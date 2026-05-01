/* NEXUS — Custom Cursor */
const cur = document.getElementById('cursor');
const curRing = document.getElementById('cursor-ring');
if (cur && curRing) {
  let mx=0,my=0,rx=0,ry=0;
  document.addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; cur.style.left=mx+'px'; cur.style.top=my+'px'; });
  function animRing() {
    rx += (mx-rx)*0.12; ry += (my-ry)*0.12;
    curRing.style.left=rx+'px'; curRing.style.top=ry+'px';
    requestAnimationFrame(animRing);
  }
  animRing();
}
