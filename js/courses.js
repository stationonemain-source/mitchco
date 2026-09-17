/* Course-by-course shingle install, driven by a progress value 0..1.
   Two pixel-registered plates: deck (bare OSB roof, real house everywhere else)
   and shingles (finished roof only, alpha outside the roof). Each roof plane is a
   polygon in 3840x2160 plate space with its eave line; courses are bands parallel
   to the eave, laid from the eave up, each band run left to right. */
(function () {
  var PLATE_W = 3840, PLATE_H = 2160, BAND = 26;

  // [polygon], [eaveStart, eaveEnd], [start, end] window in overall progress
  var PLANES = [
    { id: 'porch',    poly: [[1404,1068],[2052,1040],[2195,1150],[1125,1182]], eave: [[1125,1182],[2195,1150]], win: [0.00, 0.26] },
    { id: 'garage',   poly: [[2505,995],[3000,956],[3150,1168],[2205,1180]],   eave: [[2205,1180],[3150,1168]], win: [0.06, 0.34] },
    { id: 'garageHi', poly: [[3125,828],[3285,822],[3600,1168],[3150,1168],[3000,956]], eave: [[3150,1168],[3600,1168]], win: [0.14, 0.44] },
    { id: 'garageR',  poly: [[3285,822],[3870,1190],[3600,1168]],             eave: [[3600,1168],[3870,1190]], win: [0.18, 0.44] },
    { id: 'gableS',   poly: [[1432,659],[1650,695],[1722,704],[1722,900],[1609,904]], eave: [[1609,904],[1722,900]], win: [0.30, 0.52] },
    { id: 'between',  poly: [[1648,682],[1842,582],[1752,735],[1708,702]],    eave: [[1700,735],[1760,735]],   win: [0.34, 0.54] },
    { id: 'gableT',   poly: [[1920,478],[2232,545],[2245,778],[2170,765]],    eave: [[2170,765],[2245,778]],   win: [0.36, 0.62] },
    { id: 'mainF',    poly: [[2030,485],[2835,348],[3000,736],[2245,778],[2232,545],[1935,478]], eave: [[2245,778],[3000,736]], win: [0.46, 0.93] },
    { id: 'mainR',    poly: [[2835,348],[3000,736],[3565,890]],               eave: [[3000,736],[3565,890]],   win: [0.52, 0.96] }
  ];

  /* Traced outlines sit a few px inside the real roof edge, which left bare-wood
     slivers along eaves and ridges. Grow every outline outward; the draw step then
     subtracts the neighbours' exact outlines so shared hip/valley lines stay put. */
  var GROW = 22;
  function grow(poly, d) {
    var n = poly.length, area = 0, out = [];
    for (var i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n];
      area += a[0] * b[1] - b[0] * a[1];
    }
    var sgn = area > 0 ? 1 : -1;
    for (var j = 0; j < n; j++) {
      var prev = poly[(j + n - 1) % n], cur = poly[j], next = poly[(j + 1) % n];
      var n1 = edgeNormal(prev, cur, sgn), n2 = edgeNormal(cur, next, sgn);
      var mx = n1[0] + n2[0], my = n1[1] + n2[1], ml = Math.hypot(mx, my) || 1;
      mx /= ml; my /= ml;
      var k = d / Math.max(0.35, mx * n2[0] + my * n2[1]);
      out.push([cur[0] + mx * k, cur[1] + my * k]);
    }
    return out;
  }
  function edgeNormal(a, b, sgn) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [sgn * dy / l, -sgn * dx / l];
  }

  PLANES.forEach(function (p) {
    p.outer = grow(p.poly, GROW);
    var o = p.eave[0], e = p.eave[1];
    var dx = e[0] - o[0], dy = e[1] - o[1], len = Math.hypot(dx, dy);
    var dir = [dx / len, dy / len];
    var up = [dir[1], -dir[0]];                 // perpendicular
    var cx = 0, cy = 0;
    p.poly.forEach(function (q) { cx += q[0]; cy += q[1]; });
    cx /= p.poly.length; cy /= p.poly.length;
    if ((cx - o[0]) * up[0] + (cy - o[1]) * up[1] < 0) up = [-up[0], -up[1]];
    var uMin = Infinity, uMax = -Infinity, vMax = 0;
    p.poly.forEach(function (q) {
      var rx = q[0] - o[0], ry = q[1] - o[1];
      var u = rx * dir[0] + ry * dir[1], v = rx * up[0] + ry * up[1];
      uMin = Math.min(uMin, u); uMax = Math.max(uMax, u); vMax = Math.max(vMax, v);
    });
    p.o = o; p.dir = dir; p.up = up;
    p.uMin = uMin - GROW - 8; p.uMax = uMax + GROW + 8; p.vMin = -GROW - 8; p.vMax = vMax + GROW + 8;
    p.bands = Math.max(3, Math.ceil((p.vMax - p.vMin) / BAND));
  });

  function path(ctx, poly) {
    poly.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.closePath();
  }
  function pt(p, u, v) {
    return [p.o[0] + p.dir[0] * u + p.up[0] * v, p.o[1] + p.dir[1] * u + p.up[1] * v];
  }
  function quad(ctx, p, u0, u1, v0, v1) {
    var a = pt(p, u0, v0), b = pt(p, u1, v0), c = pt(p, u1, v1), d = pt(p, u0, v1);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
  }

  /* Returns {done, laying} for readouts: courses finished and total. */
  function stats(progress) {
    var done = 0, total = 0;
    PLANES.forEach(function (p) {
      var t = clamp((progress - p.win[0]) / (p.win[1] - p.win[0]));
      total += p.bands; done += Math.floor(t * p.bands);
    });
    return { done: done, total: total };
  }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  function Installer(canvas, deckSrc, shingleSrc) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mask = document.createElement('canvas');
    this.mctx = this.mask.getContext('2d');
    this.progress = 0;
    this.focusX = 0.66;               // keep the roof in frame on narrow screens
    this.focusY = 0.42;
    this.ready = false;
    var self = this;
    Promise.all([load(deckSrc), load(shingleSrc)]).then(function (imgs) {
      self.deck = imgs[0]; self.shingles = imgs[1]; self.ready = true;
      self.resize(); self.draw();
      canvas.dispatchEvent(new CustomEvent('plates-ready'));
    }).catch(function () {
      // the poster stays up; the page still reads, it just doesn't animate
      if (window.console) console.warn('Roof plates failed to load');
    });
  }
  /* Plain <img> loading: works under a strict connect-src, where fetch() of the
     page's own files can be refused. Two plates only, so the decoded-image cache
     cost that pushed the Tower build to blobs does not matter here. */
  function load(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        (window.createImageBitmap ? createImageBitmap(img) : Promise.resolve(img)).then(resolve, function () { resolve(img); });
      };
      img.onerror = reject;
      img.src = src;
    });
  }
  Installer.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.mask.width = this.canvas.width; this.mask.height = this.canvas.height;
    var s = Math.max(this.canvas.width / PLATE_W, this.canvas.height / PLATE_H);
    var ox = (this.canvas.width - PLATE_W * s) * this.focusX;
    var oy = (this.canvas.height - PLATE_H * s) * this.focusY;
    this.fit = { s: s, ox: ox, oy: oy };
  };
  Installer.prototype.set = function (p) {
    p = clamp(p);
    if (Math.abs(p - this.progress) < 0.0004 && this.drawn) return;
    this.progress = p; this.draw();
  };
  Installer.prototype.draw = function () {
    if (!this.ready || !this.canvas.width || !this.canvas.height) return;   // hidden concept: nothing to paint
    var ctx = this.ctx, m = this.mctx, f = this.fit, W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.deck, f.ox, f.oy, PLATE_W * f.s, PLATE_H * f.s);
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, W, H);
    m.setTransform(f.s, 0, 0, f.s, f.ox, f.oy);
    m.fillStyle = '#fff';
    var prog = this.progress;
    if (prog >= 0.999) {                      // finished roof is exactly the photograph
      ctx.drawImage(this.shingles, f.ox, f.oy, PLATE_W * f.s, PLATE_H * f.s);
      this.drawn = true;
      return;
    }
    PLANES.forEach(function (p) {
      var t = clamp((prog - p.win[0]) / (p.win[1] - p.win[0]));
      if (t <= 0) return;
      var pos = t * p.bands, k = Math.floor(pos), frac = pos - k;
      var bh = (p.vMax - p.vMin) / p.bands;
      m.save();
      m.beginPath();
      path(m, p.outer);
      m.clip();
      m.beginPath();
      m.rect(-PLATE_W, -PLATE_H, PLATE_W * 3, PLATE_H * 3);
      PLANES.forEach(function (other) { if (other !== p) path(m, other.poly); });
      m.clip('evenodd');
      m.beginPath();
      if (k > 0) quad(m, p, p.uMin, p.uMax, p.vMin, p.vMin + bh * k);
      if (frac > 0 && k < p.bands) quad(m, p, p.uMin, p.uMin + (p.uMax - p.uMin) * frac, p.vMin + bh * k, p.vMin + bh * (k + 1));
      m.fill();
      m.restore();
    });
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-in';
    m.drawImage(this.shingles, f.ox, f.oy, PLATE_W * f.s, PLATE_H * f.s);
    ctx.drawImage(this.mask, 0, 0);
    this.drawn = true;
  };
  /* Plate-space point -> CSS pixels inside the canvas, for pinning callouts. */
  Installer.prototype.project = function (x, y) {
    var dpr = this.canvas.width / this.canvas.clientWidth, f = this.fit;
    return [(f.ox + x * f.s) / dpr, (f.oy + y * f.s) / dpr];
  };

  window.RoofCourses = { Installer: Installer, stats: stats, planes: PLANES };
})();
