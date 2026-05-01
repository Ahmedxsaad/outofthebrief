/* NEXUS demo page.
 *
 * Three live components, each with one well-defined source of truth:
 *   A. Vision        — TF.js COCO-SSD running in-browser. Reports impressions
 *                      to the backend so the dashboard sees the same count.
 *   B. Audio match   — Mic capture → client-side DSP (NexusFingerprint) →
 *                      POST /api/match → backend matches against the indexed DB.
 *   C. Telecom       — Static config served from /api/telecom/sectors.
 *                      Replace with operator NMS feed when available.
 */

// ── State (no fake counters) ──────────────────────────────────────────────
const state = {
  vision:  { active: false, model: null, counts: {}, totalImpressions: 0, lastFrameTime: 0 },
  audio:   { matches: 0, lastBrand: null, analyser: null, dbReady: false },
  clientId: 'demo_' + Math.random().toString(36).slice(2, 10),
};

const DETECT_CLASSES = ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle'];
const CLASS_COLORS = {
  person: '#6B2BFF', car: '#22c55e', truck: '#fbbf24',
  bus: '#f97316', motorcycle: '#ec4899', bicycle: '#06b6d4',
};

const COHERENCE_THRESHOLD = 8;   // mirror backend; used only for UI text

// ═══ DB STATUS ════════════════════════════════════════════════════════════
async function refreshDBStatus() {
  const el = document.getElementById('db-status');
  if (!el) return;
  try {
    const data = await NexusAPI.listTracks();
    state.audio.dbReady = data.tracks.length > 0;
    el.textContent = `${data.tracks.length} tracks · ${data.unique_hashes.toLocaleString()} hashes`;
    el.style.color = state.audio.dbReady ? '#22c55e' : '#fbbf24';
  } catch (e) {
    console.error('DB status error', e);
    el.textContent = 'API unavailable';
    el.style.color = '#ef4444';
  }
}
refreshDBStatus();

// ═══ A. VISION ════════════════════════════════════════════════════════════
async function startVision() {
  const btn = document.getElementById('start-vision');
  const status = document.getElementById('vision-status');
  const placeholder = document.getElementById('camera-placeholder');
  const video = document.getElementById('camera-video');
  const overlay = document.getElementById('camera-overlay');

  if (state.vision.active) { stopVision(); return; }

  btn.textContent = 'Loading Model...'; btn.disabled = true;
  status.textContent = 'Loading'; status.className = 'demo-panel-status active';

  try {
    if (!state.vision.model) {
      state.vision.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
    });
    video.srcObject = stream; await video.play();
    placeholder.style.display = 'none';
    video.style.display = 'block'; overlay.style.display = 'block';
    overlay.width  = video.videoWidth  || 640;
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

    const frameCounts = Object.fromEntries(DETECT_CLASSES.map(c => [c, 0]));

    for (const pred of predictions) {
      if (!DETECT_CLASSES.includes(pred.class) || pred.score <= 0.35) continue;
      frameCounts[pred.class]++;
      const [x, y, w, h] = pred.bbox;
      const color = CLASS_COLORS[pred.class] || '#6B2BFF';
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      const cl = 14; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x,y+cl); ctx.lineTo(x,y); ctx.lineTo(x+cl,y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+w-cl,y); ctx.lineTo(x+w,y); ctx.lineTo(x+w,y+cl); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,y+h-cl); ctx.lineTo(x,y+h); ctx.lineTo(x+cl,y+h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+w-cl,y+h); ctx.lineTo(x+w,y+h); ctx.lineTo(x+w,y+h-cl); ctx.stroke();
      const label = `${pred.class.toUpperCase()} ${(pred.score*100).toFixed(0)}%`;
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = color + 'DD'; ctx.fillRect(x, y - 22, tw, 20);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px DM Sans, sans-serif';
      ctx.fillText(label, x + 6, y - 6);
    }

    // Scan-line FX
    const scanY = (now * 0.12) % overlay.height;
    const sg = ctx.createLinearGradient(0, scanY - 12, 0, scanY + 4);
    sg.addColorStop(0, 'rgba(107,43,255,0)');
    sg.addColorStop(1, 'rgba(107,43,255,0.06)');
    ctx.fillStyle = sg; ctx.fillRect(0, scanY - 12, overlay.width, 16);

    state.vision.counts = frameCounts;
    const frameTotal = Object.values(frameCounts).reduce((a, b) => a + b, 0);
    if (frameTotal > 0) {
      state.vision.totalImpressions += frameTotal;
      // Real impression event → backend metrics → dashboard
      NexusAPI.reportEvent('impression', frameTotal).catch(() => {});
    }

    const fps = state.vision.lastFrameTime ? Math.round(1000 / (now - state.vision.lastFrameTime)) : 0;
    state.vision.lastFrameTime = now;

    const cars   = (frameCounts.car || 0) + (frameCounts.truck || 0) + (frameCounts.bus || 0);
    const people = frameCounts.person || 0;

    document.getElementById('vision-cars').textContent   = cars;
    document.getElementById('vision-people').textContent = people;
    document.getElementById('vision-total').textContent  = state.vision.totalImpressions.toLocaleString();
    document.getElementById('vision-fps').textContent    = fps;

    const bd = document.getElementById('vision-breakdown');
    if (bd) {
      const entries = Object.entries(frameCounts).filter(([_, v]) => v > 0);
      bd.innerHTML = entries.length
        ? entries.map(([cls, v]) => `<span style="color:${CLASS_COLORS[cls]};margin-right:8px">${cls}: ${v}</span>`).join('')
        : '<span style="color:#444">Waiting for objects...</span>';
    }
  } catch (err) { console.error('Detection error:', err); }
  requestAnimationFrame(detectFrame);
}

