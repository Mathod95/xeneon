/*
 * Dot Steam : le rendu, partagé par le module Dot Hub (scripts/widget.js) et la maquette de référence
 * (mockups/reference.html). Ce qui est vu dans la maquette est exactement ce qui tourne sur l'Edge.
 *
 *   var steam = DotSteam.mount(stage, {
 *     size: "xl",
 *     art: function (appid, kind) { … url … },          // kind : "portrait", "wide", "avatar"
 *     onLaunch: function (appid) { … },                 // lancer un jeu
 *     onOpen: function (page) { … },                    // ouvrir une page de Steam ("downloads")
 *     onStatus: function (status) { … }                 // changer son statut ("online", "away", "invisible", "offline")
 *   });
 *   steam.render(state, settings);   // à chaque nouvel état du compagnon et quand un réglage change
 *   steam.setSize("m");             // S, M, L ou XL (XL d'abord, les autres reprises plus tard)
 *
 * state (réponse de GET /api/steam/state) :
 *   { steam: { found, running }, playing: { appid, name, since } | null, hero: appid,
 *     games: [{ appid, name, lastPlayed, playtime }],
 *     downloads: [{ appid, name, progress, total, speed, eta, status: "downloading" | "paused" | "queued" }],
 *     profile: { name, avatar, status } | null,
 *     friends: { enabled, error, list: [{ name, game, online }] } }
 */
