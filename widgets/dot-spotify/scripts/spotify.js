/*
 * Dot Spotify : le rendu, partagé par la maquette de référence (mockups/reference.html), Dot Page
 * et, plus tard, le module. Une seule source : ce qui est vu dans la maquette est exactement ce qui tourne ailleurs.
 *
 *   var sp = DotSpotify.mount(stage, { size: "xl", settings: function () { … }, onState: function (state) { … } });
 *   sp.render();          // quand un réglage change
 *   sp.setSize("m");      // S, M, L ou XL
 *
 * `stage` reçoit la classe .dot-spotify et la taille de l'emplacement. Réglages (tous facultatifs) :
 * sample (playing, paused, idle), coverStyle (mono, color), dotSize (9, 13, 18), showUnlit, showAlbum,
 * accent, lit, unlit, label. `onState` est appelé quand le bouton lecture / pause change l'état.
 * Les morceaux et les pochettes sont des exemples dessinés à la main : le module passera les vraies données.
 */
(function () {
	"use strict";

	var SLOTS = { s: [840, 344], m: [840, 696], l: [1688, 696], xl: [2536, 696] };
	var COVER = { xl: 548, l: 600, m: 320, s: 248 };
	var DEFAULTS = { sample: "playing", coverStyle: "mono", dotSize: 13, showUnlit: true, showAlbum: true, accent: "#10b981", lit: "#f2f0e9", unlit: "#1c1c1c", label: "#b8b6b0" };
	var PLAY = '<path d="M7 4v16l13-8z"/>', PAUSE = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';
	var MARKUP =
		'<canvas class="w-cover" data-k="cover" aria-label="Pochette en trame de points"></canvas>' +
		'<span class="w-dot"></span>' +
		'<p class="w-lbl w-name" data-hub-home>DOT SPOTIFY</p>' +
		'<p class="w-lbl w-state" data-k="state">PLAYING</p>' +
		'<div class="w-meta">' +
			'<p class="w-title" data-k="title"></p>' +
			'<p class="w-artist" data-k="artist"></p>' +
			'<p class="w-album" data-k="album"></p>' +
		'</div>' +
		'<div class="w-ctls">' +
			'<button type="button" class="ctl" data-k="prevBtn" aria-label="Previous track"><svg viewBox="0 0 24 24"><path d="M5 4h3v16H5zM20 4v16L9 12z"/></svg></button>' +
			'<button type="button" class="ctl play" data-k="playBtn" aria-label="Play / pause"><svg viewBox="0 0 24 24" data-k="playIcon"></svg></button>' +
			'<button type="button" class="ctl" data-k="nextBtn" aria-label="Next track"><svg viewBox="0 0 24 24"><path d="M16 4h3v16h-3zM4 4v16l11-8z"/></svg></button>' +
		'</div>';

	// pochettes d'exemple, dessinées à la main (aucune vraie pochette)
	function makeCover(paint) { var c = document.createElement("canvas"); c.width = c.height = 256; paint(c.getContext("2d")); return c; }
	var TRACKS = null;
	function tracks() {
		if (TRACKS) return TRACKS;
		return (TRACKS = [
			{ title: "Neon Grid", artist: "The Pixels", album: "Low Resolution", art: makeCover(function (g) {
				var bg = g.createLinearGradient(0, 0, 256, 256); bg.addColorStop(0, "#1b1446"); bg.addColorStop(1, "#4a1d5e");
				g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
				var sun = g.createRadialGradient(96, 104, 6, 96, 104, 86); sun.addColorStop(0, "#ffd38a"); sun.addColorStop(.55, "#ff6a5c"); sun.addColorStop(1, "rgba(255,80,90,0)");
				g.fillStyle = sun; g.beginPath(); g.arc(96, 104, 86, 0, Math.PI * 2); g.fill();
				var moon = g.createRadialGradient(194, 186, 2, 194, 186, 44); moon.addColorStop(0, "#9ff3e4"); moon.addColorStop(1, "rgba(60,200,190,0)");
				g.fillStyle = moon; g.beginPath(); g.arc(194, 186, 44, 0, Math.PI * 2); g.fill();
			}) },
			{ title: "Analog Dreams Under a Very Long Summer Sky", artist: "Mira Lane", album: "Tape Hiss", art: makeCover(function (g) {
				var bg = g.createLinearGradient(0, 0, 0, 256); bg.addColorStop(0, "#f3c98b"); bg.addColorStop(1, "#c4553a");
				g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
				g.fillStyle = "#fff4d6"; g.beginPath(); g.arc(128, 120, 58, 0, Math.PI * 2); g.fill();
				g.fillStyle = "#3b1f2b";
				for (var i = 0; i < 6; i++) g.fillRect(0, 150 + i * 18, 256, 8 - i);
			}) },
			{ title: "Low Tide", artist: "Harbor Lights", album: "Undertow", art: makeCover(function (g) {
				var bg = g.createLinearGradient(0, 0, 0, 256); bg.addColorStop(0, "#0d2b45"); bg.addColorStop(1, "#1c6e8c");
				g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
				for (var k = 0; k < 5; k++) {
					g.strokeStyle = "rgba(180,235,255," + (0.85 - k * 0.15) + ")"; g.lineWidth = 10 - k;
					g.beginPath();
					for (var x = 0; x <= 256; x += 4) { var y = 70 + k * 38 + Math.sin(x / 26 + k) * 14; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
					g.stroke();
				}
			}) }
		]);
	}

	function mount(stage, opts) {
		opts = opts || {};
		var size = SLOTS[opts.size] ? opts.size : "xl";
		var getSettings = typeof opts.settings === "function" ? opts.settings : function () { return opts.settings || {}; };
		function settings() { var s = getSettings() || {}, o = {}; for (var k in DEFAULTS) o[k] = s[k] === undefined ? DEFAULTS[k] : s[k]; return o; }

		stage.classList.add("dot-spotify");
		stage.innerHTML = MARKUP;
		function v(k) { return stage.querySelector('[data-k="' + k + '"]'); }
		var track = 0, state = null, sample = null;

		// trame de points
		function drawCover(s, c) {
			var cv = v("cover"), px = COVER[size], dpr = 2;
			cv.width = px * dpr; cv.height = px * dpr;
			var ctx = cv.getContext("2d");
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, px, px);
			var pitch = parseInt(s.dotSize, 10) * (px / 600 > 0.5 ? 1 : 0.75);
			var n = Math.floor(px / pitch), off = (px - n * pitch) / 2 + pitch / 2, maxR = pitch * 0.46;
			var data = null;
			if (state !== "idle") {
				var sm = document.createElement("canvas"); sm.width = sm.height = n;
				var sg = sm.getContext("2d"); sg.imageSmoothingQuality = "high";
				sg.drawImage(tracks()[track].art, 0, 0, n, n);
				data = sg.getImageData(0, 0, n, n).data;
			}
			var color = s.coverStyle === "color";
			// niveaux automatiques : on étire la luminosité de la pochette sur toute la plage, pour que les pochettes sombres restent lisibles
			var lo = 1, hi = 0;
			if (data) for (var q = 0; q < data.length; q += 4) {
				var lq = (0.2126 * data[q] + 0.7152 * data[q + 1] + 0.0722 * data[q + 2]) / 255;
				if (lq < lo) lo = lq; if (lq > hi) hi = lq;
			}
			var span = Math.max(hi - lo, 0.2);
			for (var yy = 0; yy < n; yy++) for (var xx = 0; xx < n; xx++) {
				var cx = off + xx * pitch, cy = off + yy * pitch;
				if (c.unlit) { ctx.fillStyle = c.unlit; ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, Math.PI * 2); ctx.fill(); }
				if (!data) continue;
				var i = (yy * n + xx) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
				var lum = Math.min(1, Math.max(0, ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 - lo) / span));
				var rad = color ? maxR * (0.35 + 0.65 * Math.pow(lum, 0.7)) : maxR * Math.pow(lum, 0.9);
				if (rad < 0.6) continue;
				ctx.fillStyle = color ? "rgb(" + r + "," + g + "," + b + ")" : c.lit;
				ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
			}
		}

		function render() {
			var s = settings();
			// un exemple choisi dans la maquette pose l'état (lecture, pause, rien)
			if (s.sample !== sample) { sample = s.sample; state = sample; }
			var c = { lit: s.lit, unlit: s.showUnlit ? s.unlit : null, accent: s.accent, label: s.label };
			["playing", "paused", "idle"].forEach(function (k) { stage.classList.toggle(k, k === state); });
			stage.style.setProperty("--accent", c.accent);
			stage.style.setProperty("--lit", c.lit);
			stage.style.setProperty("--label", c.label);
			var t = tracks()[track];
			v("title").textContent = state === "idle" ? "Nothing playing" : t.title;
			v("artist").textContent = state === "idle" ? "Start playback on your PC" : t.artist;
			v("album").textContent = t.album;
			v("album").hidden = state === "idle" || !s.showAlbum;
			v("state").textContent = { playing: "PLAYING", paused: "PAUSED", idle: "IDLE" }[state];
			v("playIcon").innerHTML = state === "playing" ? PAUSE : PLAY;
			drawCover(s, c);
		}

		v("playBtn").addEventListener("click", function () {
			state = state === "playing" ? "paused" : "playing";
			if (opts.onState) opts.onState(state);
			render();
		});
		v("nextBtn").addEventListener("click", function () { track = (track + 1) % tracks().length; render(); });
		v("prevBtn").addEventListener("click", function () { track = (track + tracks().length - 1) % tracks().length; render(); });

		function setSize(s) {
			size = SLOTS[s] ? s : "xl";
			["s", "m", "l", "xl"].forEach(function (k) { stage.classList.toggle(k, k === size); });
		}
		setSize(size);
		render();
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
		return {
			render: render,
			setSize: function (s) { setSize(s); render(); },
			size: function () { return size; },
			animate: function () {}   // seule animation : le point qui pulse, en CSS
		};
	}

	window.DotSpotify = { mount: mount, slots: SLOTS, defaults: DEFAULTS };
})();
