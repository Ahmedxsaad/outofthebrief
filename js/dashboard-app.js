/* NEXUS — Dashboard App Logic */

// ── LIVE CLOCK ──
function updateClock() {
  const now = new Date();
  const el = document.getElementById('dash-time');
  if (el) el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000); updateClock();

// ── INIT MAP ──
setTimeout(() => {
  NexusMap.create('dash-main-map', {
    bg: '#0a0a0e',
    grid: 36,
    hotspots: [
      {x:0.35,y:0.42,r:28,c:'107,43,255'}, {x:0.62,y:0.28,r:18,c:'107,43,255'},
      {x:0.2,y:0.58,r:22,c:'139,92,246'}, {x:0.74,y:0.55,r:14,c:'107,43,255'},
      {x:0.5,y:0.48,r:16,c:'139,92,246'}
    ]
  });
}, 200);

// ── LIVE COUNTERS ──
let impressions = 1247893;
let tuneins = 340219;
let profiles = 128441;
let eventTotal = 4521882;

setInterval(() => {
  impressions += Math.floor(Math.random() * 47 + 12);
  tuneins += Math.floor(Math.random() * 18 + 3);
  profiles += Math.floor(Math.random() * 5 + 1);
  eventTotal += Math.floor(Math.random() * 15 + 4);

  const el1 = document.getElementById('dm-impressions');
  const el2 = document.getElementById('dm-tuneins');
  const el3 = document.getElementById('dm-profiles');
  const el4 = document.getElementById('dm-event-count');
  if (el1) el1.textContent = impressions.toLocaleString();
  if (el2) el2.textContent = tuneins.toLocaleString();
  if (el3) el3.textContent = profiles.toLocaleString();
  if (el4) el4.textContent = eventTotal.toLocaleString();
}, 900);

// ── LIVE EVENT FEED ──
const events = [
  { icon: '🏙️', bg: 'rgba(107,43,255,0.15)', title: 'OOH impression detected', locations: ['Avenue Bourguiba', 'Lac 1', 'Menzah 6', 'Avenue de France', 'Bardo', 'La Marsa Corniche'] },
  { icon: '📺', bg: 'rgba(34,197,94,0.1)', title: 'Audio fingerprint matched', channels: ['Tunisie Telecom · Pub 1', 'Tunisie Telecom · Pub 2', 'Tunisie Telecom · Pub 3', 'Tunisie Telecom · Pub 4'] },
  { icon: '📻', bg: 'rgba(251,191,36,0.1)', title: 'Audio fingerprint matched', channels: ['Mosaique FM · Spot', 'Mosaique FM · Jingle'] },
  { icon: '📲', bg: 'rgba(59,130,246,0.12)', title: 'Mobile offer delivered', locations: ['Centre Ville', 'Ariana', 'Soukra', 'Manouba', 'Ben Arous'] },
  { icon: '👤', bg: 'rgba(107,43,255,0.1)', title: 'Profile updated', data: ['age bracket confirmed', 'vehicle ownership', 'media preference', 'location pattern'] },
  { icon: '🔗', bg: 'rgba(34,197,94,0.08)', title: 'Cross-channel attribution', data: ['OOH → Audio match', 'Audio → Mobile conversion', 'OOH → Mobile retarget', 'Full funnel complete'] },
];

let eventIdx = 0;
const feedEl = document.getElementById('dash-event-feed');

function addEvent() {
  if (!feedEl) return;
  const ev = events[eventIdx % events.length];
  eventIdx++;
  const detail = ev.locations ? ev.locations[Math.floor(Math.random() * ev.locations.length)]
    : ev.channels ? ev.channels[Math.floor(Math.random() * ev.channels.length)]
    : ev.data ? ev.data[Math.floor(Math.random() * ev.data.length)] : '';
  const profileId = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + '-' + Math.floor(Math.random() * 9000 + 1000);
  const item = document.createElement('div');
  item.className = 'dash-event-item';
  item.style.animation = 'feedSlide 0.4s ease';
  item.innerHTML = `
    <div class="dash-event-icon" style="background:${ev.bg}">${ev.icon}</div>
    <div class="dash-event-content">
      <div class="dash-event-title">${ev.title} · ${detail}</div>
      <div class="dash-event-meta">just now · profile #${profileId}</div>
    </div>
    <div class="dash-event-value" style="color:${ev.icon === '📲' ? '#3b82f6' : ev.icon === '📺' ? '#22c55e' : '#6B2BFF'}">+1</div>
  `;
  feedEl.insertBefore(item, feedEl.firstChild);
  while (feedEl.children.length > 15) feedEl.removeChild(feedEl.lastChild);
  // Update time on previous items
  Array.from(feedEl.children).forEach((child, i) => {
    if (i > 0) {
      const meta = child.querySelector('.dash-event-meta');
      if (meta) {
        const parts = meta.textContent.split('·');
        const secs = i * 2;
        meta.textContent = `${secs}s ago · ${parts[1] || ''}`;
      }
    }
  });
}

// Populate initial events
for (let i = 0; i < 10; i++) addEvent();
setInterval(addEvent, 2200);

// ── CHART ──
const chartData = Array.from({length: 20}, () => Math.floor(Math.random() * 60 + 30));
const chartCanvas = document.getElementById('dash-chart-main');

