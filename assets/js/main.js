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

    // slow parallax drift on the hero footage — transform only, never layout
    const heroBg = $('.hero__media');
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

  /* ── 9. БРОНИРОВАНИЕ ────────────────────────────────────────────────
     Нативные date/select остаются в форме и несут значения — без JS
     страница бронирует на них. Когда скрипт жив, они прячутся, а поверх
     встают свой календарь, плашки времени и счётчик гостей; форма
     переезжает в модальное окно, которое открывает любая кнопка
     «Забронировать». */

  /* московское время: гость может сидеть в любом часовом поясе */
  const MSK_DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function moscowNow() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow', weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const g = t => parts.find(x => x.type === t).value;
    return {
      day: MSK_DAYS[g('weekday')],
      min: (+g('hour') % 24) * 60 + +g('minute'),
      iso: `${g('year')}-${g('month')}-${g('day')}`
    };
  }

  const form = $('#res-form');
  if (form) {
    // novalidate ставим из скрипта: без JS проверять форму должен браузер,
    // иначе не проверит никто
    form.noValidate = true;

    const submitBtn = $('#res-submit');
    const summary   = $('#form-err');
    const sumList   = $('#form-err-list');
    const live      = $('#form-live');
    const done      = $('#res-done');
    const dateIn    = $('#f-date');
    const timeIn    = $('#f-time');
    const guestsIn  = $('#f-guests');
    const zoneIn    = $('#f-zone');

    /* ---- даты как строки YYYY-MM-DD; полдень UTC, чтобы не ловить DST -- */
    const toDate = iso => new Date(iso + 'T12:00:00Z');
    const toISO  = d => d.toISOString().slice(0, 10);
    const addDays = (iso, n) => { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return toISO(d); };
    const dow = iso => toDate(iso).getUTCDay();            // 0 = воскресенье
    const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

    const msk      = moscowNow();
    const TODAY    = msk.iso;
    const HORIZON  = addDays(TODAY, 60);
    const FIRST_SLOT = 12;
    // пн–чт до 22:00, пт–вс до 23:00 — совпадает с часами работы
    const LAST_SLOT  = [23, 22, 22, 22, 22, 23, 23];       // вс, пн…сб
    const LEAD_MIN   = 60;                                  // бронь минимум за час
    const MAX_SLOT   = Math.max(...LAST_SLOT);

    dateIn.min = TODAY;
    dateIn.max = HORIZON;
    if (!dateIn.value || dateIn.value < TODAY) dateIn.value = TODAY;

    const fmtLong  = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' });
    const fmtShort = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });
    const fmtMonth = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    const guestWord = v => {
      if (v === '10+') return 'больше 10 гостей';
      const n = +v, d10 = n % 10, d100 = n % 100;
      const w = (d10 === 1 && d100 !== 11) ? 'гость'
              : (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) ? 'гостя' : 'гостей';
      return `${n} ${w}`;
    };

    /* ---- календарь ---------------------------------------------------- */
    const cal = $('#cal'), calGrid = $('#cal-grid'), calM = $('#cal-m');
    let viewY, viewM;

    function setView(iso) {
      const d = toDate(iso);
      viewY = d.getUTCFullYear();
      viewM = d.getUTCMonth();
    }

    function renderCal(focusISO) {
      const first = new Date(Date.UTC(viewY, viewM, 1, 12));
      const lead  = (first.getUTCDay() + 6) % 7;            // понедельник первый
      const total = new Date(Date.UTC(viewY, viewM + 1, 0, 12)).getUTCDate();
      // ru-RU добавляет « г.» — в заголовке календаря это лишний шум
      calM.textContent = cap(fmtMonth.format(first).replace(/\s*г\.?$/, ''));

      const cells = [];
      for (let i = 0; i < lead; i++) {
        const pad = document.createElement('span');
        pad.className = 'cal__pad';
        pad.setAttribute('aria-hidden', 'true');
        cells.push(pad);
      }
      for (let n = 1; n <= total; n++) {
        const iso = toISO(new Date(Date.UTC(viewY, viewM, n, 12)));
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cal__d';
        btn.dataset.iso = iso;
        btn.textContent = String(n);
        btn.setAttribute('aria-label', cap(fmtLong.format(toDate(iso))));
        const off = iso < TODAY || iso > HORIZON;
        btn.disabled = off;
        btn.setAttribute('aria-pressed', String(iso === dateIn.value));
        if (iso === TODAY) btn.dataset.today = '';
        btn.tabIndex = iso === dateIn.value ? 0 : -1;
        cells.push(btn);
      }
      calGrid.replaceChildren(...cells);

      // если выбранный день не в этом месяце — держим одну кнопку в табе
      if (!$('.cal__d[tabindex="0"]', calGrid)) {
        const firstOk = $('.cal__d:not(:disabled)', calGrid);
        if (firstOk) firstOk.tabIndex = 0;
      }
      $('[data-cal="-1"]').disabled = toISO(new Date(Date.UTC(viewY, viewM, 1, 12))) <= TODAY;
      $('[data-cal="1"]').disabled  = toISO(new Date(Date.UTC(viewY, viewM + 1, 1, 12))) > HORIZON;

      if (focusISO) {
        const t = $(`.cal__d[data-iso="${focusISO}"]`, calGrid);
        if (t) { $$('.cal__d', calGrid).forEach(d => d.tabIndex = -1); t.tabIndex = 0; t.focus(); }
      }
      if (hasGsap && !calm()) {
        gsap.fromTo($$('.cal__d', calGrid), { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: .3, ease: 'power2.out', stagger: .008, overwrite: true });
      }
    }

    function pickDate(iso) {
      dateIn.value = iso;
      $$('.cal__d', calGrid).forEach(d => {
        d.setAttribute('aria-pressed', String(d.dataset.iso === iso));
        d.tabIndex = d.dataset.iso === iso ? 0 : -1;
      });
      check('f-date');
      renderTimes();
      paintSummary();
    }

    calGrid.addEventListener('click', e => {
      const b = e.target.closest('.cal__d');
      if (b && !b.disabled) pickDate(b.dataset.iso);
    });

    calGrid.addEventListener('keydown', e => {
      const cur = e.target.closest('.cal__d');
      if (!cur) return;
      const STEP = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      let next = null;
      if (e.key in STEP) next = addDays(cur.dataset.iso, STEP[e.key]);
      else if (e.key === 'Home') next = addDays(cur.dataset.iso, -((dow(cur.dataset.iso) + 6) % 7));
      else if (e.key === 'End')  next = addDays(cur.dataset.iso, 6 - ((dow(cur.dataset.iso) + 6) % 7));
      else if (e.key === 'PageUp' || e.key === 'PageDown') {
        const d = toDate(cur.dataset.iso);
        d.setUTCMonth(d.getUTCMonth() + (e.key === 'PageUp' ? -1 : 1));
        next = toISO(d);
      } else return;

      e.preventDefault();
      if (next < TODAY) next = TODAY;
      if (next > HORIZON) next = HORIZON;
      const d = toDate(next);
      if (d.getUTCFullYear() !== viewY || d.getUTCMonth() !== viewM) {
        setView(next); renderCal(next);
      } else {
        const t = $(`.cal__d[data-iso="${next}"]`, calGrid);
        if (t) { $$('.cal__d', calGrid).forEach(x => x.tabIndex = -1); t.tabIndex = 0; t.focus(); }
      }
    });

    $$('[data-cal]').forEach(b => b.addEventListener('click', () => {
      const d = new Date(Date.UTC(viewY, viewM + (+b.dataset.cal), 1, 12));
      viewY = d.getUTCFullYear(); viewM = d.getUTCMonth();
      renderCal();
    }));

    /* ---- время: слоты зависят от дня недели, сегодня отсекаем прошедшие -- */
    const timesBox = $('#times'), timeNote = $('#time-note');

    function renderTimes() {
      const iso = dateIn.value;
      if (!iso) return;
      const last = LAST_SLOT[dow(iso)];
      const isToday = iso === TODAY;
      const earliest = msk.min + LEAD_MIN;

      const chips = [];
      let free = 0;
      for (let h = FIRST_SLOT; h <= last; h++) {
        const label = `${String(h).padStart(2, '0')}:00`;
        const off = isToday && h * 60 < earliest;
        if (!off) free++;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(label === timeIn.value));
        b.disabled = off;
        b.dataset.time = label;
        b.textContent = label;
        if (off) b.setAttribute('aria-label', `${label} — время уже прошло`);
        chips.push(b);
      }
      timesBox.replaceChildren(...chips);

      // выбранное время могло стать недоступным на новую дату
      const active = chips.find(c => c.getAttribute('aria-checked') === 'true' && !c.disabled);
      if (!active) {
        timeIn.value = '';
        chips.forEach(c => c.setAttribute('aria-checked', 'false'));
      }

      timeNote.hidden = free > 0;
      if (!free) timeNote.textContent = 'На сегодня бронь уже закрыта — выберите другой день или позвоните нам.';
      else if (last < MAX_SLOT) {
        timeNote.hidden = false;
        timeNote.textContent = `Последняя посадка в ${String(last).padStart(2, '0')}:00.`;
      }

      if (hasGsap && !calm()) {
        gsap.fromTo(chips, { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: .28, ease: 'power2.out', stagger: .02, overwrite: true });
      }
    }

    timesBox.addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b || b.disabled) return;
      timeIn.value = b.dataset.time;
      $$('.chip', timesBox).forEach(c => c.setAttribute('aria-checked', String(c === b)));
      check('f-time');
      paintSummary();
    });
    timesBox.addEventListener('keydown', e => radioKeys(e, timesBox, b => {
      timeIn.value = b.dataset.time; check('f-time'); paintSummary();
    }));

    /* ---- залы и повод: плашки вместо системного выпадающего списка ----
       Сам <select> стилизуется, а вот список, который он открывает, рисует
       операционная система — на тёмной теме он выглядит чужеродно. Поэтому
       строим плашки поверх, а нативный select остаётся носителем значения. */
    const OCC_ICONS = {
      '':                  '<circle cx="12" cy="12" r="7.5"/>',
      'День рождения':     '<path d="M4.5 20.5h15M6 20.5v-5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5M9 13.5v-2m3 2v-2m3 2v-2M9 8.6V7.4m3 1.2V7.4m3 1.2V7.4"/>',
      'Годовщина':         '<path d="M12 20s-7-4.6-7-9.3A4 4 0 0 1 12 8.2 4 4 0 0 1 19 10.7C19 15.4 12 20 12 20Z"/>',
      'Деловой ужин':      '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5"/>',
      'Дегустация с шефом':'<path d="M12 4.6c2.3 2.9 1 4.5.3 6-.8 1.7.4 2.9 1.5 2.2 1.4-.8 1.6-2.5 1.6-2.5 1.7 1.8 2.7 3.8 2.7 5.8a6.1 6.1 0 1 1-12.2 0c0-3.9 3.2-6 4.5-8.7.5-1.3.9-2.2 1.6-2.8Z"/>'
    };

    function buildChips(box, select, icons) {
      box.replaceChildren(...[...select.options].map(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(o.value === select.value));
        b.dataset.val = o.value;
        b.tabIndex = o.value === select.value ? 0 : -1;
        if (icons && icons[o.value] !== undefined) {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
          svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
          svg.setAttribute('stroke-width', '1.6');
          svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
          svg.setAttribute('aria-hidden', 'true');
          svg.innerHTML = icons[o.value];
          b.append(svg);
        }
        b.append(document.createTextNode(o.textContent));
        return b;
      }));

      const pick = value => {
        select.value = value;
        $$('.chip', box).forEach(c => {
          const on = c.dataset.val === value;
          c.setAttribute('aria-checked', String(on));
          c.tabIndex = on ? 0 : -1;
        });
        paintSummary();
      };

      box.addEventListener('click', e => {
        const b = e.target.closest('.chip');
        if (b) pick(b.dataset.val);
      });
      box.addEventListener('keydown', e => radioKeys(e, box, b => pick(b.dataset.val)));
      return pick;
    }

    const zonesBox = $('#zones'), occsBox = $('#occs');
    const occIn = $('#f-occ');
    const pickZone = buildChips(zonesBox, zoneIn);
    const pickOcc  = buildChips(occsBox, occIn, OCC_ICONS);

    // стрелки внутри группы радио-плашек
    function radioKeys(e, box, apply) {
      const items = $$('.chip:not(:disabled)', box);
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      const map = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const next = items[(map[e.key] + items.length) % items.length];
      items.forEach(c => c.tabIndex = -1);
      next.tabIndex = 0; next.focus();
      $$('.chip', box).forEach(c => c.setAttribute('aria-checked', String(c === next)));
      apply(next);
    }

    /* ---- счётчик гостей ------------------------------------------------ */
    const cnt = $('#guests'), cntOut = $('#guests-out');
    const GUESTS = [...guestsIn.options].map(o => o.value);
    function paintGuests() {
      const i = GUESTS.indexOf(guestsIn.value);
      cntOut.textContent = guestsIn.value === '10+' ? '10+' : guestsIn.value;
      $('[data-g="-1"]', cnt).disabled = i <= 0;
      $('[data-g="1"]', cnt).disabled  = i >= GUESTS.length - 1;
      paintSummary();
    }
    $$('[data-g]', cnt).forEach(b => b.addEventListener('click', () => {
      const i = GUESTS.indexOf(guestsIn.value) + (+b.dataset.g);
      if (i < 0 || i >= GUESTS.length) return;
      guestsIn.value = GUESTS[i];
      check('f-guests');
      paintGuests();
      if (hasGsap && !calm()) gsap.fromTo(cntOut, { scale: .82 }, { scale: 1, duration: .3, ease: 'back.out(2)' });
    }));

    /* ---- строка сводки ------------------------------------------------- */
    const sumline = $('#sumline');
    function paintSummary() {
      if (!form.classList.contains('upgraded')) return;
      const parts = [];
      if (dateIn.value) parts.push(cap(fmtShort.format(toDate(dateIn.value))));
      if (timeIn.value) parts.push(timeIn.value);
      const head = parts.join(' · ');
      sumline.hidden = !head;
      if (!head) return;
      sumline.replaceChildren(
        Object.assign(document.createElement('b'), { textContent: head }),
        Object.assign(document.createElement('span'), {
          textContent: `${guestWord(guestsIn.value)} · ${zoneIn.value.toLowerCase()}`
                     + (occIn.value ? ` · ${occIn.value.toLowerCase()}` : '')
        })
      );
    }

    /* ---- шаги ---------------------------------------------------------- */
    const step1 = $('#step-1'), step2 = $('#step-2');
    const backBtn = $('#step-back'), nextBtn = $('#step-next');
    const prog = $('#book-prog'), progText = $('#book-steps'), progBar = $('#book-bar-i');
    const STEP_NAMES = ['Когда и сколько вас', 'Как с вами связаться'];
    let step = 1;

    function showStep(n, focus = true) {
      step = n;
      step1.hidden = n !== 1;
      step2.hidden = n !== 2;
      backBtn.hidden = n === 1;
      nextBtn.hidden = n !== 1;
      submitBtn.hidden = n !== 2;
      progText.innerHTML = `<b>Шаг ${n}</b> из 2 · ${STEP_NAMES[n - 1]}`;
      progBar.style.width = `${n * 50}%`;
      const panel = n === 1 ? step1 : step2;
      if (hasGsap && !calm()) {
        gsap.fromTo(panel, { opacity: 0, x: n === 2 ? 24 : -24 },
          { opacity: 1, x: 0, duration: .38, ease: 'power3.out', overwrite: true });
      }
      if (focus) {
        const t = n === 1 ? $('.cal__d[tabindex="0"]', calGrid) : $('#f-name');
        if (t) t.focus({ preventScroll: true });
      }
      $('#book-body') && ($('#book-body').scrollTop = 0);
    }

    nextBtn.addEventListener('click', () => {
      const bad = ['f-date', 'f-time', 'f-guests'].filter(id => !check(id));
      if (bad.length) { showErrors(bad); return; }
      summary.hidden = true;
      showStep(2);
    });
    backBtn.addEventListener('click', () => showStep(1));

    /* ---- валидация ----------------------------------------------------- */
    const RULES = {
      'f-name':   v => v.trim().length >= 2 || 'Укажите имя — минимум две буквы, чтобы мы знали, к кому обращаться.',
      'f-tel':    v => { const d = (v.match(/\d/g) || []).length; return (d >= 10 && d <= 12) || 'Введите номер телефона полностью, например +7 900 000-00-00.'; },
      'f-date':   v => {
        if (!v) return 'Выберите дату визита.';
        if (v < TODAY)   return 'Эта дата уже прошла — выберите сегодняшний день или позже.';
        if (v > HORIZON) return 'Брони принимаем на 60 дней вперёд. Для более дальних дат позвоните нам.';
        return true;
      },
      'f-time':   v => !!v || 'Выберите время — стол держим 20 минут после назначенного часа.',
      'f-guests': v => !!v || 'Укажите количество гостей.',
      'f-ok':     (_, el) => el.checked || 'Нужно согласие на обработку данных — иначе мы не сможем перезвонить.'
    };
    const STEP_OF = { 'f-date': 1, 'f-time': 1, 'f-guests': 1, 'f-name': 2, 'f-tel': 2, 'f-ok': 2 };
    const LABELS  = { 'f-date': 'Дата', 'f-time': 'Время', 'f-guests': 'Гостей',
                      'f-name': 'Имя', 'f-tel': 'Телефон', 'f-ok': 'Согласие' };

    function setError(id, msg) {
      const el = $('#' + id);
      const wrap = el.closest('.fld, .f');
      const mirror = wrap.querySelector('[data-err-mirror]');
      let node = $('.err', wrap);
      const errId = id + '-err';

      const link = (target, on) => {
        if (!target) return;
        const rest = (target.getAttribute('aria-describedby') || '')
          .split(/\s+/).filter(t => t && t !== errId);
        if (on) {
          target.setAttribute('aria-describedby', [errId, ...rest].join(' '));
          target.setAttribute('aria-invalid', 'true');
        } else {
          rest.length ? target.setAttribute('aria-describedby', rest.join(' '))
                      : target.removeAttribute('aria-describedby');
          target.removeAttribute('aria-invalid');
        }
      };

      if (msg) {
        if (!node) {
          node = document.createElement('span');
          node.className = 'err';
          node.id = errId;
          wrap.appendChild(node);
        }
        node.textContent = msg;
        link(el, true); link(mirror, true);
      } else if (node) {
        link(el, false); link(mirror, false);
        node.remove();
      }
    }

    function check(id) {
      const el = $('#' + id);
      const res = RULES[id](el.value, el);
      setError(id, res === true ? null : res);
      return res === true;
    }

    function focusField(id) {
      if (STEP_OF[id] !== step) showStep(STEP_OF[id], false);
      const wrap = $('#' + id).closest('.fld, .f');
      const mirror = wrap.querySelector('[data-err-mirror]');
      const inWidget = mirror && form.classList.contains('upgraded')
        ? mirror.querySelector('[tabindex="0"]:not(:disabled), button:not(:disabled)') : null;
      (inWidget || $('#' + id)).focus({ preventScroll: false });
    }

    function showErrors(bad) {
      sumList.replaceChildren(...bad.map(id => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#' + id;
        a.textContent = `${LABELS[id]}: ${$('#' + id + '-err').textContent}`;
        a.addEventListener('click', ev => { ev.preventDefault(); focusField(id); });
        li.appendChild(a);
        return li;
      }));
      summary.hidden = false;
      if (STEP_OF[bad[0]] !== step) showStep(STEP_OF[bad[0]], false);
      summary.focus({ preventScroll: false });
      live.textContent = `Не отправлено: ошибок — ${bad.length}.`;
    }

    let attempted = false;
    Object.keys(RULES).forEach(id => {
      const el = $('#' + id);
      const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'blur';
      el.addEventListener(ev, () => { if (attempted || el.value) check(id); });
      el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(id); });
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      attempted = true;
      const bad = Object.keys(RULES).filter(id => !check(id));
      if (bad.length) { showErrors(bad); return; }

      summary.hidden = true;
      sumList.replaceChildren();
      submitBtn.classList.add('is-busy');
      submitBtn.disabled = true;
      live.textContent = 'Отправляем заявку…';

      const data = Object.fromEntries(new FormData(form).entries());
      const endpoint = form.dataset.endpoint;

      try {
        if (endpoint) {
          const r = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
          });
          if (!r.ok) throw new Error('HTTP ' + r.status);
        } else {
          // Демо-режим: бэкенда нет. Укажите URL в data-endpoint у <form>.
          console.info('[ЧУГУН] Бронь (демо, не отправлено на сервер):', data);
          await new Promise(res => setTimeout(res, 700));
        }

        $('#done-sum').textContent =
          `${data.name}, ждём вас ${cap(fmtShort.format(toDate(data.date)))} в ${data.time}. ` +
          `${cap(guestWord(data.guests))}, ${data.zone.toLowerCase()}.`;

        form.hidden = true;
        if (prog) prog.hidden = true;
        done.hidden = false;
        done.focus({ preventScroll: false });
        live.textContent = 'Заявка принята.';
        if (hasGsap && !calm()) gsap.fromTo(done, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .45, ease: 'power3.out' });
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
        submitBtn.classList.remove('is-busy');
        submitBtn.disabled = false;
      }
    });

    $('#res-again').addEventListener('click', () => {
      form.reset();
      dateIn.value = TODAY;
      attempted = false;
      Object.keys(RULES).forEach(id => setError(id, null));
      done.hidden = true;
      form.hidden = false;
      if (prog) prog.hidden = false;
      setView(TODAY); renderCal();
      renderTimes(); paintGuests(); pickZone(zoneIn.value); pickOcc(occIn.value);
      showStep(1);
    });

    /* ---- включаем свои виджеты и переносим форму в модальное окно ------- */
    const dlg = $('#book'), bookBody = $('#book-body'), host = $('#res-host'), cta = $('#res-cta');

    if (dlg && bookBody && typeof dlg.showModal === 'function') {
      form.classList.add('upgraded');
      cal.hidden = false; timesBox.hidden = false; cnt.hidden = false;
      zonesBox.hidden = false; occsBox.hidden = false;
      prog.hidden = false;
      bookBody.append(form, done);
      host.hidden = true;
      cta.hidden = false;

      setView(dateIn.value); renderCal(); renderTimes(); paintGuests();
      pickZone(zoneIn.value); pickOcc(occIn.value);
      showStep(1, false);

      let opener = null;
      const openBook = (zone, trigger) => {
        opener = trigger || null;
        if (zone) pickZone(zone);
        dlg.showModal();
        document.body.style.overflow = 'hidden';
        if (hasGsap && !calm()) {
          const narrow = innerWidth < 700;
          gsap.fromTo($('.book__in', dlg),
            { opacity: 0, x: narrow ? 0 : 40, y: narrow ? 30 : 0 },
            { opacity: 1, x: 0, y: 0, duration: .42, ease: 'expo.out' });
        }
      };

      // все «Забронировать» открывают окно, а не прыгают к секции
      $$('a[href="#reserve"]').forEach(a => { a.dataset.bookOpen = ''; });
      document.addEventListener('click', e => {
        const t = e.target.closest('[data-book-open]');
        if (!t) return;
        e.preventDefault();
        openBook(t.dataset.zone, t);
      });

      $$('[data-book-close]', dlg).forEach(b => b.addEventListener('click', () => dlg.close()));
      dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', () => {
        document.body.style.overflow = '';
        if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
      });
    } else {
      // модального окна нет — форма остаётся в секции на нативных полях
      if (cta) cta.hidden = true;
      showStep(1, false);
      step1.hidden = false; step2.hidden = false;
      nextBtn.hidden = true; backBtn.hidden = true; submitBtn.hidden = false;
    }
  }

  /* ── 10. ЖИВОЙ СТАТУС «СЕЙЧАС ОТКРЫТО» ──────────────────────────────
     Считаем по московскому времени, а не по часам гостя: иначе человек
     из Берлина увидит «закрыто», когда в зале полный сервис. Плашка
     появляется только здесь — без скрипта остаётся статичное расписание. */
  const nowChip = $('#open-now'), nowText = $('#open-now-t');
  if (nowChip && nowText) {
    const OPEN = 12 * 60;                                   // открываемся в 12:00
    const CLOSE = [23 * 60, 22 * 60, 22 * 60, 22 * 60, 22 * 60, 23 * 60, 23 * 60]; // вс…сб
    const hhmm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

    const paint = () => {
      let day, min;
      try { ({ day, min } = moscowNow()); } catch { nowChip.hidden = true; return; }
      const prev = (day + 6) % 7;
      let open = false, until = 0;

      if (min >= OPEN && min < CLOSE[day]) {                 // обычный сервис
        open = true; until = CLOSE[day];
      } else if (CLOSE[prev] > 24 * 60 && min < CLOSE[prev] - 24 * 60) {
        open = true; until = CLOSE[prev] - 24 * 60;          // ночь пятницы и субботы
      }

      nowChip.dataset.state = open ? 'open' : 'closed';
      nowText.textContent = open
        ? `Сейчас открыто · до ${hhmm(until)}`
        : (min < OPEN ? 'Закрыто · откроемся в 12:00' : 'Закрыто · завтра с 12:00');
      nowChip.hidden = false;
    };

    paint();
    setInterval(paint, 60000);
  }

  /* ── 11. КОПИРОВАНИЕ АДРЕСА ─────────────────────────────────────────── */
  $$('[data-copy]').forEach(btn => {
    const label = $('.info__copy-t', btn);
    const original = label.textContent;
    let timer;
    btn.addEventListener('click', async () => {
      clearTimeout(timer);
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        label.textContent = 'Адрес скопирован';
        btn.dataset.done = '1';
      } catch {
        // буфер недоступен (не защищённый контекст или запрет) — говорим честно
        label.textContent = 'Скопируйте вручную';
      }
      timer = setTimeout(() => { label.textContent = original; delete btn.dataset.done; }, 2600);
    });
  });

  /* ── 12. ФОНОВОЕ ВИДЕО ПЕРВОГО ЭКРАНА ───────────────────────────────
     Постер отрисован сразу и остаётся LCP; видео подгружается отдельно
     и проявляется, только когда реально пошло. Не грузим совсем при
     prefers-reduced-motion и в режиме экономии трафика.
     Движущийся контент, который стартует сам, по WCAG 2.2.2 обязан
     иметь способ остановки — отсюда кнопка паузы, а не просто autoplay. */
  const heroVid = $('#hero-vid'), motionBtn = $('#hero-motion'), motionTxt = $('#hero-motion-t');

  if (heroVid && motionBtn) {
    // ролик весит около полутора мегабайт, поэтому не тянем его при экономии
    // трафика и на заведомо медленной сети — постер там остаётся вместо него
    const conn = navigator.connection || {};
    const thin = !!conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || '');
    const source = matchMedia('(min-width: 56em)').matches
      ? heroVid.dataset.wide : heroVid.dataset.tall;
    let wanted = !calm() && !thin;          // чего хочет пользователь, а не что происходит

    const setBtn = playing => {
      motionBtn.hidden = false;
      motionBtn.dataset.state = playing ? 'playing' : 'paused';
      const label = playing ? 'Остановить фоновое видео' : 'Запустить фоновое видео';
      motionBtn.setAttribute('aria-label', label);
      motionTxt.textContent = label;
    };

    const start = () => {
      if (!heroVid.getAttribute('src')) {
        heroVid.setAttribute('src', source);
        heroVid.load();
      }
      const p = heroVid.play();
      if (p) p.catch(() => setBtn(false));   // автозапуск запрещён — остаётся постер
    };

    heroVid.addEventListener('playing', () => { heroVid.classList.add('is-on'); setBtn(true); });
    heroVid.addEventListener('error', () => { motionBtn.hidden = true; });

    motionBtn.addEventListener('click', () => {
      if (heroVid.paused) { wanted = true; start(); }
      else { wanted = false; heroVid.pause(); setBtn(false); }
    });

    // за пределами экрана видео крутить незачем — это батарея и процессор
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (!wanted) return;
        e.isIntersecting ? start() : heroVid.pause();
      }, { threshold: .08 }).observe($('.hero'));
    }

    wanted ? start() : setBtn(false);
  }

  /* ── 13. SMOOTH ANCHORS WITH REAL FOCUS MOVE ────────────────────────── */
  $$('a[href^="#"]:not([href="#"]):not([data-book-open])').forEach(a => {
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
