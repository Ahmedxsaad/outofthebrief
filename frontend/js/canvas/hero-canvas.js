/* NEXUS — Hero Canvas (Particle Network) */
(function(){
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W,H,frame=0;
  const nodes = Array.from({length:30}, () => ({
    x: Math.random(), y: Math.random(),
    vx: (Math.random()-0.5)*0.0004, vy: (Math.random()-0.5)*0.0004,
    r: 1+Math.random()*2,
    color: Math.random()>0.6 ? 'violet' : Math.random()>0.5 ? 'dark' : 'light'
  }));
  function resize(){ W=canvas.width=canvas.offsetWidth; H=canvas.height=canvas.offsetHeight; }
  window.addEventListener('resize', resize); resize();
  let mouseX=0.5, mouseY=0.5;
  document.addEventListener('mousemove', e => { mouseX=e.clientX/window.innerWidth; mouseY=e.clientY/window.innerHeight; });
  function draw(){
    ctx.clearRect(0,0,W,H);
    const grad = ctx.createRadialGradient(mouseX*W, mouseY*H, 0, mouseX*W, mouseY*H, Math.max(W,H)*0.8);
    grad.addColorStop(0,'rgba(107,43,255,0.06)');
    grad.addColorStop(0.5,'rgba(107,43,255,0.02)');
    grad.addColorStop(1,'rgba(107,43,255,0)');
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if(n.x<0||n.x>1) n.vx*=-1;
      if(n.y<0||n.y>1) n.vy*=-1;
      n.x += (mouseX-n.x)*0.00015;
      n.y += (mouseY-n.y)*0.00015;
    });
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i], b=nodes[j];
        const dx=(a.x-b.x)*W, dy=(a.y-b.y)*H;
        const dist=Math.hypot(dx,dy);
        if(dist<W*0.18){
          ctx.beginPath(); ctx.moveTo(a.x*W,a.y*H); ctx.lineTo(b.x*W,b.y*H);
          ctx.strokeStyle=`rgba(107,43,255,${(1-dist/(W*0.18))*0.15})`;
          ctx.lineWidth=0.5; ctx.stroke();
        }
      }
    }
    nodes.forEach(n => {
      ctx.beginPath(); ctx.arc(n.x*W,n.y*H,n.r,0,Math.PI*2);
      const alpha = 0.3+0.2*Math.sin(frame*0.02+n.x*10);
      if(n.color==='violet') ctx.fillStyle=`rgba(107,43,255,${alpha})`;
      else if(n.color==='dark') ctx.fillStyle=`rgba(10,10,10,${alpha})`;
      else ctx.fillStyle=`rgba(139,92,246,${alpha})`;
      ctx.fill();
    });
    frame++;
    requestAnimationFrame(draw);
  }
  draw();
})();
