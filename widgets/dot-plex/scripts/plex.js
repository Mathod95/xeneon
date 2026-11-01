/*
 * Dot Plex : le rendu, partagé par la maquette de référence (mockups/reference.html), Dot Page
 * et, plus tard, le module. Une seule source : ce qui est vu dans la maquette est exactement ce qui tourne ailleurs.
 *
 *   var px = DotPlex.mount(stage, { size: "xl", settings: function () { … } });
 *   px.render();          // quand un réglage change
 *   px.setSize("m");      // S, M, L ou XL
 *   px.animate(false);    // arrête l'avance des lectures (vue cachée)
 *
 * `stage` reçoit la classe .dot-plex et la taille de l'emplacement. Réglages (tous facultatifs) :
 * sample (two, one, idle, offline), libRow (recent, deck), posterStyle (mono, color), dotSize (0.75, 1, 1.4),
 * showUnlit, hideUsers, accent, lit, unlit, label.
 * Les lectures, les affiches et les utilisateurs sont des exemples dessinés à la main : le module passera les vraies données.
 */
(function () {
	"use strict";

	var SLOTS = { s: [840, 344], m: [840, 696], l: [1688, 696], xl: [2536, 696] };
	var SIZES = { xl: { posters: 4, pitch: 10 }, l: { posters: 3, pitch: 9 }, m: { posters: 3, pitch: 9 }, s: { posters: 5, pitch: 7 } };
	var DEFAULTS = { sample: "two", libRow: "recent", posterStyle: "mono", dotSize: 1, showUnlit: true, hideUsers: false, accent: "#10b981", lit: "#f2f0e9", unlit: "#1c1c1c", label: "#b8b6b0" };
	var MARKUP =
		'<span class="w-dot"></span>' +
		'<p class="w-lbl w-name" data-hub-home>DOT PLEX</p>' +
		'<p class="w-lbl w-state" data-k="state"></p>' +
		'<div class="w-sess" data-k="sess"></div>' +
		'<div class="w-empty" data-k="empty" hidden><p class="big" data-k="emptyBig">Nothing playing</p><p class="sm" data-k="emptySm"></p></div>' +
		'<div class="w-lib" data-k="lib">' +
			'<div class="tabs" role="tablist" aria-label="Bibliothèque">' +
				'<button type="button" class="tab" role="tab" data-tab="recent" aria-selected="true">Recently added</button>' +
				'<button type="button" class="tab" role="tab" data-tab="deck" aria-selected="false">On deck</button>' +
			'</div>' +
			'<div class="posters" data-k="posters"></div>' +
		'</div>';

	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

	// affiches d'exemple, dessinées à la main (aucune vraie affiche)
	function art(paint) { var c = document.createElement("canvas"); c.width = 200; c.height = 300; paint(c.getContext("2d")); return c; }
	function lin(g, y0, y1, a, b) { var gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; }
	function disc(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
	function glow(g, x, y, r, a, b) { var gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
	var ART = null;
	function arts() {
		if (ART) return ART;
		return (ART = {
			harbor: art(function (g) {
				g.fillStyle = lin(g, 0, 300, "#0b1d33", "#16496b"); g.fillRect(0, 0, 200, 300);
				glow(g, 60, 90, 34, "#ffe7a3", "rgba(255,180,60,0)"); glow(g, 140, 120, 26, "#ffd27a", "rgba(255,160,60,0)"); glow(g, 100, 60, 18, "#fff0c4", "rgba(255,200,90,0)");
				for (var k = 0; k < 5; k++) { g.strokeStyle = "rgba(170,225,255," + (0.8 - k * 0.14) + ")"; g.lineWidth = 9 - k; g.beginPath();
					for (var x = 0; x <= 200; x += 4) { var y = 190 + k * 22 + Math.sin(x / 20 + k) * 8; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
			}),
			orbit: art(function (g) {
				g.fillStyle = "#05060c"; g.fillRect(0, 0, 200, 300);
				for (var i = 0; i < 40; i++) disc(g, (i * 73) % 200, (i * 131) % 300, 1.6, "#cfd8ff");
				glow(g, 100, 150, 70, "#9fc6ff", "#1a2a6a"); disc(g, 100, 150, 56, "rgba(160,200,255,.9)");
				g.strokeStyle = "#ffffff"; g.lineWidth = 6; g.beginPath(); g.ellipse(100, 150, 96, 22, -0.35, 0, Math.PI * 2); g.stroke();
			}),
			lantern: art(function (g) {
				g.fillStyle = lin(g, 0, 300, "#3a0d12", "#8a2a18"); g.fillRect(0, 0, 200, 300);
				[[50, 70, 22], [130, 50, 28], [95, 140, 32], [40, 210, 20], [150, 200, 24]].forEach(function (p) { glow(g, p[0], p[1], p[2] * 1.8, "rgba(255,190,90,.9)", "rgba(255,120,40,0)"); disc(g, p[0], p[1], p[2], "#ffb35c"); });
			}),
			ridge: art(function (g) {
				g.fillStyle = lin(g, 0, 300, "#f6d7a7", "#7aa6c9"); g.fillRect(0, 0, 200, 300);
				disc(g, 140, 80, 26, "#fff6dc");
				g.fillStyle = "#4b5d7a"; g.beginPath(); g.moveTo(0, 210); g.lineTo(60, 130); g.lineTo(110, 190); g.lineTo(160, 120); g.lineTo(200, 170); g.lineTo(200, 300); g.lineTo(0, 300); g.fill();
				g.fillStyle = "#1e2638"; g.beginPath(); g.moveTo(0, 260); g.lineTo(70, 200); g.lineTo(130, 250); g.lineTo(200, 215); g.lineTo(200, 300); g.lineTo(0, 300); g.fill();
			}),
			north: art(function (g) {
				g.fillStyle = lin(g, 0, 300, "#dfe9f2", "#8fb3cf"); g.fillRect(0, 0, 200, 300);
				g.fillStyle = "#2b3440"; g.beginPath(); g.moveTo(90, 150); g.lineTo(110, 150); g.lineTo(200, 300); g.lineTo(0, 300); g.fill();
				g.fillStyle = "#f4f4f4"; for (var i = 0; i < 6; i++) g.fillRect(98, 165 + i * 22, 4 + i, 10 + i * 2);
			}),
			copper: art(function (g) {
				g.fillStyle = lin(g, 0, 300, "#5a2410", "#c96b2c"); g.fillRect(0, 0, 200, 300);
				glow(g, 100, 120, 60, "#ffd9a0", "rgba(255,140,60,0)");
				g.fillStyle = "#3a1508"; g.beginPath(); g.moveTo(0, 220); g.quadraticCurveTo(70, 170, 120, 210); g.quadraticCurveTo(170, 240, 200, 200); g.lineTo(200, 300); g.lineTo(0, 300); g.fill();
			}),
			field: art(function (g) {
				g.fillStyle = lin(g, 0, 180, "#bfe3f0", "#f2f0d0"); g.fillRect(0, 0, 200, 180);
				g.fillStyle = lin(g, 180, 300, "#6f9a3a", "#2f4a18"); g.fillRect(0, 180, 200, 120);
				g.fillStyle = "#25301a"; g.fillRect(132, 120, 8, 64); disc(g, 136, 112, 30, "#2f4a22");
			})
		});
	}

	var LIB = {
		recent: [
			{ art: "orbit", title: "The Quiet Orbit", sub: "Film · 2h ago" },
			{ art: "ridge", title: "Ridge Line", sub: "Season 1 · 1d ago" },
			{ art: "lantern", title: "Paper Lanterns", sub: "Film · 2d ago" },
			{ art: "north", title: "Northbound", sub: "Film · 3d ago" },
			{ art: "copper", title: "Copper Valley", sub: "S03 · E01 · 4d ago" }
		],
		deck: [
			{ art: "harbor", title: "Harbor Nights", sub: "S02 · E06", p: 0 },
			{ art: "ridge", title: "Ridge Line", sub: "S01 · E04", p: 0.18 },
			{ art: "field", title: "The Long Field", sub: "Film · 54 min left", p: 0.54 },
			{ art: "copper", title: "Copper Valley", sub: "S03 · E01", p: 0 },
			{ art: "north", title: "Northbound", sub: "Film", p: 0.08 }
		]
	};

	// barre de progression en points : allumés en accent jusqu'à la position
	function bar(w, frac, pitch, c) {
		var cv = document.createElement("canvas"), dpr = 2, n = Math.floor(w / pitch), h = pitch;
		cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px";
		var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		var on = Math.round(n * frac);
		for (var i = 0; i < n; i++) {
			ctx.fillStyle = i < on ? c.accent : (c.unlit || "#1c1c1c");
			ctx.beginPath(); ctx.arc(i * pitch + pitch / 2, h / 2, pitch * 0.36, 0, Math.PI * 2); ctx.fill();
		}
		return cv;
	}
	function hms(s) {
		s = Math.floor(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
		return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (x < 10 ? "0" : "") + x;
	}

	function mount(stage, opts) {
		opts = opts || {};
		var size = SLOTS[opts.size] ? opts.size : "xl";
		var getSettings = typeof opts.settings === "function" ? opts.settings : function () { return opts.settings || {}; };
		function settings() { var s = getSettings() || {}, o = {}; for (var k in DEFAULTS) o[k] = s[k] === undefined ? DEFAULTS[k] : s[k]; return o; }
		function colors(s) { return { lit: s.lit, unlit: s.showUnlit ? s.unlit : null, accent: s.accent, label: s.label }; }

		stage.classList.add("dot-plex");
		stage.innerHTML = MARKUP;
		function v(k) { return stage.querySelector('[data-k="' + k + '"]'); }
		var tab = "recent", libRow = null, sesIndex = 0;
		var SESSIONS = [
			{ art: "harbor", title: "Harbor Nights", sub: "S02 · E05 · Lanterns", user: "Alex", device: "Living room TV", q: "4K HDR · Direct Play", t: 2292, d: 3160, playing: true },
			{ art: "orbit", title: "The Quiet Orbit", sub: "Film · 2025", user: "Sam", device: "iPhone", q: "1080p → 720p · Transcode", t: 3725, d: 7890, playing: false }
		];

		// trame de points
		function poster(key, w, h, c, s) {
			var cv = document.createElement("canvas"), dpr = 2;
			cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px";
			var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			var pitch = SIZES[size].pitch * parseFloat(s.dotSize);
			var nx = Math.floor(w / pitch), ny = Math.floor(h / pitch), ox = (w - nx * pitch) / 2 + pitch / 2, oy = (h - ny * pitch) / 2 + pitch / 2, maxR = pitch * 0.46;
			var data = null;
			if (key) {
				var sm = document.createElement("canvas"); sm.width = nx; sm.height = ny;
				var sg = sm.getContext("2d"); sg.imageSmoothingQuality = "high"; sg.drawImage(arts()[key], 0, 0, nx, ny);
				data = sg.getImageData(0, 0, nx, ny).data;
			}
			var color = s.posterStyle === "color", lo = 1, hi = 0;
			if (data) for (var q = 0; q < data.length; q += 4) { var lq = (0.2126 * data[q] + 0.7152 * data[q + 1] + 0.0722 * data[q + 2]) / 255; if (lq < lo) lo = lq; if (lq > hi) hi = lq; }
			var span = Math.max(hi - lo, 0.2);
			for (var y = 0; y < ny; y++) for (var x = 0; x < nx; x++) {
				var cx = ox + x * pitch, cy = oy + y * pitch;
				if (c.unlit) { ctx.fillStyle = c.unlit; ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, Math.PI * 2); ctx.fill(); }
				if (!data) continue;
				var i = (y * nx + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
				var lum = Math.min(1, Math.max(0, ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 - lo) / span));
				var rad = color ? maxR * (0.35 + 0.65 * Math.pow(lum, 0.7)) : maxR * Math.pow(lum, 0.9);
				if (rad < 0.6) continue;
				ctx.fillStyle = color ? "rgb(" + r + "," + g + "," + b + ")" : c.lit;
				ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
			}
			return cv;
		}

		var sesNodes = [];
		function renderSessions(list, c, s) {
			var box = v("sess");
			box.innerHTML = ""; sesNodes = [];
			box.className = "w-sess" + (list.length === 1 ? " one" : "");
			var boxH = size === "s" ? 248 : 548, gap = 24;
			var rowH = (boxH - gap * (list.length - 1)) / list.length;
			var pw = Math.round(rowH * 2 / 3);
			var textW = (size === "xl" ? 1160 : size === "l" ? 760 : size === "m" ? 728 : 744) - pw - (size === "xl" ? 32 : 28);
			list.forEach(function (x) {
				var b = el("button", "ses"); b.type = "button";
				b.appendChild(poster(x.art, pw, rowH, c, s));
				var tx = el("div", "tx");
				tx.appendChild(el("p", "t ell", x.title));
				tx.appendChild(el("p", "st ell", x.sub));
				var who = s.hideUsers ? "User " + (SESSIONS.indexOf(x) + 1) : x.user;
				tx.appendChild(el("p", "who ell", who + " · " + x.device));
				var bw = el("div", "bar"); tx.appendChild(bw);
				var ml = el("div", "ml");
				ml.appendChild(el("span", "q", (x.playing ? "▶ " : "❚❚ ") + x.q));
				var tm = el("span", "tm"); ml.appendChild(tm); tx.appendChild(ml);
				b.appendChild(tx);
				b.setAttribute("aria-label", x.title + ", " + who);
				// en S, un toucher passe à la lecture suivante
				b.addEventListener("click", function () { if (size === "s" && settings().sample === "two") { sesIndex = (sesIndex + 1) % SESSIONS.length; render(); } });
				box.appendChild(b);
				sesNodes.push({ s: x, bw: bw, tm: tm, w: textW });
			});
			tickSessions(c);
		}
		function tickSessions(c) {
			var pitch = size === "xl" ? 14 : size === "s" ? 10 : 12;
			sesNodes.forEach(function (n) {
				n.bw.innerHTML = ""; n.bw.appendChild(bar(n.w, n.s.t / n.s.d, pitch, c));
				n.tm.textContent = hms(n.s.t) + " / " + hms(n.s.d);
			});
		}

		function renderLib(c, s) {
			var box = v("posters"), Z = SIZES[size];
			box.innerHTML = "";
			var W = size === "xl" ? 1184 : size === "l" ? 752 : size === "s" ? 744 : 728;
			var H = size === "s" ? 264 : 548 - 24 - 28;
			var gap = size === "xl" ? 24 : size === "l" ? 22 : size === "m" ? 20 : 22;
			var cap = size === "s" ? 34 : tab === "deck" ? 96 : 68;
			var n = Z.posters, pw = Math.floor(Math.min((W - gap * (n - 1)) / n, (H - cap) * 2 / 3)), ph = Math.round(pw * 1.5);
			stage.querySelectorAll(".tab").forEach(function (t) { t.setAttribute("aria-selected", t.getAttribute("data-tab") === tab ? "true" : "false"); });
			LIB[tab].slice(0, n).forEach(function (it) {
				var p = el("div", "pst"); p.style.width = pw + "px";
				p.appendChild(poster(it.art, pw, ph, c, s));
				p.appendChild(el("p", "pt ell", it.title));
				p.appendChild(el("p", "ps ell", it.sub));
				if (tab === "deck") { var pb = el("div", "pb"); pb.appendChild(bar(pw, it.p, 10, c)); p.appendChild(pb); }
				box.appendChild(p);
			});
		}

		function render() {
			var s = settings(), sample = s.sample, c = colors(s);
			// la rangée choisie dans les réglages devient l'onglet affiché
			if (s.libRow !== libRow) { libRow = s.libRow; tab = libRow; }
			stage.style.setProperty("--accent", c.accent);
			stage.style.setProperty("--lit", c.lit);
			stage.style.setProperty("--label", c.label);
			stage.style.setProperty("--unlit", c.unlit || "#1c1c1c");
			var list = sample === "two" ? SESSIONS.slice() : sample === "one" ? [SESSIONS[0]] : [];
			if (size === "s" && list.length > 1) list = [list[sesIndex % list.length]];
			var live = list.length > 0;
			stage.classList.toggle("live", live && list.some(function (x) { return x.playing; }));
			v("state").textContent = "HOME-SERVER · " + (sample === "offline" ? "OFFLINE" : sample === "idle" ? "IDLE" : (sample === "two" ? 2 : 1) + (sample === "two" ? " STREAMS" : " STREAM"));
			var narrow = size === "m" || size === "s";
			v("sess").hidden = !live;
			v("empty").hidden = live || (narrow && sample !== "offline");
			if (sample === "offline") {
				v("emptyBig").textContent = "Server offline";
				v("emptySm").textContent = "Check Plex URL in Dot Companion";
			} else {
				v("emptyBig").textContent = "Nothing playing";
				v("emptySm").textContent = "1 284 movies · 86 shows";
			}
			v("lib").hidden = sample === "offline" || (narrow && live);
			if (live) renderSessions(list, c, s); else sesNodes = [];
			if (!v("lib").hidden) renderLib(c, s);
		}

		stage.querySelectorAll(".tab").forEach(function (t) {
			t.addEventListener("click", function () { tab = t.getAttribute("data-tab"); render(); });
		});

		// la progression avance pendant la lecture
		var timer = null;
		function tick() {
			var any = false;
			SESSIONS.forEach(function (x) { if (x.playing) { x.t = (x.t + 1) % x.d; any = true; } });
			if (any && sesNodes.length) tickSessions(colors(settings()));
		}
		function animate(on) { clearInterval(timer); timer = on ? setInterval(tick, 1000) : null; }

		function setSize(s) {
			size = SLOTS[s] ? s : "xl";
			["s", "m", "l", "xl"].forEach(function (k) { stage.classList.toggle(k, k === size); });
		}
		setSize(size);
		render();
		animate(opts.animate !== false);
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
		return {
			render: render,
			setSize: function (s) { setSize(s); render(); },
			size: function () { return size; },
			animate: animate
		};
	}

	window.DotPlex = { mount: mount, slots: SLOTS, defaults: DEFAULTS };
})();
