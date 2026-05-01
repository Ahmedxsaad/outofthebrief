/* Client-side audio fingerprinting.
 *
 * Mirrors core/fingerprint.py — any change to constants or algorithm here
 * MUST be reflected in core/config.py and core/fingerprint.py.
 *
 * Pipeline: raw samples → log-magnitude STFT → adaptive-threshold
 * local-max peaks → constellation hashes (anchor-target pairs).
 * Output: array of { hash, time } sent verbatim to POST /api/match.
 */
const FP_CONFIG = Object.freeze({
  SR: 22050,
  FFT: 2048,                              // 93 ms window, 10.7 Hz/bin
  HOP: 512,                               // 23 ms hop
  MIN_BIN: Math.floor(300  * 2048 / 22050), // 27
  MAX_BIN: Math.floor(8000 * 2048 / 22050), // 743
  PEAKS_PER_FRAME: 10,
  LOCAL_MAX_R: 3,
  THRESH_K: 0.5,
  FAN_OUT: 5,
  T_MIN: 2,
  T_MAX: 100,
  FREQ_QUANT: 2,
});

// ── DSP helpers ───────────────────────────────────────────────────────────

function _hann(n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
  return out;
}

/** Cooley–Tukey radix-2 FFT, in-place. `real` and `imag` length must be a power of 2. */
function fftInPlace(real, imag) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wR = Math.cos(ang), wI = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cR = 1, cI = 0;
      for (let j = 0; j < len / 2; j++) {
        const k = i + j + len / 2;
        const tR = cR * real[k] - cI * imag[k];
        const tI = cR * imag[k] + cI * real[k];
        real[k] = real[i + j] - tR; imag[k] = imag[i + j] - tI;
        real[i + j] += tR; imag[i + j] += tI;
        const nR = cR * wR - cI * wI; cI = cR * wI + cI * wR; cR = nR;
      }
    }
  }
}

/** Anti-aliased downsample by simple block-averaging. */
function downsample(buf, fromRate, toRate) {
  if (fromRate === toRate) return buf;
  const ratio = fromRate / toRate;
  const newLen = Math.floor(buf.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const s = Math.floor(i * ratio);
    const e = Math.floor((i + 1) * ratio);
    let sum = 0, n = 0;
    for (let k = s; k < e && k < buf.length; k++) { sum += buf[k]; n++; }
    out[i] = n ? sum / n : 0;
  }
  return out;
}

function _meanStd(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  const mean = s / arr.length;
  let v = 0;
  for (let i = 0; i < arr.length; i++) { const d = arr[i] - mean; v += d * d; }
  return { mean, std: Math.sqrt(v / arr.length) };
}

// ── Pipeline ──────────────────────────────────────────────────────────────

/** samples (Float32Array @ FP_CONFIG.SR) → array of { hash, time }. */
function computeFingerprint(samples, cfg = FP_CONFIG) {
  const window = _hann(cfg.FFT);
  const binCount = cfg.MAX_BIN - cfg.MIN_BIN;
  const frames = [];

  for (let start = 0; start + cfg.FFT <= samples.length; start += cfg.HOP) {
    const real = new Float32Array(cfg.FFT);
    const imag = new Float32Array(cfg.FFT);
    for (let i = 0; i < cfg.FFT; i++) real[i] = samples[start + i] * window[i];
    fftInPlace(real, imag);
    const logMags = new Float32Array(binCount);
    for (let b = 0; b < binCount; b++) {
      const idx = b + cfg.MIN_BIN;
      const mag = Math.sqrt(real[idx] * real[idx] + imag[idx] * imag[idx]);
      logMags[b] = Math.log1p(mag * 100);
    }
    frames.push(logMags);
  }

  // Peak extraction: per-frame adaptive threshold + local-max in frequency
  const peaks = [];
  for (let t = 0; t < frames.length; t++) {
    const frame = frames[t];
    const { mean, std } = _meanStd(frame);
    const thresh = mean + cfg.THRESH_K * std;
    const candidates = [];
    for (let i = cfg.LOCAL_MAX_R; i < frame.length - cfg.LOCAL_MAX_R; i++) {
      const v = frame[i];
      if (v < thresh) continue;
      let isMax = true;
      for (let di = -cfg.LOCAL_MAX_R; di <= cfg.LOCAL_MAX_R && isMax; di++) {
        if (di !== 0 && frame[i + di] > v) isMax = false;
      }
      if (isMax) candidates.push({ mag: v, bin: i + cfg.MIN_BIN });
    }
    candidates.sort((a, b) => b.mag - a.mag);
    for (const p of candidates.slice(0, cfg.PEAKS_PER_FRAME)) peaks.push({ t, bin: p.bin });
  }

  // Constellation hashing: each anchor → FAN_OUT target peaks
  const hashes = [];
  for (let i = 0; i < peaks.length; i++) {
    let paired = 0;
    for (let j = i + 1; j < peaks.length && paired < cfg.FAN_OUT; j++) {
      const dt = peaks[j].t - peaks[i].t;
      if (dt < cfg.T_MIN) continue;
      if (dt > cfg.T_MAX) break;
      const qb1 = Math.floor(peaks[i].bin / cfg.FREQ_QUANT) * cfg.FREQ_QUANT;
      const qb2 = Math.floor(peaks[j].bin / cfg.FREQ_QUANT) * cfg.FREQ_QUANT;
      hashes.push({ hash: `${qb1}|${qb2}|${dt}`, time: peaks[i].t });
      paired++;
    }
  }
  return { hashes, frameCount: frames.length, peakCount: peaks.length };
}

window.NexusFingerprint = { compute: computeFingerprint, downsample, SR: FP_CONFIG.SR };
