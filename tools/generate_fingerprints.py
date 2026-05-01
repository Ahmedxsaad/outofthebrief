#!/usr/bin/env python3
"""
NEXUS Fingerprint Generator v6 (FINAL)
B=6, Q=1 (exact bins), no fuzzy. Browser threshold=200.
"""
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample
import json, os

SR = 22050; FFT = 1024; HOP = 512; BANDS = 6
MIN_BIN = int(200 / (SR / FFT)); MAX_BIN = int(5000 / (SR / FFT))

def load_audio(path):
    sr, data = wavfile.read(path)
    if data.dtype == np.int16: data = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32: data = data.astype(np.float32) / 2147483648.0
    elif data.dtype == np.float64: data = data.astype(np.float32)
    if data.ndim > 1: data = data.mean(axis=1)
    if sr != SR: data = resample(data, int(len(data) * SR / sr))
    return data.astype(np.float32)

def process_file(path, name, brand):
    print(f"  {os.path.basename(path)}")
    samples = load_audio(path)[:SR * 60]
    dur = len(samples) / SR
    window = 0.5 * (1 - np.cos(2 * np.pi * np.arange(FFT) / (FFT - 1)))
    spec = []
    for s in range(0, len(samples) - FFT, HOP):
        mags = np.abs(np.fft.rfft(samples[s:s+FFT] * window))[:FFT // 2]
        spec.append(mags)

    band_size = max(1, (MAX_BIN - MIN_BIN) // BANDS)
    peaks = []
    for t, frame in enumerate(spec):
        for band in range(BANDS):
            s = MIN_BIN + band * band_size
            e = min(s + band_size, MAX_BIN, len(frame))
            if s >= e: continue
            region = frame[s:e]
            idx = int(np.argmax(region)) + s
            val = float(frame[idx])
            if val > 0.001:
                peaks.append((t, idx, val))

    peaks.sort(key=lambda p: -p[2])
    peaks = peaks[:min(len(peaks), len(spec) * 3)]
    peaks.sort(key=lambda p: p[0])

    hashes = []
    for i, (t1, b1, _) in enumerate(peaks):
        paired = 0
        for j in range(i + 1, len(peaks)):
            t2, b2, _ = peaks[j]
            dt = t2 - t1
            if dt < 1: continue
            if dt > 10: break
            hashes.append({'hash': f'{b1}|{b2}|{dt}', 'time': t1})
            paired += 1
            if paired >= 15: break

    print(f"    {dur:.1f}s | {len(spec)} frames | {len(peaks)} peaks | {len(hashes)} hashes")
    return {
        'name': name, 'brand': brand, 'duration': round(dur, 1),
        'hashes': hashes, 'peakCount': len(peaks), 'hashCount': len(hashes)
    }

def main():
    files = [
        ('tunisie_telecom_1.wav', 'Tunisie Telecom — Pub 1', 'Tunisie Telecom'),
        ('tunisie_telecom_2.wav', 'Tunisie Telecom — Pub 2', 'Tunisie Telecom'),
        ('tunisie_telecom_3.wav', 'Tunisie Telecom — Pub 3', 'Tunisie Telecom'),
        ('tunisie_telecom_4.wav', 'Tunisie Telecom — Pub 4', 'Tunisie Telecom'),
        ('mosaique_fm_1.wav',     'Mosaique FM — Spot',      'Mosaique FM'),
    ]
    fps = []
    for fn, name, brand in files:
        p = f'assets/reference-audio/{fn}'
        if os.path.exists(p): fps.append(process_file(p, name, brand))

    payload = json.dumps({
        'version': 6, 'sampleRate': SR, 'fftSize': FFT, 'hopSize': HOP,
        'minBin': MIN_BIN, 'maxBin': MAX_BIN, 'numBands': BANDS,
        'fingerprints': fps
    })
    with open('assets/fingerprints.js', 'w') as f:
        f.write(f'window.FINGERPRINT_DB = {payload};\n')
    total_h = sum(fp['hashCount'] for fp in fps)
    uniq = len(set(h['hash'] for fp in fps for h in fp['hashes']))
    print(f"\n✓ {len(fps)} tracks | {total_h} hashes | {uniq} unique")

if __name__ == '__main__':
    main()
