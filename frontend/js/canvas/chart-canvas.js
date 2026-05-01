/* NEXUS — Chart Canvas (Line chart + area) */
window.NexusChart = {
  data: [30,45,38,60,55,80,75,95,72,85,90,100,88],
  interval: null,
  init: function() {
    const canvas = document.getElementById('chart-canvas');
    if(!canvas) return;
    canvas.width = canvas.offsetWidth; canvas.height = 160;
    this.interval = setInterval(() => {
      this.data = [...this.data.slice(1), Math.max(20, Math.min(100, this.data[this.data.length-1]+(Math.random()-0.4)*25))];
      this.draw();
    }, 1200);
    this.draw();
  },
  draw: function() {
    const canvas = document.getElementById('chart-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    const pts = this.data.map((v,i) => [i*(W/(this.data.length-1)), H-(v/100)*H*0.85-H*0.05]);
    // Area
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'rgba(107,43,255,0.3)'); g.addColorStop(1,'rgba(107,43,255,0)');
    ctx.beginPath();
    pts.forEach((p,i) => i===0 ? ctx.moveTo(p[0],p[1]) : ctx.lineTo(p[0],p[1]));
    ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    // Line
    ctx.beginPath();
    pts.forEach((p,i) => i===0 ? ctx.moveTo(p[0],p[1]) : ctx.lineTo(p[0],p[1]));
    ctx.strokeStyle = '#6B2BFF'; ctx.lineWidth = 1.5; ctx.stroke();
    // Last dot
    const lp = pts[pts.length-1];
    ctx.beginPath(); ctx.arc(lp[0],lp[1],3.5,0,Math.PI*2);
    ctx.fillStyle = '#6B2BFF'; ctx.fill();
  },
  destroy: function() {
    if(this.interval) clearInterval(this.interval);
  }
};

/* NEXUS — Donut Canvas */
window.NexusDonut = {
  init: function() {
    const canvas = document.getElementById('donut-canvas');
    if(!canvas) return;
    canvas.width = 80; canvas.height = 80;
    const ctx = canvas.getContext('2d');
    const data = [{pct:28,color:'#6B2BFF'},{pct:38,color:'#8B5CF6'},{pct:20,color:'#a78bfa'},{pct:14,color:'#c4b5fd'}];
    const labels = ['18–24','25–34','35–44','45+'];
    let start = -Math.PI/2;
    data.forEach(d => {
      const angle = (d.pct/100)*Math.PI*2;
      ctx.beginPath(); ctx.moveTo(40,40); ctx.arc(40,40,30,start,start+angle); ctx.closePath();
      ctx.fillStyle = d.color; ctx.fill(); start += angle;
    });
    ctx.beginPath(); ctx.arc(40,40,16,0,Math.PI*2); ctx.fillStyle = '#111'; ctx.fill();
    // Legend
    const leg = document.getElementById('demo-legend');
    if(leg){ leg.innerHTML = ''; data.forEach((d,i) => {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px';
      const dot = document.createElement('div'); dot.style.cssText = `width:7px;height:7px;border-radius:50%;background:${d.color};flex-shrink:0`;
      const txt = document.createElement('span'); txt.style.cssText = 'font-size:9px;color:#666;font-family:DM Sans,sans-serif';
      txt.textContent = `${labels[i]} · ${d.pct}%`;
      row.append(dot,txt); leg.appendChild(row);
    }); }
  }
};

/* NEXUS — Mini Chart */
(function(){
  const canvas = document.getElementById('hero-minichart');
  if(!canvas) return;
  let data = [40,55,48,70,62,85,78,92,80,88,95,100,90];
  canvas.width = canvas.offsetWidth; canvas.height = 36;
  function draw(){
    const W=canvas.width,H=canvas.height;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    const pts=data.map((v,i)=>[i*(W/(data.length-1)),H-(v/100)*H*0.9]);
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'rgba(107,43,255,0.4)');g.addColorStop(1,'rgba(107,43,255,0)');
    ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]));
    ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle=g;ctx.fill();
    ctx.beginPath();pts.forEach((p,i)=>i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]));
    ctx.strokeStyle='#6B2BFF';ctx.lineWidth=1.5;ctx.stroke();
    const lp=pts[pts.length-1];
    ctx.beginPath();ctx.arc(lp[0],lp[1],3,0,Math.PI*2);ctx.fillStyle='#6B2BFF';ctx.fill();
  }
  draw();
  setInterval(()=>{
    data=[...data.slice(1),Math.max(20,Math.min(100,data[data.length-1]+(Math.random()-0.38)*22))];
    canvas.width=canvas.offsetWidth;draw();
  },1400);
})();
