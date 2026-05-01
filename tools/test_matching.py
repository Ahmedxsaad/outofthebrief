#!/usr/bin/env python3
"""Test: find best band count where sine/noise fail but real clips pass."""
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample

SR = 22050; FFT = 1024; HOP = 512
MIN_BIN = int(200 / (SR / FFT)); MAX_BIN = int(5000 / (SR / FFT))

def load(p):
    sr, d = wavfile.read(p)
    if d.dtype == np.int16: d = d.astype(np.float32) / 32768.0
    elif d.dtype == np.int32: d = d.astype(np.float32) / 2147483648.0
    if d.ndim > 1: d = d.mean(axis=1)
    if sr != SR: d = resample(d, int(len(d) * SR / sr))
    return d.astype(np.float32)

def fp(samples, bands):
    window = 0.5 * (1 - np.cos(2 * np.pi * np.arange(FFT) / (FFT - 1)))
    spec = [np.abs(np.fft.rfft(samples[s:s+FFT] * window))[:FFT//2]
            for s in range(0, len(samples)-FFT, HOP)]
    bs = max(1, (MAX_BIN - MIN_BIN) // bands)
    peaks = []
    for t, f in enumerate(spec):
        for band in range(bands):
            s = MIN_BIN + band * bs; e = min(s + bs, MAX_BIN, len(f))
            if s >= e: continue
            idx = int(np.argmax(f[s:e])) + s
            if f[idx] > 0.001: peaks.append((t, idx, float(f[idx])))
    peaks.sort(key=lambda p: -p[2])
    peaks = peaks[:min(len(peaks), len(spec)*3)]
    peaks.sort(key=lambda p: p[0])
    hashes = []
    for i, (t1,b1,_) in enumerate(peaks):
        paired = 0
        for j in range(i+1, len(peaks)):
            t2,b2,_ = peaks[j]; dt = t2-t1
            if dt < 1: continue
            if dt > 10: break
            hashes.append((f'{b1}|{b2}|{dt}', t1)); paired += 1
            if paired >= 15: break
    return hashes

def match(ref_fps, query):
    ht = {}
    for tidx, hashes in enumerate(ref_fps):
        for h, t in hashes:
            if h not in ht: ht[h] = []
            ht[h].append((tidx, t))
    th, td = {}, {}
    for qh, qt in query:
        if qh in ht:
            for tidx, rt in ht[qh]:
                if tidx not in th: th[tidx] = 0; td[tidx] = {}
                th[tidx] += 1
                rd = round(rt - qt)
                td[tidx][rd] = td[tidx].get(rd, 0) + 1
    best = -1; bh = 0; bc = 0
    for tidx, hits in th.items():
        c = max(td[tidx].values())
        if c > bc: best = tidx; bh = hits; bc = c
    return best, bh, bc

files = [
    ('assets/reference-audio/tunisie_telecom_1.wav', 'TT1'),
    ('assets/reference-audio/tunisie_telecom_2.wav', 'TT2'),
    ('assets/reference-audio/tunisie_telecom_3.wav', 'TT3'),
    ('assets/reference-audio/tunisie_telecom_4.wav', 'TT4'),
    ('assets/reference-audio/mosaique_fm_1.wav', 'MFM'),
]
refs = [(load(f), n) for f, n in files]

sine = (0.3*np.sin(2*np.pi*440*np.arange(SR*5)/SR)).astype(np.float32)
noise = (np.random.randn(SR*5)*0.1).astype(np.float32)

for bands in [6, 12, 20, 30]:
    ref_fps = [fp(r[:SR*60], bands) for r, _ in refs]
    
    # Noise
    nq = fp(noise, bands); _, _, nc = match(ref_fps, nq)
    # Sine
    sq = fp(sine, bands); _, _, sc = match(ref_fps, sq)
    # Real TT1
    mid = len(refs[0][0])//2; clip = refs[0][0][mid:mid+SR*5].copy()
    clip += (np.random.randn(len(clip))*0.05).astype(np.float32)
    cq = fp(clip, bands); ct, ch, cc = match(ref_fps, cq)
    # Real MFM
    mid = len(refs[4][0])//2; clip2 = refs[4][0][mid:mid+SR*5].copy()
    clip2 += (np.random.randn(len(clip2))*0.1).astype(np.float32)
    cq2 = fp(clip2, bands); ct2, _, cc2 = match(ref_fps, cq2)
    
    min_real = min(cc, cc2)
    max_fake = max(nc, sc)
    gap = min_real / max(max_fake, 1)
    
    print(f"B={bands:2d}: noise_coh={nc:4d} sine_coh={sc:4d} TT1_coh={cc:5d} MFM_coh={cc2:5d} "
          f"ratio={gap:.1f}x  threshold_range=[{max_fake+1}..{min_real-1}]")
