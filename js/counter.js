/* NEXUS — Live Counters & Feed Animation */
let count = 1247893;
let feedTotal = 4521882;
const feedEvents = [
  { icon: '🏙️', bg: 'rgba(107,43,255,0.15)', event: 'OOH impression · Avenue Bourguiba', profile: 'A', val: '+1' },
  { icon: '📺', bg: 'rgba(34,197,94,0.1)', event: 'Audio matched · Tunisie Telecom ad', profile: 'B', val: '+1' },
  { icon: '📻', bg: 'rgba(251,191,36,0.1)', event: 'Audio fingerprint · Mosaique FM', profile: 'C', val: '+1' },
  { icon: '🏙️', bg: 'rgba(107,43,255,0.15)', event: 'OOH impression · Lac 1', profile: 'D', val: '+1' },
  { icon: '📲', bg: 'rgba(59,130,246,0.12)', event: 'Mobile offer delivered · profile matched', profile: 'E', val: '✓' },
  { icon: '📺', bg: 'rgba(34,197,94,0.1)', event: 'Audio matched · Tunisie Telecom spot', profile: 'F', val: '+1' },
  { icon: '🏙️', bg: 'rgba(107,43,255,0.15)', event: 'OOH impression · Menzah 6', profile: 'G', val: '+1' },
  { icon: '📻', bg: 'rgba(251,191,36,0.1)', event: 'Audio fingerprint · Mosaique FM jingle', profile: 'H', val: '+1' },
];
let feedIdx = 0;
const times = ['just now', '1s ago', '2s ago', '3s ago', '5s ago'];

setInterval(() => {
  count += Math.floor(Math.random()*43+10);
  feedTotal += Math.floor(Math.random()*12+3);
  const el1 = document.getElementById('dash-counter');
  const el2 = document.getElementById('hero-counter');
  const el3 = document.getElementById('feed-count');
  if(el1) el1.textContent = count.toLocaleString();
  if(el2) el2.textContent = count.toLocaleString();
  if(el3) el3.textContent = feedTotal.toLocaleString() + ' events';
}, 900);

setInterval(() => {
  const feed = document.getElementById('feed-items');
  if(!feed) return;
  const ev = feedEvents[feedIdx % feedEvents.length];
  feedIdx++;
  const profileNum = Math.floor(Math.random()*9000+1000);
  const item = document.createElement('div');
  item.className = 'dc-feed-item';
  item.innerHTML = `
    <div class="dc-feed-icon" style="background:${ev.bg}">${ev.icon}</div>
    <div class="dc-feed-text">
      <div class="dc-feed-event">${ev.event}</div>
      <div class="dc-feed-time">just now · profile #${ev.profile}-${profileNum}</div>
    </div>
    <div class="dc-feed-val">${ev.val}</div>
  `;
  feed.insertBefore(item, feed.firstChild);
  while(feed.children.length > 3) feed.removeChild(feed.lastChild);
  Array.from(feed.children).forEach((child, i) => {
    const timeEl = child.querySelector('.dc-feed-time');
    if(timeEl && i > 0) {
      const t = timeEl.textContent.split('·');
      timeEl.textContent = `${times[Math.min(i*2, 4)]} · ${t[1]||''}`;
    }
  });
}, 2800);

// Expose for dashboard page
window.nexusCounters = { getCount: () => count, getFeedTotal: () => feedTotal };
