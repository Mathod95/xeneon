/*
 * Dot Clock : horloge dot-matrix pour la CORSAIR XENEON EDGE.
 * Référence visuelle : widgets/dot-clock/mockups/reference.html (mêmes valeurs, mêmes mises en page).
 * Une mise en page par taille : XL et L (heure + secondes à droite), M (secondes sous l'heure), S (heure seule, date et fuseau en bas).
 * Vertical : mise en page provisoire calculée (à concevoir).
 */
(function () {
	"use strict";

	var BOLD = window.DotFont.BOLD, THIN = window.DotFont.THIN, cell = window.DotFont.cell;
	var MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
	var DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
	var SLOTS = {
		h: { s: [840, 344], m: [840, 696], l: [1688, 696], xl: [2536, 696] },
		v: { s: [696, 416], m: [696, 840], l: [696, 1688], xl: [696, 2536] }
	};

	// Géométrie du bloc horaire relevée sur le mock (échelle 1, origine = centre du premier point de la case 1)
	var G = {
		pitch: 36.7, radius: 13.6,
		cells: [0, 191.8, 448.8, 640.8],    // départ des 4 cases HH MM
		colonX: 388.8, colonY: [60, 161], colonR: 14,
		sideX: 837.3, secY: 79.5, ampmTop: -10, ampmBottom: 168.1,
		sidePitch: 10.35, sideRadius: 3.6,
		height: 247.2,                       // du haut du premier point au bas du dernier
		centerY: 110,                        // milieu vertical du bloc, depuis la première ligne
		centerWithSide: 465.4,               // milieu horizontal avec la colonne secondes / AM-PM
		centerNoSide: 393.8,                 // milieu horizontal de HH:MM seul
		widthWithSide: 958,
		widthNoSide: 814.8
	};

	function $(id) { return document.getElementById(id); }

	// ------------------------------------------------------------------ réglages iCUE
	function get(name, def) {
		try {
			var v = window[name];
			return v === undefined || v === null ? def : v;
		} catch (e) { return def; }
	}
	function bool(v) { return v === true || v === "true" || v === 1 || v === "1"; }

	function readSettings() {
		return {
			clock12: String(get("clockFormat", "24")) === "12",
			ampmPos: String(get("ampmPosition", "top")) === "bottom" ? "bottom" : "top",
			showSec: bool(get("showSeconds", true)),
			font: String(get("dotFont", "bold")) === "thin" ? THIN : BOLD,
			showUnlit: bool(get("showUnlitDots", true)),
			showUnlitSec: bool(get("showUnlitSecondsDots", true)),
			timeZone: String(get("timeZone", "local") || "local"),
			tzLabel: String(get("timeZoneLabel", "city")),
			tzCustom: String(get("customTimeZoneLabel", "HOME")),
			// liste de formats ; « custom » prend le champ libre (une ancienne valeur libre reste acceptée telle quelle)
			dateFormat: (function () {
				var f = String(get("dateFormat", "WWW, MMMM DD, YYYY"));
				if (f === "custom") f = String(get("customDateFormat", "WWW, MMMM DD, YYYY"));
				return f.trim() || "WWW, MMMM DD, YYYY";
			})(),
			footer: String(get("footerText", "MADE BY MATHOD & CLAUDE")),
			accent: get("dotAccentColor", "#10B981") || "#10B981",
			lit: get("litDotColor", "#F2F0E9") || "#F2F0E9",
			unlit: get("unlitDotColor", "#1C1C1C") || "#1C1C1C",
			label: get("labelColor", "#B8B6B0") || "#B8B6B0"
		};
	}

	// ------------------------------------------------------------------ heure et fuseau
	var formatters = {};
	function formatter(tz) {
		if (formatters[tz]) return formatters[tz];
		var opts = { hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit", second: "2-digit" };
		if (tz !== "local") opts.timeZone = tz;
		var f;
		try { f = new Intl.DateTimeFormat("en-US", opts); }
		catch (e) { delete opts.timeZone; f = new Intl.DateTimeFormat("en-US", opts); }
		formatters[tz] = f;
		return f;
	}

	function nowParts(date, tz) {
		var out = {};
		formatter(tz).formatToParts(date).forEach(function (p) { out[p.type] = p.value; });
		var wd = DAYS.indexOf(String(out.weekday || "").toUpperCase());
		return {
			year: parseInt(out.year, 10), month: parseInt(out.month, 10), day: parseInt(out.day, 10),
			weekday: wd < 0 ? date.getDay() : wd,
			hour: parseInt(out.hour, 10) % 24, minute: parseInt(out.minute, 10), second: parseInt(out.second, 10)
		};
	}

	function zoneId(tz) {
		if (tz !== "local") return tz;
		try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; }
	}

	function zoneName(date, zone, style, locale) {
		try {
			var parts = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: style }).formatToParts(date);
			for (var i = 0; i < parts.length; i++) if (parts[i].type === "timeZoneName") return parts[i].value;
		} catch (e) { /* style non géré */ }
		return "";
	}

	function utcOffset(date, zone) {
		var off = zoneName(date, zone, "shortOffset", "en-US");
		if (off) return off.replace(/^GMT/, "UTC");
		// repli : écart calculé entre l'heure locale du fuseau et l'heure UTC
		var p = nowParts(date, zone);
		var asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
		var mins = Math.round((asUtc - date.getTime()) / 60000);
		if (!mins) return "UTC";
		var sign = mins > 0 ? "+" : "-", a = Math.abs(mins), h = Math.floor(a / 60), m = a % 60;
		return "UTC" + sign + h + (m ? ":" + (m < 10 ? "0" : "") + m : "");
	}

	function zoneAbbr(date, zone) {
		var generic = /^(GMT|UTC)([+-]|$)/;
		var a = zoneName(date, zone, "short", "en-US");
		if (!a || generic.test(a)) {
			var b = zoneName(date, zone, "short", "en-GB");
			if (b && !generic.test(b)) a = b;
		}
		return a ? a.replace(/^GMT/, "UTC") : utcOffset(date, zone);
	}

	function zoneLabel(date, s) {
		var zone = zoneId(s.timeZone);
		var city = /^(Etc\/)?(UTC|GMT)$/.test(zone) ? "UTC" : zone.split("/").pop().replace(/_/g, " ");
		switch (s.tzLabel) {
			case "abbr": return zoneAbbr(date, zone);
			case "offset": return utcOffset(date, zone);
			case "cityOffset": return city === "UTC" ? "UTC" : city + " " + utcOffset(date, zone);
			case "custom": return s.tzCustom;
			case "none": return "";
			default: return city;
		}
	}

	function pad(n) { return (n < 10 ? "0" : "") + n; }

	function formatDate(p, fmt) {
		return fmt.replace(/YYYY|YY|MMMM|MMM|MM|M|DD|D|WWWW|WWW/gi, function (t) {
			switch (t.toUpperCase()) {
				case "YYYY": return String(p.year);
				case "YY": return String(p.year).slice(-2);
				case "MMMM": return MONTHS[p.month - 1];
				case "MMM": return MONTHS[p.month - 1].slice(0, 3);
				case "MM": return pad(p.month);
				case "M": return String(p.month);
				case "DD": return pad(p.day);
				case "D": return String(p.day);
				case "WWWW": return DAYS[p.weekday];
				case "WWW": return DAYS[p.weekday].slice(0, 3);
			}
			return t;
		});
	}

	// ------------------------------------------------------------------ mises en page
	// Libellés dans les angles, à 56 px des bords latéraux et 44 px du haut / bas
	var CORNERS = {
		name: { left: 80, top: 44 }, dot: { left: 56, top: 51 },
		tz: { right: 56, top: 44 },
		date: { left: 56, bottom: 42 },
		footer: { right: 56, bottom: 44 }
	};
	var S_LABELS = { date: { left: 56, bottom: 42 }, tz: { right: 56, bottom: 44 } };

	function layoutFor(size, orient, W, H) {
		if (orient === "h") {
			if (size === "xl" || size === "l") return { mode: "row", k: 1.14, cy: H / 2, labels: CORNERS };
			if (size === "s") return { mode: "row", k: 0.72, cy: 138, labels: S_LABELS };
			return { mode: "stack", k: 0.93, labels: CORNERS };
		}
		// vertical : provisoire, on garde la disposition qui laisse les plus gros chiffres
		var kRow = Math.min(1.14, (W - 112) / G.widthWithSide, (H - 176) / G.height);
		var kStack = Math.min(1.14, (W - 80) / G.widthNoSide, (H - 176 - 124) / G.height);
		if (kRow >= kStack) return { mode: "row", k: kRow, cy: H / 2, labels: size === "s" ? S_LABELS : CORNERS };
		return { mode: "stack", k: kStack, labels: CORNERS };
	}

	function place(el, pos) {
		if (!pos) { el.hidden = true; return; }
		el.style.left = pos.left !== undefined ? pos.left + "px" : "auto";
		el.style.right = pos.right !== undefined ? pos.right + "px" : "auto";
		el.style.top = pos.top !== undefined ? pos.top + "px" : "auto";
		el.style.bottom = pos.bottom !== undefined ? pos.bottom + "px" : "auto";
	}

	function setText(el, text, pos) {
		el.textContent = text;
		if (!text || !pos) { el.hidden = true; return; }
		el.hidden = false;
		place(el, pos);
	}

	// ------------------------------------------------------------------ dessin
	var state = { size: "xl", orient: "h", W: 2536, H: 696, scale: 1 };

	function setupStage() {
		var root = document.documentElement;
		var size = root.getAttribute("data-size") || "xl", orient = root.getAttribute("data-orientation") || "h";
		var dims = SLOTS[orient][size];
		var W = dims[0], H = dims[1];
		var scale = Math.min(window.innerWidth / W, window.innerHeight / H);
		var stage = $("stage");
		stage.style.width = W + "px";
		stage.style.height = H + "px";
		stage.style.transform = "translate(" + (window.innerWidth - W * scale) / 2 + "px," + (window.innerHeight - H * scale) / 2 + "px) scale(" + scale + ")";
		var cv = $("dots"), dpr = window.devicePixelRatio || 1;
		cv.width = Math.round(W * scale * dpr);
		cv.height = Math.round(H * scale * dpr);
		state = { size: size, orient: orient, W: W, H: H, scale: scale, dpr: dpr };
	}

	function drawSide(ctx, s, chars, x, y, p, r, on, off) {
		cell(ctx, s.font, chars.charAt(0), x, y, p, r, on, off);
		cell(ctx, s.font, chars.charAt(1), x + 6 * p, y, p, r, on, off);
	}

	function render() {
		var s = readSettings();
		var now = new Date();
		var t = nowParts(now, s.timeZone);
		var W = state.W, H = state.H;
		var L = layoutFor(state.size, state.orient, W, H);

		var root = document.documentElement.style;
		root.setProperty("--accent", s.accent);
		root.setProperty("--label", s.label);

		// libellés
		var nameOn = !!L.labels.name;
		$("name").hidden = !nameOn; $("nameDot").hidden = !nameOn;
		if (nameOn) { place($("name"), L.labels.name); place($("nameDot"), L.labels.dot); }
		setText($("tz"), zoneLabel(now, s).toUpperCase(), L.labels.tz);
		setText($("date"), formatDate(t, s.dateFormat).toUpperCase(), L.labels.date);
		setText($("footer"), s.footer.trim().toUpperCase(), L.labels.footer);

		// heure
		var h = t.hour, ampm = null, hh;
		if (s.clock12) {
			ampm = h < 12 ? "AM" : "PM";
			h = h % 12 || 12;
			hh = h < 10 ? " " + h : String(h);
		} else {
			hh = pad(h);
		}
		var chars = hh + pad(t.minute), ss = pad(t.second);
		var off = s.showUnlit ? s.unlit : null, offSec = s.showUnlitSec ? s.unlit : null;

		var cv = $("dots"), ctx = cv.getContext("2d");
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, cv.width, cv.height);
		ctx.setTransform(state.scale * state.dpr, 0, 0, state.scale * state.dpr, 0, 0);

		var k = L.k, P = G.pitch * k, R = G.radius * k, x0, y0, i;
		if (L.mode === "row") {
			var side = s.showSec || !!ampm;
			x0 = W / 2 - (side ? G.centerWithSide : G.centerNoSide) * k;
			y0 = L.cy - G.centerY * k;
		} else {
			var p2 = 12.5 * k / 0.93, r2 = 4.4 * k / 0.93, gap = 40 * k / 0.93;
			var items = [];
			if (s.showSec) items.push({ t: ss, c: s.accent });
			if (ampm) items.push({ t: ampm, c: s.lit });
			var digitsH = 6 * P + 2 * R, rowH = 6 * p2 + 2 * r2;
			var top = (H - (digitsH + (items.length ? gap + rowH : 0))) / 2;
			x0 = W / 2 - G.centerNoSide * k;
			y0 = top + R;
		}

		for (i = 0; i < 4; i++) cell(ctx, s.font, chars.charAt(i), x0 + G.cells[i] * k, y0, P, R, s.lit, off);
		ctx.fillStyle = s.accent;
		G.colonY.forEach(function (dy) {
			ctx.beginPath();
			ctx.arc(x0 + G.colonX * k, y0 + dy * k, G.colonR * k, 0, Math.PI * 2);
			ctx.fill();
		});

		if (L.mode === "row") {
			var sx = x0 + G.sideX * k, p = G.sidePitch * k, r = G.sideRadius * k;
			if (s.showSec) drawSide(ctx, s, ss, sx, y0 + G.secY * k, p, r, s.accent, offSec);
			if (ampm) drawSide(ctx, s, ampm, sx, y0 + (s.ampmPos === "bottom" ? G.ampmBottom : G.ampmTop) * k, p, r, s.lit, offSec);
		} else if (items.length) {
			var rowW = items.length * 10 * p2 + (items.length - 1) * 4 * p2;
			var rx = W / 2 - rowW / 2, ry = y0 - R + digitsH + gap + r2;
			items.forEach(function (it, n) { drawSide(ctx, s, it.t, rx + n * 14 * p2, ry, p2, r2, it.c, offSec); });
		}
	}

	// ------------------------------------------------------------------ boucle
	var timer = null;
	function tick() {
		render();
		clearTimeout(timer);
		timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 10);
	}

	function relayout() { setupStage(); render(); }

	window.icueEvents = {
		onICUEInitialized: function () { formatters = {}; render(); },
		onDataUpdated: function () { formatters = {}; render(); }
	};
	window.addEventListener("edgesize", relayout);

	setupStage();
	tick();
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
})();