// ═══ B. AUDIO MATCH ═══════════════════════════════════════════════════════
const A_SR        = NexusFingerprint.SR;
const CAPTURE_MS  = 2000;
let audioAnimFrame = null;

async function startAudioCapture() {
  const btn       = document.getElementById('start-audio');
  const status    = document.getElementById('audio-status');
  const matchArea = document.getElementById('audio-match-area');

  if (!state.audio.dbReady) {
    matchArea.innerHTML = '<div style="color:#ef4444;font-size:12px;padding:8px">Fingerprint DB not loaded</div>';
    return;
  }

  btn.disabled = true; btn.textContent = '🎤 Listening...';
  status.textContent = 'Listening'; status.className = 'demo-panel-status active';
  matchArea.innerHTML = '<div class="audio-listening">Capturing 2-second audio sample <div class="listen-dots"><span></span><span></span><span></span></div></div>';

  let audioCtx;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source    = audioCtx.createMediaStreamSource(stream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    const captured  = [];

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser); source.connect(processor);
    processor.connect(audioCtx.destination);

    state.audio.analyser = analyser;
    const waveCanvas = document.getElementById('audio-waveform');
    waveCanvas.width = waveCanvas.offsetWidth; waveCanvas.height = 80;
    drawWaveform(waveCanvas);

    processor.onaudioprocess = (e) => captured.push(new Float32Array(e.inputBuffer.getChannelData(0)));

    setTimeout(async () => {
      processor.disconnect(); source.disconnect();
      stream.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(audioAnimFrame);

      const total = captured.reduce((a, b) => a + b.length, 0);
      const full = new Float32Array(total);
      let off = 0;
      for (const chunk of captured) { full.set(chunk, off); off += chunk.length; }
      const samples = NexusFingerprint.downsample(full, audioCtx.sampleRate, A_SR);

      // Reject silence early — saves an API round-trip
      let energy = 0;
      for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
      energy /= samples.length;

      if (energy < 0.0001) {
        renderResult({ matched: false, silent: true }, matchArea, btn, status);
        audioCtx.close(); return;
      }

      status.textContent = 'Matching...'; status.className = 'demo-panel-status active';
      matchArea.innerHTML = '<div style="color:#6B2BFF;font-size:11px;text-align:center;padding:8px">Analyzing fingerprint...</div>';

      const { hashes, frameCount, peakCount } = NexusFingerprint.compute(samples);
      console.log(`Query: ${frameCount} frames, ${peakCount} peaks, ${hashes.length} hashes`);

      try {
        const result = await NexusAPI.matchAudio(hashes, state.clientId);
        renderResult(result, matchArea, btn, status);
      } catch (e) {
        console.error('match error', e);
        renderResult({ matched: false, error: true }, matchArea, btn, status);
      }
      audioCtx.close();
    }, CAPTURE_MS);

  } catch (err) {
    console.error('Audio error:', err);
    if (audioCtx) audioCtx.close();
    btn.disabled = false; btn.textContent = '🎤 Listen for Broadcast';
    status.textContent = 'Error';
    matchArea.innerHTML = '<div style="color:#ef4444;font-size:11px">Microphone access denied</div>';
  }
}

