/* NEXUS — Demo App v3: Car/Person Detection + Audio Fingerprinting + Telecom */

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
const state = {
  vision: { active: false, model: null, counts: {}, totalImpressions: 0, lastFrameTime: 0 },
  audio: { active: false, analyser: null, matches: 0, lastBrand: null, db: null },
  telecom: { density: 4821, ci: 14.2 },
  unified: { ooh: 0, audio: 0, total: 0 }
};

// Detection targets — COCO-SSD classes
const DETECT_CLASSES = ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle'];
const CLASS_COLORS = {
  person: '#6B2BFF', car: '#22c55e', truck: '#fbbf24',
  bus: '#f97316', motorcycle: '#ec4899', bicycle: '#06b6d4'
};

// ═══════════════════════════════════════════════════════════════
// LOAD FINGERPRINT DATABASE
// ═══════════════════════════════════════════════════════════════
function loadFingerprintDB() {
  const data = window.FINGERPRINT_DB;
  if (!data) {
    console.error('FINGERPRINT_DB not found');
    document.getElementById('db-status').textContent = 'DB not found';
    document.getElementById('db-status').style.color = '#ef4444';
    return;
  }
  const hashTable = {};
  data.fingerprints.forEach((fp, trackIdx) => {
    fp.hashes.forEach(h => {
      if (!hashTable[h.hash]) hashTable[h.hash] = [];
      hashTable[h.hash].push({ trackIdx, time: h.time });
    });
  });
  state.audio.db = { tracks: data.fingerprints, hashTable, config: data };
  const uniqs = Object.keys(hashTable).length;
  console.log(`✓ Fingerprint DB: ${data.fingerprints.length} tracks, ${uniqs} unique hashes`);
  document.getElementById('db-status').textContent = `${data.fingerprints.length} tracks loaded`;
  document.getElementById('db-status').style.color = '#22c55e';
}
loadFingerprintDB();

// ═══════════════════════════════════════════════════════════════
// COMPONENT A: VISION — Cars, People, Vehicles (COCO-SSD)
// ═══════════════════════════════════════════════════════════════
async function startVision() {
  const btn = document.getElementById('start-vision');
  const status = document.getElementById('vision-status');
  const placeholder = document.getElementById('camera-placeholder');
  const video = document.getElementById('camera-video');
  const overlay = document.getElementById('camera-overlay');

  if (state.vision.active) { stopVision(); return; }

  btn.textContent = 'Loading Model...';
  btn.disabled = true;
  status.textContent = 'Loading'; status.className = 'demo-panel-status active';

  try {
    if (!state.vision.model) {
      state.vision.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' }
    });
    video.srcObject = stream;
    await video.play();
    placeholder.style.display = 'none';
    video.style.display = 'block';
    overlay.style.display = 'block';
    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
    state.vision.active = true;
    status.textContent = 'Detecting'; status.className = 'demo-panel-status detecting';
    btn.style.display = 'none';
    detectFrame();
  } catch (err) {
    console.error('Vision error:', err);
    btn.textContent = 'Start Detection'; btn.disabled = false;
    status.textContent = 'Error'; status.className = 'demo-panel-status idle';
    alert('Camera access denied or model load failed: ' + err.message);
  }
}

function stopVision() {
  state.vision.active = false;
  const video = document.getElementById('camera-video');
  if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
  document.getElementById('vision-status').textContent = 'Idle';
  document.getElementById('vision-status').className = 'demo-panel-status idle';
  const btn = document.getElementById('start-vision');
  btn.style.display = ''; btn.textContent = 'Start Detection'; btn.disabled = false;
}