(function () {
	"use strict";

	var SIZES = {
		xl: { w: 2536, h: 696, n: 8, libW: 1600, libH: 340, gap: 20, cap: 38, pitch: 8, heroW: 760 },
		l: { w: 1688, h: 696, n: 4, libW: 872, libH: 360, gap: 20, cap: 38, pitch: 9, heroW: 640 },
		m: { w: 840, h: 696, n: 8, cols: 4, libW: 728, libH: 544, gap: 20, rowGap: 16, cap: 32, pitch: 7, heroW: 0 },
		s: { w: 840, h: 344, n: 4, libW: 744, libH: 288, gap: 20, cap: 30, pitch: 7, heroW: 0 }
	};
	var STATUSES = [["online", "Online"], ["away", "Away"], ["invisible", "Invisible"], ["offline", "Offline"]];

	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
	function bool(v) { return v === true || v === "true" || v === 1 || v === "1"; }

	/** Réglages normalisés à partir des propriétés (mêmes noms que les x-icue-property du module). */
	function fromProperties(get) {
		return {
			launchWith: String(get("launchWith", "hold")),
			coverStyle: String(get("coverStyle", "color")),
			coverRender: String(get("coverRender", "dots")),
			gridOpacity: Math.max(0, Math.min(100, parseInt(get("gridOpacity", "70"), 10) || 0)),
			showNames: bool(get("showNames", true)),
			longNames: String(get("longNames", "truncate")),
			panel: String(get("panel", "downloads")),
			showFriends: bool(get("showFriends", true)),
			showUnlitDots: bool(get("showUnlitDots", true)),
			accent: String(get("dotAccentColor", "#10B981")),
			lit: String(get("litDotColor", "#F2F0E9")),
			unlit: String(get("unlitDotColor", "#1C1C1C")),
			label: String(get("labelColor", "#B8B6B0"))
		};
	}

	// ------------------------------------------------------------------ textes
	function ago(sec) {
		if (!sec) return "never";
		var d = Math.max(0, Date.now() / 1000 - sec);
		if (d < 3600) return Math.max(1, Math.round(d / 60)) + " min ago";
		if (d < 86400) return Math.round(d / 3600) + "h ago";
		return Math.round(d / 86400) + "d ago";
	}
	function dur(ms) {
		var m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60);
		return h ? h + " h " + (m % 60) + " min" : m + " min";
	}
	function hours(min) { return Math.round((min || 0) / 60) + " h"; }
	function size(b) {
		if (!b) return "";
		if (b >= 1e9) return (b / 1e9).toFixed(b >= 1e10 ? 0 : 1) + " GB";
		return Math.round(b / 1e6) + " MB";
	}
	function eta(s) {
		if (!s && s !== 0) return "";
		if (s < 60) return "< 1 min";
		if (s < 3600) return Math.round(s / 60) + " min";
		return Math.floor(s / 3600) + " h " + Math.round((s % 3600) / 60) + " min";
	}

	// ------------------------------------------------------------------ jaquettes en points
	// recadrage « cover » : l'image remplit la case sans être déformée (utile quand une jaquette verticale manque)
	function crop(src, w, h) {
		var iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height;
		if (!iw || !ih) return [0, 0, 1, 1];
		var r = w / h, ir = iw / ih;
		if (ir > r) { var cw = ih * r; return [(iw - cw) / 2, 0, cw, ih]; }
		var ch = iw / r; return [0, (ih - ch) / 2, iw, ch];
	}
	/*
	 * Rendus proposés (réglage « Cover render ») :
	 * - dots  : un point par case, taille selon la luminosité (le plus « dot », le moins lisible) ;
	 * - solid : un point plein par case, à la couleur de l'image (plus lisible, trame régulière) ;
	 * - fine  : points pleins deux fois plus serrés (le plus lisible des rendus en points) ;
	 * - grid  : l'image elle-même, vue à travers une grille de points ; l'opacité de la grille est réglable.
	 */
	function dither(src, w, h, pitch, c, color, mode, gridOpacity, dpr) {
		var cv = document.createElement("canvas");
		cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px";
		var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (mode === "fine") pitch = pitch / 2;
		var nx = Math.floor(w / pitch), ny = Math.floor(h / pitch), ox = (w - nx * pitch) / 2 + pitch / 2, oy = (h - ny * pitch) / 2 + pitch / 2, maxR = pitch * 0.46;

		if (mode === "grid") {
			// l'image en entier, puis un voile percé de trous ronds par-dessus
			if (src) {
				var k = crop(src, w, h);
				if (!color) ctx.filter = "grayscale(1)";
				try { ctx.drawImage(src, k[0], k[1], k[2], k[3], 0, 0, w, h); } catch (e) {}
				ctx.filter = "none";
			}
			var veil = document.createElement("canvas"); veil.width = cv.width; veil.height = cv.height;
			var vx = veil.getContext("2d"); vx.setTransform(dpr, 0, 0, dpr, 0, 0);
			vx.fillStyle = "rgba(8,8,8," + (src ? gridOpacity / 100 : 1) + ")"; vx.fillRect(0, 0, w, h);
			vx.globalCompositeOperation = "destination-out";
			for (var gy = 0; gy < ny; gy++) for (var gx = 0; gx < nx; gx++) { vx.beginPath(); vx.arc(ox + gx * pitch, oy + gy * pitch, maxR, 0, Math.PI * 2); vx.fill(); }
			ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(veil, 0, 0);
			if (!src && c.unlit) {
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = c.unlit;
				for (var uy = 0; uy < ny; uy++) for (var ux = 0; ux < nx; ux++) { ctx.beginPath(); ctx.arc(ox + ux * pitch, oy + uy * pitch, maxR, 0, Math.PI * 2); ctx.fill(); }
			}
			return cv;
		}

		var d = null, lo = 1, hi = 0;
		if (src) {
			try {
				var sm = document.createElement("canvas"); sm.width = nx; sm.height = ny;
				var sg = sm.getContext("2d"), q0 = crop(src, w, h); sg.imageSmoothingQuality = "high";
				sg.drawImage(src, q0[0], q0[1], q0[2], q0[3], 0, 0, nx, ny);
				d = sg.getImageData(0, 0, nx, ny).data;
			} catch (e) { d = null; }
		}
		if (d) for (var q = 0; q < d.length; q += 4) { var l0 = (0.2126 * d[q] + 0.7152 * d[q + 1] + 0.0722 * d[q + 2]) / 255; if (l0 < lo) lo = l0; if (l0 > hi) hi = l0; }
		var span = Math.max(hi - lo, 0.2), solid = mode === "solid" || mode === "fine";
		for (var y = 0; y < ny; y++) for (var x = 0; x < nx; x++) {
			var cx = ox + x * pitch, cy = oy + y * pitch;
			if (c.unlit && !(solid && d)) { ctx.fillStyle = c.unlit; ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, Math.PI * 2); ctx.fill(); }
			if (!d) continue;
			var i = (y * nx + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
			var lum = Math.min(1, Math.max(0, ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 - lo) / span));
			if (solid) {
				// point plein : la couleur porte l'image (en Mono, la luminosité devient l'opacité)
				if (color) ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
				else { ctx.globalAlpha = 0.12 + 0.88 * lum; ctx.fillStyle = c.lit; }
				ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
				continue;
			}
			var rad = color ? maxR * (0.35 + 0.65 * Math.pow(lum, 0.7)) : maxR * Math.pow(lum, 0.9);
			if (rad < 0.6) continue;
			ctx.fillStyle = color ? "rgb(" + r + "," + g + "," + b + ")" : c.lit;
			ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
		}
		return cv;
	}
	function bar(w, frac, pitch, c, dpr) {
		var cv = document.createElement("canvas"), n = Math.max(1, Math.floor(w / pitch)), h = pitch;
		cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px";
		var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		var k = Math.round(n * Math.max(0, Math.min(1, frac)));
		for (var i = 0; i < n; i++) {
			ctx.fillStyle = i < k ? c.accent : (c.unlit || "#1c1c1c");
			ctx.beginPath(); ctx.arc(i * pitch + pitch / 2, h / 2, pitch * 0.36, 0, Math.PI * 2); ctx.fill();
		}
		return cv;
	}
	// avatar rond en points (image du compte, ou initiale à défaut)
	function avatarDots(src, px, pitch, c, dpr, name) {
		var cv = dither(src, px, px, pitch, c, true, "solid", 0, dpr), ctx = cv.getContext("2d");
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.globalCompositeOperation = "destination-in"; ctx.beginPath(); ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); ctx.fill();
		ctx.globalCompositeOperation = "source-over";
		if (!src && name) { ctx.fillStyle = c.lit; ctx.font = "500 " + Math.round(px * 0.42) + "px 'Fira Code', Consolas, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(name[0].toUpperCase(), px / 2, px / 2 + 2); }
		return cv;
	}

	function mount(stage, opts) {
		opts = opts || {};
		var sz = SIZES[opts.size] ? opts.size : "xl";
		var art = opts.art || function () { return ""; };
		var onLaunch = opts.onLaunch || function () {};
		var onOpen = opts.onOpen || function () {};
		var onStatus = opts.onStatus || function () {};
		var ratio = opts.pixelRatio || function () { return window.devicePixelRatio || 1; };
		var last = null, lastSettings = null, launching = null, launchTimer = null, pending = false, wantedStatus = null, wantedAt = 0;

		stage.classList.add("dot-steam");
		stage.innerHTML = "";
		var dot = el("span", "w-dot"), name = el("p", "w-lbl w-name", "DOT STEAM");
		dot.setAttribute("data-hub-home", ""); name.setAttribute("data-hub-home", "");
		var state = el("p", "w-lbl w-state"), hero = el("div", "w-hero"), lib = el("div", "w-lib");
		var dl = el("div", "w-dl panel"), fr = el("div", "w-fr panel"), empty = el("div", "w-empty");
		empty.hidden = true;
		[dot, name, state, hero, lib, dl, fr, empty].forEach(function (e) { stage.appendChild(e); });
		dl.addEventListener("click", function (e) {
			if (dl.classList.contains("downloads") && !e.target.closest(".st")) onOpen("downloads");
		});

		// images : chargées une fois, trames recalculées seulement quand la taille, le rendu ou les couleurs changent
		var imgs = {}, trames = {};
		function image(url) {
			if (!url) return null;
			var it = imgs[url];
			// image absente (le compagnon la télécharge peut-être) : nouvel essai toutes les 20 s
			if (!it || (!it.ok && it.failed && Date.now() - it.failed > 20000)) {
				var retry = !!it;
				it = imgs[url] = { img: new Image(), ok: false, failed: 0 };
				it.img.onload = function () { it.ok = true; later(); };
				it.img.onerror = function () { it.failed = Date.now(); later(); };
				it.img.src = retry && url.indexOf("data:") !== 0 ? url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now() : url;
			}
			return it.ok ? it.img : null;
		}
		function failed(url) { return !!(url && imgs[url] && imgs[url].failed); }
		function copy(cv) { var cp = cv.cloneNode(); cp.getContext("2d").drawImage(cv, 0, 0); return cp; }
		function trame(appid, kind, w, h, pitch, c, s) {
			// jaquette verticale absente : la large, recadrée
			var url = art(appid, kind), src = image(url);
			if (!src && kind === "portrait" && failed(url)) { url = art(appid, "wide"); src = image(url); }
			var dpr = Math.max(1, ratio());
			var key = [url, w, h, pitch, s.coverStyle, s.coverRender, s.gridOpacity, c.lit, c.unlit, dpr.toFixed(2), src ? 1 : 0].join("|");
			if (!trames[key]) trames[key] = dither(src, w, h, pitch, c, s.coverStyle !== "mono", s.coverRender, s.gridOpacity, dpr);
			return copy(trames[key]);
		}
		function later() { if (pending) return; pending = true; setTimeout(function () { pending = false; if (last) render(last, lastSettings); }, 60); }

		function launch(g) {
			launching = g.appid; clearTimeout(launchTimer);
			launchTimer = setTimeout(function () { launching = null; if (last) render(last, lastSettings); }, 6000);
			onLaunch(g.appid);
			if (last) render(last, lastSettings);
		}
		// lancement selon le réglage : appui long, toucher ou double toucher
		function wire(b, g, w, s, c) {
			var raf = null, t0 = 0, lastTap = 0, hb = b.querySelector(".hb");
			function paint(p) { hb.innerHTML = ""; if (p > 0) hb.appendChild(bar(w, p, sz === "xl" || sz === "l" ? 10 : 8, c, Math.max(1, ratio()))); }
			if (s.launchWith === "tap") { b.addEventListener("click", function () { launch(g); }); return; }
			if (s.launchWith === "double") {
				b.addEventListener("click", function () { var t = Date.now(); if (t - lastTap < 400) { lastTap = 0; launch(g); } else lastTap = t; });
				return;
			}
			function stop() { if (raf) cancelAnimationFrame(raf); raf = null; paint(0); b.classList.remove("press"); }
			b.addEventListener("pointerdown", function (e) {
				e.preventDefault(); e.stopPropagation(); t0 = performance.now(); b.classList.add("press");
				(function step(now) { var p = Math.min(1, (now - t0) / 800); paint(p); if (p >= 1) { raf = null; b.classList.remove("press"); launch(g); return; } raf = requestAnimationFrame(step); })(t0);
			});
			["pointerup", "pointerleave", "pointercancel"].forEach(function (n) { b.addEventListener(n, stop); });
		}
		function gameNode(g, kind, w, h, s, c, big, now) {
			var b = el("button", "game" + (launching === g.appid ? " go" : "") + (now ? " now" : "")); b.type = "button";
			b.setAttribute("aria-label", "Launch " + g.name); b.style.width = w + "px";
			var a = el("div", "art"); a.appendChild(trame(g.appid, kind, w, h, big ? SIZES[sz].pitch + 2 : SIZES[sz].pitch, c, s)); b.appendChild(a);
			// nom : masquable ; trop long, il défile (« Scroll ») ou se coupe et défile au survol ou à l'appui (« Truncate »)
			var t = el("p", "t" + (s.showNames || big ? "" : " off")), span = el("span", "", g.name);
			t.appendChild(span); b.appendChild(t);
			b.appendChild(el("div", "hb"));
			wire(b, g, w, s, c);
			return b;
		}
		function marquee(root, mode) {
			root.querySelectorAll(".game .t").forEach(function (t) {
				var span = t.firstChild, over = span.scrollWidth - t.clientWidth;
				t.classList.toggle("long", over > 1);
				t.classList.toggle("auto", over > 1 && mode !== "truncate");
				t.style.setProperty("--shift", over > 1 ? -over + "px" : "0px");
				t.style.setProperty("--dur", Math.max(4, over / 45 + 2) + "s");
			});
		}

		function render(st, s) {
			last = st; lastSettings = s;
			var Z = SIZES[sz], c = { lit: s.lit, unlit: s.showUnlitDots ? s.unlit : null, accent: s.accent, label: s.label };
			stage.style.setProperty("--accent", s.accent);
			stage.style.setProperty("--lit", s.lit);
			stage.style.setProperty("--label", s.label);
			stage.style.setProperty("--unlit", s.unlit);
			var steam = st.steam || {}, playing = st.playing || null, games = st.games || [];
			if (playing && launching === playing.appid) { launching = null; clearTimeout(launchTimer); }
			var launchName = launching ? (games.filter(function (g) { return g.appid === launching; })[0] || {}).name || "" : "";
			var offline = !steam.running, friends = st.friends || { enabled: false, list: [] };
			var inGame = (friends.list || []).filter(function (f) { return f.game; }).length;
			stage.className = "dot-steam " + sz + (offline ? " offline" : "") + (launching ? " launching" : "") + (s.showNames ? "" : " nonames");
			state.textContent = launching ? "LAUNCHING · " + launchName.toUpperCase() : offline ? "STEAM · OFFLINE"
				: playing ? "PLAYING · " + playing.name.toUpperCase() : friends.enabled && !friends.error ? "ONLINE · " + inGame + " FRIENDS IN GAME" : "ONLINE";

			// Steam introuvable ou aucun jeu : un message, jamais de jeu inventé
			var none = !steam.found || !games.length;
			empty.hidden = !none; hero.hidden = none; lib.hidden = none;
			if (none) {
				empty.innerHTML = "";
				empty.appendChild(el("p", "big", steam.found ? "No games installed" : "Steam not found"));
				empty.appendChild(el("p", "sm", steam.found ? "Install a game in Steam to see it here" : "Install Steam or set its folder in Dot Companion"));
				dl.hidden = true; fr.hidden = true;
				return;
			}

			// dernier jeu joué, ou jeu en cours
			hero.innerHTML = ""; hero.hidden = !Z.heroW;
			var heroGame = playing ? (games.filter(function (g) { return g.appid === playing.appid; })[0] || { appid: playing.appid, name: playing.name, playtime: 0 })
				: (games.filter(function (g) { return g.appid === st.hero; })[0] || games[0]);
			if (Z.heroW) {
				var hw = Z.heroW, hh = Math.round(hw * 215 / 460);
				hero.appendChild(gameNode(heroGame, "wide", hw, hh, s, c, true, !!playing));
				hero.appendChild(el("p", "sub", playing ? "Playing for " + dur(Date.now() - (playing.since || Date.now())) + " · " + hours(heroGame.playtime) + " total"
					: "Last played " + ago(heroGame.lastPlayed) + " · " + hours(heroGame.playtime)));
				hero.appendChild(el("p", "go-k" + (playing ? " now" : ""), playing ? "Now playing" : { hold: "Hold to play", tap: "Tap to play", double: "Double tap to play" }[s.launchWith] || "Hold to play"));
			}

			// jeux
			lib.innerHTML = "";
			var cols = Z.cols || Z.n, rows = Math.ceil(Z.n / cols), rowGap = Z.rowGap || 0, cap = s.showNames ? Z.cap : 0;
			var pw = Math.floor(Math.min((Z.libW - Z.gap * (cols - 1)) / cols, ((Z.libH - rowGap * (rows - 1)) / rows - cap) * 2 / 3)), ph = Math.round(pw * 1.5);
			lib.className = "w-lib" + (Z.cols ? " grid" : "");
			var list = Z.heroW && Z.n === 4 ? games.filter(function (g) { return g !== heroGame; }).slice(0, 4) : games.slice(0, Z.n);
			list.forEach(function (g) { lib.appendChild(gameNode(g, "portrait", pw, ph, s, c, false, !!playing && g.appid === playing.appid)); });

			// panneau du bas : téléchargements, ou ton profil et ton statut (réglage « Panel »)
			dl.innerHTML = ""; dl.hidden = offline || !Z.heroW;
			dl.className = "w-dl panel " + (s.panel === "profile" ? "profile" : "downloads");
			if (!dl.hidden && s.panel === "profile") {
				var pr = st.profile || {}, cur = wantedStatus && Date.now() - wantedAt < 30000 ? wantedStatus : pr.status;
				var label = cur ? (STATUSES.filter(function (x) { return x[0] === cur; })[0] || [0, cur])[1] : "status unknown";
				dl.appendChild(el("p", "w-lbl", "Profile · " + label));
				var row = el("div", "me");
				row.appendChild(avatarDots(image(pr.avatar ? art(0, "avatar") : ""), 96, 7, c, Math.max(1, ratio()), pr.name || "?"));
				var who = el("div", "who"); who.appendChild(el("p", "pn ell", pr.name || "Steam"));
				var chips = el("div", "sts");
				STATUSES.forEach(function (x) {
					var b = el("button", "st", x[1]); b.type = "button"; b.setAttribute("aria-pressed", x[0] === cur ? "true" : "false");
					b.addEventListener("click", function (e) { e.stopPropagation(); wantedStatus = x[0]; wantedAt = Date.now(); onStatus(x[0]); render(last, lastSettings); });
					chips.appendChild(b);
				});
				who.appendChild(chips); row.appendChild(who); dl.appendChild(row);
			} else if (!dl.hidden) {
				var downs = st.downloads || [];
				if (!downs.length) {
					dl.appendChild(el("p", "w-lbl", "Downloads ›"));
					dl.appendChild(el("div", "dl q")).appendChild(el("span", "n", "No downloads · " + games.length + " games up to date"));
				} else {
					var d0 = downs[0], paused = d0.status === "paused";
					dl.appendChild(el("p", "w-lbl", (playing && paused ? "Downloads · paused while playing" : "Downloads · " + downs.length) + " ›"));
					var r1 = el("div", "dl");
					r1.appendChild(el("span", "n", d0.name));
					var pct = Math.round((d0.progress || 0) * 100) + "%";
					r1.appendChild(el("span", "r", paused ? pct + " · paused" : d0.status === "downloading"
						? pct + (d0.speed ? " · " + (d0.speed >= 1e6 ? Math.round(d0.speed / 1e6) + " MB/s" : Math.round(d0.speed / 1e3) + " KB/s") : "") + (d0.eta ? " · " + eta(d0.eta) : "")
						: pct + " · queued"));
					dl.appendChild(r1);
					var bb = el("div", "bar"); bb.appendChild(bar(sz === "xl" ? 760 : 872, d0.progress || 0, 14, c, Math.max(1, ratio()))); dl.appendChild(bb);
					downs.slice(1, 2).forEach(function (d) {
						var r2 = el("div", "dl q"); r2.appendChild(el("span", "n", d.name)); r2.appendChild(el("span", "r", (d.status === "paused" ? "Paused" : d.status === "downloading" ? Math.round((d.progress || 0) * 100) + "%" : "Queued") + (d.total ? " · " + size(d.total) : ""))); dl.appendChild(r2);
					});
				}
			}

			// amis
			fr.innerHTML = ""; fr.hidden = offline || sz !== "xl" || !s.showFriends;
			if (!fr.hidden) {
				if (!friends.enabled) {
					fr.appendChild(el("p", "w-lbl", "Friends"));
					fr.appendChild(el("div", "fr note", "Add a Steam Web API key in Dot Companion"));
				} else if (friends.error) {
					fr.appendChild(el("p", "w-lbl", "Friends"));
					fr.appendChild(el("div", "fr note", friends.error));
				} else {
					fr.appendChild(el("p", "w-lbl", "Friends · " + inGame + " in game"));
					var shown = (friends.list || []).filter(function (f) { return f.game || f.online; }).slice(0, 3);
					if (!shown.length) fr.appendChild(el("div", "fr note", "No friends online"));
					shown.forEach(function (f) {
						var rw = el("div", "fr" + (f.game ? " in" : "")); rw.appendChild(el("i"));
						rw.appendChild(el("span", "n", f.name)); rw.appendChild(el("span", "g", f.game ? "· " + f.game : "· Online"));
						fr.appendChild(rw);
					});
				}
			}
			marquee(stage, s.longNames);
		}

		function setSize(s) {
			sz = SIZES[s] ? s : "xl";
			stage.style.width = SIZES[sz].w + "px"; stage.style.height = SIZES[sz].h + "px";
			stage.setAttribute("data-size", sz);
			if (last) render(last, lastSettings);
		}
		setSize(sz);
		return { render: render, setSize: setSize, size: function () { return sz; }, slot: function () { return [SIZES[sz].w, SIZES[sz].h]; } };
	}

	/** Une jaquette seule, dans un rendu donné (comparaison des rendus dans la maquette). */
	function cover(img, w, h, s, pitch, dpr) {
		return dither(img, w, h, pitch || 8, { lit: s.lit, unlit: s.showUnlitDots ? s.unlit : null }, s.coverStyle !== "mono", s.coverRender, s.gridOpacity, dpr || window.devicePixelRatio || 1);
	}

	window.DotSteam = { mount: mount, fromProperties: fromProperties, cover: cover, slots: { xl: [2536, 696], l: [1688, 696], m: [840, 696], s: [840, 344] } };
})();
