/*
 * Dot Bambu Lab : le rendu, partagé par la maquette de référence (mockups/reference.html), Dot Page
 * et le module servi par Dot Companion (scripts/widget.js). Une seule source : ce qui est vu dans la maquette
 * est exactement ce qui tourne sur l'Edge.
 *
 *   var bl = DotBambuLab.mount(stage, { size: "xl", settings: function () { … },
 *     state: function () { … },              // module : l'état de l'imprimante envoyé par le compagnon (voir demo())
 *     onCommand: function (cmd) { … } });    // module : light, pause, resume, stop
 *   bl.render();          // quand un réglage ou l'état change
 *   bl.setSize("m");      // S, M, L ou XL
 *   bl.animate(false);    // arrête la mise à jour de l'heure de fin (vue cachée)
 *
 * `stage` reçoit la classe .dot-bambulab et la taille de l'emplacement. Réglages (tous facultatifs) :
 * showAms, showUnlit, accent, lit, unlit, label ; dans la maquette et sur Dot Page, sans `state`, sample
 * (printing, paused, error, finished, idle, offline) et model (X1C, P1S, A1) choisissent l'exemple dessiné,
 * et `onState` est appelé quand un bouton de l'écran le change.
 */
(function () {
	"use strict";

	var SLOTS = { s: [840, 344], m: [840, 696], l: [1688, 696], xl: [2536, 696] };
	var SIZES = {
		xl: { digit: 34, bar: 18, progW: 900, tempBar: 12, tempW: 420, spool: 168 },
		l: { digit: 30, bar: 16, progW: 760, tempBar: 10, tempW: 228, spool: 116 },
		m: { digit: 15, bar: 14, progW: 728, tempBar: 10, tempW: 0, spool: 0 },
		s: { digit: 11, bar: 12, progW: 744, tempBar: 0, tempW: 0, spool: 0 }
	};
	var DEFAULTS = { sample: "printing", model: "P1S", showAms: true, showUnlit: true, accent: "#10b981", lit: "#f2f0e9", unlit: "#1c1c1c", label: "#b8b6b0" };
	var STATES = ["printing", "paused", "error", "finished", "idle", "offline"];
	var MARKUP =
		'<span class="w-dot"></span>' +
		'<p class="w-lbl w-name" data-hub-home>DOT BAMBU LAB</p>' +
		'<p class="w-lbl w-state" data-k="state"></p>' +
		'<div class="w-prog" data-k="prog"></div>' +
		'<p class="w-mini" data-k="mini"></p>' +
		'<div class="w-temps" data-k="temps"></div>' +
		'<div class="w-ams" data-k="ams">' +
			'<div class="ams-head"><p class="w-lbl" data-k="amsLbl">AMS · 4 SLOTS</p><p class="w-lbl" data-k="amsHum"></p></div>' +
			'<div class="slots" data-k="slots"></div>' +
		'</div>' +
		'<p class="w-hint" data-k="hint">Hold ■ to stop</p>' +
		'<div class="w-ctls">' +
			'<button type="button" class="ctl lamp" data-k="lampBtn" aria-label="Chamber light"><svg viewBox="0 0 24 24"><path d="M9 21h6v-1.5H9zM12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2z"/></svg></button>' +
			'<button type="button" class="ctl main" data-k="pauseBtn" aria-label="Pause / resume"><svg viewBox="0 0 24 24" data-k="pauseIcon"></svg></button>' +
			'<button type="button" class="ctl" data-k="stopBtn" aria-label="Stop print (hold)"><svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"/></svg><span class="ring" data-k="ring"></span></button>' +
		'</div>';

	// police 5 × 7 points pour le pourcentage
	var FONT = {
		"0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
		"1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
		"2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
		"3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
		"4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
		"5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
		"6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
		"7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
		"8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
		"9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
		"%": ["11000", "11001", "00010", "00100", "01000", "10011", "00011"],
		" ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
	};
	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
	function dotText(str, pitch, c) {
		// toujours 4 cases (« 100% ») : la mise en page ne bouge pas
		str = ("    " + str).slice(-4);
		var cols = 4 * 6 - 1, cv = document.createElement("canvas"), dpr = 2, w = cols * pitch, h = 7 * pitch;
		cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px";
		var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		for (var k = 0; k < 4; k++) {
			var g = FONT[str[k]] || FONT[" "];
			for (var y = 0; y < 7; y++) for (var x = 0; x < 6; x++) {
				if (k === 3 && x === 5) continue;
				var on = x < 5 && g[y][x] === "1";
				var col = on ? (str[k] === "%" ? c.accent : c.lit) : c.unlit;
				if (!col) continue;
				ctx.fillStyle = col; ctx.beginPath(); ctx.arc((k * 6 + x) * pitch + pitch / 2, y * pitch + pitch / 2, pitch * 0.4, 0, Math.PI * 2); ctx.fill();
			}
		}
		return cv;
	}
	// barre de points
	function bar(w, frac, pitch, c, on) {
		var cv = document.createElement("canvas"), dpr = 2, n = Math.floor(w / pitch), h = pitch;
		cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px";
		var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		var k = Math.round(n * Math.max(0, Math.min(1, frac)));
		for (var i = 0; i < n; i++) {
			ctx.fillStyle = i < k ? (on || c.accent) : (c.unlit || "#1c1c1c");
			ctx.beginPath(); ctx.arc(i * pitch + pitch / 2, h / 2, pitch * 0.36, 0, Math.PI * 2); ctx.fill();
		}
		return cv;
	}
	// bobine : disque de points, rempli depuis le bas selon le reste ; le contour garde toujours la couleur du filament
	// (en accent pour la bobine en cours), pour qu'on la voie même presque vide. Filament trop sombre pour le fond :
	// points de sa vraie couleur, cerclés de gris.
	function spool(px, color, remain, active, c, empty) {
		var cv = document.createElement("canvas"), dpr = 2;
		cv.width = px * dpr; cv.height = px * dpr; cv.style.width = px + "px"; cv.style.height = px + "px";
		var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		var off = c.unlit || "#1c1c1c", dark = !empty && lumi(color) < 0.22;
		var pitch = px / 15, R = px / 2 - pitch / 2, hub = R * 0.28;
		for (var y = 0; y < 15; y++) for (var x = 0; x < 15; x++) {
			var cx = x * pitch + pitch / 2, cy = y * pitch + pitch / 2, d = Math.hypot(cx - px / 2, cy - px / 2);
			if (d > R + 0.5 || d < hub) continue;
			var rim = d > R - pitch * 0.9, filled = (15 - y) / 15 <= remain + 0.001;
			var col = rim ? (active ? c.accent : empty ? off : color) : filled && !empty ? color : off;
			ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, pitch * 0.4, 0, Math.PI * 2); ctx.fill();
			if (dark && col === color) { ctx.lineWidth = 1.2; ctx.strokeStyle = "#6a6a6a"; ctx.stroke(); }
		}
		return cv;
	}
	function lumi(hex) { var rgb = parseInt(String(hex).slice(1), 16) || 0; return (0.2126 * (rgb >> 16) + 0.7152 * (rgb >> 8 & 255) + 0.0722 * (rgb & 255)) / 255; }
	// nom de la couleur d'un filament (Bambu Lab n'envoie que le code) : la plus proche de cette liste
	var NAMES = [["Black", "#000000"], ["White", "#ffffff"], ["Gray", "#8a8a8a"], ["Silver", "#c4c4c4"], ["Red", "#d42a2a"], ["Orange", "#f07a1a"],
		["Yellow", "#f2d21a"], ["Gold", "#c8a03c"], ["Beige", "#e6d6b0"], ["Brown", "#7a4a28"], ["Green", "#2aa042"], ["Lime", "#9ad21e"],
		["Teal", "#1a9a96"], ["Cyan", "#28c8e0"], ["Blue", "#2a62d6"], ["Navy", "#1c2a62"], ["Purple", "#7a3ac0"], ["Pink", "#f08ab4"], ["Magenta", "#d0209c"]];
	function colorName(hex) {
		var v = parseInt(String(hex).slice(1), 16);
		if (isNaN(v)) return "";
		var r = v >> 16, g = v >> 8 & 255, b = v & 255, best = "", bd = 1e9;
		NAMES.forEach(function (n) {
			var w = parseInt(n[1].slice(1), 16), dr = r - (w >> 16), dg = g - (w >> 8 & 255), db = b - (w & 255);
			var dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
			if (dist < bd) { bd = dist; best = n[0]; }
		});
		return best;
	}
	function dur(min) { var h = Math.floor(min / 60), m = min % 60; return (h ? h + "h " : "") + m + "m"; }
	function clock(ms) { var d = new Date(ms); return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes(); }
	function eta(min) { var d = new Date(Date.now() + min * 60000); return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes(); }

	// ---------------------------------------------------------------- état de l'imprimante
	// Le même état sert partout : le compagnon l'envoie au module (GET /api/bambulab/state), la maquette et
	// Dot Page le fabriquent avec demo(). Champs : state (printing, paused, error, finished, idle, offline),
	// model, pct, layer, layers, left (min), file, speed, nozzle {v, t}, bed {v, t}, chamber (°, X1C) ou fan (%),
	// ams [{ color, type, remain (0 à 1) }], tray (emplacement en cours), error, light, last { file, ago },
	// hint (texte sous « Printer offline »).
	var JOB = { file: "Benchy_hull_v2.3mf", pct: 67, layer: 142, layers: 212, left: 84, speed: "Standard" };
	var AMS = [
		{ color: "#f2f0e9", type: "PLA Basic", remain: 0.82 },
		{ color: "#2f6fd6", type: "PETG HF", remain: 0.04 },
		{ color: "#e9862b", type: "PLA Matte", remain: 0.55 },
		{ color: "#1a1a1a", type: "PLA Basic", remain: 0.31 }
	];
	// exemples de la maquette et de Dot Page : jamais sur l'Edge, où le module passe toujours l'état du compagnon
	function demo(sample, model, light) {
		var active = sample === "printing" || sample === "paused" || sample === "error";
		var st = { state: sample, model: model, light: light, file: JOB.file, pct: sample === "finished" ? 100 : JOB.pct, layer: JOB.layer, layers: JOB.layers,
			left: JOB.left, speed: JOB.speed, duration: 192, nozzle: { v: active ? 219 : 27, t: active ? 220 : 0 }, bed: { v: active ? 61 : 25, t: active ? 65 : 0 },
			ams: AMS, tray: active ? 2 : null, amsHumidity: 41, amsTemp: 26, error: sample === "error" ? "Filament ran out · AMS slot 2" : null, last: { file: "Cable_clip_x8.3mf", ago: "2h ago" } };
		if (model === "X1C") st.chamber = active ? 38 : 24; else st.fan = active ? 80 : 0;
		return st;
	}

	function mount(stage, opts) {
		opts = opts || {};
		var size = SLOTS[opts.size] ? opts.size : "xl";
		var getSettings = typeof opts.settings === "function" ? opts.settings : function () { return opts.settings || {}; };
		function settings() { var s = getSettings() || {}, o = {}; for (var k in DEFAULTS) o[k] = s[k] === undefined ? DEFAULTS[k] : s[k]; return o; }
		var real = typeof opts.state === "function";   // le module sur l'Edge : l'état vient du compagnon

		stage.classList.add("dot-bambulab");
		stage.innerHTML = MARKUP;
		function v(k) { return stage.querySelector('[data-k="' + k + '"]'); }
		// maquette : l'exemple choisi, modifié par les boutons de l'écran
		var lamp = true, override = null, sample = null, st = null;

		function current(s) {
			if (real) return opts.state() || { state: "offline", hint: "Connecting to the printer…" };
			if (s.sample !== sample) { sample = s.sample; override = null; }
			return demo(override || sample, s.model, lamp);
		}

		function render() {
			var s = settings(), Z = SIZES[size];
			st = current(s);
			var state = st.state, model = st.model || "";
			var c = { lit: s.lit, unlit: s.showUnlit ? s.unlit : null, accent: s.accent, label: s.label, alert: "#ed403b" };
			stage.style.setProperty("--accent", c.accent);
			stage.style.setProperty("--lit", c.lit);
			stage.style.setProperty("--label", c.label);
			var active = state === "printing" || state === "paused" || state === "error";
			STATES.forEach(function (k) { stage.classList.toggle(k, k === state); });
			v("state").textContent = (model ? model + " · " : "") + { printing: "PRINTING", paused: "PAUSED", error: "ERROR", finished: "DONE", idle: "IDLE", offline: "OFFLINE" }[state];

			// progression
			var prog = v("prog"); prog.innerHTML = "";
			if (state === "offline") {
				prog.appendChild(el("p", "big", "Printer offline"));
				prog.appendChild(el("p", "sub", st.hint || "Check IP and access code in Dot Companion"));
			} else if (state === "idle") {
				prog.appendChild(el("p", "big", "Ready"));
				prog.appendChild(el("p", "sub", st.last && st.last.file ? "Last print · " + st.last.file + (st.last.ago ? " · " + st.last.ago : "") : "No print yet"));
			} else {
				var pct = state === "finished" ? 100 : Math.round(st.pct || 0);
				prog.appendChild(dotText(pct + "%", Z.digit, c));
				var b = el("div", "bar"); b.appendChild(bar(Z.progW, pct / 100, Z.bar, c, state === "error" ? c.alert : null)); prog.appendChild(b);
				prog.appendChild(el("p", "file ell", String(st.file || "--").replace(/\.(gcode\.)?3mf$/i, "")));
				var info = el("div", "info");
				if (state === "finished") {
					info.appendChild(el("span", "left", "Done" + (st.doneAt ? " at " + clock(st.doneAt) : "")));
					if (st.layers) info.appendChild(el("span", "", (st.duration ? dur(st.duration) + " · " : "") + st.layers + " layers"));
				} else {
					if (st.layers) info.appendChild(el("span", "", "Layer " + (st.layer || 0) + " / " + st.layers));
					if (st.left != null) info.appendChild(el("span", "left", dur(st.left) + " left"));
					if (st.left != null && size !== "s") info.appendChild(el("span", "", "Ends " + eta(st.left)));
					if (size === "xl" && st.speed) info.appendChild(el("span", "", st.speed));
				}
				prog.appendChild(info);
				if (st.error) prog.appendChild(el("p", "alert ell", st.error));
			}

			// températures (le P1S et l'A1 n'ont pas de sonde de chambre : ventilateur de pièce à la place)
			var temps = v("temps"); temps.innerHTML = ""; temps.hidden = state === "offline";
			var nz = st.nozzle || {}, bd = st.bed || {};
			var T = [
				{ k: "Nozzle", v: nz.v, t: nz.t },
				{ k: "Bed", v: bd.v, t: bd.t },
				st.chamber != null ? { k: "Chamber", v: st.chamber, t: 0 } : { k: "Part fan", v: st.fan, t: 0, unit: "%" }
			];
			T.forEach(function (x) {
				var d = el("div", "tmp");
				d.appendChild(el("p", "k", x.k));
				var vv = el("p", "v", x.v == null ? "--" : Math.round(x.v) + (x.unit || "°"));
				vv.appendChild(el("small", "", x.t ? "/ " + Math.round(x.t) + "°" : ""));
				d.appendChild(vv);
				if (Z.tempW && x.t) { var hb = el("div", "hb"); hb.appendChild(bar(Z.tempW, (x.v || 0) / x.t, Z.tempBar, c)); d.appendChild(hb); }
				else if (Z.tempW) { var sp = el("div", "hb"); sp.style.height = Z.tempBar + "px"; d.appendChild(sp); }
				temps.appendChild(d);
			});
			v("mini").innerHTML = state === "offline" ? "" : "NOZZLE <b>" + (nz.v == null ? "--" : Math.round(nz.v)) + "°</b><br>BED <b>" + (bd.v == null ? "--" : Math.round(bd.v)) + "°</b>";

			// AMS
			var ams = v("ams"), slots = v("slots"), trays = st.ams || []; slots.innerHTML = "";
			ams.hidden = state === "offline" || !s.showAms || !Z.spool || !trays.length;
			v("amsLbl").textContent = (model === "A1" || model === "A1 mini" ? "AMS lite" : "AMS") + " · " + trays.length + " slots";
			var hum = st.amsHumidity != null ? "Humidity " + Math.round(st.amsHumidity) + " %" : st.amsHumidityLevel != null ? "Humidity level " + st.amsHumidityLevel + " / 5" : "";
			v("amsHum").textContent = hum + (hum && st.amsTemp != null ? " · " + Math.round(st.amsTemp) + "°" : "");
			if (!ams.hidden) trays.forEach(function (a, i) {
				var on = active && i === st.tray, empty = !a || !a.type;
				var sl = el("div", "spool-slot" + (on ? " on" : ""));
				sl.style.width = (Z.spool + 24) + "px";
				var color = empty ? "#1c1c1c" : a.color || "#8a8a8a";
				sl.appendChild(spool(Z.spool, color, empty || a.remain == null ? 0 : a.remain, on, c, empty));
				sl.appendChild(el("p", "ty ell", empty ? "Empty" : a.type));
				sl.appendChild(el("p", "cn ell", empty || !a.color ? "" : a.name || colorName(a.color)));
				sl.appendChild(el("p", "re", on ? "▶ In use" : empty || a.remain == null ? "--" : Math.round(a.remain * 100) + "%"));
				slots.appendChild(sl);
			});

			// commandes
			var canPause = active;
			v("pauseBtn").disabled = !canPause;
			v("stopBtn").disabled = !canPause;
			v("lampBtn").disabled = state === "offline";
			v("lampBtn").classList.toggle("on", !!st.light && state !== "offline");
			v("pauseIcon").innerHTML = state === "printing" ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4v16l13-8z"/>';
			v("hint").hidden = !canPause;
		}

		// boutons : sur l'Edge, une commande pour le compagnon ; dans la maquette, l'exemple change
		function command(cmd) {
			if (real) { if (opts.onCommand) opts.onCommand(cmd); return; }
			if (cmd === "light") lamp = !lamp;
			else { override = cmd === "pause" ? "paused" : cmd === "resume" ? "printing" : "idle"; if (opts.onState) opts.onState(override); }
			render();
		}
		v("pauseBtn").addEventListener("click", function () { if (st) command(st.state === "printing" ? "pause" : "resume"); });
		v("lampBtn").addEventListener("click", function () { command("light"); });
		// stop : garder le doigt 2 s
		var hold = null, t0 = 0;
		function cancelHold() { if (hold) cancelAnimationFrame(hold); hold = null; v("ring").style.setProperty("--p", 0); }
		v("stopBtn").addEventListener("pointerdown", function (e) {
			if (v("stopBtn").disabled) return;
			e.preventDefault(); t0 = performance.now();
			(function step(now) {
				var p = Math.min(1, (now - t0) / 2000);
				v("ring").style.setProperty("--p", p);
				if (p >= 1) { cancelHold(); command("stop"); return; }
				hold = requestAnimationFrame(step);
			})(t0);
		});
		["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { v("stopBtn").addEventListener(ev, cancelHold); });

		// heure de fin : recalculée toutes les 30 s
		var timer = null;
		function animate(on) { clearInterval(timer); timer = on ? setInterval(render, 30000) : null; }

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
			slot: function () { return SLOTS[size]; },
			animate: animate
		};
	}

	window.DotBambuLab = { mount: mount, slots: SLOTS, defaults: DEFAULTS, demo: demo };
})();