async function detectFrame() {
  if (!state.vision.active) return;
  const video = document.getElementById('camera-video');
  const overlay = document.getElementById('camera-overlay');
  const ctx = overlay.getContext('2d');
  const now = performance.now();

  try {
    const predictions = await state.vision.model.detect(video);
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const frameCounts = {};
    DETECT_CLASSES.forEach(c => frameCounts[c] = 0);

    predictions.forEach(pred => {
      if (DETECT_CLASSES.includes(pred.class) && pred.score > 0.35) {
        frameCounts[pred.class]++;
        const [x, y, w, h] = pred.bbox;
        const color = CLASS_COLORS[pred.class] || '#6B2BFF';

        // Bounding box
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        // Corner accents
        const cl = 14; ctx.lineWidth = 3; ctx.strokeStyle = color;
        ctx.beginPath(); ctx.moveTo(x,y+cl); ctx.lineTo(x,y); ctx.lineTo(x+cl,y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+w-cl,y); ctx.lineTo(x+w,y); ctx.lineTo(x+w,y+cl); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x,y+h-cl); ctx.lineTo(x,y+h); ctx.lineTo(x+cl,y+h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+w-cl,y+h); ctx.lineTo(x+w,y+h); ctx.lineTo(x+w,y+h-cl); ctx.stroke();

        // Label
        const label = `${pred.class.toUpperCase()} ${(pred.score*100).toFixed(0)}%`;
        const tw = ctx.measureText(label).width + 12;
        ctx.fillStyle = color + 'DD';
        ctx.fillRect(x, y - 22, tw, 20);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px DM Sans, sans-serif';
        ctx.fillText(label, x + 6, y - 6);
      }
    });

    // Scan line effect
    const scanY = (now * 0.12) % overlay.height;
    const sg = ctx.createLinearGradient(0, scanY - 12, 0, scanY + 4);
    sg.addColorStop(0, 'rgba(107,43,255,0)');
    sg.addColorStop(1, 'rgba(107,43,255,0.06)');
    ctx.fillStyle = sg; ctx.fillRect(0, scanY - 12, overlay.width, 16);

    // Update counts
    state.vision.counts = frameCounts;
    const frameTotal = Object.values(frameCounts).reduce((a, b) => a + b, 0);
    state.vision.totalImpressions += frameTotal;
    state.unified.ooh = state.vision.totalImpressions;

    const fps = state.vision.lastFrameTime ? Math.round(1000 / (now - state.vision.lastFrameTime)) : 0;
    state.vision.lastFrameTime = now;

    // Update stats display
    const cars = (frameCounts.car || 0) + (frameCounts.truck || 0) + (frameCounts.bus || 0);
    const people = frameCounts.person || 0;
    const moto = (frameCounts.motorcycle || 0) + (frameCounts.bicycle || 0);

    document.getElementById('vision-cars').textContent = cars;
    document.getElementById('vision-people').textContent = people;
    document.getElementById('vision-total').textContent = state.vision.totalImpressions.toLocaleString();
    document.getElementById('vision-fps').textContent = fps;

    // Update breakdown
    const bd = document.getElementById('vision-breakdown');
    if (bd && frameTotal > 0) {
      bd.innerHTML = Object.entries(frameCounts)
        .filter(([_, v]) => v > 0)
        .map(([cls, v]) => `<span style="color:${CLASS_COLORS[cls]};margin-right:8px">${cls}: ${v}</span>`)
        .join('');
    } else if (bd) {
      bd.innerHTML = '<span style="color:#444">Waiting for objects...</span>';
    }
  } catch (err) { console.error('Detection error:', err); }
  requestAnimationFrame(detectFrame);
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT B: AUDIO FINGERPRINTING (exact bins + fuzzy matching)
// ═══════════════════════════════════════════════════════════════
const A_SR = 22050;
const A_FFT = 1024;
const A_HOP = 512;
const A_MIN_BIN = Math.floor(200 / (A_SR / A_FFT));
const A_MAX_BIN = Math.floor(5000 / (A_SR / A_FFT));
const A_BANDS = 6;
const COHERENCE_THRESHOLD = 200; // tested: noise≤98, real≥963
let audioAnimFrame = null;

