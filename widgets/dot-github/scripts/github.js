/*
 * Dot GitHub : le rendu, partagé par la maquette de référence (mockups/reference.html), Dot Page
 * et, plus tard, le module. Une seule source : ce qui est vu dans la maquette est exactement ce qui tourne ailleurs.
 *
 *   var gh = DotGitHub.mount(stage, { size: "xl", settings: function () { … } });
 *   gh.render();          // quand un réglage change
 *   gh.setSize("m");      // S, M, L ou XL
 *
 * `stage` reçoit la classe .dot-github et la taille de l'emplacement. Réglages (tous facultatifs) :
 * user, scen (ok, fail, off), github (couleurs du graphe GitHub), showUnlit, accent, lit, unlit, label.
 * Les contributions, pull requests, notifications et runs sont des exemples : le module passera les vraies données.
 */
(function () {
	"use strict";

	var SLOTS = { s: [840, 344], m: [840, 696], l: [1688, 696], xl: [2536, 696] };
	var SIZES = {
		xl: { weeks: 53, pitch: 30, days: true },
		l: { weeks: 34, pitch: 28, days: true },
		m: { weeks: 26, pitch: 26, days: true },
		s: { weeks: 26, pitch: 22, days: false }
	};
	var DEFAULTS = { user: "MATHOD95", scen: "ok", github: false, showUnlit: true, accent: "#10b981", lit: "#f2f0e9", unlit: "#1c1c1c", label: "#b8b6b0" };

	// police dot grasse du Dot Clock
	var FONT = {
		"0": [".###.", "##.##", "##.##", "##.##", "##.##", "##.##", ".###."],
		"1": [".##.", "###.", ".##.", ".##.", ".##.", ".##.", "####"],
		"2": [".###.", "##.##", "...##", "..##.", ".##..", "##...", "#####"],
		"3": [".###.", "##.##", "...##", "..##.", "...##", "##.##", ".###."],
		"4": ["...##", "..###", ".####", "##.##", "#####", "...##", "...##"],
		"5": ["#####", "##...", "####.", "...##", "...##", "##.##", ".###."],
		"6": [".###.", "##...", "##...", "####.", "##.##", "##.##", ".###."],
		"7": ["#####", "...##", "..##.", "..##.", ".##..", ".##..", ".##.."],
		"8": [".###.", "##.##", "##.##", ".###.", "##.##", "##.##", ".###."],
		"9": [".###.", "##.##", "##.##", ".####", "...##", "...##", ".###."]
	};

	// contributions d'exemple : 53 semaines jusqu'au dimanche 25 octobre 2026
	var WEEKS = 53;
	var START = new Date(2026, 9, 25 - 52 * 7);
	var TODAY_IDX = 52 * 7;
	var seed = 95;
	function rnd() { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; }
	var COUNTS = [];
	for (var i = 0; i <= TODAY_IDX; i++) {
		var wd = i % 7, p = wd === 0 || wd === 6 ? 0.45 : 0.72;
		var r = rnd(), q = rnd();
		COUNTS.push(r < p ? 1 + Math.floor(q * q * 14) : 0);
	}
	for (var j = 0; j < 17; j++) if (!COUNTS[TODAY_IDX - j]) COUNTS[TODAY_IDX - j] = 2 + (j % 5);
	COUNTS[TODAY_IDX - 17] = 0;
	COUNTS[TODAY_IDX] = 6;
	var TOTAL = COUNTS.reduce(function (a, b) { return a + b; }, 0);
	var LONGEST = 0, run = 0;
	COUNTS.forEach(function (c) { run = c ? run + 1 : 0; if (run > LONGEST) LONGEST = run; });
	var STREAK = 17;
	var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
	function dateOf(idx) { return new Date(START.getFullYear(), START.getMonth(), START.getDate() + idx); }
	function level(c) { return c === 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : c <= 9 ? 3 : 4; }

	// listes d'exemple
	function lists(s) {
		var u = s.user.toLowerCase();
		var fail = s.scen === "fail";
		return {
			prs: [
				{ st: "info", t: "Dot Clock: S and M layouts", m: "XENEON #14 · REVIEW REQUESTED", r: "2 H", url: "github.com/" + u + "/xeneon/pull/14" },
				{ st: "ok", t: "Site: reference mockups index", m: "XENEON #13 · APPROVED", r: "1 D", url: "github.com/" + u + "/xeneon/pull/13" },
				{ st: fail ? "fail" : "ok", t: "traefik: bump to v3.5", m: "HOMELAB #41 · " + (fail ? "CI FAILED" : "CHECKS PASSED"), r: "3 D", url: "github.com/" + u + "/homelab/pull/41" },
				{ st: "fail", t: "plex: move transcode to tmpfs", m: "HOMELAB #39 · CHANGES REQUESTED", r: "4 D", url: "github.com/" + u + "/homelab/pull/39" },
				{ st: "run", t: "nvim: migrate to lazy.nvim", m: "DOTFILES #7 · DRAFT · CHECKS RUNNING", r: "5 D", url: "github.com/" + u + "/dotfiles/pull/7" }
			],
			inbox: [
				{ st: "info", t: "Can you check the S layout?", m: "MENTION · XENEON #14", r: "12 MIN", url: "github.com/" + u + "/xeneon/pull/14" },
				{ st: fail ? "fail" : "info", t: fail ? "Deploy failed on main" : "Deploy succeeded on main", m: "ACTIONS · HOMELAB", r: "40 MIN", url: "github.com/" + u + "/homelab/actions" },
				{ st: "info", t: "v0.4.49", m: "RELEASE · ICUE-WIDGET-BUILDER", r: "3 H", url: "github.com/corsairlabs/icue-widget-builder/releases" },
				{ st: "info", t: "Dot Weather: Open-Meteo rate limit", m: "ISSUE · XENEON #15", r: "5 H", url: "github.com/" + u + "/xeneon/issues/15" },
				{ st: "info", t: "Review requested", m: "PULL REQUEST · DOTFILES #7", r: "1 D", url: "github.com/" + u + "/dotfiles/pull/7" }
			],
			actions: [
				{ st: "ok", t: "Site", m: "XENEON · MAIN", r: "42 S", r2: "3 MIN", url: "github.com/" + u + "/xeneon/actions" },
				{ st: "ok", t: "Build widgets", m: "XENEON · MAIN", r: "1 M 12 S", r2: "3 MIN", url: "github.com/" + u + "/xeneon/actions" },
				{ st: fail ? "fail" : "ok", t: "Deploy", m: "HOMELAB · MAIN", r: "2 M 05 S", r2: "40 MIN", url: "github.com/" + u + "/homelab/actions" },
				{ st: "run", t: "Lint", m: "DOTFILES · NVIM-LAZY", r: "RUNNING", r2: "0 M 31 S", url: "github.com/" + u + "/dotfiles/actions" },
				{ st: "ok", t: "Build widgets", m: "XENEON · V0.1.2", r: "1 M 08 S", r2: "2 D", url: "github.com/" + u + "/xeneon/actions" }
			]
		};
	}
	var COUNT = { prs: 5, inbox: 7 };

	// dessins
	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
	function canvasFor(w, h) {
		var cv = document.createElement("canvas"), dpr = 2;
		cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px";
		var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		return { cv: cv, ctx: ctx };
	}
	function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
	function mix(a, b, t) { var x = hex(a), y = hex(b); return "rgb(" + x.map(function (c, i) { return Math.round(c + (y[i] - c) * t); }).join(",") + ")"; }
	function levelColor(l, s) {
		if (s.github) return ["", "#0e4429", "#006d32", "#26a641", "#39d353"][l];
		return mix(s.unlit, s.accent, [0, 0.3, 0.52, 0.76, 1][l]);
	}
	function digits(text, k, s, color) {
		var P = 36.7 * k, R = 13.6 * k, gap = 22 * k, w = 0;
		for (var i = 0; i < text.length; i++) w += (FONT[text[i]][0].length - 1) * P + 2 * R + (i < text.length - 1 ? gap : 0);
		var c = canvasFor(w, 6 * P + 2 * R), x = R;
		for (var j = 0; j < text.length; j++) {
			var g = FONT[text[j]];
			for (var row = 0; row < 7; row++) for (var cc = 0; cc < g[row].length; cc++) {
				var lit = g[row][cc] === "#";
				if (!lit && !s.showUnlit) continue;
				c.ctx.beginPath(); c.ctx.fillStyle = lit ? color : s.unlit;
				c.ctx.arc(x + cc * P, R + row * P, R, 0, Math.PI * 2); c.ctx.fill();
			}
			x += (g[0].length - 1) * P + 2 * R + gap;
		}
		return c.cv;
	}
	function graph(Z, s) {
		var P = Z.pitch, n = Z.weeks, lw = Z.days ? 70 : 0, top = 34, r = P * 0.36;
		var c = canvasFor(lw + n * P, top + 7 * P), ctx = c.ctx;
		ctx.font = "500 18px 'Fira Code', Consolas, monospace"; ctx.textBaseline = "middle"; ctx.fillStyle = s.label;
		if (Z.days) [["MON", 1], ["WED", 3], ["FRI", 5]].forEach(function (d) { ctx.fillText(d[0], 0, top + d[1] * P + P / 2); });
		var first = WEEKS - n, lastLabel = -9;
		for (var col = 0; col < n; col++) {
			var w = first + col, d0 = dateOf(w * 7);
			if (d0.getDate() <= 7 && col - lastLabel >= 3 && col <= n - 2) { ctx.fillStyle = s.label; ctx.fillText(MONTHS[d0.getMonth()], lw + col * P + P / 2 - r, 12); lastLabel = col; }
			for (var row = 0; row < 7; row++) {
				var idx = w * 7 + row;
				if (idx > TODAY_IDX) continue;
				var l = level(COUNTS[idx]);
				if (l === 0 && !s.showUnlit) continue;
				ctx.beginPath(); ctx.fillStyle = l === 0 ? s.unlit : levelColor(l, s);
				ctx.arc(lw + col * P + P / 2, top + row * P + P / 2, r, 0, Math.PI * 2); ctx.fill();
				if (idx === TODAY_IDX) { ctx.lineWidth = 2; ctx.strokeStyle = s.lit; ctx.beginPath(); ctx.arc(lw + col * P + P / 2, top + row * P + P / 2, r + 4, 0, Math.PI * 2); ctx.stroke(); }
			}
		}
		var box = el("div", "graph"); box.appendChild(c.cv);
		return box;
	}
	function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

	function mount(stage, opts) {
		opts = opts || {};
		var size = SLOTS[opts.size] ? opts.size : "xl";
		var getSettings = typeof opts.settings === "function" ? opts.settings : function () { return opts.settings || {}; };
		function settings() {
			var s = getSettings() || {}, o = {}; for (var k in DEFAULTS) o[k] = s[k] === undefined ? DEFAULTS[k] : s[k];
			o.user = String(o.user).trim().toUpperCase() || "MATHOD95";
			return o;
		}
		stage.classList.add("dot-github");
		var tab = "prs", detail = null, backTimer = null, toastTimer = null, hit = -1;

		function head(s, scen) {
			var hd = el("div", "head");
			hd.appendChild(el("span", "dot"));
			hd.appendChild(el("p", "lbl", "DOT GITHUB · @" + s.user));
			hd.appendChild(el("span", "grow"));
			hd.appendChild(el("p", "lbl" + (scen === "off" ? " warn" : ""), scen === "off" ? "UPDATED 2 H AGO" : "UPDATED 2 MIN AGO"));
			return hd;
		}
		function failCount(s) { return s.scen === "fail" ? 1 : 0; }
		function toast(text) {
			var old = stage.querySelector(".toast"); if (old) old.remove();
			var t = el("p", "lbl toast", text); stage.appendChild(t);
			clearTimeout(toastTimer);
			toastTimer = setTimeout(function () { hit = -1; render(); }, 2200);
		}
		function rowsFor(key, s) {
			var box = el("div", "rows");
			lists(s)[key].forEach(function (it, i) {
				var b = el("button", "row" + (hit === i ? " hit" : "")); b.type = "button";
				b.appendChild(el("span", "st " + it.st));
				var txt = el("span", "txt");
				txt.appendChild(el("span", "t", it.t));
				txt.appendChild(el("span", "lbl m", it.m));
				b.appendChild(txt);
				var rr = el("span", "r");
				rr.appendChild(el("span", "lbl" + (it.st === "fail" ? " warn" : ""), it.r));
				if (it.r2) rr.appendChild(el("span", "lbl", it.r2));
				b.appendChild(rr);
				b.addEventListener("click", function () { hit = i; render(); toast("OPENS ON PC · " + it.url.toUpperCase()); });
				box.appendChild(b);
			});
			return box;
		}
		function tabs(s) {
			var t = el("div", "tabs");
			[["prs", "PRS", String(COUNT.prs)], ["inbox", "INBOX", String(COUNT.inbox)], ["actions", "ACTIONS", failCount(s) ? "1 FAILED" : "PASSING"]].forEach(function (d) {
				var b = el("button", "tab" + (tab === d[0] ? " on" : "")); b.type = "button";
				b.appendChild(document.createTextNode(d[1]));
				b.appendChild(el("span", "n" + (d[0] === "actions" && failCount(s) ? " warn" : ""), d[2]));
				b.addEventListener("click", function () { tab = d[0]; hit = -1; render(); });
				t.appendChild(b);
			});
			return t;
		}
		function stats(s, compact) {
			var st = el("div", "stats");
			var big = el("div", "big");
			big.appendChild(digits(String(STREAK), 0.55, s, s.accent));
			big.appendChild(el("p", "lbl", "DAY STREAK"));
			st.appendChild(big);
			var kv = [["CONTRIBUTIONS · 12 MONTHS", fmt(TOTAL)], ["TODAY", String(COUNTS[TODAY_IDX])], ["LONGEST STREAK", LONGEST + " DAYS"]];
			if (!compact) kv.push(["MOST ACTIVE", "XENEON"]);
			kv.forEach(function (d) {
				var x = el("div", "kv"); x.appendChild(el("p", "val", d[1])); x.appendChild(el("p", "lbl", d[0])); st.appendChild(x);
			});
			return st;
		}

		function viewWide(s) {
			var Z = SIZES[size];
			stage.appendChild(head(s, s.scen));
			stage.appendChild(graph(Z, s));
			stage.appendChild(stats(s, size === "l"));
			var panel = el("div", "panel");
			panel.appendChild(tabs(s));
			panel.appendChild(rowsFor(tab, s));
			stage.appendChild(panel);
		}
		function viewM(s) {
			var Z = SIZES[size];
			if (detail) {
				var hd = el("div", "head");
				var back = el("button", "back", "‹ BACK"); back.type = "button";
				back.addEventListener("click", function () { detail = null; hit = -1; render(); });
				hd.appendChild(back);
				hd.appendChild(el("p", "lbl", { prs: "PULL REQUESTS", inbox: "NOTIFICATIONS", actions: "ACTIONS" }[detail]));
				hd.appendChild(el("span", "grow"));
				hd.appendChild(el("p", "lbl" + (s.scen === "off" ? " warn" : ""), s.scen === "off" ? "2 H AGO" : "2 MIN AGO"));
				stage.appendChild(hd);
				var panel = el("div", "panel"); panel.appendChild(rowsFor(detail, s)); stage.appendChild(panel);
				clearTimeout(backTimer);
				backTimer = setTimeout(function () { detail = null; hit = -1; render(); }, 30000);
				return;
			}
			stage.appendChild(head(s, s.scen));
			var cs = el("div", "counters");
			[["prs", String(COUNT.prs), "PRS", s.lit], ["inbox", String(COUNT.inbox), "INBOX", s.lit], ["actions", String(failCount(s)), "CI FAILING", failCount(s) ? "#ed403b" : s.lit]].forEach(function (d) {
				var b = el("button", "counter"); b.type = "button";
				b.appendChild(digits(d[1], 0.45, s, d[3]));
				b.appendChild(el("span", "lbl", d[2]));
				b.addEventListener("click", function () { detail = d[0]; hit = -1; render(); });
				cs.appendChild(b);
			});
			stage.appendChild(cs);
			stage.appendChild(graph(Z, s));
			stage.appendChild(el("p", "lbl foot", STREAK + " DAY STREAK · " + fmt(TOTAL) + " CONTRIBUTIONS · 12 MONTHS"));
		}
		function viewS(s) {
			var Z = SIZES[size];
			var top = el("p", "lbl top"); top.textContent = "@" + s.user + " · ";
			var sp = el("span"); sp.style.color = "var(--accent)"; sp.textContent = STREAK + " DAY STREAK"; top.appendChild(sp);
			stage.appendChild(top);
			stage.appendChild(graph(Z, s));
			stage.appendChild(el("p", "lbl bottom" + (s.scen === "off" ? " warn" : ""), s.scen === "off" ? "UPDATED 2 H AGO" : fmt(TOTAL) + " CONTRIBUTIONS · 12 MONTHS"));
			var side = el("div", "side");
			[["PRS", String(COUNT.prs), s.lit], ["INBOX", String(COUNT.inbox), s.lit], ["CI", failCount(s) ? "FAIL" : "OK", failCount(s) ? "#ed403b" : s.accent]].forEach(function (d) {
				var row = el("div");
				row.appendChild(el("p", "lbl", d[0]));
				var val = el("span", "v");
				var dot = el("i"); dot.style.background = d[2]; val.appendChild(dot);
				val.appendChild(el("span", "val", d[1]));
				row.appendChild(val);
				side.appendChild(row);
			});
			stage.appendChild(side);
		}

		function render() {
			var s = settings();
			stage.style.setProperty("--accent", s.accent);
			stage.style.setProperty("--lit", s.lit);
			stage.style.setProperty("--label", s.label);
			stage.innerHTML = "";
			if (size === "xl" || size === "l") viewWide(s);
			else if (size === "m") viewM(s);
			else viewS(s);
		}

		function setSize(s) {
			size = SLOTS[s] ? s : "xl"; detail = null; hit = -1;
			["s", "m", "l", "xl"].forEach(function (k) { stage.classList.toggle(k, k === size); });
		}
		setSize(size);
		render();
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
		return {
			render: render,
			setSize: function (s) { setSize(s); render(); },
			size: function () { return size; },
			animate: function () {}   // seule animation : le point des runs en cours, en CSS
		};
	}

	window.DotGitHub = { mount: mount, slots: SLOTS, defaults: DEFAULTS };
})();
