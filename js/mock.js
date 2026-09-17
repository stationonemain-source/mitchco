/* MitchCo mock-ups: concept switcher, cover boxes, and the scroll drivers
   for "Course by Course" (shingle install), "Drawn to Last" (ink-to-build wipe)
   and "Storm Desk" (calm-to-storm grade + inspection form). */
(function () {
  var PLATE_W = 3840, PLATE_H = 2160;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* A plate-shaped box that covers its stage like object-fit: cover, with a focal
     point, so canvas, images and SVG annotations all share one coordinate space. */
  function fitBox(box) {
    var stage = box.parentElement;
    var fx = parseFloat(box.dataset.fx || '0.62'), fy = parseFloat(box.dataset.fy || '0.45');
    var W = stage.clientWidth, H = stage.clientHeight;
    var s = Math.max(W / PLATE_W, H / PLATE_H);
    var bw = PLATE_W * s, bh = PLATE_H * s;
    box.style.width = bw + 'px'; box.style.height = bh + 'px';
    box.style.left = (W - bw) * fx + 'px'; box.style.top = (H - bh) * fy + 'px';
  }

  /* Progress of a tall pinned section: 0 when its top meets the viewport top,
     1 when its bottom meets the viewport bottom. */
  function pinProgress(section) {
    var r = section.getBoundingClientRect();
    var run = r.height - window.innerHeight;
    return run > 0 ? clamp(-r.top / run) : 0;
  }

  /* ---------- concept switcher ---------- */
  var concepts = $$('[data-concept]');
  var tabs = $$('.review-tab');
  function show(id, keepScroll) {
    // standalone pages carry one concept: fall back to whichever exists
    if (!id || !$('#' + id + '[data-concept]')) id = concepts.length ? concepts[0].id : 'c1';
    concepts.forEach(function (c) { c.hidden = c.id !== id; });
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.target === id)); });
    if (!keepScroll) window.scrollTo(0, 0);
    requestAnimationFrame(function () { layout(); tick(); });
    try { localStorage.setItem('mitchco-concept', id); } catch (e) {}
  }
  tabs.forEach(function (t) {
    if (!t.dataset.target) return;            // plain links on the public pages
    t.addEventListener('click', function () { history.replaceState(null, '', '#' + t.dataset.target); show(t.dataset.target); });
  });

  /* ---------- 1. Course by Course ---------- */
  var c1 = { section: $('#c1-film') };
  if (c1.section) {
    c1.canvas = $('#c1-canvas');
    // plates sit beside the poster, wherever the page lives (root or a subfolder)
    var imgBase = $('#c1 .plate-poster').getAttribute('src').replace(/deck-1600\.webp$/, '');
    c1.installer = new RoofCourses.Installer(c1.canvas, imgBase + 'deck-' + plateSize() + '.webp', imgBase + 'shingles-' + plateSize() + '.webp');
    c1.count = $('#c1-count');
    c1.total = $('#c1-total');
    c1.bar = $('#c1-bar');
    c1.steps = $$('#c1 .film-step');
    c1.marks = $$('#c1 .plate-mark');
    c1.close = $('#c1-close');
    c1.canvas.addEventListener('plates-ready', function () { c1.section.classList.add('is-ready'); tick(); });
  }
  function plateSize() { return Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1) > 2200 ? 2560 : 1600; }

  function driveC1() {
    if (!c1.section || c1.section.closest('[hidden]')) return;
    var p = pinProgress(c1.section);
    // hold the bare deck for the opening, finish the roof before the booking card
    var roof = clamp((p - 0.1) / 0.72);
    if (params.has('p')) roof = parseFloat(params.get('p'));
    if (c1.installer.ready) {
      c1.installer.set(reduce ? (p > 0.1 ? 1 : 0) : roof);
    }
    var st = RoofCourses.stats(roof);
    if (c1.count) c1.count.textContent = String(st.done);
    if (c1.total) c1.total.textContent = String(st.total);
    if (c1.bar) c1.bar.style.transform = 'scaleX(' + roof.toFixed(4) + ')';
    var active = roof <= 0.001 ? 0 : roof < 0.45 ? 1 : roof < 0.999 ? 2 : 3;
    c1.steps.forEach(function (s, i) { s.classList.toggle('is-on', i === active); });
    c1.marks.forEach(function (m) {
      var on = m.dataset.step === String(active);
      m.classList.toggle('is-on', on);
    });
    c1.section.classList.toggle('is-done', roof >= 0.999);
  }

  /* ---------- 2. Drawn to Last ---------- */
  var c2 = { section: $('#c2-film') };
  if (c2.section) {
    c2.photo = $('#c2-photo');
    c2.edge = $('#c2-edge');
    c2.dims = $('#c2-dims');
    c2.copyA = $('#c2-copy-a');
    c2.copyB = $('#c2-copy-b');
  }
  function driveC2() {
    if (!c2.section || c2.section.closest('[hidden]')) return;
    var p = pinProgress(c2.section);
    var w = reduce ? (p > 0.5 ? 1 : 0) : ease(clamp((p - 0.12) / 0.7));
    if (params.has('w')) w = parseFloat(params.get('w'));
    var pct = (w * 100).toFixed(2);
    c2.photo.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
    c2.edge.style.left = pct + '%';
    c2.edge.style.opacity = w > 0.005 && w < 0.995 ? '1' : '0';
    // On a phone the plate is cropped, so the wipe only crosses the screen for part
    // of its run. Normalise to the visible slice before handing the copy over.
    var box = c2.photo.parentElement, bw = box.offsetWidth || 1;
    var vl = Math.max(0, -box.offsetLeft / bw), vr = Math.min(1, (box.parentElement.clientWidth - box.offsetLeft) / bw);
    var wv = clamp((w - vl) / Math.max(0.01, vr - vl));
    var narrow = window.innerWidth <= 900;
    c2.dims.style.opacity = String(clamp(1 - wv * 1.6));
    c2.section.style.setProperty('--wv', wv.toFixed(3));
    c2.copyA.classList.toggle('is-on', wv < (narrow ? 0.6 : 0.1));
    c2.copyB.classList.toggle('is-on', wv > (narrow ? 0.85 : 0.34));
  }

  /* Before/after comparer: keyboard and pointer both move the same range input. */
  $$('.compare').forEach(function (cmp) {
    var range = $('input[type=range]', cmp), top = $('.compare-top', cmp), handle = $('.compare-handle', cmp);
    function set() {
      var v = range.value;
      top.style.clipPath = 'inset(0 ' + (100 - v) + '% 0 0)';
      handle.style.left = v + '%';
    }
    range.addEventListener('input', set); set();
  });

  /* Project planner: three short steps, one question each. */
  $$('.planner').forEach(function (form) {
    var steps = $$('.planner-step', form), meter = $('.planner-meter span', form), label = $('.planner-count', form);
    var i = 0;
    function go(n) {
      i = Math.max(0, Math.min(steps.length - 1, n));
      steps.forEach(function (s, k) { s.hidden = k !== i; });
      if (meter) meter.style.transform = 'scaleX(' + ((i + 1) / steps.length) + ')';
      if (label) label.textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
    }
    $$('[data-next]', form).forEach(function (b) { b.addEventListener('click', function () { go(i + 1); }); });
    $$('[data-back]', form).forEach(function (b) { b.addEventListener('click', function () { go(i - 1); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var done = $('.planner-done', form);
      steps.forEach(function (s) { s.hidden = true; });
      if (done) done.hidden = false;
    });
    go(0);
  });

  /* Mock forms never send anything. Say so instead of pretending. */
  $$('form.mock-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = $('.form-note', f);
      if (note) note.textContent = 'Mock-up only: nothing was sent. On the live site this books the inspection and texts the office.';
    });
  });

  /* ---------- 3. Storm Desk ---------- */
  var c3 = { section: $('#c3-hero') };
  if (c3.section) { c3.storm = $('#c3-storm'); }
  function driveC3() {
    if (!c3.section || c3.section.closest('[hidden]')) return;
    var r = c3.section.getBoundingClientRect();
    // the storm passes as the visitor scrolls toward the inspection form
    var t = clamp(-r.top / Math.max(1, r.height * 0.7));
    if (c3.storm) c3.storm.style.opacity = String(reduce ? 1 : 1 - ease(t));
  }

  /* ---------- loop ---------- */
  var queued = false;
  function tick() {
    queued = false;
    driveC1(); driveC2(); driveC3();
  }
  function onScroll() { if (!queued) { queued = true; requestAnimationFrame(tick); } }
  function layout() {
    $$('.plate-box').forEach(function (b) { if (!b.closest('[hidden]')) fitBox(b); });
    if (c1.installer && c1.installer.ready && !c1.section.closest('[hidden]')) { c1.installer.resize(); c1.installer.drawn = false; c1.installer.draw(); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { layout(); tick(); });

  window.addEventListener('hashchange', function () {
    var id = location.hash.slice(1);
    if (/^c[123]$/.test(id)) show(id);
  });

  var start = (location.hash || '').slice(1);
  if (!/^c[123]$/.test(start)) start = '';
  if (!start) { try { start = localStorage.getItem('mitchco-concept') || 'c1'; } catch (e) { start = 'c1'; } }
  show(start, true);
  if (params.has('y')) window.scrollTo(0, parseInt(params.get('y'), 10));
  layout(); tick();
})();
