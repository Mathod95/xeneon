/*
 * Dot Bambu Lab : le rendu, partagé par la maquette de référence (mockups/reference.html), Dot Page
 * et, plus tard, le module. Une seule source : ce qui est vu dans la maquette est exactement ce qui tourne ailleurs.
 *
 *   var bl = DotBambuLab.mount(stage, { size: "xl", settings: function () { … }, onState: function (state) { … } });
 *   bl.render();          // quand un réglage change
 *   bl.setSize("m");      // S, M, L ou XL
 *   bl.animate(false);    // arrête la mise à jour de l'heure de fin (vue cachée)
 *
 * `stage` reçoit la classe .dot-bambulab et la taille de l'emplacement. Réglages (tous facultatifs) :
 * sample (printing, paused, error, finished, idle, offline), model (X1C, P1S, A1), showAms, showUnlit,
 * accent, lit, unlit, label. `onState` est appelé quand l'écran change l'état (pause, reprise, arrêt).
 * L'impression, les températures et l'AMS sont des exemples : le module passera les vraies données.
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
	var DEFAULTS = { sample: "printing", model: "X1C", showAms: true, showUnlit: true, accent: "#10b981", lit: "#f2f0e9", unlit: "#1c1c1c", label: "#b8b6b0" };
	var STATES = ["printing", "paused", "error", "finished", "idle", "offline"];
	var MARKUP =
		'<span class="w-dot"></span>' +
		'<p class="w-lbl w-name" data-hub-home>DOT BAMBU LAB</p>' +
		'<p class="w-lbl w-state" data-k="state"></p>' +
		'<div class="w-prog" data-k="prog"></div>' +
		'<p class="w-mini" data-k="mini"></p>' +
		'<div class="w-temps" data-k="temps"></div>' +
		'<div class="w-ams" data-k="ams">' +
			'<p class="w-lbl" data-k="amsLbl">AMS · 4 SLOTS</p>' +
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
	// bobine : disque de points, rempli depuis le bas selon le reste
	function spool(px, color, remain, active, c) {
		var cv = document.createElement("canvas"), dpr = 2;
		cv.width = px * dpr; cv.height = px * dpr; cv.style.width = px + "px"; cv.style.height = px + "px";
		var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		// filament trop sombre pour se voir sur le fond : éclairci
		var rgb = parseInt(color.slice(1), 16), lumi = (0.2126 * (rgb >> 16) + 0.7152 * (rgb >> 8 & 255) + 0.0722 * (rgb & 255)) / 255;
		if (lumi < 0.22) color = "#5a5a5a";
		var pitch = px / 15, R = px / 2 - pitch / 2, hub = R * 0.28;
		for (var y = 0; y < 15; y++) for (var x = 0; x < 15; x++) {
			var cx = x * pitch + pitch / 2, cy = y * pitch + pitch / 2, d = Math.hypot(cx - px / 2, cy - px / 2);
			if (d > R + 0.5) continue;
			var rim = d > R - pitch * 0.9, filled = (15 - y) / 15 <= remain + 0.001;
			var col = d < hub ? null : rim ? (active ? c.accent : (c.unlit || "#1c1c1c")) : filled ? color : (c.unlit || "#1c1c1c");
			if (!col) continue;
			ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, pitch * 0.4, 0, Math.PI * 2); ctx.fill();
		}
		return cv;
	}
	function dur(min) { var h = Math.floor(min / 60), m = min % 60; return (h ? h + "h " : "") + m + "m"; }
	function eta(min) { var d = new Date(Date.now() + min * 60000); return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes(); }

	var JOB = { file: "Benchy_hull_v2.3mf", pct: 67, layer: 142, layers: 212, left: 84, speed: "Standard" };
	var AMS = [
		{ color: "#f2f0e9", type: "PLA Basic", remain: 0.82 },
		{ color: "#2f6fd6", type: "PETG HF", remain: 0.04 },
		{ color: "#e9862b", type: "PLA Matte", remain: 0.55 },
		{ color: "#1a1a1a", type: "PLA Basic", remain: 0.31 }
	];
	var ACTIVE = 2;

	function mount(stage, opts) {
		opts = opts || {};
		var size = SLOTS[opts.size] ? opts.size : "xl";
		var getSettings = typeof opts.settings === "function" ? opts.settings : function () { return opts.settings || {}; };
		function settings() { var s = getSettings() || {}, o = {}; for (var k in DEFAULTS) o[k] = s[k] === undefined ? DEFAULTS[k] : s[k]; return o; }

		stage.classList.add("dot-bambulab");
		stage.innerHTML = MARKUP;
		function v(k) { return stage.querySelector('[data-k="' + k + '"]'); }
		var lamp = true, state = null, sample = null;

		function render() {
			var s = settings(), model = s.model, Z = SIZES[size];
			// un exemple choisi dans la maquette pose l'état (impression, pause…)
			if (s.sample !== sample) { sample = s.sample; state = sample; }
			var c = { lit: s.lit, unlit: s.showUnlit ? s.unlit : null, accent: s.accent, label: s.label, alert: "#ed403b" };
			stage.style.setProperty("--accent", c.accent);
			stage.style.setProperty("--lit", c.lit);
			stage.style.setProperty("--label", c.label);
			var active = state === "printing" || state === "paused" || state === "error";
			STATES.forEach(function (k) { stage.classList.toggle(k, k === state); });
			v("state").textContent = model + " · " + { printing: "PRINTING", paused: "PAUSED", error: "ERROR", finished: "DONE", idle: "IDLE", offline: "OFFLINE" }[state];

			// progression
			var prog = v("prog"); prog.innerHTML = "";
			if (state === "offline") {
				prog.appendChild(el("p", "big", "Printer offline"));
				prog.appendChild(el("p", "sub", "Check IP and access code in Dot Companion"));
			} else if (state === "idle") {
				prog.appendChild(el("p", "big", "Ready"));
				prog.appendChild(el("p", "sub", "Last print · Cable_clip_x8.3mf · 2h ago"));
			} else {
				var pct = state === "finished" ? 100 : JOB.pct;
				prog.appendChild(dotText(pct + "%", Z.digit, c));
				var b = el("div", "bar"); b.appendChild(bar(Z.progW, pct / 100, Z.bar, c, state === "error" ? c.alert : null)); prog.appendChild(b);
				prog.appendChild(el("p", "file ell", JOB.file.replace(/\.3mf$/i, "")));
				var info = el("div", "info");
				if (state === "finished") {
					info.appendChild(el("span", "left", "Done at " + eta(-12)));
					info.appendChild(el("span", "", "3h 12m · " + JOB.layers + " layers"));
				} else {
					info.appendChild(el("span", "", "Layer " + JOB.layer + " / " + JOB.layers));
					info.appendChild(el("span", "left", dur(JOB.left) + " left"));
					if (size !== "s") info.appendChild(el("span", "", "Ends " + eta(JOB.left)));
					if (size === "xl") info.appendChild(el("span", "", JOB.speed));
				}
				prog.appendChild(info);
				if (state === "error") prog.appendChild(el("p", "alert ell", "Filament ran out · AMS slot 2"));
			}

			// températures
			var temps = v("temps"); temps.innerHTML = ""; temps.hidden = state === "offline";
			var T = [
				{ k: "Nozzle", v: active ? 219 : 27, t: active ? 220 : 0 },
				{ k: "Bed", v: active ? 61 : 25, t: active ? 65 : 0 },
				model === "X1C" ? { k: "Chamber", v: active ? 38 : 24, t: 0 } : { k: "Part fan", v: active ? 80 : 0, t: 0, unit: "%" }
			];
			T.forEach(function (x) {
				var d = el("div", "tmp");
				d.appendChild(el("p", "k", x.k));
				var vv = el("p", "v", x.v + (x.unit || "°"));
				vv.appendChild(el("small", "", x.t ? "/ " + x.t + "°" : ""));
				d.appendChild(vv);
				if (Z.tempW && x.t) { var hb = el("div", "hb"); hb.appendChild(bar(Z.tempW, x.v / x.t, Z.tempBar, c)); d.appendChild(hb); }
				else if (Z.tempW) { var sp = el("div", "hb"); sp.style.height = Z.tempBar + "px"; d.appendChild(sp); }
				temps.appendChild(d);
			});
			v("mini").innerHTML = state === "offline" ? "" : "NOZZLE <b>" + T[0].v + "°</b><br>BED <b>" + T[1].v + "°</b>";

			// AMS
			var ams = v("ams"), slots = v("slots"); slots.innerHTML = "";
			ams.hidden = state === "offline" || !s.showAms || !Z.spool;
			v("amsLbl").textContent = (model === "A1" ? "AMS lite" : "AMS") + " · 4 slots";
			if (!ams.hidden) AMS.forEach(function (a, i) {
				var on = active && i === ACTIVE;
				var sl = el("div", "spool-slot" + (on ? " on" : ""));
				sl.style.width = (Z.spool + 24) + "px";
				sl.appendChild(spool(Z.spool, a.color, a.remain, on, c));
				sl.appendChild(el("p", "ty ell", a.type));
				sl.appendChild(el("p", "re", on ? "▶ In use" : Math.round(a.remain * 100) + "%"));
				slots.appendChild(sl);
			});

			// commandes
			var canPause = active;
			v("pauseBtn").disabled = !canPause;
			v("stopBtn").disabled = !canPause;
			v("lampBtn").disabled = state === "offline";
			v("lampBtn").classList.toggle("on", lamp && state !== "offline");
			v("pauseIcon").innerHTML = state === "printing" ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4v16l13-8z"/>';
			v("hint").hidden = !canPause;
		}

		function setState(x) { state = x; if (opts.onState) opts.onState(x); render(); }
		v("pauseBtn").addEventListener("click", function () { setState(state === "printing" ? "paused" : "printing"); });
		v("lampBtn").addEventListener("click", function () { lamp = !lamp; render(); });
		// stop : garder le doigt 2 s
		var hold = null, t0 = 0;
		function cancelHold() { if (hold) cancelAnimationFrame(hold); hold = null; v("ring").style.setProperty("--p", 0); }
		v("stopBtn").addEventListener("pointerdown", function (e) {
			if (v("stopBtn").disabled) return;
			e.preventDefault(); t0 = performance.now();
			(function step(now) {
				var p = Math.min(1, (now - t0) / 2000);
				v("ring").style.setProperty("--p", p);
				if (p >= 1) { cancelHold(); setState("idle"); return; }
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
			animate: animate
		};
	}

	window.DotBambuLab = { mount: mount, slots: SLOTS, defaults: DEFAULTS };
})();
