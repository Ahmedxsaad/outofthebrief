/* NEXUS dashboard.
 *
 * Counters and the event feed are driven by the backend:
 *   • GET  /api/metrics          one-shot snapshot on load + low-rate poll
 *   • GET  /api/events  (SSE)    real-time push for matches and impressions
 *
 * No random-walk simulation. No fake event cycling. Sparkline values
 * track the live audio_matches counter (one sample per second).
 */

// ── Live clock ────────────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('dash-time');
  if (el) el.textContent = new Date().toLocaleTimeString(
    'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000); updateClock();

// ── Map ───────────────────────────────────────────────────────────────────
setTimeout(() => {
  if (!window.NexusMap) return;
  NexusMap.create('dash-main-map', {
    bg: '#0a0a0e', grid: 36,
    hotspots: [
      { x:0.35, y:0.42, r:28, c:'107,43,255' }, { x:0.62, y:0.28, r:18, c:'107,43,255' },
      { x:0.2,  y:0.58, r:22, c:'139,92,246' }, { x:0.74, y:0.55, r:14, c:'107,43,255' },
      { x:0.5,  y:0.48, r:16, c:'139,92,246' },
    ],
  });
}, 200);

// ── Counters from /api/metrics ────────────────────────────────────────────
function applyMetrics(m) {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('dm-impressions',  m.impressions.toLocaleString());
  set('dm-tuneins',      m.tuneins.toLocaleString());
  set('dm-profiles',     m.profiles.toLocaleString());
  set('dm-event-count',  m.events_total.toLocaleString());
}

async function refreshMetrics() {
  try { applyMetrics(await NexusAPI.getMetrics()); }
  catch (e) { /* backend down; silently keep last values */ }
}
refreshMetrics();
setInterval(refreshMetrics, 5000);

// ── Real event feed via SSE ──────────────────────────────────────────────
const feedEl = document.getElementById('dash-event-feed');
const FEED_MAX = 15;

function pushFeedItem({ icon, bg, color, title, detail, profileId }) {
  if (!feedEl) return;
  const item = document.createElement('div');
  item.className = 'dash-event-item';
  item.style.animation = 'feedSlide 0.4s ease';
  item.innerHTML = `
    <div class="dash-event-icon" style="background:${bg}">${icon}</div>
    <div class="dash-event-content">
      <div class="dash-event-title">${title}${detail ? ' · ' + detail : ''}</div>
      <div class="dash-event-meta">just now${profileId ? ' · profile #' + profileId : ''}</div>
    </div>
    <div class="dash-event-value" style="color:${color}">+1</div>
  `;
  feedEl.insertBefore(item, feedEl.firstChild);
  while (feedEl.children.length > FEED_MAX) feedEl.removeChild(feedEl.lastChild);

  Array.from(feedEl.children).forEach((child, i) => {
    if (i > 0) {
      const meta = child.querySelector('.dash-event-meta');
      if (meta) {
        const profilePart = meta.textContent.split('·').slice(1).join('·').trim();
        meta.textContent = `${i * 2}s ago${profilePart ? ' · ' + profilePart : ''}`;
      }
    }
  });
}

NexusAPI.subscribeEvents(({ type, data }) => {
  if (type === 'match') {
    const isRadio = (data.brand || '').toLowerCase().includes('mosaique');
    pushFeedItem({
      icon: isRadio ? '📻' : '📺',
      bg: isRadio ? 'rgba(251,191,36,0.1)' : 'rgba(34,197,94,0.1)',
      color: isRadio ? '#6B2BFF' : '#22c55e',
      title: 'Audio fingerprint matched',
      detail: data.track_name,
      profileId: (data.client_id || '').slice(-4).toUpperCase(),
    });
  } else if (type === 'metric' && data.totals) {
    applyMetrics(data.totals);
    if (data.type === 'impression') {
      pushFeedItem({
        icon: '🏙️', bg: 'rgba(107,43,255,0.15)', color: '#6B2BFF',
        title: 'OOH impression detected', detail: `${data.count} object(s)`,
      });
    }
  }
});

// ── Sparkline: tracks live audio-match rate per second ───────────────────
const chartCanvas = document.getElementById('dash-chart-main');
const SPARK_WINDOW = 20;
const sparkData = Array(SPARK_WINDOW).fill(0);
let lastMatchTotal = null;

function initDashChart() {
  if (!chartCanvas) return;
  chartCanvas.width  = chartCanvas.offsetWidth;
  chartCanvas.height = chartCanvas.offsetHeight || 180;
  drawDashChart();
}

function drawDashChart() {
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');
  const W = chartCanvas.width, H = chartCanvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 0.5;
  for (let y = 0; y < H; y += H / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  const peak = Math.max(1, ...sparkData);
  const pts = sparkData.map((v, i) => [
    i * (W / (sparkData.length - 1)),
    H - (v / peak) * H * 0.85 - H * 0.05,
  ]);

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(107,43,255,0.25)');
  g.addColorStop(1, 'rgba(107,43,255,0)');
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();

  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
  ctx.strokeStyle = '#6B2BFF'; ctx.lineWidth = 2; ctx.stroke();

  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
  ctx.strokeStyle = 'rgba(107,43,255,0.3)'; ctx.lineWidth = 6; ctx.stroke();

  const lp = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(lp[0], lp[1], 4, 0, Math.PI * 2);
  ctx.fillStyle = '#6B2BFF'; ctx.fill();
  ctx.beginPath(); ctx.arc(lp[0], lp[1], 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(107,43,255,0.2)'; ctx.fill();
}
setTimeout(initDashChart, 300);

setInterval(async () => {
  try {
    const m = await NexusAPI.getMetrics();
    const total = m.audio_matches;
    const delta = lastMatchTotal == null ? 0 : Math.max(0, total - lastMatchTotal);
    lastMatchTotal = total;
    sparkData.push(delta); sparkData.shift();
  } catch { sparkData.push(0); sparkData.shift(); }
  drawDashChart();
}, 1000);

// ── Donut (audience demographics — static placeholder) ───────────────────
// Wire to a real audience-profile API when one exists. Until then this is
// a clearly-labeled visual stand-in, not a fabricated live number.
function initDashDonut() {
  const canvas = document.getElementById('dash-donut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = [
    { pct: 28, color: '#6B2BFF', label: '18–24' },
    { pct: 38, color: '#8B5CF6', label: '25–34' },
    { pct: 20, color: '#a78bfa', label: '35–44' },
    { pct: 14, color: '#c4b5fd', label: '45+'   },
  ];
  let start = -Math.PI / 2;
  const cx = 60, cy = 60, r = 50, hole = 30;
  for (const d of data) {
    const angle = (d.pct / 100) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + angle); ctx.closePath();
    ctx.fillStyle = d.color; ctx.fill();
    start += angle;
  }
  ctx.beginPath(); ctx.arc(cx, cy, hole, 0, Math.PI * 2);
  ctx.fillStyle = '#0E0E12'; ctx.fill();
  ctx.fillStyle = '#f0f0f8'; ctx.font = '600 14px DM Sans'; ctx.textAlign = 'center';
  ctx.fillText('—', cx, cy + 2);
  ctx.fillStyle = '#444'; ctx.font = '8px DM Sans';
  ctx.fillText('PROFILES', cx, cy + 14);

  const leg = document.getElementById('dash-demo-legend');
  if (leg) {
    leg.innerHTML = '';
    leg.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    for (const d of data) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px';
      row.innerHTML = `
        <div style="width:8px;height:8px;border-radius:50%;background:${d.color}"></div>
        <span style="font-size:11px;color:#888">${d.label}</span>
        <span style="font-size:11px;color:#e0e0e8;font-weight:500;margin-left:auto">${d.pct}%</span>`;
      leg.appendChild(row);
    }
  }
}
setTimeout(initDashDonut, 400);

// ── Telecom sectors: real fetch, no simulation ───────────────────────────
async function initTelecom() {
  const container = document.getElementById('telecom-sectors');
  if (!container) return;
  let sectors = [];
  try {
    const data = await NexusAPI.getTelecomSectors();
    sectors = data.sectors;
  } catch (e) {
    container.innerHTML = '<div style="padding:8px;color:#ef4444;font-size:11px">Telecom API unavailable</div>';
    return;
  }
  container.innerHTML = '';
  for (const s of sectors) {
    const row = document.createElement('div');
    row.className = 'telecom-sector';
    row.innerHTML = `
      <span class="telecom-sector-name">${s.name}</span>
      <div class="telecom-sector-bar"><div class="telecom-sector-fill" style="width:${s.capacity_pct}%"></div></div>
      <span class="telecom-sector-pct">${Math.round(s.capacity_pct)}%</span>`;
    container.appendChild(row);
  }
}
initTelecom();
