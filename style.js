/* =========================================================
   NASA | página única
   Estrutura:
   1. Utilitários
   2. Loader (contagem regressiva)
   3. Texto dividido em letras
   4. Revelações ao rolar + contadores
   5. Campo de estrelas (canvas)
   6. Menu (mobile, ativo, esconder ao rolar)
   7. Interações (tilt, brilho, magnético, cursor)
   8. Cenas ligadas à rolagem (parallax, missões, lançamento)
   9. Loop principal
   ========================================================= */
(() => {
  'use strict';

  /* 1. UTILITÁRIOS ---------------------------------------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  const body = document.body;
  const header = $('#header');

  let sy = window.scrollY;
  let lastY = sy;
  let vel = 0;               // velocidade de rolagem suavizada
  let mouseX = .5;
  let mouseY = .5;

  /* 2. LOADER --------------------------------------------- */
  function runLoader() {
    const loader = $('#loader');
    const num = $('#count');

    const finish = () => {
      loader.classList.add('is-done');
      body.classList.remove('is-loading');
      body.classList.add('ready');
      startReveals();
    };

    if (reduce) { finish(); return; }

    let n = 3;
    const step = () => {
      num.textContent = n > 0 ? n : '0';
      num.classList.remove('pop');
      void num.offsetWidth;            // reinicia a animação
      num.classList.add('pop');
      if (n === 0) { setTimeout(finish, 550); return; }
      n--;
      setTimeout(step, 500);
    };
    step();
  }

  /* 3. TEXTO DIVIDIDO EM LETRAS --------------------------- */
  $$('[data-split]').forEach(el => {
    const text = el.textContent.trim();
    el.textContent = '';
    el.setAttribute('aria-label', text);
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'char';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', i);
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      el.appendChild(s);
    });
  });

  /* 4. REVELAÇÕES AO ROLAR + CONTADORES ------------------- */
  function countUp(el) {
    const end = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reduce) { el.textContent = end + suffix; return; }
    const dur = 2200;
    const t0 = performance.now();
    const tick = now => {
      const p = clamp((now - t0) / dur);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(end * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function startReveals() {
    // escalonamento automático dos filhos
    $$('[data-stagger]').forEach(group => {
      [...group.children].forEach((child, i) => {
        if (!child.classList.contains('reveal')) child.classList.add('reveal');
        child.style.setProperty('--d', i * 120);
      });
    });
    $$('[data-delay]').forEach(el => el.style.setProperty('--d', el.dataset.delay));

    const targets = $$('.reveal, .title, [data-count]');

    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(el => {
        el.classList.add('is-visible');
        if (el.dataset.count !== undefined) countUp(el);
      });
      return;
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('is-visible');
        if (el.dataset.count !== undefined) countUp(el);
        io.unobserve(el);
      });
    }, { threshold: .18, rootMargin: '0px 0px -8% 0px' });

    targets.forEach(el => io.observe(el));
  }

  /* 5. CAMPO DE ESTRELAS ---------------------------------- */
  const canvas = $('#stars');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, stars = [];
  let shooting = null;
  let nextShot = 3000;
  const palette = ['#ffffff', '#cfe0ff', '#ffe9c7', '#b9c8ff'];

  function resizeStars() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round((W * H) / 5200);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: .15 + Math.random() * .85,
      r: Math.random() * 1.25 + .3,
      t: Math.random() * Math.PI * 2,
      c: palette[(Math.random() * palette.length) | 0]
    }));
  }

  function drawStars(time) {
    ctx.clearRect(0, 0, W, H);
    const streak = clamp(vel, -70, 70);

    for (const s of stars) {
      let y = (s.y - sy * s.z * .35) % H;
      if (y < 0) y += H;
      const x = s.x + (mouseX - .5) * 46 * s.z;
      const twinkle = reduce ? 1 : .4 + .6 * Math.abs(Math.sin(time * .0009 * (1 + s.z) + s.t));

      ctx.globalAlpha = twinkle * (.35 + s.z * .65);
      ctx.strokeStyle = ctx.fillStyle = s.c;

      if (Math.abs(streak) > 2.5 && !reduce) {
        ctx.lineWidth = s.r * s.z + .3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + streak * s.z * 1.4);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s.r * (.5 + s.z * .5), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // estrela cadente
    if (!reduce) {
      if (!shooting && time > nextShot) {
        shooting = { x: Math.random() * W * .8, y: Math.random() * H * .4, vx: 9 + Math.random() * 5, vy: 4 + Math.random() * 3, life: 1 };
        nextShot = time + 4000 + Math.random() * 6000;
      }
      if (shooting) {
        const s = shooting;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9);
        grad.addColorStop(0, `rgba(255,255,255,${s.life})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9);
        ctx.stroke();
        s.x += s.vx; s.y += s.vy; s.life -= .014;
        if (s.life <= 0 || s.x > W + 100 || s.y > H + 100) shooting = null;
      }
    }
    ctx.globalAlpha = 1;
  }

  /* 6. MENU ----------------------------------------------- */
  const burger = $('#burger');
  const nav = $('#nav');
  const navLinks = $$('.nav__link');
  const navSections = navLinks
    .map(a => $(a.getAttribute('href')))
    .filter(Boolean);
  let headerHidden = false;

  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    nav.classList.toggle('is-open', open);
    body.classList.toggle('menu-open', open);
  }
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  navLinks.forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  function updateHeader(delta) {
    header.classList.toggle('is-scrolled', sy > 40);
    if (body.classList.contains('menu-open')) return;
    if (sy > innerHeight * .6 && delta > 3 && !headerHidden) {
      headerHidden = true; header.classList.add('is-hidden');
    } else if ((delta < -3 || sy < innerHeight * .6) && headerHidden) {
      headerHidden = false; header.classList.remove('is-hidden');
    }
  }

  function updateActiveLink() {
    let current = navSections[0];
    for (const sec of navSections) {
      if (sec.getBoundingClientRect().top <= innerHeight * .4) current = sec;
    }
    navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + current.id));
  }

  /* 7. INTERAÇÕES ----------------------------------------- */
  // Brilho que segue o mouse dentro dos cartões + inclinação 3D
  $$('.card').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', px * 100 + '%');
      card.style.setProperty('--my', py * 100 + '%');
      if (card.classList.contains('tilt') && finePointer && !reduce) {
        card.classList.remove('is-leaving');
        card.style.setProperty('--ry', ((px - .5) * 14).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((.5 - py) * 14).toFixed(2) + 'deg');
      }
    });
    card.addEventListener('pointerleave', () => {
      if (!card.classList.contains('tilt')) return;
      card.classList.add('is-leaving');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  // Botões magnéticos
  if (finePointer && !reduce) {
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * .25}px, ${dy * .35}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  // Luz que segue o cursor
  const glow = $('#glow');
  let gx = innerWidth / 2, gy = innerHeight / 2, cx = gx, cy = gy;
  if (finePointer && !reduce) {
    addEventListener('pointermove', e => {
      gx = e.clientX; gy = e.clientY;
      mouseX = e.clientX / innerWidth;
      mouseY = e.clientY / innerHeight;
      glow.classList.add('is-on');
    });
  }

  /* 8. CENAS LIGADAS À ROLAGEM ---------------------------- */
  const progressBar = $('#progress');
  const hero = $('.hero');
  const parallaxEls = $$('[data-parallax]').map(el => ({
    el,
    speed: parseFloat(el.dataset.parallax),
    host: el.closest('section') || el.parentElement
  }));
  const marquee = $('#marquee');

  // Missões: rolagem horizontal
  const hs = $('.hscroll');
  const track = $('#track');
  const hbar = $('#hbar');
  let hsDist = 0;
  function sizeHscroll() {
    hsDist = Math.max(0, track.scrollWidth - innerWidth);
    hs.style.height = (hsDist + innerHeight * 1.1) + 'px';
  }

  // Lançamento
  const launch = $('.launch');
  const rocket = $('#rocket');
  const flame = $('#flame');
  const sky = $('#sky');
  const clouds = $('#clouds');
  const ground = $('#ground');
  const stages = $$('#stages li');
  const hudT = $('#hudT');
  const hudAlt = $('#hudAlt');
  const hudVel = $('#hudVel');
  let stageIdx = -1;

  const fmt = n => n.toLocaleString('pt-BR');
  const pad2 = n => String(n).padStart(2, '0');

  function updateLaunch() {
    const r = launch.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight));
    const vh = innerHeight / 100;

    const rise = Math.pow(p, 1.35);
    rocket.style.transform =
      `translate3d(${p * 8}vw, ${-rise * 72}vh, 0) rotate(${p * 38}deg) scale(${1 - p * .3})`;
    rocket.classList.toggle('shake', p > .01 && p < .22);
    flame.style.transform = `scaleY(${.55 + p * .9})`;
    sky.style.opacity = String(clamp(1 - p * 1.45));
    clouds.style.opacity = String(clamp(1 - p * 1.6));
    clouds.style.transform = `translate3d(0, ${p * 150}vh, 0)`;
    ground.style.transform = `translate3d(0, ${p * 140 * vh}px, 0)`;

    const secs = Math.round(p * 540);
    hudT.textContent = `${pad2(Math.floor(secs / 60))}:${pad2(secs % 60)}`;
    hudAlt.textContent = fmt(Math.round(400 * Math.pow(p, 1.4))) + ' km';
    hudVel.textContent = fmt(Math.round(27600 * Math.pow(p, 1.15))) + ' km/h';

    const idx = p < .22 ? 0 : p < .5 ? 1 : p < .78 ? 2 : 3;
    if (idx !== stageIdx) {
      stageIdx = idx;
      stages.forEach((li, i) => li.classList.toggle('is-active', i === idx));
    }
  }

  function updateScrollScenes(delta) {
    const H_ = innerHeight;
    const max = document.documentElement.scrollHeight - H_;

    progressBar.style.transform = `scaleX(${max > 0 ? sy / max : 0})`;
    hero.style.setProperty('--hp', clamp(sy / H_).toFixed(3));

    if (!reduce) {
      // parallax
      for (const p of parallaxEls) {
        const r = p.host.getBoundingClientRect();
        if (r.bottom < -200 || r.top > H_ + 200) continue;
        const center = r.top + r.height / 2 - H_ / 2;
        p.el.style.transform = `translate3d(0, ${(-center * p.speed).toFixed(1)}px, 0)`;
      }
      // faixa inclina conforme a velocidade da rolagem
      marquee.style.transform = `skewX(${clamp(-vel * .25, -6, 6).toFixed(2)}deg)`;
    }

    // missões horizontais
    const hr = hs.getBoundingClientRect();
    if (hr.bottom > 0 && hr.top < H_) {
      const p = clamp(-hr.top / (hr.height - H_));
      track.style.transform = `translate3d(${-p * hsDist}px, 0, 0)`;
      hbar.style.transform = `scaleX(${p})`;
    }

    // lançamento
    const lr = launch.getBoundingClientRect();
    if (lr.bottom > -50 && lr.top < H_ + 50) updateLaunch();
  }

  /* 9. LOOP PRINCIPAL ------------------------------------- */
  function frame(time) {
    sy = window.scrollY;
    const delta = sy - lastY;
    lastY = sy;
    vel = lerp(vel, delta, .16);
    if (Math.abs(vel) < .05) vel = 0;

    updateHeader(delta);
    updateActiveLink();
    updateScrollScenes(delta);
    drawStars(time);

    if (finePointer && !reduce) {
      cx = lerp(cx, gx, .12);
      cy = lerp(cy, gy, .12);
      glow.style.transform = `translate3d(${cx - 200}px, ${cy - 200}px, 0)`;
    }
    requestAnimationFrame(frame);
  }

  /* INICIALIZAÇÃO ----------------------------------------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  resizeStars();
  sizeHscroll();
  addEventListener('resize', () => { resizeStars(); sizeHscroll(); });
  addEventListener('load', sizeHscroll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeHscroll);

  window.scrollTo(0, 0);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  runLoader();
  requestAnimationFrame(frame);
})();