async function startAudioCapture() {
  const btn = document.getElementById('start-audio');
  const status = document.getElementById('audio-status');
  const matchArea = document.getElementById('audio-match-area');

  if (!state.audio.db) {
    matchArea.innerHTML = '<div style="color:#ef4444;font-size:12px;padding:8px">DB not loaded</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = '🎤 Listening...';
  status.textContent = 'Listening'; status.className = 'demo-panel-status active';
  matchArea.innerHTML = '<div class="audio-listening">Capturing 5-second audio sample <div class="listen-dots"><span></span><span></span><span></span></div></div>';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);

    const bufferSize = 4096;
    const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    const capturedSamples = [];

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    source.connect(processor);
    processor.connect(audioCtx.destination);

    state.audio.analyser = analyser;
    const waveCanvas = document.getElementById('audio-waveform');
    waveCanvas.width = waveCanvas.offsetWidth; waveCanvas.height = 80;
    drawWaveform(waveCanvas);

    processor.onaudioprocess = (e) => {
      capturedSamples.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    setTimeout(() => {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(audioAnimFrame);

      const totalLen = capturedSamples.reduce((a, b) => a + b.length, 0);
      const fullAudio = new Float32Array(totalLen);
      let offset = 0;
      capturedSamples.forEach(chunk => { fullAudio.set(chunk, offset); offset += chunk.length; });

      const downsampled = downsample(fullAudio, audioCtx.sampleRate, A_SR);
      console.log(`Captured ${totalLen} @ ${audioCtx.sampleRate}Hz → ${downsampled.length} @ ${A_SR}Hz`);

      // Reject silence
      let energy = 0;
      for (let i = 0; i < downsampled.length; i++) energy += downsampled[i] * downsampled[i];
      energy /= downsampled.length;
      console.log(`Audio energy: ${energy.toFixed(6)}`);

      if (energy < 0.0001) {
        status.textContent = 'No Audio'; status.className = 'demo-panel-status idle';
        matchArea.innerHTML = '<div class="audio-match-result"><div style="font-size:28px;margin-bottom:8px">🔇</div><div style="font-size:14px;color:#888">No audio detected</div><div style="font-size:10px;color:#555;margin-top:6px">Play a reference ad and try again</div></div>';
        btn.disabled = false; btn.textContent = '🎤 Listen Again';
        audioCtx.close();
        return;
      }

      status.textContent = 'Matching...'; status.className = 'demo-panel-status active';
      matchArea.innerHTML = '<div style="color:#6B2BFF;font-size:11px;text-align:center;padding:8px">Analyzing fingerprint...</div>';

      setTimeout(() => {
        const result = matchAudio(downsampled);
        displayResult(result, matchArea, btn, status);
        audioCtx.close();
      }, 50);

    }, 5000);

  } catch (err) {
    console.error('Audio error:', err);
    btn.disabled = false; btn.textContent = '🎤 Listen for Broadcast';
    status.textContent = 'Error';
    matchArea.innerHTML = '<div style="color:#ef4444;font-size:11px">Microphone access denied</div>';
  }
}

function downsample(buf, fromRate, toRate) {
  if (fromRate === toRate) return buf;
  const ratio = fromRate / toRate;
  const newLen = Math.floor(buf.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) out[i] = buf[Math.floor(i * ratio)];
  return out;
}

