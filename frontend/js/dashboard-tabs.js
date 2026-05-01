/* NEXUS — Dashboard Section Tab Switcher */
let dashCanvasInit = false;
function initDashCanvas(){
  if(dashCanvasInit) return; dashCanvasInit=true;
  NexusMap.create('dash-canvas', { bg: '#0d0d0d', grid: 32 });
}

function switchTab(btn, tab){
  document.querySelectorAll('.dash-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const mapEl=document.getElementById('dash-canvas');
  const chartEl=document.getElementById('dash-chart');
  const demoEl=document.getElementById('dash-demo');
  mapEl.style.display='none'; chartEl.style.display='none'; demoEl.style.display='none';
  if(tab==='map'){ mapEl.style.display='block'; dashCanvasInit=false; initDashCanvas(); }
  else if(tab==='chart'){ chartEl.style.display='block'; NexusChart.destroy(); NexusChart.init(); }
  else { demoEl.style.display='block'; NexusDonut.init(); }
}

// Init
setTimeout(()=>{ initDashCanvas(); }, 400);

// Float animation
const style=document.createElement('style');
style.textContent=`@keyframes floatDash{0%,100%{transform:translateY(0) rotate(0deg);}40%{transform:translateY(-10px) rotate(0.3deg);}70%{transform:translateY(-5px) rotate(-0.2deg);}}`;
document.head.appendChild(style);

// Expose globally
window.switchTab = switchTab;