function initDashChart() {
  if (!chartCanvas) return;
  chartCanvas.width = chartCanvas.offsetWidth;
  chartCanvas.height = chartCanvas.offsetHeight || 180;
  drawDashChart();
}

function drawDashChart() {
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');
  const W = chartCanvas.width, H = chartCanvas.height;
  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5;
  for (let y = 0; y < H; y += H / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  const pts = chartData.map((v, i) => [i * (W / (chartData.length - 1)), H - (v / 100) * H * 0.85 - H * 0.05]);

  // Area fill
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(107,43,255,0.25)');
  g.addColorStop(1, 'rgba(107,43,255,0)');
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
  ctx.strokeStyle = '#6B2BFF'; ctx.lineWidth = 2; ctx.stroke();

  // Glow
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
  ctx.strokeStyle = 'rgba(107,43,255,0.3)'; ctx.lineWidth = 6; ctx.stroke();

  // Dot
  const lp = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(lp[0], lp[1], 4, 0, Math.PI * 2);
  ctx.fillStyle = '#6B2BFF'; ctx.fill();
  ctx.beginPath(); ctx.arc(lp[0], lp[1], 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(107,43,255,0.2)'; ctx.fill();
}

setTimeout(initDashChart, 300);
setInterval(() => {
  chartData.push(Math.max(20, Math.min(100, chartData[chartData.length - 1] + (Math.random() - 0.42) * 20)));
  chartData.shift();
  drawDashChart();
}, 1200);

// ── DONUT ──
function initDashDonut() {
  const canvas = document.getElementById('dash-donut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = [
    { pct: 28, color: '#6B2BFF', label: '18–24' },
    { pct: 38, color: '#8B5CF6', label: '25–34' },
    { pct: 20, color: '#a78bfa', label: '35–44' },
    { pct: 14, color: '#c4b5fd', label: '45+' }
  ];
  let start = -Math.PI / 2;
  const cx = 60, cy = 60, r = 50, hole = 30;
  data.forEach(d => {
    const angle = (d.pct / 100) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + angle); ctx.closePath();
    ctx.fillStyle = d.color; ctx.fill();
    start += angle;
  });
  ctx.beginPath(); ctx.arc(cx, cy, hole, 0, Math.PI * 2); ctx.fillStyle = '#0E0E12'; ctx.fill();
  // Center text
  ctx.fillStyle = '#f0f0f8'; ctx.font = '600 14px DM Sans'; ctx.textAlign = 'center';
  ctx.fillText('128K', cx, cy + 2);
  ctx.fillStyle = '#444'; ctx.font = '8px DM Sans';
  ctx.fillText('PROFILES', cx, cy + 14);

  // Legend
  const leg = document.getElementById('dash-demo-legend');
  if (leg) {
    leg.innerHTML = '';
    leg.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    data.forEach(d => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px';
      row.innerHTML = `
        <div style="width:8px;height:8px;border-radius:50%;background:${d.color}"></div>
        <span style="font-size:11px;color:#888">${d.label}</span>
        <span style="font-size:11px;color:#e0e0e8;font-weight:500;margin-left:auto">${d.pct}%</span>
      `;
      leg.appendChild(row);
    });
  }
}
setTimeout(initDashDonut, 400);

// ── TELECOM SECTORS ──
const sectors = [
  { name: 'Tunis Centre (Sector A)', capacity: 87, ci: 12.4 },
  { name: 'Ariana Nord (Sector B)', capacity: 72, ci: 18.1 },
  { name: 'La Marsa (Sector C)', capacity: 45, ci: 24.6 },
  { name: 'Menzah VI (Sector D)', capacity: 91, ci: 8.2 },
  { name: 'Lac 1 Business (Sector E)', capacity: 68, ci: 15.8 },
  { name: 'Bardo (Sector F)', capacity: 54, ci: 21.3 },
];

function initTelecom() {
  const container = document.getElementById('telecom-sectors');
  if (!container) return;
  container.innerHTML = '';
  sectors.forEach(s => {
    const row = document.createElement('div');
    row.className = 'telecom-sector';
    row.innerHTML = `
      <span class="telecom-sector-name">${s.name}</span>
      <div class="telecom-sector-bar"><div class="telecom-sector-fill" style="width:${s.capacity}%"></div></div>
      <span class="telecom-sector-pct">${s.capacity}%</span>
    `;
    container.appendChild(row);
  });
}
initTelecom();

// Simulate capacity shifts
setInterval(() => {
  sectors.forEach(s => {
    s.capacity = Math.max(20, Math.min(98, s.capacity + (Math.random() - 0.45) * 8));
    s.ci = Math.max(5, Math.min(30, s.ci + (Math.random() - 0.5) * 3));
  });
  const fills = document.querySelectorAll('.telecom-sector-fill');
  const pcts = document.querySelectorAll('.telecom-sector-pct');
  fills.forEach((f, i) => { if (sectors[i]) f.style.width = Math.round(sectors[i].capacity) + '%'; });
  pcts.forEach((p, i) => { if (sectors[i]) p.textContent = Math.round(sectors[i].capacity) + '%'; });
}, 2000);
