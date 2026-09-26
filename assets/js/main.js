/* ═══════════════════════════════════════════════════════════════════════════
   ЧУГУН — поведение страницы
   Ничего не прячется за JS: разметка полная и читаемая без скриптов,
   а всё движение отключается при prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const root   = document.documentElement;
  const $      = (s, c = document) => c.querySelector(s);
  const $$     = (s, c = document) => [...c.querySelectorAll(s)];
  const motionQ = matchMedia('(prefers-reduced-motion: reduce)');
  const calm    = () => motionQ.matches;

  /* ── 1. REVEALS ─────────────────────────────────────────────────────────
     The head script hides .rv and arms a 2.5s failsafe. We either take over
     with GSAP or release everything immediately. */
  const hasGsap = !!(window.gsap && window.ScrollTrigger);

  if (!hasGsap || calm()) {
    root.classList.add('rv-fallback');
  } else {
    clearTimeout(window.__rvFailsafe);
    gsap.registerPlugin(ScrollTrigger);

    const reveal = (els, vars = {}) => els.forEach(el => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: .62, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        ...vars
      });
    });

    gsap.set('.rv, .rv-s', { y: 22 });
    reveal($$('.rv'));

    // grids and lists arrive as a wave rather than all at once
    $$('.cuts, .evs, .gal, .tl, .duo, .info').forEach(group => {
      const items = $$('.rv-s', group);
      if (!items.length) return;
      gsap.to(items, {
        opacity: 1, y: 0, duration: .55, ease: 'power3.out',
        stagger: { each: .07, from: 'start' },
        scrollTrigger: { trigger: group, start: 'top 85%', once: true }
      });
    });
    reveal($$('.rv-s').filter(el => !el.closest('.cuts, .evs, .gal, .tl, .duo, .info')));

    // hero headline: three lines rising out of their own overflow box
    gsap.to('.rv-l span', {
      y: 0, duration: .95, ease: 'expo.out', stagger: .09, delay: .12
    });

    // slow parallax drift on the hero plate — transform only, never layout
    const heroBg = $('.hero__bg');
    if (heroBg) {
      gsap.to(heroBg, {
        yPercent: 12, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 }
      });
    }
  }

  /* ── 2. HEADER STATE ────────────────────────────────────────────────── */
  // declared up here because the scroll handler below calls ctaBarUpdate()
  const ctaBar = $('#ctabar');
  const resSect = $('#reserve');
  let formFocused = false;

  const hdr = $('#hdr');
  const onScroll = () => {
    hdr.classList.toggle('hdr--solid', window.scrollY > 40);
    ctaBarUpdate();
  };
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();

  /* ── 3. MOBILE NAV ──────────────────────────────────────────────────── */
  const mnav = $('#mnav'), burger = $('#burger');
  if (mnav && burger) {
    const open = () => {
      mnav.showModal();
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    };
    const close = () => {
      mnav.close();
    };
    burger.addEventListener('click', () => mnav.open ? close() : open());
    mnav.addEventListener('close', () => {
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      burger.focus({ preventScroll: true });
    });
    $$('[data-close-mnav], .mnav__list a, .mnav__foot a[href^="#"]', mnav)
      .forEach(el => el.addEventListener('click', close));
    // click on the backdrop area closes too
    mnav.addEventListener('click', e => { if (e.target === mnav) close(); });
  }

  /* ── 4. MENU TABS ───────────────────────────────────────────────────── */
  const tabBar = $('.tabs__bar');
  if (tabBar) {
    const tabs = $$('[role="tab"]', tabBar);

    const select = (tab, focus = true) => {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        $('#' + t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
      if (!calm() && hasGsap) {
        const panel = $('#' + tab.getAttribute('aria-controls'));
        gsap.fromTo(panel.querySelectorAll('li'),
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: .34, ease: 'power2.out', stagger: .035, overwrite: true });
      }
    };

    tabs.forEach(tab => tab.addEventListener('click', () => select(tab)));
    tabBar.addEventListener('keydown', e => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      select(tabs[(map[e.key] + tabs.length) % tabs.length]);
    });
  }

  /* ── 5. LIGHTBOX ────────────────────────────────────────────────────── */
  const lb = $('#lb');
  if (lb) {
    const shots = $$('#gal [data-lb]').map(btn => {
      const img = $('img', btn);
      return { src: img.src, alt: img.alt, cap: $('.gal__cap', btn).textContent.trim(), btn };
    });
    const lbImg = $('#lb-img'), lbCap = $('#lb-cap'), lbCount = $('#lb-count');
    let idx = 0, opener = null;

    const paint = () => {
      const s = shots[idx];
      lbImg.src = s.src;
      lbImg.alt = s.alt;
      lbCap.textContent = s.cap;
      lbCount.textContent = `${idx + 1} / ${shots.length}`;
      if (!calm() && hasGsap) gsap.fromTo(lbImg, { opacity: .3 }, { opacity: 1, duration: .28, ease: 'power2.out' });
    };
    const step = d => { idx = (idx + d + shots.length) % shots.length; paint(); };

    shots.forEach((s, i) => s.btn.addEventListener('click', () => {
      idx = i; opener = s.btn; paint(); lb.showModal();
    }));
    $$('[data-lb-step]', lb).forEach(b => b.addEventListener('click', () => step(+b.dataset.lbStep)));
    $('[data-lb-close]', lb).addEventListener('click', () => lb.close());
    lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
    lb.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
    });
    lb.addEventListener('close', () => opener && opener.focus({ preventScroll: true }));
  }

  /* ── 6. MAP ON DEMAND ───────────────────────────────────────────────── */
  const mapBtn = $('#map-load'), mapBox = $('#map');
  if (mapBtn && mapBox) {
    mapBtn.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = mapBox.dataset.src;
      f.title = 'Карта: Трёхпрудный переулок, 11/13';
      f.loading = 'lazy';
      f.allowFullscreen = true;
      f.referrerPolicy = 'no-referrer-when-downgrade';
      mapBox.replaceChildren(f);
    });
  }

  /* ── 7. SCROLLSPY ───────────────────────────────────────────────────── */
  const navLinks = $$('.nav a[href^="#"]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(navLinks.map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        const a = byId.get(en.target.id);
        if (!a) return;
        if (en.isIntersecting) {
          navLinks.forEach(l => l.removeAttribute('aria-current'));
          a.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ── 8. STICKY CTA BAR ──────────────────────────────────────────────── */
  function ctaBarUpdate() {
    if (!ctaBar || !resSect) return;
    const pastHero = window.scrollY > innerHeight * .6;
    const r = resSect.getBoundingClientRect();
    const resVisible = r.top < innerHeight && r.bottom > 0;
    const on = pastHero && !resVisible && !formFocused;
    ctaBar.classList.toggle('cta-bar--on', on);
    ctaBar.setAttribute('aria-hidden', String(!on));
  }
  // a fixed bar must never sit on top of the control the user just focused
  addEventListener('focusin', e => {
    formFocused = !!e.target.closest('form, .mnav');
    ctaBarUpdate();
  });
  addEventListener('focusout', () => { formFocused = false; ctaBarUpdate(); });

  /* ── 9. RESERVATION FORM ────────────────────────────────────────────── */
  const form = $('#res-form');
  if (form) {
    const submit  = $('#res-submit');
    const summary = $('#form-err');
    const sumList = $('#form-err-list');
    const live    = $('#form-live');
    const done    = $('#res-done');
    const dateIn  = $('#f-date');

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizon = new Date(today); horizon.setDate(horizon.getDate() + 60);
    const iso = d => d.toISOString().slice(0, 10);
    dateIn.min = iso(today);
    dateIn.max = iso(horizon);
    if (!dateIn.value) dateIn.value = iso(today);

    const digits = s => (s.match(/\d/g) || []).length;

    const RULES = {
      'f-name':   v => v.trim().length >= 2      || 'Укажите имя — минимум две буквы, чтобы мы знали, к кому обращаться.',
      'f-tel':    v => (digits(v) >= 10 && digits(v) <= 12) || 'Введите номер телефона полностью, например +7 900 000-00-00.',
      'f-date':   v => {
        if (!v) return 'Выберите дату визита.';
        const d = new Date(v + 'T00:00:00');
        if (d < today)   return 'Эта дата уже прошла — выберите сегодняшний день или позже.';
        if (d > horizon) return 'Брони принимаем на 60 дней вперёд. Для более дальних дат позвоните нам.';
        return true;
      },
      'f-time':   v => !!v                        || 'Выберите время — стол держим 20 минут после назначенного часа.',
      'f-guests': v => !!v                        || 'Укажите количество гостей.',
      'f-ok':     (_, el) => el.checked           || 'Нужно согласие на обработку данных — иначе мы не сможем перезвонить.'
    };

    const fieldOf = id => $('#' + id);
    const labelOf = id => {
      const l = form.querySelector(`label[for="${id}"]`);
      return l ? l.textContent.replace('*', '').trim() : id;
    };

    function setError(id, msg) {
      const el = fieldOf(id);
      const wrap = el.closest('.f');
      let node = $('.err', wrap);
      if (msg) {
        if (!node) {
          node = document.createElement('span');
          node.className = 'err';
          node.id = id + '-err';
          wrap.appendChild(node);
        }
        node.textContent = msg;
        el.setAttribute('aria-invalid', 'true');
        const described = (el.getAttribute('aria-describedby') || '')
          .split(/\s+/).filter(t => t && t !== node.id);
        el.setAttribute('aria-describedby', [node.id, ...described].join(' '));
      } else if (node) {
        const described = (el.getAttribute('aria-describedby') || '')
          .split(/\s+/).filter(t => t && t !== node.id);
        described.length ? el.setAttribute('aria-describedby', described.join(' '))
                         : el.removeAttribute('aria-describedby');
        node.remove();
        el.removeAttribute('aria-invalid');
      }
    }

    function check(id) {
      const el = fieldOf(id);
      const res = RULES[id](el.value, el);
      setError(id, res === true ? null : res);
      return res === true;
    }

    let attempted = false;
    Object.keys(RULES).forEach(id => {
      const el = fieldOf(id);
      const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'blur';
      el.addEventListener(ev, () => { if (attempted || el.value) check(id); });
      el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(id); });
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      attempted = true;

      const bad = Object.keys(RULES).filter(id => !check(id));

      if (bad.length) {
        sumList.replaceChildren(...bad.map(id => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = '#' + id;
          a.textContent = `${labelOf(id)}: ${$('#' + id + '-err').textContent}`;
          a.addEventListener('click', ev => {
            ev.preventDefault();
            fieldOf(id).focus();
          });
          li.appendChild(a);
          return li;
        }));
        summary.hidden = false;
        summary.focus({ preventScroll: false });
        live.textContent = `Не отправлено: ошибок — ${bad.length}.`;
        return;
      }

      summary.hidden = true;
      sumList.replaceChildren();
      submit.classList.add('is-busy');
      submit.disabled = true;
      live.textContent = 'Отправляем заявку…';

      const data = Object.fromEntries(new FormData(form).entries());
      const endpoint = form.dataset.endpoint;

      try {
        if (endpoint) {
          const r = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (!r.ok) throw new Error('HTTP ' + r.status);
        } else {
          // Демо-режим: бэкенда нет. Укажите URL в data-endpoint у <form>.
          console.info('[ЧУГУН] Бронь (демо, не отправлено на сервер):', data);
          await new Promise(res => setTimeout(res, 700));
        }

        const d = new Date(data.date + 'T00:00:00');
        const when = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        $('#done-sum').textContent =
          `${data.name}, ждём вас ${when} в ${data.time}. ${data.guests} гост${
            data.guests === '1' ? 'ь' : +data.guests < 5 ? 'я' : 'ей'}, ${data.zone.toLowerCase()}.`;

        form.hidden = true;
        done.hidden = false;
        done.focus({ preventScroll: false });
        live.textContent = 'Заявка принята.';
      } catch (err) {
        console.error('[ЧУГУН] Не удалось отправить бронь:', err);
        sumList.replaceChildren(Object.assign(document.createElement('li'), {
          textContent: 'Не удалось отправить заявку — проверьте соединение и попробуйте ещё раз ' +
                       'или позвоните нам по +7 495 120-84-16.'
        }));
        summary.hidden = false;
        summary.focus();
        live.textContent = 'Ошибка отправки.';
      } finally {
        submit.classList.remove('is-busy');
        submit.disabled = false;
      }
    });

    $('#res-again').addEventListener('click', () => {
      form.reset();
      dateIn.value = iso(today);
      attempted = false;
      Object.keys(RULES).forEach(id => setError(id, null));
      done.hidden = true;
      form.hidden = false;
      $('#f-name').focus();
    });
  }

  /* ── 10. SMOOTH ANCHORS WITH REAL FOCUS MOVE ────────────────────────── */
  $$('a[href^="#"]:not([href="#"])').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.getElementById(a.getAttribute('href').slice(1));
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
      // screen-reader и клавиатура должны попасть туда же, куда и взгляд
      t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
      history.replaceState(null, '', a.getAttribute('href'));
    });
  });
})();
