/*
 * Dot Glucose : le rendu, partagé par la maquette de référence (mockups/reference.html), Dot Page
 * et, plus tard, le module servi par Dot Companion. Une seule source : ce qui est vu dans la maquette
 * est exactement ce qui tourne ailleurs.
 *
 *   var g = DotGlucose.mount(stage, { size: "xl", settings: function () { … }, now: function () { … } });
 *   g.render();          // quand un réglage change
 *   g.setSize("xl");     // pour l'instant, seul le XL est dessiné
 *   g.animate(false);    // arrête la mise à jour de l'âge de la mesure (vue cachée)
 *
 * `stage` reçoit la classe .dot-glucose et la taille de l'emplacement. Réglages (tous facultatifs) :
 * sample (range, high, low, stale, starting, offline), units (mgdl, mmol), target ("70-180"…), hours (3, 6, 12, 24),
 * showUnlit, accent, lit, unlit, label.
 * Les mesures sont des exemples : le module servi par le compagnon passera les vraies, lues dans LibreLinkUp
 * (valeur toutes les minutes, tendance, courbe en points de 15 min, fin du capteur).
 */
(function () {
	"use strict";

	var SLOTS = { s: [840, 344], m: [840, 696], l: [1688, 696], xl: [2536, 696] };
	var DEFAULTS = { sample: "range", units: "mgdl", target: "70-180", hours: 12, showUnlit: true, accent: "#10b981", lit: "#f2f0e9", unlit: "#1c1c1c", label: "#b8b6b0" };
	var LOW = "#ed403b", HIGH = "#f5b942";
	var MMOL = 18.0;   // mg/dL par mmol/L (valeur d'Abbott)

	// police 5 × 7 points (chiffres, point décimal, tiret)
	var FONT = {
		"0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"], "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
		"2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"], "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
		"4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"], "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
		"6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"], "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
		"8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"], "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
		".": ["0", "0", "0", "0", "0", "0", "1"], "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"]
	};
	// flèches de tendance 7 × 7 (1 baisse rapide … 5 hausse rapide, comme LibreLinkUp)
	var ARROWS = {
		1: ["...#...", "...#...", "...#...", "#..#..#", ".#.#.#.", "..###..", "...#..."],
		2: ["#......", ".#.....", "..#....", "...#..#", "....#.#", ".....##", "...####"],
		3: ["...#...", "....#..", ".....#.", "#######", ".....#.", "....#..", "...#..."],
		4: ["...####", ".....##", "....#.#", "...#..#", "..#....", ".#.....", "#......"],
		5: ["...#...", "..###..", ".#.#.#.", "#..#..#", "...#...", "...#...", "...#..."]
	};
	var TREND = { 1: "Falling fast", 2: "Falling", 3: "Steady", 4: "Rising", 5: "Rising fast" };

	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
	function canvas(w, h) { var cv = document.createElement("canvas"), dpr = 2; cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px"; var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { cv: cv, ctx: ctx }; }
	function dot(ctx, x, y, r, col) { if (!col) return; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

	// texte en gros points ; les cases éteintes suivent « Show unlit dots »
	function dotText(str, pitch, color, unlit) {
		var cols = 0;
		str.split("").forEach(function (ch, i) { cols += (FONT[ch] || FONT["-"])[0].length + (i < str.length - 1 ? 1 : 0); });
		var k = canvas(cols * pitch, 7 * pitch), x = 0;
		str.split("").forEach(function (ch) {
			var g = FONT[ch] || FONT["-"];
			for (var y = 0; y < 7; y++) for (var c = 0; c < g[0].length; c++) {
				var on = g[y][c] === "1";
				dot(k.ctx, (x + c) * pitch + pitch / 2, y * pitch + pitch / 2, pitch * 0.4, on ? color : unlit);
			}
			x += g[0].length + 1;
		});
		return k.cv;
	}
	function picto(rows, pitch, color, unlit) {
		var k = canvas(7 * pitch, 7 * pitch);
		for (var y = 0; y < 7; y++) for (var x = 0; x < 7; x++) dot(k.ctx, x * pitch + pitch / 2, y * pitch + pitch / 2, pitch * 0.36, rows[y][x] === "#" ? color : unlit);
		return k.cv;
	}

	// mesures d'exemple : 24 h en points de 15 min, qui finissent sur la valeur et la tendance de l'exemple
	var ENDS = { range: [124, 3], high: [212, 4], low: [62, 2], stale: [131, 3] };
	function series(sample) {
		var end = ENDS[sample];
		if (!end) return [];
		var pts = [], n = 96;
		for (var i = 0; i <= n; i++) {
			var h = i / 4;   // heures depuis le début
			var v = 132 + 34 * Math.sin(h / 3.1) + 18 * Math.sin(h / 1.15 + 1.3) + 10 * Math.sin(h * 2.3);
			[[7.5, 70], [12.5, 85], [19.8, 95]].forEach(function (meal) { var d = h - meal[0]; if (d > 0) v += meal[1] * d * Math.exp(-d * 1.4); });
			pts.push(v);
		}
		// les 2 dernières heures rejoignent la valeur de fin avec sa pente
		var slope = { 1: -3, 2: -1.6, 3: 0, 4: 1.6, 5: 3 }[end[1]] * 15;
		for (var j = 0; j < 8; j++) {
			var w = (j + 1) / 8, target = end[0] - slope * (7 - j) / 4;
			pts[n - 7 + j] = pts[n - 7 + j] * (1 - w) + target * w;
		}
		return pts.map(function (v) { return Math.round(Math.max(40, Math.min(400, v))); });
	}

	function mount(stage, opts) {
		opts = opts || {};
		var size = SLOTS[opts.size] ? opts.size : "xl";
		var getSettings = typeof opts.settings === "function" ? opts.settings : function () { return opts.settings || {}; };
		var getNow = opts.now || function () { return new Date(); };
		function settings() { var s = getSettings() || {}, o = {}; for (var k in DEFAULTS) o[k] = s[k] === undefined ? DEFAULTS[k] : s[k]; return o; }

		stage.classList.add("dot-glucose");
		stage.innerHTML =
			'<span class="w-dot"></span>' +
			'<p class="w-lbl w-name" data-hub-home>DOT GLUCOSE</p>' +
			'<p class="w-lbl w-state" data-k="state"></p>' +
			'<div class="g-now" data-k="now"></div>' +
			'<p class="g-status" data-k="status"></p>' +
			'<p class="g-sub" data-k="sub"></p>' +
			'<div class="g-stats" data-k="stats"></div>' +
			'<div class="g-graph" data-k="graph" role="button" aria-label="Change graph duration"><div class="head"><p class="w-lbl" data-k="gLeft"></p><p class="w-lbl" data-k="gRight"></p></div><div data-k="plot"></div></div>';
		function v(k) { return stage.querySelector('[data-k="' + k + '"]'); }
		var hours = null, hoursSetting = null;

		function fmt(mg, units) { return units === "mmol" ? (mg / MMOL).toFixed(1) : String(Math.round(mg)); }
		function rangeOf(s) { var t = String(s.target).split("-"); return [+t[0] || 70, +t[1] || 180]; }

		function plot(pts, s, c, staleMin) {
			var W = 1480, H = 494, gridW = 1400, top = 4, rows = 14, rowP = 30, colP = 30, cols = Math.floor(gridW / colP);
			var k = canvas(W, H), ctx = k.ctx, R = rangeOf(s), vmin = 40, vmax = 320;
			function rowOf(val) { return Math.max(0, Math.min(rows - 1, Math.round((vmax - val) / (vmax - vmin) * (rows - 1)))); }
			var rLo = rowOf(R[0]), rHi = rowOf(R[1]);
			// valeur de chaque colonne : interpolée entre les points de 15 min des dernières heures
			var n = pts.length, lastAge = (staleMin || 0) / 15, vals = [];
			for (var col = 0; col < cols; col++) {
				var back = hours * 4 * (1 - col / (cols - 1)) - lastAge;   // en points de 15 min avant la dernière mesure
				if (!n || back < -0.01) { vals.push(null); continue; }
				var idx = n - 1 - back;
				if (idx < 0) { vals.push(null); continue; }
				var a = Math.floor(idx), b = Math.min(n - 1, a + 1), f = idx - a;
				vals.push(pts[a] * (1 - f) + pts[b] * f);
			}
			for (var x = 0; x < cols; x++) for (var y = 0; y < rows; y++) {
				var cx = x * colP + colP / 2, cy = top + y * rowP + rowP / 2, band = y >= rHi && y <= rLo;
				dot(ctx, cx, cy, colP * (band ? 0.2 : 0.16), band ? "#3a3a36" : c.unlit);
			}
			vals.forEach(function (val, x) {
				if (val === null) return;
				var col = val < R[0] ? LOW : val > R[1] ? HIGH : c.lit, cx = x * colP + colP / 2, cy = top + rowOf(val) * rowP + rowP / 2;
				var last = x === vals.length - 1 || vals[x + 1] === null;
				dot(ctx, cx, cy, colP * (last ? 0.42 : 0.3), col);
				if (last) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, colP * 0.62, 0, Math.PI * 2); ctx.stroke(); }
			});
			// limites de la plage cible à droite, heures en dessous
			ctx.font = "400 18px 'Fira Code', Consolas, monospace"; ctx.textBaseline = "middle"; ctx.fillStyle = c.label;
			ctx.fillText(fmt(R[1], s.units), gridW + 18, top + rHi * rowP + rowP / 2);
			ctx.fillText(fmt(R[0], s.units), gridW + 18, top + rLo * rowP + rowP / 2);
			var now = getNow(), gy = top + rows * rowP + 26;
			ctx.textBaseline = "alphabetic";
			[0, 1 / 3, 2 / 3, 1].forEach(function (p, i) {
				var t = new Date(now.getTime() - hours * 3600000 * (1 - p)), txt = i === 3 ? "NOW" : (t.getHours() < 10 ? "0" : "") + t.getHours() + ":" + (t.getMinutes() < 10 ? "0" : "") + t.getMinutes();
				var x = Math.min(gridW - ctx.measureText(txt).width, Math.max(0, p * (cols - 1) * colP + colP / 2 - (i ? ctx.measureText(txt).width / 2 : colP / 2)));
				ctx.fillText(txt, x, gy);
			});
			return k.cv;
		}

		function render() {
			var s = settings(), c = { lit: s.lit, unlit: s.showUnlit ? s.unlit : null, accent: s.accent, label: s.label };
			if (String(s.hours) !== hoursSetting) { hoursSetting = String(s.hours); hours = +s.hours || 12; }
			stage.style.setProperty("--accent", c.accent);
			stage.style.setProperty("--lit", c.lit);
			stage.style.setProperty("--label", c.label);
			stage.style.setProperty("--unlit", c.unlit || "#1c1c1c");
			var sample = s.sample, pts = series(sample), R = rangeOf(s), unit = s.units === "mmol" ? "mmol/L" : "mg/dL";
			var has = pts.length > 0, last = has ? pts[pts.length - 1] : null, trend = ENDS[sample] ? ENDS[sample][1] : 3;
			var stale = sample === "stale", staleMin = stale ? 18 : 0;
			["stale", "offline"].forEach(function (k) { stage.classList.toggle(k, k === sample); });

			// état en haut à droite : capteur et âge de la mesure
			v("state").textContent = sample === "offline" ? "Offline" : sample === "starting" ? "Libre 3 · warming up" : "Libre 3 · " + (stale ? "18 min ago" : "1 min ago");

			// valeur, tendance, unité
			var col = !has || stale ? c.label : last < R[0] ? LOW : last > R[1] ? HIGH : c.lit;
			var now = v("now"); now.innerHTML = "";
			now.appendChild(dotText(has && sample !== "offline" ? fmt(last, s.units) : "---", 30, col, c.unlit));
			if (has && !stale) now.appendChild(picto(ARROWS[trend], 24, col, c.unlit));
			now.appendChild(el("p", "unit", unit));

			// état en toutes lettres
			var status, sub;
			if (sample === "offline") { status = "LibreLinkUp unreachable"; sub = "Check your account in Dot Companion"; col = HIGH; }
			else if (sample === "starting") { status = "Sensor starting"; sub = "First reading in 34 min"; }
			else if (stale) { status = "No data for 18 min"; sub = "Last " + fmt(last, s.units) + " " + unit + " · keep the phone near the sensor"; col = HIGH; }
			else { status = (last < R[0] ? "Low" : last > R[1] ? "High" : "In range") + " · " + TREND[trend]; sub = "Target " + fmt(R[0], s.units) + "–" + fmt(R[1], s.units) + " " + unit; }
			v("status").textContent = status; v("status").style.setProperty("--c", col);
			v("sub").textContent = sub;

			// chiffres des 24 dernières heures
			var stats = v("stats"); stats.innerHTML = "";
			var inR = has ? Math.round(pts.filter(function (x) { return x >= R[0] && x <= R[1]; }).length / pts.length * 100) : null;
			var avg = has ? pts.reduce(function (a, b) { return a + b; }, 0) / pts.length : null;
			[["Time in range · 24 h", inR === null || sample === "offline" ? "--" : inR, inR === null || sample === "offline" ? "" : "%"],
			 ["Average · 24 h", avg === null || sample === "offline" ? "--" : fmt(avg, s.units), avg === null || sample === "offline" ? "" : unit],
			 ["Sensor", sample === "offline" ? "--" : sample === "starting" ? "14" : "9", sample === "offline" ? "" : "days left"]].forEach(function (d) {
				var b = el("div"); b.appendChild(el("p", "k", d[0]));
				var vv = el("p", "v", String(d[1])); if (d[2]) vv.appendChild(el("small", "", d[2])); b.appendChild(vv);
				stats.appendChild(b);
			});

			// courbe
			v("gLeft").textContent = "Last " + hours + " h";
			v("gRight").textContent = "Target " + fmt(R[0], s.units) + "–" + fmt(R[1], s.units);
			var p = v("plot"); p.innerHTML = "";
			p.appendChild(plot(sample === "offline" ? [] : pts, s, c, staleMin));
		}

		// un toucher sur la courbe change la durée : 3, 6, 12, 24 h
		v("graph").addEventListener("click", function () { hours = { 3: 6, 6: 12, 12: 24, 24: 3 }[hours] || 12; render(); });

		// l'âge de la mesure avance (et l'axe des heures) : redessin chaque minute
		var timer = null;
		function animate(on) { clearInterval(timer); timer = on ? setInterval(render, 60000) : null; }

		function setSize(s) {
			size = SLOTS[s] ? s : "xl";
			["s", "m", "l", "xl"].forEach(function (k) { stage.classList.toggle(k, k === size); });
		}
		setSize(size);
		render();
		animate(opts.animate !== false);
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
		return { render: render, setSize: function (s) { setSize(s); render(); }, size: function () { return size; }, animate: animate };
	}

	window.DotGlucose = { mount: mount, slots: SLOTS, defaults: DEFAULTS };
})();
