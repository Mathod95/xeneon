/*
 * Dot Audio : le rendu, partagé par la maquette de référence (mockups/reference.html), Dot Page
 * et, plus tard, le module servi par Dot Companion. Une seule source : ce qui est vu dans la maquette
 * est exactement ce qui tourne ailleurs.
 *
 *   var audio = DotAudio.mount(stage, { size: "xl", settings: function () { … } });
 *   audio.render();          // quand un réglage change
 *   audio.setSize("m");      // S, M, L ou XL
 *   audio.animate(false);    // arrête les niveaux en direct (vue cachée)
 *
 * `stage` reçoit la classe .dot-audio et la taille de l'emplacement. Réglages (tous facultatifs) :
 * sample (normal, micoff, spkoff, nomedia), coverStyle (mono, color), showUnlit, accent, lit, unlit, label.
 * Les applications, périphériques et le morceau sont des exemples : le module servi par le compagnon
 * passera les vraies données.
 */
(function () {
	"use strict";

	var SLOTS = { s: [840, 344], m: [840, 696], l: [1688, 696], xl: [2536, 696] };
	var SIZES = {
		xl: { digit: 20, barW: 560, barP: 20, ring: 168, rows: 16, fp: 20, cover: 300 },
		l: { digit: 20, barW: 560, barP: 20, ring: 168, rows: 16, fp: 20, cover: 0 },
		m: { digit: 16, barW: 728, barP: 20, ring: 136, rows: 7, fp: 17, cover: 0 },
		s: { digit: 14, barW: 744, barP: 20, ring: 152, rows: 0, fp: 0, cover: 0 }
	};
	var DEFAULTS = { sample: "normal", coverStyle: "mono", showUnlit: true, accent: "#10b981", lit: "#f2f0e9", unlit: "#1c1c1c", label: "#b8b6b0" };

	var FONT = {
		"0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"], "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
		"2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"], "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
		"4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"], "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
		"6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"], "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
		"8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"], "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
		"%": ["11000", "11001", "00010", "00100", "01000", "10011", "00011"], " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
	};
	var ICON = {
		spk: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
		spkOff: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6"/>',
		mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
		micOff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/>',
		play: '<path d="M7 4v16l13-8z"/>', pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>'
	};
	var MARKUP =
		'<span class="w-dot"></span>' +
		'<p class="w-lbl w-name" data-hub-home>DOT AUDIO</p>' +
		'<p class="w-lbl w-state" data-k="state"></p>' +
		'<div class="w-out">' +
			'<button type="button" class="dev" data-k="outDev"></button>' +
			'<div class="digits" data-k="digits"></div>' +
			'<div class="vb" data-k="vb" role="slider" aria-label="Output volume"></div>' +
			'<button type="button" class="rb spk" data-k="spkBtn" aria-label="Mute output"><svg viewBox="0 0 24 24" data-k="spkIcon"></svg></button>' +
		'</div>' +
		'<div class="w-mic">' +
			'<div class="ring" data-k="ring"><canvas data-k="ringCv"></canvas><button type="button" class="rb" data-k="micBtn" aria-label="Mute all microphones"><svg viewBox="0 0 24 24" data-k="micIcon"></svg></button></div>' +
			'<div class="tx"><button type="button" class="dev" data-k="inDev"></button><p class="st" data-k="micSt"></p><p class="hint">Tap mutes every mic</p></div>' +
		'</div>' +
		'<div class="w-mix">' +
			'<div class="tabs" role="tablist">' +
				'<button type="button" class="tab" role="tab" data-tab="mixer">Mixer</button>' +
				'<button type="button" class="tab" role="tab" data-tab="eq">Equalizer</button>' +
				'<span class="grow"></span>' +
				'<button type="button" class="dev" data-k="presetBtn" hidden></button>' +
			'</div>' +
			'<div class="chs" data-k="chs"></div>' +
		'</div>' +
		'<div class="w-np">' +
			'<canvas data-k="cover"></canvas>' +
			'<p class="t ell" data-k="npT"></p>' +
			'<p class="a ell" data-k="npA"></p>' +
			'<div class="ctls">' +
				'<button type="button" class="rb" data-k="prevBtn" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M6 5v14M19 5v14L8 12z" fill="currentColor"/></svg></button>' +
				'<button type="button" class="rb fill" data-k="playBtn" aria-label="Play / pause"><svg viewBox="0 0 24 24" data-k="playIcon"></svg></button>' +
				'<button type="button" class="rb" data-k="nextBtn" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M18 5v14M5 5v14l11-7z" fill="currentColor"/></svg></button>' +
			'</div>' +
		'</div>' +
		'<div class="w-pick" data-k="pick" hidden></div>';

	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
	function canvas(w, h) { var cv = document.createElement("canvas"), dpr = 2; cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px"; var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { cv: cv, ctx: ctx }; }
	function dot(ctx, x, y, r, col) { if (!col) return; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
	function dotText(str, pitch, c, dim) {
		str = ("    " + str).slice(-4);
		var k2 = canvas(23 * pitch, 7 * pitch);
		for (var k = 0; k < 4; k++) {
			var g = FONT[str[k]] || FONT[" "];
			for (var y = 0; y < 7; y++) for (var x = 0; x < 6; x++) {
				if (k === 3 && x === 5) continue;
				var on = x < 5 && g[y][x] === "1";
				dot(k2.ctx, (k * 6 + x) * pitch + pitch / 2, y * pitch + pitch / 2, pitch * 0.4, on ? (str[k] === "%" ? c.accent : dim ? c.label : c.lit) : c.unlit);
			}
		}
		return k2.cv;
	}
	function hbar(w, frac, pitch, c, dim) {
		var n = Math.floor(w / pitch), k2 = canvas(n * pitch, pitch), k = Math.round(n * frac);
		for (var i = 0; i < n; i++) dot(k2.ctx, i * pitch + pitch / 2, pitch / 2, pitch * 0.36, i < k ? (i === k - 1 ? c.accent : dim ? c.label : c.lit) : (c.unlit || "#1c1c1c"));
		return k2.cv;
	}
	// fader vertical : colonne principale + petite colonne de niveau en direct
	function fader(rows, pitch, frac, live, c, muted) {
		var k2 = canvas(pitch * 2, rows * pitch), k = Math.round(rows * frac), lv = Math.round(rows * live);
		for (var i = 0; i < rows; i++) {
			var y = (rows - 1 - i) * pitch + pitch / 2;
			dot(k2.ctx, pitch / 2, y, pitch * 0.36, i < k ? (muted ? c.label : i === k - 1 ? c.accent : c.lit) : (c.unlit || "#1c1c1c"));
			dot(k2.ctx, pitch * 1.45, y, pitch * 0.16, i < lv && !muted ? c.label : (c.unlit || null));
		}
		return k2.cv;
	}
	function eqFader(rows, pitch, db, c) {
		var k2 = canvas(pitch, rows * pitch), mid = Math.floor(rows / 2), t = Math.round(db / 12 * mid);
		for (var i = 0; i < rows; i++) {
			var y = i * pitch + pitch / 2, r = mid - i;
			var lit = t >= 0 ? (r >= 0 && r <= t) : (r <= 0 && r >= t);
			var col = r === t ? c.accent : lit ? c.lit : r === 0 ? c.label : (c.unlit || "#1c1c1c");
			dot(k2.ctx, pitch / 2, y, pitch * (r === 0 && !lit ? 0.2 : 0.36), col);
		}
		return k2.cv;
	}
	// pochette d'exemple
	var ART = null;
	function art() {
		if (ART) return ART;
		var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
		var gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, "#1b1446"); gr.addColorStop(1, "#6a2c70"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
		var s = g.createRadialGradient(48, 52, 3, 48, 52, 44); s.addColorStop(0, "#ffd38a"); s.addColorStop(.6, "#ff6a5c"); s.addColorStop(1, "rgba(255,80,90,0)"); g.fillStyle = s; g.fillRect(0, 0, 128, 128);
		var m = g.createRadialGradient(96, 94, 2, 96, 94, 24); m.addColorStop(0, "#9ff3e4"); m.addColorStop(1, "rgba(60,200,190,0)"); g.fillStyle = m; g.fillRect(0, 0, 128, 128);
		return (ART = c);
	}

	function mount(stage, opts) {
		opts = opts || {};
		var size = SLOTS[opts.size] ? opts.size : "xl";
		var getSettings = typeof opts.settings === "function" ? opts.settings : function () { return opts.settings || {}; };
		function settings() { var s = getSettings() || {}, o = {}; for (var k in DEFAULTS) o[k] = s[k] === undefined ? DEFAULTS[k] : s[k]; return o; }
		function colors(s) { return { lit: s.lit, unlit: s.showUnlit ? s.unlit : null, accent: s.accent, label: s.label, alert: "#ed403b" }; }

		stage.classList.add("dot-audio");
		stage.innerHTML = MARKUP;
		function v(k) { return stage.querySelector('[data-k="' + k + '"]'); }

		var tab = "mixer", vol = 0.64, spkMuted = false, micMuted = false, playing = true, picker = false, sample = null;
		var OUTS = ["Speakers · Realtek Audio", "Headset · USB Audio", "Monitor · NVIDIA HDMI"], INS = ["USB Audio Device", "Headset · USB Audio", "Webcam"];
		var outSel = 0, inSel = 0;
		var APPS = [
			{ n: "Spotify", v: 0.72 }, { n: "Discord", v: 0.55 }, { n: "Neon Courier", v: 0.9 },
			{ n: "Firefox", v: 0.4, m: true }, { n: "OBS", v: 0.64 }, { n: "System", v: 0.8 }
		];
		var BANDS = ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
		var PRESETS = { Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "Bass boost": [8, 7, 5, 2, 0, 0, 0, 0, 1, 2], Voice: [-4, -3, -1, 1, 3, 5, 5, 3, 0, -2] };
		var preset = "Bass boost", eq = PRESETS[preset].slice();
		var micLevel = 0.5, liveLv = APPS.map(function (a) { return a.v * 0.7; });

		function drawCover(px, c, empty, color) {
			var cv = v("cover"), dpr = 2; cv.width = cv.height = px * dpr; cv.style.width = cv.style.height = px + "px";
			var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, px, px);
			var pitch = 12, n = Math.floor(px / pitch), off = (px - n * pitch) / 2 + pitch / 2, maxR = pitch * .46;
			var sm = document.createElement("canvas"); sm.width = sm.height = n; var sg = sm.getContext("2d"); sg.drawImage(art(), 0, 0, n, n);
			var d = sg.getImageData(0, 0, n, n).data;
			for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
				var cx = off + x * pitch, cy = off + y * pitch; dot(ctx, cx, cy, maxR, c.unlit);
				if (empty) continue;
				var i = (y * n + x) * 4, lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
				var rad = color ? maxR * (0.35 + 0.65 * Math.pow(lum, .7)) : maxR * Math.pow(Math.min(1, lum * 1.4), .9);
				if (rad > .6) dot(ctx, cx, cy, rad, color ? "rgb(" + d[i] + "," + d[i + 1] + "," + d[i + 2] + ")" : c.lit);
			}
		}
		// anneau du micro : points autour du bouton, allumés selon le niveau
		function drawRing(c) {
			var px = SIZES[size].ring, ring = v("ring"); ring.style.width = ring.style.height = px + "px";
			var cv = v("ringCv"), dpr = 2; cv.width = cv.height = px * dpr; cv.style.width = cv.style.height = px + "px";
			var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, px, px);
			var n = 28, R = px / 2 - 8, lit = micMuted ? 0 : Math.round(n * micLevel);
			for (var i = 0; i < n; i++) {
				var a = -Math.PI / 2 + i / n * Math.PI * 2;
				dot(ctx, px / 2 + Math.cos(a) * R, px / 2 + Math.sin(a) * R, px / 48, i < lit ? c.accent : (c.unlit || "#1c1c1c"));
			}
		}
		function renderMixer(c) {
			var Z = SIZES[size], chs = v("chs"); chs.innerHTML = "";
			stage.querySelectorAll(".tab").forEach(function (t) { t.setAttribute("aria-selected", t.getAttribute("data-tab") === tab ? "true" : "false"); });
			v("presetBtn").hidden = tab !== "eq";
			v("presetBtn").innerHTML = "Preset · <b>" + preset + "</b>";
			if (!Z.rows) return;
			if (tab === "mixer") {
				APPS.forEach(function (a, i) {
					var ch = el("div", "ch" + (a.m ? " muted" : ""));
					ch.appendChild(el("p", "v", String(Math.round(a.v * 100))));
					var fd = el("button", "fd"); fd.type = "button"; fd.setAttribute("aria-label", a.n + " volume");
					fd.appendChild(fader(Z.rows, Z.fp, a.v, liveLv[i], c, a.m)); ch.appendChild(fd);
					dragV(fd, function (f) { a.v = f; });
					ch.appendChild(el("p", "n ell", a.n));
					var mb = el("button", "rb mb" + (a.m ? " off" : "")); mb.type = "button"; mb.setAttribute("aria-label", "Mute " + a.n);
					mb.innerHTML = '<svg viewBox="0 0 24 24">' + (a.m ? ICON.spkOff : ICON.spk) + "</svg>";
					mb.addEventListener("click", function () { a.m = !a.m; render(); });
					ch.appendChild(mb); chs.appendChild(ch);
				});
			} else {
				BANDS.forEach(function (b, i) {
					var ch = el("div", "ch");
					ch.appendChild(el("p", "v", (eq[i] > 0 ? "+" : "") + eq[i]));
					var fd = el("button", "fd"); fd.type = "button"; fd.setAttribute("aria-label", b + " Hz");
					var rows = Z.rows % 2 ? Z.rows : Z.rows + 1;
					fd.appendChild(eqFader(rows, Z.fp, eq[i], c)); ch.appendChild(fd);
					dragV(fd, function (f) { eq[i] = Math.round(f * 24 - 12); preset = "Custom"; });
					ch.appendChild(el("p", "n", b));
					chs.appendChild(ch);
				});
			}
		}
		function dragV(fd, set) {
			var go = function (ev) { var r = fd.getBoundingClientRect(); set(Math.max(0, Math.min(1, 1 - (ev.clientY - r.top) / r.height))); render(); };
			fd.addEventListener("pointerdown", function (ev) { fd.setPointerCapture(ev.pointerId); go(ev); fd.onpointermove = go; });
			fd.addEventListener("pointerup", function () { fd.onpointermove = null; });
		}
		function renderPicker() {
			var p = v("pick"); p.innerHTML = ""; p.hidden = !picker; if (!picker) return;
			[["Output", OUTS, outSel, function (i) { outSel = i; }], ["Microphone", INS, inSel, function (i) { inSel = i; }]].forEach(function (g) {
				var col = el("div", "col"); col.appendChild(el("p", "w-lbl", g[0]));
				g[1].forEach(function (name, i) {
					var r = el("button", "row" + (i === g[2] ? " on" : "")); r.type = "button"; r.appendChild(el("i")); r.appendChild(el("span", "", name));
					r.addEventListener("click", function () { g[3](i); picker = false; render(); });
					col.appendChild(r);
				});
				p.appendChild(col);
			});
			var x = el("button", "rb close"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
			x.addEventListener("click", function () { picker = false; render(); }); p.appendChild(x);
		}

		function render() {
			var s = settings(), c = colors(s), Z = SIZES[size];
			// un exemple choisi dans la maquette pose l'état de départ (micros coupés, sortie coupée…)
			if (s.sample !== sample) { sample = s.sample; micMuted = sample === "micoff"; spkMuted = sample === "spkoff"; }
			stage.style.setProperty("--accent", c.accent);
			stage.style.setProperty("--lit", c.lit);
			stage.style.setProperty("--label", c.label);
			stage.style.setProperty("--unlit", c.unlit || "#1c1c1c");
			stage.classList.toggle("playing", playing && sample !== "nomedia");
			stage.classList.toggle("micoff", micMuted);
			v("state").textContent = micMuted ? "ALL MICS MUTED" : "MIC LIVE";
			// sortie
			v("outDev").innerHTML = "Output · <b>" + OUTS[outSel] + "</b> ▾";
			var d = v("digits"); d.innerHTML = ""; d.appendChild(dotText(Math.round(vol * 100) + "%", Z.digit, c, spkMuted));
			var vb = v("vb"); vb.innerHTML = ""; vb.appendChild(hbar(Z.barW, vol, Z.barP, c, spkMuted)); vb.setAttribute("aria-valuenow", Math.round(vol * 100));
			v("spkBtn").className = "rb spk" + (spkMuted ? " off" : ""); v("spkIcon").innerHTML = spkMuted ? ICON.spkOff : ICON.spk;
			// micro
			v("inDev").innerHTML = "Mic · <b>" + INS[inSel] + "</b> ▾";
			v("micBtn").className = "rb" + (micMuted ? " off" : ""); v("micIcon").innerHTML = micMuted ? ICON.micOff : ICON.mic;
			v("micSt").textContent = micMuted ? "All mics muted" : "Live"; v("micSt").className = "st" + (micMuted ? " off" : "");
			drawRing(c);
			renderMixer(c);
			// lecture en cours
			if (Z.cover) {
				var none = sample === "nomedia";
				drawCover(Z.cover, c, none, s.coverStyle === "color");
				v("npT").textContent = none ? "Nothing playing" : "Neon Grid";
				v("npA").textContent = none ? "Start playback on your PC" : "The Pixels · Low Resolution";
				v("playIcon").innerHTML = playing && !none ? ICON.pause : ICON.play;
				["prevBtn", "playBtn", "nextBtn"].forEach(function (id) { v(id).disabled = none; v(id).style.opacity = none ? .3 : 1; });
			}
			renderPicker();
		}

		// interactions
		(function () {
			var vb = v("vb"), go = function (ev) { var r = vb.firstChild.getBoundingClientRect(); vol = Math.round(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * 100) / 100; spkMuted = false; render(); };
			vb.addEventListener("pointerdown", function (ev) { vb.setPointerCapture(ev.pointerId); go(ev); vb.onpointermove = go; });
			vb.addEventListener("pointerup", function () { vb.onpointermove = null; });
		})();
		v("spkBtn").addEventListener("click", function () { spkMuted = !spkMuted; render(); });
		v("micBtn").addEventListener("click", function () { micMuted = !micMuted; render(); });
		v("outDev").addEventListener("click", function () { picker = true; render(); });
		v("inDev").addEventListener("click", function () { picker = true; render(); });
		v("playBtn").addEventListener("click", function () { playing = !playing; render(); });
		v("presetBtn").addEventListener("click", function () { var k = Object.keys(PRESETS), i = (k.indexOf(preset) + 1) % k.length; preset = k[i]; eq = PRESETS[preset].slice(); render(); });
		stage.querySelectorAll(".tab").forEach(function (t) { t.addEventListener("click", function () { tab = t.getAttribute("data-tab"); render(); }); });

		// niveaux en direct (micro et applications)
		var timer = null;
		function tick() {
			micLevel = Math.max(0.05, Math.min(1, micLevel + (Math.random() - 0.5) * 0.5));
			liveLv = APPS.map(function (a) { return a.m ? 0 : a.v * (0.4 + Math.random() * 0.6); });
			var c = colors(settings()); drawRing(c); if (tab === "mixer" && !picker) renderMixer(c);
		}
		function animate(on) { clearInterval(timer); timer = on ? setInterval(tick, 180) : null; }

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

	window.DotAudio = { mount: mount, slots: SLOTS, defaults: DEFAULTS };
})();