function renderResult(result, area, btn, status) {
  if (result.silent) {
    status.textContent = 'No Audio'; status.className = 'demo-panel-status idle';
    area.innerHTML = '<div class="audio-match-result"><div style="font-size:28px;margin-bottom:8px">🔇</div><div style="font-size:14px;color:#888">No audio detected</div><div style="font-size:10px;color:#555;margin-top:6px">Play a reference ad and try again</div></div>';
  } else if (result.error) {
    status.textContent = 'Error'; status.className = 'demo-panel-status idle';
    area.innerHTML = '<div class="audio-match-result"><div style="color:#ef4444;font-size:12px">Match request failed — check backend</div></div>';
  } else if (result.matched) {
    state.audio.matches++;
    state.audio.lastBrand = result.brand;
    document.getElementById('audio-matches').textContent  = state.audio.matches;
    document.getElementById('audio-channel').textContent  = result.brand;
    document.getElementById('audio-confidence').textContent = Math.round(result.confidence * 100) + '%';
    status.textContent = 'Matched!'; status.className = 'demo-panel-status detecting';
    const icon = result.brand === 'Mosaique FM' ? '📻' : '📡';
    area.innerHTML = `<div class="audio-match-result">
      <div style="font-size:28px;margin-bottom:8px">${icon}</div>
      <div class="audio-match-channel">${result.track_name}</div>
      <div style="font-size:12px;color:#888;margin-bottom:6px">${result.brand}</div>
      <div class="audio-match-confidence">✓ Match — ${Math.round(result.confidence * 100)}% confidence</div>
      <div style="font-size:9px;color:#444;margin-top:8px">${result.total_hits} hits · ${result.coherence} coherent · ${result.query_hash_count} query hashes</div>
    </div>`;
    const u = document.getElementById('unified-audio-channel');
    if (u) u.textContent = result.brand;
  } else {
    status.textContent = 'No Match'; status.className = 'demo-panel-status idle';
    area.innerHTML = `<div class="audio-match-result">
      <div style="font-size:28px;margin-bottom:8px">🔍</div>
      <div style="font-size:14px;color:#888">No match found</div>
      <div style="font-size:10px;color:#555;margin-top:6px">Play a reference ad louder/closer to the mic and try again</div>
      <div style="font-size:9px;color:#333;margin-top:4px">${result.query_hash_count} hashes · best coherence: ${result.coherence}</div>
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

// ═══ C. TELECOM (real fetch from API, no random walk) ═════════════════════
async function initTelecomDemo() {
  if (window.NexusMap) {
    NexusMap.create('telecom-map', {
      bg: '#0a0a0e', grid: 28,
      hotspots: [
        { x: 0.35, y: 0.4, r: 24, c: '107,43,255' }, { x: 0.65, y: 0.3, r: 16, c: '139,92,246' },
        { x: 0.25, y: 0.6, r: 20, c: '107,43,255' }, { x: 0.7,  y: 0.6, r: 12, c: '139,92,246' },
      ],
    });
  }
  const c = document.getElementById('telecom-demo-sectors');
  if (!c) return;

  let sectors = [];
  try {
    const data = await NexusAPI.getTelecomSectors();
    sectors = data.sectors;
  } catch (e) {
    console.warn('telecom API unavailable', e);
    return;
  }

  c.innerHTML = '';
  for (const s of sectors) {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:10px';
    r.innerHTML = `<span style="color:#666;width:80px">${s.name}</span>
      <div style="flex:1;height:3px;background:rgba(255,255,255,0.04);border-radius:2px;margin:0 8px;overflow:hidden">
        <div class="tsf" style="height:100%;width:${s.capacity_pct}%;background:linear-gradient(90deg,#6B2BFF,#8B5CF6);border-radius:2px"></div>
      </div><span class="tsp" style="color:#555;width:28px;text-align:right">${s.capacity_pct}%</span>`;
    c.appendChild(r);
  }

  // Aggregate density estimate (still client-side; this is purely display)
  const density = sectors.reduce((a, s) => a + Math.round(s.capacity_pct * 55), 0);
  const ci = sectors.reduce((a, s) => a + s.ci_db, 0) / Math.max(sectors.length, 1);
  const dd = document.getElementById('telecom-density'); if (dd) dd.textContent = density.toLocaleString();
  const dc = document.getElementById('telecom-ci');      if (dc) dc.textContent = ci.toFixed(1);
}
setTimeout(initTelecomDemo, 300);

// ═══ UNIFIED PANEL — driven by real backend metrics ═══════════════════════
async function refreshUnified() {
  let m;
  try { m = await NexusAPI.getMetrics(); }
  catch (e) { return; }
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('unified-ooh',     m.impressions.toLocaleString());
  set('unified-audio',   m.audio_matches);
  set('unified-total',   m.events_total.toLocaleString());
  const r = document.getElementById('unified-ooh-rate');
  if (r) r.textContent = state.vision.active ? (state.vision.counts.car || 0) + ' cars/frame' : '0/min';
}
setInterval(refreshUnified, 1000);
refreshUnified();

// Idle waveform on initial load
(function () {
  const c = document.getElementById('audio-waveform');
  if (!c) return; c.width = c.offsetWidth; c.height = 80;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(107,43,255,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 40);
  for (let x = 0; x < c.width; x++) ctx.lineTo(x, 40 + Math.sin(x * 0.05) * 3);
  ctx.stroke();
})();

window.startVision        = startVision;
window.startAudioCapture  = startAudioCapture;
