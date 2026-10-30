// Anatomie d'un type de page (docs/design/<type>.html) : partie commune aux quatre pages.
// La page déclare window.ANATOMY = { native: largeur réelle de .mini en px, zones: [{ id, side: "L"|"R", name, field, desc, rule, parts }] }
// parts (facultatif) : les éléments de la zone, numérotés 1.1, 1.2… ; dans la page générique, l'élément n porte data-part="n".
// puis charge ce fichier. Il crée les étiquettes et les fiches, met la page générique à l'échelle, trace les traits,
// gère le survol et la bascule Vraie vue / Squelette, et dessine les titres et pictogrammes en points.
(function () {
  "use strict";
  var A = window.ANATOMY || { native: 1320, zones: [] };
  var diag = document.getElementById("diag"), stage = document.getElementById("stage"), mini = document.getElementById("mini");
  var svg = document.getElementById("leaders"), NS = "http://www.w3.org/2000/svg";
  var pinsL = document.getElementById("pinsL"), pinsR = document.getElementById("pinsR"), list = document.getElementById("list");
  mini.style.width = A.native + "px";

  // étiquettes et fiches
  A.zones.forEach(function (z, i) {
    var pin = document.createElement("button");
    pin.type = "button"; pin.className = "a-pin"; pin.dataset.zone = z.id;
    pin.innerHTML = '<span class="a-pin-title"><span class="a-num">' + (i + 1) + '</span><span>' + z.name + '</span></span><span class="a-field">' + z.field + '</span>';
    (z.side === "L" ? pinsL : pinsR).appendChild(pin);
    var li = document.createElement("li");
    li.className = "a-item"; li.dataset.zone = z.id; li.tabIndex = 0;
    var parts = (z.parts || []).map(function (t, j) {
      return '<li data-part="' + (i + 1) + '.' + (j + 1) + '"><span class="a-subnum">' + (i + 1) + '.' + (j + 1) + '</span><span>' + t + '</span></li>';
    }).join("");
    li.innerHTML = '<span class="a-num"' + (parts ? ' style="grid-row: span 4"' : '') + '>' + (i + 1) + '</span><h3>' + z.name + ' <code>' + z.field + '</code></h3><p>' + z.desc + '</p>'
      + (parts ? '<ul class="a-parts">' + parts + '</ul>' : '') + '<p class="a-rule">' + z.rule + '</p>';
    list.appendChild(li);
    // pastilles 1.1, 1.2… sur les éléments de la zone
    var zone = mini.querySelector('[data-zone="' + z.id + '"]');
    if (zone) zone.querySelectorAll("[data-part]").forEach(function (el) {
      var b = document.createElement("span");
      b.className = "badge sub"; b.textContent = (i + 1) + "." + el.dataset.part;
      el.dataset.part = b.textContent;
      el.appendChild(b);
    });
  });

  // surlignage : étiquette, fiche ou zone de la page
  function activate(id) {
    document.querySelectorAll("[data-zone]").forEach(function (el) { el.classList.toggle("is-active", !!id && el.dataset.zone === id); });
  }
  document.querySelectorAll(".a-pin, .a-item, .mini [data-zone]").forEach(function (el) {
    el.addEventListener("mouseenter", function () { activate(el.dataset.zone); });
    el.addEventListener("mouseleave", function () { activate(null); });
    el.addEventListener("focus", function () { activate(el.dataset.zone); });
    el.addEventListener("blur", function () { activate(null); });
  });

  // surlignage d'un élément : sa ligne dans la fiche et l'élément dans la page
  function activatePart(id) {
    document.querySelectorAll("[data-part]").forEach(function (el) { el.classList.toggle("is-part", !!id && el.dataset.part === id); });
  }
  document.querySelectorAll(".a-parts li, .mini [data-part]").forEach(function (el) {
    el.addEventListener("mouseenter", function () { activatePart(el.dataset.part); });
    el.addEventListener("mouseleave", function () { activatePart(null); });
  });

  // bascule vraie vue / squelette
  var btns = document.querySelectorAll(".a-switch button");
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      mini.classList.toggle("sk", b.dataset.view === "skeleton");
      btns.forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
    });
  });

  // police 5 × 7 (celle des pages du site) : titres en points
  var F = {
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
    L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    " ": ["..", "..", "..", "..", "..", "..", ".."]
  };
  // accentLast : le dernier mot en points éteints sur un fond de points d'accent (titre de la homePage)
  // sans data-pitch, l'écart entre les points découle de la largeur du canvas
  function drawTitle(cv, text, accentLast, lit) {
    var ctx = cv.getContext("2d"), cols = [], lastWordCol = 0;
    text.split("").forEach(function (ch, i) {
      if (ch === " ") lastWordCol = cols.length + F[" "][0].length;
      var g = F[ch];
      for (var c = 0; c < g[0].length; c++) cols.push(g.map(function (r) { return r[c] === "#"; }));
      if (i < text.length - 1) cols.push([false, false, false, false, false, false, false]);
    });
    var pad = 1, total = cols.length + pad * 2, rows = 7 + pad * 2, accentFrom = accentLast ? lastWordCol + pad : Infinity;
    // data-pitch : écart fixe entre les points, en px ; la largeur du titre suit alors la longueur du texte (canvas en double résolution)
    if (cv.dataset.pitch) { var pp = +cv.dataset.pitch; cv.width = total * pp * 2; cv.style.width = total * pp + "px"; }
    var pitch = cv.width / total, r = pitch * 0.36;
    cv.height = Math.round(rows * pitch);
    for (var x = 0; x < total; x++) for (var y = 0; y < rows; y++) {
      var col = cols[x - pad], on = col && y >= pad && y < 7 + pad && col[y - pad];
      var inWord = x >= accentFrom, accent = inWord && !on, isLit = on && !inWord;
      ctx.beginPath();
      ctx.fillStyle = isLit ? (lit || "#f2f0e9") : accent ? "#10b981" : "#171717";
      ctx.arc(x * pitch + pitch / 2, y * pitch + pitch / 2, isLit || accent ? r : r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  document.querySelectorAll("canvas[data-title]").forEach(function (cv) {
    drawTitle(cv, cv.dataset.title, cv.hasAttribute("data-accent-last"), cv.dataset.lit);
  });

  // pictogrammes 7 × 7 génériques
  var PICS = {
    a: ["#######", "#.....#", "#.###.#", "#.#.#.#", "#.###.#", "#.....#", "#######"],
    b: ["...#...", "..###..", ".#####.", "#######", ".#####.", "..###..", "...#..."],
    c: ["###.###", "###.###", "###.###", ".......", "###.###", "###.###", "###.###"],
    d: [".#####.", "#.....#", "#.#.#.#", "#.....#", "#.###.#", "#.....#", ".#####."]
  };
  document.querySelectorAll("canvas[data-pic]").forEach(function (cv) {
    var g = PICS[cv.dataset.pic], ctx = cv.getContext("2d"), p = cv.width / 7;
    for (var y = 0; y < 7; y++) for (var x = 0; x < 7; x++) {
      ctx.beginPath();
      ctx.fillStyle = g[y][x] === "#" ? "#f2f0e9" : "#1c1c1c";
      ctx.arc(x * p + p / 2, y * p + p / 2, p * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // mise à l'échelle de la page générique et tracé des traits
  function layout() {
    var s = stage.clientWidth / A.native;
    mini.style.transform = "scale(" + s + ")";
    stage.style.height = Math.ceil(mini.offsetHeight * s) + "px";
    svg.textContent = "";
    if (getComputedStyle(pinsL).display === "none") return;
    var d = diag.getBoundingClientRect(), st = stage.getBoundingClientRect();
    [[pinsL, true], [pinsR, false]].forEach(function (pair) {
      var col = pair[0], left = pair[1], prev = -Infinity;
      var colTop = col.getBoundingClientRect().top - d.top;
      Array.prototype.forEach.call(col.children, function (pin) {
        var zr = mini.querySelector('[data-zone="' + pin.dataset.zone + '"]').getBoundingClientRect();
        var ty = zr.top - d.top + Math.min(zr.height / 2, 60 * s + 20);
        var h = pin.offsetHeight, top = Math.max(ty - colTop - h / 2, prev + 10, 0);
        pin.style.top = top + "px";
        prev = top + h;
        var pr = pin.getBoundingClientRect(), py = pr.top - d.top + 15;
        var x0 = left ? pr.right - d.left + 8 : pr.left - d.left - 8;
        var x1 = left ? st.left - d.left - 12 : st.right - d.left + 12;
        var tx = left ? zr.left - d.left - 6 * s : zr.right - d.left + 6 * s;
        var g = document.createElementNS(NS, "g"); g.dataset.zone = pin.dataset.zone;
        var path = document.createElementNS(NS, "path");
        path.setAttribute("d", "M" + x0 + " " + py + " H" + x1 + " L" + tx + " " + ty);
        var dot = document.createElementNS(NS, "circle");
        dot.setAttribute("cx", tx); dot.setAttribute("cy", ty); dot.setAttribute("r", 4.5);
        g.appendChild(path); g.appendChild(dot); svg.appendChild(g);
      });
    });
  }
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(diag); else window.addEventListener("resize", layout);
})();