function matchAudio(samples) {
  const hann = new Float32Array(A_FFT);
  for (let i = 0; i < A_FFT; i++) hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (A_FFT - 1)));

  const spec = [];
  for (let start = 0; start + A_FFT <= samples.length; start += A_HOP) {
    const frame = new Float32Array(A_FFT);
    for (let i = 0; i < A_FFT; i++) frame[i] = samples[start + i] * hann[i];
    const real = new Float32Array(A_FFT);
    const imag = new Float32Array(A_FFT);
    for (let i = 0; i < A_FFT; i++) { real[i] = frame[i]; imag[i] = 0; }
    fftInPlace(real, imag);
    const mags = new Float32Array(A_FFT / 2);
    for (let i = 0; i < A_FFT / 2; i++) mags[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    spec.push(mags);
  }

  // Band-based peaks — exact bins, no quantization
  const bandSize = Math.max(1, Math.floor((A_MAX_BIN - A_MIN_BIN) / A_BANDS));
  let peaks = [];
  for (let t = 0; t < spec.length; t++) {
    const frame = spec[t];
    for (let band = 0; band < A_BANDS; band++) {
      const s = A_MIN_BIN + band * bandSize;
      const e = Math.min(s + bandSize, A_MAX_BIN);
      let maxVal = 0, maxIdx = s;
      for (let b = s; b < e && b < frame.length; b++) {
        if (frame[b] > maxVal) { maxVal = frame[b]; maxIdx = b; }
      }
      if (maxVal > 0.001) peaks.push({ t, bin: maxIdx, mag: maxVal });
    }
  }
  peaks.sort((a, b) => b.mag - a.mag);
  peaks = peaks.slice(0, Math.min(peaks.length, spec.length * 3));
  peaks.sort((a, b) => a.t - b.t);

  // Generate hashes (exact bins)
  const queryHashes = [];
  for (let i = 0; i < peaks.length; i++) {
    let paired = 0;
    for (let j = i + 1; j < peaks.length && paired < 15; j++) {
      const dt = peaks[j].t - peaks[i].t;
      if (dt < 1) continue;
      if (dt > 10) break;
      queryHashes.push({ hash: `${peaks[i].bin}|${peaks[j].bin}|${dt}`, time: peaks[i].t });
      paired++;
    }
  }

  console.log(`Query: ${spec.length} frames, ${peaks.length} peaks, ${queryHashes.length} hashes`);

  // EXACT hash lookup — no fuzzy matching
  const db = state.audio.db;
  const trackHits = {};
  const trackDeltas = {};

  queryHashes.forEach(qh => {
    const matches = db.hashTable[qh.hash];
    if (matches) {
      matches.forEach(m => {
        const k = m.trackIdx;
        if (!trackHits[k]) { trackHits[k] = 0; trackDeltas[k] = {}; }
        trackHits[k]++;
        const rd = Math.round(m.time - qh.time);
        trackDeltas[k][rd] = (trackDeltas[k][rd] || 0) + 1;
      });
    }
  });

  // Best by coherence (time-aligned hits count)
  let bestTrack = -1, bestHits = 0, bestCoherence = 0;
  Object.entries(trackHits).forEach(([idx, hits]) => {
    const maxCoh = Math.max(...Object.values(trackDeltas[idx]));
    if (maxCoh > bestCoherence) {
      bestTrack = parseInt(idx); bestHits = hits; bestCoherence = maxCoh;
    }
  });

  console.log(`Best: track=${bestTrack}, hits=${bestHits}, coherence=${bestCoherence}, threshold=${COHERENCE_THRESHOLD}`);

  if (bestTrack >= 0 && bestCoherence >= COHERENCE_THRESHOLD) {
    const track = db.tracks[bestTrack];
    const confidence = Math.min(99, Math.max(65, Math.round(65 + Math.log10(bestCoherence / COHERENCE_THRESHOLD) * 30)));
    return {
      matched: true, track: track.name, brand: track.brand,
      confidence, hits: bestHits, coherence: bestCoherence, totalHashes: queryHashes.length
    };
  }
  return { matched: false, totalHashes: queryHashes.length, bestHits, bestCoherence };
}

// Cooley-Tukey FFT (in-place, radix-2)
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

function displayResult(result, area, btn, status) {
  if (result.matched) {
    state.audio.matches++;
    state.audio.lastBrand = result.brand;
    state.unified.audio = state.audio.matches;
    document.getElementById('audio-matches').textContent = state.audio.matches;
    document.getElementById('audio-channel').textContent = result.brand;
    document.getElementById('audio-confidence').textContent = result.confidence + '%';
    status.textContent = 'Matched!'; status.className = 'demo-panel-status detecting';
    const icon = result.brand === 'Mosaique FM' ? '📻' : '📡';
    area.innerHTML = `<div class="audio-match-result">
      <div style="font-size:28px;margin-bottom:8px">${icon}</div>
      <div class="audio-match-channel">${result.track}</div>
      <div style="font-size:12px;color:#888;margin-bottom:6px">${result.brand}</div>
      <div class="audio-match-confidence">✓ Match — ${result.confidence}% confidence</div>
      <div style="font-size:9px;color:#444;margin-top:8px">${result.hits} hits · ${result.coherence} coherent · ${result.totalHashes} query hashes</div>
    </div>`;
    const u = document.getElementById('unified-audio-channel');
    if (u) u.textContent = result.brand;
  } else {
    status.textContent = 'No Match'; status.className = 'demo-panel-status idle';
    area.innerHTML = `<div class="audio-match-result">
      <div style="font-size:28px;margin-bottom:8px">🔍</div>
      <div style="font-size:14px;color:#888">No match found</div>
      <div style="font-size:10px;color:#555;margin-top:6px">Play a reference ad louder/closer to the mic and try again</div>
      <div style="font-size:9px;color:#333;margin-top:4px">${result.totalHashes} hashes · best: ${result.bestHits || 0} hits, ${result.bestCoherence || 0} coherent</div>
    </div>`;
  }
  btn.disabled = false; btn.textContent = '🎤 Listen Again';
}

