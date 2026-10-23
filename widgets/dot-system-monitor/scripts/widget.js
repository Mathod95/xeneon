/* EDGE / DOT – Dot System Monitor for CORSAIR XENEON EDGE (iCUE widget) */
(function () {
	"use strict";

	// ---------------------------------------------------------------- state
	var HIST_MAX = 900; // 15 min at 1 sample / sec
	var SPARK_SEC = 60; // mini sparklines show the last minute

	var state = {
		mode: "demo", // "live" | "demo"
		userMode: null, // forced by the gear menu, null = auto
		windowSec: 300,
		selected: "fps",
		fpsPluginReady: false,
		sensorsPluginReady: false,
		t: 0
	};

	var fps = {
		key: "fps",
		name: "FRAMERATE",
		unit: "FPS",
		value: null,
		available: false,
		process: "",
		history: [],
		fixedMax: null
	};

	var sensors = [
		{ key: "cpuTemp", prop: "sensorCpuTemp", type: "temperature", kind: "cpu-temp", demoName: "CPU PACKAGE", demoUnit: "°C", base: 64, amp: 4, max: 100 },
		{ key: "cpuLoad", prop: "sensorCpuLoad", type: "load", kind: "", demoName: "CPU LOAD", demoUnit: "%", base: 41, amp: 12, max: 100 },
		{ key: "gpuTemp", prop: "sensorGpuTemp", type: "temperature", kind: "gpu-temp", demoName: "GPU TEMPERATURE", demoUnit: "°C", base: 73, amp: 3, max: 100 },
		{ key: "gpuLoad", prop: "sensorGpuLoad", type: "load", kind: "gpu-load", demoName: "GPU LOAD", demoUnit: "%", base: 98, amp: 2, max: 100 }
	];
	sensors.forEach(function (s) {
		s.id = "";
		s.name = s.demoName;
		s.unit = s.demoUnit;
		s.device = "";
		s.value = null;
		s.history = [];
	});

	function series(key) {
		if (key === "fps") return fps;
		for (var i = 0; i < sensors.length; i++) if (sensors[i].key === key) return sensors[i];
		return fps;
	}

	// ---------------------------------------------------------------- helpers
	function $(id) { return document.getElementById(id); }

	function globalVal(name) {
		try { return typeof window[name] !== "undefined" ? window[name] : undefined; } catch (e) { return undefined; }
	}

	function normUnit(u) {
		if (!u) return "";
		u = String(u).trim();
		if (u === "C" || u === "c") return "°C";
		if (u === "F" || u === "f") return "°F";
		return u;
	}

	function fmt(v) {
		if (v === null || v === undefined || isNaN(v)) return "–";
		return Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(1);
	}

	function lastN(arr, n) { return arr.length > n ? arr.slice(arr.length - n) : arr; }

	function statsOf(arr) {
		var vals = arr.filter(function (v) { return v !== null && !isNaN(v); });
		if (!vals.length) return null;
		var min = Infinity, max = -Infinity, sum = 0;
		vals.forEach(function (v) { if (v < min) min = v; if (v > max) max = v; sum += v; });
		return { min: min, max: max, avg: sum / vals.length };
	}

	// Promise bridge over the Qt "requestId / asyncResponse" pattern
	function makeAsync(plugin) {
		var next = 1;
		var pending = {};
		try {
			plugin.asyncResponse.connect(function (id, value) {
				var cb = pending[id];
				if (cb) { delete pending[id]; cb(value); }
			});
		} catch (e) { /* ignore */ }
		return function (method) {
			var args = Array.prototype.slice.call(arguments, 1);
			return new Promise(function (resolve) {
				var id = next++;
				pending[id] = resolve;
				try { plugin[method].apply(plugin, [id].concat(args)); }
				catch (e) { delete pending[id]; resolve(null); return; }
				setTimeout(function () { if (pending[id]) { delete pending[id]; resolve(null); } }, 5000);
			});
		};
	}

	// ---------------------------------------------------------------- canvas utils
	function prepCanvas(cv) {
		var dpr = window.devicePixelRatio || 1;
		var w = Math.max(1, Math.round(cv.clientWidth * dpr));
		var h = Math.max(1, Math.round(cv.clientHeight * dpr));
		if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
		var ctx = cv.getContext("2d");
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, w, h);
		return { ctx: ctx, w: w, h: h, dpr: dpr };
	}

	function cssVar(name) {
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	}

	// 5x7 dot-matrix font
	var FONT = {
		"0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
		"1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
		"2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
		"3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
		"4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
		"5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
		"6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
		"7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
		"8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
		"9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
		"-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
		" ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
		".": ["0", "0", "0", "0", "0", "0", "1"]
	};

	// opts: { showOff, on, off, gap (cols between glyphs), fill (fraction of pitch), align }
	function drawDots(cv, text, opts) {
		if (opts.fitWidth) {
			var n = 0;
			for (var j = 0; j < text.length; j++) n += (FONT[text[j]] || FONT[" "])[0].length + (j < text.length - 1 ? (opts.gap || 1) : 0);
			cv.style.width = Math.ceil(n * cv.clientHeight / 7) + "px";
		}
		var c = prepCanvas(cv);
		var ctx = c.ctx;
		var gap = opts.gap || 1;
		var cols = 0;
		for (var i = 0; i < text.length; i++) {
			var g = FONT[text[i]] || FONT[" "];
			cols += g[0].length + (i < text.length - 1 ? gap : 0);
		}
		var pitch = Math.min(c.h / 7, c.w / Math.max(cols, 1));
		var r = pitch * (opts.fill || 0.38);
		var x0 = opts.align === "center" ? (c.w - cols * pitch) / 2 : 0;
		var y0 = c.h - 7 * pitch;
		var x = x0;
		for (var k = 0; k < text.length; k++) {
			var glyph = FONT[text[k]] || FONT[" "];
			for (var row = 0; row < 7; row++) {
				for (var col = 0; col < glyph[row].length; col++) {
					var lit = glyph[row][col] === "1";
					if (!lit && !opts.showOff) continue;
					ctx.beginPath();
					ctx.fillStyle = lit ? opts.on : opts.off;
					ctx.arc(x + col * pitch + pitch / 2, y0 + row * pitch + pitch / 2, r, 0, Math.PI * 2);
					ctx.fill();
				}
			}
			x += (glyph[0].length + gap) * pitch;
		}
	}

	function smoothPath(ctx, pts) {
		ctx.beginPath();
		ctx.moveTo(pts[0][0], pts[0][1]);
		for (var i = 1; i < pts.length - 1; i++) {
			var mx = (pts[i][0] + pts[i + 1][0]) / 2;
			var my = (pts[i][1] + pts[i + 1][1]) / 2;
			ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
		}
		var last = pts[pts.length - 1];
		ctx.lineTo(last[0], last[1]);
	}

	function dottedLine(ctx, x1, x2, y, dpr, color) {
		ctx.save();
		ctx.strokeStyle = color;
		ctx.lineWidth = 1.2 * dpr;
		ctx.setLineDash([1 * dpr, 4 * dpr]);
		ctx.beginPath();
		ctx.moveTo(x1, Math.round(y) + 0.5);
		ctx.lineTo(x2, Math.round(y) + 0.5);
		ctx.stroke();
		ctx.restore();
	}

	// Mini sparkline: line in the upper part, two dotted rules underneath
	function drawSpark(cv, data, color, lineWidth) {
		var c = prepCanvas(cv);
		var ctx = c.ctx, w = c.w, h = c.h, dpr = c.dpr;
		var lineZone = h * 0.55;
		dottedLine(ctx, 0, w, h * 0.72, dpr, "#2e2e2e");
		dottedLine(ctx, 0, w, h * 0.94, dpr, "#2e2e2e");
		var vals = data.filter(function (v) { return v !== null && !isNaN(v); });
		if (vals.length < 2) return;
		var st = statsOf(vals);
		var span = Math.max(st.max - st.min, Math.abs(st.avg) * 0.08, 1);
		var lo = st.avg - span * 0.75, hi = st.avg + span * 0.75;
		var pad = lineWidth * dpr;
		var pts = vals.map(function (v, i) {
			return [
				(i / (vals.length - 1)) * w,
				pad + (1 - (v - lo) / (hi - lo)) * (lineZone - pad * 2)
			];
		});
		ctx.strokeStyle = color;
		ctx.lineWidth = lineWidth * dpr;
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		smoothPath(ctx, pts);
		ctx.stroke();
	}

	function niceMax(v, s) {
		if (s && s.unit === "%") return 100;
		if (s && /°/.test(s.unit || "")) return Math.max(100, Math.ceil(v / 10) * 10);
		if (!v || v <= 0) return 60;
		var target = v * 1.15;
		var step = target > 200 ? 50 : 20;
		return Math.ceil(target / step) * step;
	}

	function drawHistory(cv, s) {
		var c = prepCanvas(cv);
		var ctx = c.ctx, w = c.w, h = c.h, dpr = c.dpr;
		var data = lastN(s.history, state.windowSec);
		var st = statsOf(data);
		var top = niceMax(st ? st.max : 0, s);
		$("histTop").textContent = top;

		var gridColor = "#2c2c2c";
		dottedLine(ctx, 0, w, 1, dpr, gridColor);
		dottedLine(ctx, 0, w, h * 0.333, dpr, gridColor);
		dottedLine(ctx, 0, w, h * 0.666, dpr, gridColor);
		dottedLine(ctx, 0, w, h - 1, dpr, gridColor);

		var vals = data.map(function (v) { return v === null || isNaN(v) ? null : v; });
		if (vals.filter(function (v) { return v !== null; }).length < 2) return;

		// x positions span the full window so a young history grows from the right
		var n = state.windowSec;
		var offset = n - vals.length;
		var segs = [], cur = [];
		vals.forEach(function (v, i) {
			if (v === null) { if (cur.length > 1) segs.push(cur); cur = []; return; }
			var x = ((offset + i) / (n - 1)) * w;
			var y = h - (Math.min(v, top) / top) * h;
			cur.push([x, y]);
		});
		if (cur.length > 1) segs.push(cur);

		ctx.strokeStyle = cssVar("--accent") || "#e5484d";
		ctx.lineWidth = 2 * dpr;
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		segs.forEach(function (pts) { smoothPath(ctx, pts); ctx.stroke(); });
	}

	// ---------------------------------------------------------------- UI build
	function buildCards() {
		var wrap = $("cards");
		wrap.innerHTML = "";
		sensors.forEach(function (s) {
			var b = document.createElement("button");
			b.className = "card";
			b.innerHTML =
				'<span class="card-title"></span>' +
				'<span class="card-value"><canvas></canvas><span class="unit"></span></span>' +
				'<span class="card-sub"></span>' +
				'<canvas class="spark"></canvas>';
			b.addEventListener("click", function () { select(s.key); });
			s.el = {
				root: b,
				title: b.querySelector(".card-title"),
				value: b.querySelector(".card-value canvas"),
				unit: b.querySelector(".card-value .unit"),
				sub: b.querySelector(".card-sub"),
				spark: b.querySelector(".spark")
			};
			wrap.appendChild(b);
		});
	}

	function select(key) {
		state.selected = state.selected === key && key !== "fps" ? "fps" : key;
		render();
	}

	function applyLayout() {
		var w = window.innerWidth, h = window.innerHeight;
		// design reference: 150 x 62 rem
		var rem = Math.max(4, Math.min(h / 62, w / 150));
		document.documentElement.style.fontSize = rem + "px";
		var app = $("app");
		var ratio = w / h;
		app.classList.toggle("compact", ratio < 1.9 && ratio >= 1.15);
		app.classList.toggle("tiny", ratio < 1.15);
		if (ratio < 1.9) {
			document.documentElement.style.fontSize = Math.max(4, Math.min(h / 62, w / (ratio < 1.15 ? 60 : 100))) + "px";
		}
	}

	function setSeg(id, attr, value) {
		var btns = $(id).querySelectorAll("button");
		for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("on", btns[i].getAttribute(attr) === String(value));
	}

	function windowLabel() {
		return state.windowSec >= 60 ? state.windowSec / 60 + " MIN" : state.windowSec + " SEC";
	}

	// ---------------------------------------------------------------- render
	function render() {
		var live = state.mode === "live";
		var app = $("app");
		app.classList.toggle("live", live);
		var accent = cssVar("--accent") || "#e5484d";
		var text = cssVar("--text") || "#e6e6e6";

		$("modeLabel").textContent = live ? "LIVE / ICUE" : "DEMO / SIMULATED";
		$("footLeft").textContent = live ? "LIVE / ICUE SENSORS" : "DEMO / SIMULATED DATA";
		$("footRight").textContent = "1 SEC / " + windowLabel() + " HISTORY";
		setSeg("segWindow", "data-win", state.windowSec);

		// FPS column
		var fpsOk = !live || fps.available;
		$("fpsTag").textContent = (live ? "LIVE" : "DEMO") + " / FRAMERATE";
		$("gameName").textContent = live ? (fps.available ? (fps.process || "GAME DETECTED") : "NO GAME DETECTED") : "CYBERPUNK 2077";
		$("fpsSource").textContent = live ? (fps.available ? "ICUE / FPS OVERLAY" : "WAITING FOR A GAME") : "SIMULATED / DEMO DATA";
		var fv = fpsOk && fps.value !== null ? Math.max(0, Math.min(999, Math.round(fps.value))) : null;
		var fText = fv === null ? "---" : ("   " + fv).slice(-3);
		drawDots($("fpsCanvas"), fText, { showOff: true, on: "#f5f5f5", off: "#1e1e1e", gap: 1, fill: 0.4 });

		var fWin = statsOf(lastN(fps.history, state.windowSec));
		$("fpsMin").textContent = fWin ? fmt(fWin.min) : "–";
		$("fpsAvg").textContent = fWin ? Math.round(fWin.avg) : "–";
		$("fpsMax").textContent = fWin ? Math.round(fWin.max) : "–";
		drawSpark($("fpsSpark"), lastN(fps.history, SPARK_SEC), accent, 2);

		// sensor cards
		sensors.forEach(function (s) {
			var e = s.el;
			e.root.classList.toggle("sel", state.selected === s.key);
			e.title.textContent = s.name;
			e.unit.textContent = s.unit;
			e.sub.textContent = live ? (s.device || (s.id ? "ICUE SENSOR" : "NO SENSOR SELECTED")) : "SIMULATED";
			drawDots(e.value, s.value === null ? "--" : fmt(s.value), { showOff: false, on: text, gap: 1, fill: 0.3, fitWidth: true });
			drawSpark(e.spark, lastN(s.history, SPARK_SEC), "#d9d9d9", 1.6);
		});

		// history panel
		var sel = series(state.selected);
		$("histName").textContent = sel.name;
		$("histUnit").textContent = sel.unit;
		$("histWindow").textContent = windowLabel();
		$("histFrom").textContent = "−" + windowLabel();
		drawHistory($("histCanvas"), sel);
		var hs = statsOf(lastN(sel.history, state.windowSec));
		var unit = sel === fps ? "" : " " + sel.unit;
		$("histLow").textContent = hs ? fmt(hs.min) + unit : "–";
		$("histAvg").textContent = hs ? (sel === fps ? Math.round(hs.avg) : fmt(hs.avg)) + unit : "–";
		$("histPeak").textContent = hs ? (sel === fps ? Math.round(hs.max) : fmt(hs.max)) + unit : "–";
	}

	// ---------------------------------------------------------------- sampling
	function demoValue(base, amp, t, seed) {
		return base + amp * (0.55 * Math.sin(t / 9 + seed) + 0.3 * Math.sin(t / 4.1 + seed * 2) + 0.15 * Math.sin(t / 1.9 + seed * 3));
	}

	function push(arr, v) {
		arr.push(v);
		if (arr.length > HIST_MAX) arr.shift();
	}

	function tick() {
		state.t += 1;
		if (state.mode === "demo") {
			fps.value = demoValue(119, 20, state.t, 0.4);
			sensors.forEach(function (s, i) {
				var v = demoValue(s.base, s.amp, state.t, i + 1);
				s.value = s.unit === "%" ? Math.min(100, v) : v;
			});
			push(fps.history, fps.value);
		} else {
			push(fps.history, fps.available ? fps.value : null);
			refreshSensorValues();
		}
		sensors.forEach(function (s) { push(s.history, s.value); });
		render();
	}

	function seedDemoHistory() {
		for (var i = 0; i < HIST_MAX; i++) {
			var t = state.t - HIST_MAX + i;
			fps.history.push(demoValue(119, 20, t, 0.4));
			sensors.forEach(function (s, k) {
				var v = demoValue(s.base, s.amp, t, k + 1);
				s.history.push(s.unit === "%" ? Math.min(100, v) : v);
			});
		}
	}

	function setMode(mode) {
		if (mode === state.mode) return;
		state.mode = mode;
		fps.history = [];
		sensors.forEach(function (s) {
			s.history = [];
			if (mode === "demo") { s.name = s.demoName; s.unit = s.demoUnit; }
		});
		if (mode === "demo") seedDemoHistory();
		else { fps.value = null; sensors.forEach(function (s) { s.value = null; s.id = ""; }); resolveSensors(); }
		render();
	}

	function inIcue() {
		return typeof window.iCUE_initialized !== "undefined" || typeof window.iCUE !== "undefined" || !!window.plugins;
	}

	function autoMode() {
		// Inside iCUE the widget only ever shows real data.
		// The simulated preview exists solely when index.html is opened in a normal browser.
		setMode(inIcue() || state.fpsPluginReady || state.sensorsPluginReady ? "live" : "demo");
	}

	// ---------------------------------------------------------------- iCUE: appearance
	function onIcueDataUpdated() {
		var root = document.documentElement.style;
		var a = globalVal("accentColor"), t = globalVal("textColor"), b = globalVal("backgroundColor");
		if (a) root.setProperty("--accent", a);
		if (t) root.setProperty("--text", t);
		if (b) root.setProperty("--bg", b);
		if (state.sensorsPluginReady) resolveSensors();
		render();
	}

	function onIcueInitialized() { autoMode(); }

	// ---------------------------------------------------------------- iCUE: FPS plugin
	var fpsCall = null;

	function initFps() {
		if (state.fpsPluginReady) return;
		var p = window.plugins && window.plugins.Fpsdataprovider;
		if (!p) return;
		state.fpsPluginReady = true;
		fpsCall = makeAsync(p);
		try {
			p.fpsUpdated.connect(function (v) { fps.value = Number(v); });
			p.fpsAvailabilityChanged.connect(function (ok) { fps.available = !!ok; render(); });
			p.processChanged.connect(function (name) { fps.process = String(name || "").toUpperCase(); render(); });
		} catch (e) { /* older runtime */ }
		Promise.all([fpsCall("getFpsAvailable"), fpsCall("getCurrentFps"), fpsCall("getCurrentProcess")]).then(function (r) {
			fps.available = !!r[0];
			if (r[1] !== null) fps.value = Number(r[1]);
			fps.process = String(r[2] || "").toUpperCase();
			render();
		});
		autoMode();
	}

	// ---------------------------------------------------------------- iCUE: Sensors plugin
	var sensorCall = null;

	function resolveSensors() {
		var p = window.plugins && window.plugins.Sensorsdataprovider;
		if (!p || !sensorCall || state.mode !== "live") return;
		sensors.forEach(function (s) {
			var id = globalVal(s.prop);
			if (!id) {
				try { id = p.getDefaultSensorIdBlock(s.type, s.kind); } catch (e) { id = ""; }
			}
			if (id === s.id) return;
			s.id = id || "";
			s.history = [];
			s.value = null;
			if (!s.id) { s.name = s.demoName; s.device = ""; return; }
			Promise.all([
				sensorCall("getSensorName", s.id),
				sensorCall("getSensorUnits", s.id),
				sensorCall("getSensorDeviceName", s.id),
				sensorCall("getSensorValue", s.id)
			]).then(function (r) {
				if (r[0]) s.name = String(r[0]).toUpperCase();
				s.unit = normUnit(r[1]) || s.demoUnit;
				s.device = String(r[2] || "").toUpperCase();
				if (r[3] !== null && r[3] !== "") s.value = parseFloat(r[3]);
				render();
			});
		});
	}

	function refreshSensorValues() {
		if (!sensorCall) return;
		sensors.forEach(function (s) {
			if (!s.id) return;
			sensorCall("getSensorValue", s.id).then(function (v) {
				if (v !== null && v !== "" && !isNaN(parseFloat(v))) s.value = parseFloat(v);
			});
		});
	}

	function initSensors() {
		if (state.sensorsPluginReady) return;
		var p = window.plugins && window.plugins.Sensorsdataprovider;
		if (!p) return;
		state.sensorsPluginReady = true;
		sensorCall = makeAsync(p);
		try {
			p.sensorValueChanged.connect(function (id, value) {
				sensors.forEach(function (s) { if (s.id === id) s.value = parseFloat(value); });
			});
			p.sensorUnitsChanged.connect(function (id, units) {
				sensors.forEach(function (s) { if (s.id === id) s.unit = normUnit(units); });
			});
		} catch (e) { /* older runtime */ }
		autoMode();
		resolveSensors();
	}

	// ---------------------------------------------------------------- wiring
	window.icueEvents = { onICUEInitialized: onIcueInitialized, onDataUpdated: onIcueDataUpdated };
	window.pluginFpsdataproviderEvents = { onInitialized: initFps };
	window.pluginSensorsdataproviderEvents = { onInitialized: initSensors };

	function start() {
		buildCards();
		applyLayout();
		if (inIcue()) { state.mode = "live"; } else { seedDemoHistory(); }

		$("fpsHistoryBtn").addEventListener("click", function () { state.selected = "fps"; render(); });
		$("gearBtn").addEventListener("click", function (e) {
			e.stopPropagation();
			var pop = $("popover");
			pop.hidden = !pop.hidden;
		});
		$("popover").addEventListener("click", function (e) {
			e.stopPropagation();
			var t = e.target.closest("button");
			if (!t) return;
			if (t.hasAttribute("data-win")) state.windowSec = parseInt(t.getAttribute("data-win"), 10);
			render();
		});
		document.addEventListener("click", function () { $("popover").hidden = true; });
		window.addEventListener("resize", function () { applyLayout(); render(); });

		// late initialisation (scripts loaded after iCUE injection)
		if (globalVal("iCUE_initialized")) { onIcueInitialized(); onIcueDataUpdated(); }
		if (globalVal("pluginFpsdataprovider_initialized")) initFps();
		if (globalVal("pluginSensorsdataprovider_initialized")) initSensors();

		render();
		setInterval(tick, 1000);
	}

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
	else start();
})();
