/* NEXUS — Map Canvas (Tunis hotspots with network grid) — Reusable */
window.NexusMap = {
  instances: {},
  create: function(canvasId, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    const bgColor = opts.bg || '#0d0d0d';
    const gridSpacing = opts.grid || 32;
    const hotspots = opts.hotspots || [
      {x:0.38,y:0.48,r:22,c:'107,43,255'}, {x:0.6,y:0.32,r:14,c:'107,43,255'},
      {x:0.22,y:0.62,r:18,c:'139,92,246'}, {x:0.72,y:0.6,r:11,c:'107,43,255'}
    ];
    const nodes = Array.from({length:18}, () => ({
      x:Math.random(), y:Math.random(),
      vx:(Math.random()-0.5)*0.0005, vy:(Math.random()-0.5)*0.0005,
      phase:Math.random()*6
    }));
    let active = true;

    function resize(){ canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight; }
    resize();

    function draw(){
      if (!active) return;
      const W=canvas.width, H=canvas.height;
      if(!W||!H){ requestAnimationFrame(draw); return; }
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle=bgColor; ctx.fillRect(0,0,W,H);
      // Grid
      ctx.strokeStyle='rgba(107,43,255,0.06)'; ctx.lineWidth=0.5;
      for(let x=0;x<W;x+=gridSpacing){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=gridSpacing){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      // Move nodes
      nodes.forEach(n => { n.x+=n.vx; n.y+=n.vy; if(n.x<0||n.x>1)n.vx*=-1; if(n.y<0||n.y>1)n.vy*=-1; });
      // Connections
      for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i],b=nodes[j],dx=(a.x-b.x)*W,dy=(a.y-b.y)*H,d=Math.hypot(dx,dy);
        if(d<W*0.22){ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H);ctx.strokeStyle=`rgba(107,43,255,${(1-d/(W*0.22))*0.18})`;ctx.lineWidth=0.5;ctx.stroke();}
      }
      // Hotspots
      hotspots.forEach((h,i)=>{
        const cx=h.x*W,cy=h.y*H,pulse=0.5+0.5*Math.sin(frame*0.05+i*1.5);
        const g=ctx.createRadialGradient(cx,cy,0,cx,cy,h.r*(1+pulse*0.5));
        g.addColorStop(0,`rgba(${h.c},${0.55*pulse})`); g.addColorStop(1,`rgba(${h.c},0)`);
        ctx.beginPath();ctx.arc(cx,cy,h.r*(1+pulse*0.5),0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
        ctx.beginPath();ctx.arc(cx,cy,2.5,0,Math.PI*2);ctx.fillStyle=`rgba(${h.c},${0.9+0.1*pulse})`;ctx.fill();
      });
      // Nodes
      nodes.forEach(n=>{
        const pulse=0.4+0.4*Math.sin(frame*0.04+n.phase);
        ctx.beginPath();ctx.arc(n.x*W,n.y*H,1.5,0,Math.PI*2);
        ctx.fillStyle=`rgba(107,43,255,${pulse})`;ctx.fill();
      });
      // Scan line
      const scan=(frame*1.2)%H;
      const sg=ctx.createLinearGradient(0,scan-14,0,scan+4);
      sg.addColorStop(0,'rgba(107,43,255,0)');sg.addColorStop(1,'rgba(107,43,255,0.07)');
      ctx.fillStyle=sg;ctx.fillRect(0,scan-14,W,18);
      frame++;
      requestAnimationFrame(draw);
    }
    draw();
    this.instances[canvasId] = { stop: () => { active = false; }, start: () => { active = true; draw(); }, resize };
    return this.instances[canvasId];
  }
};

// Auto-init hero map
(function(){
  const c = document.getElementById('hero-map-canvas');
  if(c) {
    window.addEventListener('resize', () => {
      if(NexusMap.instances['hero-map-canvas']) NexusMap.instances['hero-map-canvas'].resize();
    });
    NexusMap.create('hero-map-canvas', { bg: '#080808', grid: 28 });
  }
})();
