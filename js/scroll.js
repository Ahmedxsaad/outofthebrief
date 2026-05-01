/* NEXUS — Scroll Progress, Reveal, Parallax */

// Scroll progress bar
const scrollProgress = document.getElementById('scroll-progress');
if (scrollProgress) {
  window.addEventListener('scroll', () => {
    const scrollTop = document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress.style.transform = `scaleX(${scrollTop / scrollHeight})`;
  }, { passive: true });
}

// Scroll reveal
const srObs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('visible'); srObs.unobserve(e.target); } });
}, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.sr,.sr-left,.sr-scale').forEach(el => srObs.observe(el));

// Force-reveal elements already in viewport on load
setTimeout(() => {
  document.querySelectorAll('.sr,.sr-left,.sr-scale').forEach(el => {
    const r = el.getBoundingClientRect();
    if(r.top < window.innerHeight) el.classList.add('visible');
  });
}, 100);

// Journey step reveal
const journeyObs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting){
    e.currentTarget.querySelectorAll('.journey-step').forEach((s,i) => {
      setTimeout(() => s.classList.add('visible'), i * 150);
    });
    journeyObs.unobserve(e.currentTarget);
  }});
}, { threshold: 0 });
const journey = document.getElementById('journey');
if(journey) journeyObs.observe(journey);

// Hero parallax
const heroCanvas = document.getElementById('hero-canvas');
if (heroCanvas) {
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if(scrollY < window.innerHeight) heroCanvas.style.transform = `translateY(${scrollY * 0.3}px)`;
  }, { passive: true });
}

// Count-up animation on numbers section
function animateCountUp(el, target, suffix = '') {
  const duration = 2000;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(target * ease * 10) / 10;
    if(target >= 1) el.textContent = current.toFixed(target % 1 !== 0 ? 1 : 0) + suffix;
    else el.textContent = current.toFixed(1) + suffix;
    if(progress < 1) requestAnimationFrame(step);
    else el.textContent = target + suffix;
  }
  requestAnimationFrame(step);
}
const numbersObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if(e.isIntersecting) {
      const vals = e.target.querySelectorAll('.number-val');
      const targets = [{val:1.2,suffix:'M+'},{val:99.2,suffix:'%'},{val:2,suffix:'s'},{val:5,suffix:'ms'}];
      vals.forEach((v,i) => { if(targets[i]) animateCountUp(v, targets[i].val, targets[i].suffix); });
      numbersObs.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });
const numbersSection = document.getElementById('numbers');
if(numbersSection) numbersObs.observe(numbersSection);