function drawWaveform(canvas) {
  if (!state.audio.analyser) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const a = state.audio.analyser;
  const d = new Uint8Array(a.frequencyBinCount);
  a.getByteTimeDomainData(d);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(14,14,18,0.3)'; ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  const sw = W / d.length;
  for (let i = 0, x = 0; i < d.length; i++, x += sw) {
    const y = (d[i] / 128.0) * H / 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#6B2BFF'; ctx.lineWidth = 1.5; ctx.stroke();
  audioAnimFrame = requestAnimationFrame(() => drawWaveform(canvas));
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT C: TELECOM DENSITY
// ═══════════════════════════════════════════════════════════════
const telecomSectors = [
  { name: 'Tunis Centre', capacity: 87, ci: 12.4 },
  { name: 'Ariana', capacity: 72, ci: 18.1 },
  { name: 'La Marsa', capacity: 45, ci: 24.6 },
  { name: 'Menzah', capacity: 91, ci: 8.2 },
];

function initTelecomDemo() {
  NexusMap.create('telecom-map', {
    bg: '#0a0a0e', grid: 28,
    hotspots: [
      {x:0.35,y:0.4,r:24,c:'107,43,255'}, {x:0.65,y:0.3,r:16,c:'139,92,246'},
      {x:0.25,y:0.6,r:20,c:'107,43,255'}, {x:0.7,y:0.6,r:12,c:'139,92,246'}
    ]
  });
  const c = document.getElementById('telecom-demo-sectors');
  if (!c) return;
  telecomSectors.forEach(s => {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:10px';
    r.innerHTML = `<span style="color:#666;width:80px">${s.name}</span>
      <div style="flex:1;height:3px;background:rgba(255,255,255,0.04);border-radius:2px;margin:0 8px;overflow:hidden">
        <div class="tsf" style="height:100%;width:${s.capacity}%;background:linear-gradient(90deg,#6B2BFF,#8B5CF6);border-radius:2px;transition:width 0.6s"></div>
      </div><span class="tsp" style="color:#555;width:28px;text-align:right">${s.capacity}%</span>`;
    c.appendChild(r);
  });
}
setTimeout(initTelecomDemo, 300);

setInterval(() => {
  let td = 0, tc = 0;
  telecomSectors.forEach(s => {
    s.capacity = Math.max(25, Math.min(98, s.capacity + (Math.random() - 0.45) * 6));
    s.ci = Math.max(5, Math.min(30, s.ci + (Math.random() - 0.5) * 2));
    td += Math.round(s.capacity * 55); tc += s.ci;
  });
  state.telecom.density = td; state.telecom.ci = (tc / telecomSectors.length).toFixed(1);
  document.querySelectorAll('.tsf').forEach((f, i) => { if (telecomSectors[i]) f.style.width = Math.round(telecomSectors[i].capacity) + '%'; });
  document.querySelectorAll('.tsp').forEach((p, i) => { if (telecomSectors[i]) p.textContent = Math.round(telecomSectors[i].capacity) + '%'; });
  document.getElementById('telecom-density').textContent = td.toLocaleString();
  document.getElementById('telecom-ci').textContent = state.telecom.ci;
}, 2500);

// ═══════════════════════════════════════════════════════════════
// UNIFIED DASHBOARD
// ═══════════════════════════════════════════════════════════════
setInterval(() => {
  state.unified.total = state.unified.ooh + state.unified.audio + Math.round(state.telecom.density / 100);
  const m = {
    'unified-ooh': state.unified.ooh.toLocaleString(), 'unified-audio': state.unified.audio,
    'unified-telecom': state.telecom.density.toLocaleString(), 'unified-total': state.unified.total.toLocaleString()
  };
  Object.entries(m).forEach(([id, v]) => { const e = document.getElementById(id); if (e) e.textContent = v; });
  const r = document.getElementById('unified-ooh-rate');
  if (r) r.textContent = state.vision.active ? (state.vision.counts.car || 0) + ' cars/frame' : '0/min';
  const c = document.getElementById('unified-telecom-ci');
  if (c) c.textContent = 'C/I: ' + state.telecom.ci;
}, 500);

// Idle waveform
(function () {
  const c = document.getElementById('audio-waveform');
  if (!c) return; c.width = c.offsetWidth; c.height = 80;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(107,43,255,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 40);
  for (let x = 0; x < c.width; x++) ctx.lineTo(x, 40 + Math.sin(x * 0.05) * 3);
  ctx.stroke();
})();

window.startVision = startVision;
window.startAudioCapture = startAudioCapture;
