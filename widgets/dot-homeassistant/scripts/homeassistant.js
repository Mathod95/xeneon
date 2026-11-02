/*
 * Dot Home Assistant : le rendu, partagé par la maquette de référence (mockups/reference.html), Dot Page
 * et le module servi par Dot Companion (scripts/widget.js). Une seule source : ce qui est vu dans la maquette
 * est exactement ce qui tourne sur l'Edge.
 *
 *   var ha = DotHomeAssistant.mount(stage, { size: "xl", settings: function () { … },
 *     state: function () { … },        // module : l'état de la maison envoyé par le compagnon (voir demo())
 *     onCall: function (call) { … },   // module : { domain, service, entity, data } pour Home Assistant
 *     edit: function () { … },         // vrai : la grille se modifie (aperçu de la page de réglages du compagnon)
 *     onLayout: function (json) { … } });  // la disposition modifiée, à enregistrer dans le réglage haLayout
 *   ha.render();  ha.setSize("l");
 *
 *   DotHomeAssistant.card(entity, rows, settings)  // une carte seule (section Cartes de la maquette), exemples
 *
 * Réglages (tous facultatifs) : showTabs, showUnlit, accent, lit, unlit, label, layout (texte JSON :
 * { "<onglet>": [{ key, col, row, h }] }). Sans `state`, l'exemple de la maquette (demo()) : les touchers le modifient.
 */
(function () {
	"use strict";

	var SLOTS = { s: [840, 344], m: [840, 696], l: [1688, 696], xl: [2536, 696] };
	var COLS = { xl: 6, l: 4, m: 2, s: 0 }, ROWS = 6, PITCH = 12, BAR = 12;
	var DEFAULTS = { showTabs: true, showUnlit: true, grid: false, accent: "#10b981", lit: "#f2f0e9", unlit: "#1c1c1c", label: "#b8b6b0", layout: "" };
	var SIZE_NAME = { 2: "Small · 1 × 2", 3: "Medium · 1 × 3", 6: "Tall · 1 × 6" };
	var KIND = { light: "Light", plug: "Switch", cover: "Cover", climate: "Thermostat", lock: "Lock", scene: "Scene", auto: "Automation", sensor: "Sensor", power: "Power", th: "Temperature · humidity", list: "List" };
	// tailles possibles d'une carte, en rangées (la première est celle par défaut)
	var SIZES = { light: [2, 3], plug: [2, 3], scene: [2, 3], auto: [2, 3], cover: [3], climate: [3], lock: [3], sensor: [3], power: [3], th: [3], list: [6, 3] };

	// pictogrammes 7 × 7 points
	var PICS = {
		light: ["..###..", ".#...#.", "#.....#", "#.....#", ".#...#.", "..###..", "..###.."],
		plug: [".#...#.", ".#...#.", "#######", "#.....#", "#.....#", ".#####.", "...#..."],
		climate: ["...#...", "..#.#..", "..#.#..", "..###..", ".#####.", ".#####.", "..###.."],
		cover: ["#######", ".......", "#######", ".......", "#######", ".......", "#######"],
		lock: ["..###..", ".#...#.", ".#...#.", "#######", "###.###", "###.###", "#######"],
		sensor: [".......", "#......", "##...#.", "#.#.#.#", "#..#...", "#......", "#######"],
		power: ["....##.", "...##..", "..##...", ".#####.", "...##..", "..##...", ".##...."],
		scene: ["...#...", "...#...", "#######", ".#####.", "..###..", ".##.##.", "#.....#"],
		group: [".......", ".#...#.", "#.#.#.#", "#.#.#.#", ".#...#.", ".#...#.", "......."],
		auto: ["..#....", "..##...", "..###..", "..####.", "..###..", "..##...", "..#...."],
		update: ["...#...", "...#...", ".#.#.#.", "..###..", "...#...", "#.....#", "#######"],
		services: ["#######", "#.....#", "#######", ".......", "#######", "#.....#", "#######"]
	};
	// couleurs proposées au toucher du bouton couleur, blancs au toucher du bouton température
	var LIGHT_COLORS = ["#ffb35c", "#ff5a4e", "#ff6fd8", "#8b7bff", "#4fa3ff", "#3fe0a0"];
	var KELVINS = [[2700, "#ffb46b"], [4000, "#ffe2bd"], [6500, "#e9efff"]];

	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
	function canvas(w, h) {
		var cv = document.createElement("canvas"), dpr = 2;
		cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px";
		var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		return { cv: cv, ctx: ctx };
	}
	function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
	function pic(key, on, c) {
		var g = PICS[key] || PICS.sensor, k = canvas(7 * PITCH, 7 * PITCH);
		for (var y = 0; y < 7; y++) for (var x = 0; x < 7; x++) {
			var col = g[y][x] === "#" ? (on ? c.accent : c.lit) : c.unlit;
			if (!col) continue;
			k.ctx.globalAlpha = g[y][x] === "#" && !on ? 0.55 : 1;
			k.ctx.fillStyle = col; dot(k.ctx, x * PITCH + PITCH / 2, y * PITCH + PITCH / 2, PITCH * 0.38);
		}
		return k.cv;
	}
	function bar(w, frac, pitch, c, on) {
		var n = Math.max(1, Math.floor(w / pitch)), k = canvas(w, pitch), lit = Math.round(n * Math.max(0, Math.min(1, frac || 0)));
		for (var i = 0; i < n; i++) {
			k.ctx.fillStyle = i < lit ? (on ? c.accent : c.label) : (c.unlit || "#1c1c1c");
			dot(k.ctx, i * pitch + pitch / 2, pitch / 2, pitch * 0.36);
		}
		return k.cv;
	}
	// bouton en points 3 × 3 : croix allumée (5 points), angles éteints
	function cross(color, alpha, c, g) {
		g = g || [".#.", "###", ".#."];
		var k = canvas(3 * PITCH, 3 * PITCH);
		for (var y = 0; y < 3; y++) for (var x = 0; x < 3; x++) {
			var lit = g[y][x] === "#", col = lit ? color : c.unlit;
			if (!col) continue;
			k.ctx.globalAlpha = lit ? alpha : 1; k.ctx.fillStyle = col;
			dot(k.ctx, x * PITCH + PITCH / 2, y * PITCH + PITCH / 2, PITCH * 0.38);
		}
		return k.cv;
	}
	function rgbOf(hex) { var v = parseInt(String(hex || "").slice(1), 16) || 0; return [v >> 16, v >> 8 & 255, v & 255]; }
	function nearest(list, f) { var best = 0, bd = Infinity; list.forEach(function (x, i) { var d = f(x); if (d < bd) { bd = d; best = i; } }); return best; }
	function colorIndex(hex) { var a = rgbOf(hex); return nearest(LIGHT_COLORS, function (x) { var b = rgbOf(x); return Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2); }); }
	function kelvinIndex(k) { return nearest(KELVINS, function (x) { return Math.abs(x[0] - (k || 2700)); }); }
	function domain(id) { return String(id).split(".")[0]; }
	function fmt1(x) { return x == null ? "--" : (Math.round(x * 10) / 10).toFixed(1); }
	// dernier lancement d'une automatisation
	function ago(iso) {
		if (!iso) return "Never";
		var d = new Date(iso); if (isNaN(d)) return String(iso);
		var now = new Date(), days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
		if (days <= 0) return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
		return days === 1 ? "yesterday" : days + "d ago";
	}
	function isOn(e) {
		switch (e.type) {
			case "light": case "plug": case "lock": return !!e.on;
			case "cover": return e.lvl > 0;
			case "climate": return e.action === "heating" || e.action === "cooling";
			default: return false;
		}
	}

	// ---------------------------------------------------------------- l'exemple (maquette, Dot Page)
	function demo() {
		var areas = [{ id: "living", name: "Living room" }, { id: "kitchen", name: "Kitchen" }, { id: "bedroom", name: "Bedroom" }, { id: "office", name: "Office" }, { id: "entrance", name: "Entrance" }];
		var E = [
			{ id: "light.ceiling", type: "light", name: "Ceiling", area: "living", on: true, lvl: 0.8, color: true, white: true, mode: "color", rgb: "#ffb35c", kelvin: 2700 },
			{ id: "light.desk", type: "light", name: "Desk light", area: "office", on: true, lvl: 0.65, color: true, white: true, mode: "color", rgb: "#ff6fd8", kelvin: 4000 },
			{ id: "light.bed_lamp", type: "light", name: "Bed lamp", area: "bedroom", on: false, lvl: 0.3, color: true, white: true, mode: "white", rgb: "#ffb35c", kelvin: 2700 },
			{ id: "light.floor", type: "light", name: "Floor lamp", area: "living", on: false, lvl: 0.5, color: false, white: true, mode: "white", kelvin: 2700 },
			{ id: "light.spots", type: "light", name: "Spots", area: "kitchen", on: true, lvl: 1, color: false, white: true, mode: "white", kelvin: 4000 },
			{ id: "light.porch", type: "light", name: "Porch", area: "entrance", on: false, lvl: 1, color: false, white: false },
			{ id: "light.living_room", type: "light", name: "Living room lights", area: "living", on: true, lvl: 0.8, color: true, white: true, mode: "color", rgb: "#ffb35c", kelvin: 2700, members: 2, membersOn: 1 },
			{ id: "th:bedroom", type: "th", name: "Bedroom sensor", area: "bedroom", temp: 19.8, hum: 52 },
			{ id: "th:sofa", type: "th", name: "Sofa sensor", area: "living", temp: 21.4, hum: 47 },
			{ id: "automation.good_night", type: "auto", name: "Good night", on: true, last: "22:40" },
			{ id: "automation.movie_mode", type: "auto", name: "Movie mode", on: true, last: "yesterday" },
			{ id: "automation.leave_home", type: "auto", name: "Leave home", on: false, last: "08:12" },
			{ id: "climate.living", type: "climate", name: "Thermostat", area: "living", cur: 21.4, target: 22, action: "heating", min: 7, max: 30, step: 0.5 },
			{ id: "lock.front_door", type: "lock", name: "Front door", area: "entrance", on: true },
			{ id: "cover.living_blinds", type: "cover", name: "Blinds", area: "living", lvl: 0.6 },
			{ id: "cover.bedroom_blinds", type: "cover", name: "Blinds", area: "bedroom", lvl: 0 },
			{ id: "scene.movie_night", type: "scene", name: "Movie night", area: "living" },
			{ id: "sensor.power", type: "power", name: "Power", area: "kitchen", value: 412, unit: "W" },
			{ id: "switch.coffee", type: "plug", name: "Coffee machine", area: "kitchen", on: false },
			{ id: "switch.tv", type: "plug", name: "TV", area: "living", on: true },
			{ id: "switch.monitor", type: "plug", name: "Monitor", area: "office", on: true },
			{ id: "sensor.co2", type: "sensor", name: "CO₂", area: "office", value: 640, unit: "ppm" }
		];
		var U = [
			{ id: "update.core", name: "Home Assistant Core", ver: "2026.11.0" }, { id: "update.os", name: "Home Assistant OS", ver: "17.1" },
			{ id: "update.z2m", name: "Zigbee2MQTT", ver: "2.4.0" }, { id: "update.esphome", name: "ESPHome", ver: "2026.10.3" },
			{ id: "update.hacs", name: "HACS", ver: "2.1.0" }, { id: "update.hue", name: "Hue bridge firmware", ver: "1972004020" }
		];
		var S = [
			{ name: "Frigate", st: "err" }, { name: "Music Assistant", st: "stop" }, { name: "Mosquitto broker", st: "ok" }, { name: "Zigbee2MQTT", st: "ok" },
			{ name: "Node-RED", st: "ok" }, { name: "ESPHome", st: "ok" }, { name: "Philips Hue", st: "ok" }, { name: "Spotify", st: "ok" }
		];
		return { state: "online", demo: true, areas: areas, entities: E, updates: U, services: S };
	}

	// un appel appliqué tout de suite à l'état (exemple, ou en attendant la réponse de Home Assistant)
	function applyLocal(st, call) {
		if (!st) return;
		var e = (st.entities || []).filter(function (x) { return x.id === call.entity; })[0], d = call.data || {};
		if (call.domain === "update") { (st.updates || []).forEach(function (u) { if (u.id === call.entity) u.installing = true; }); return; }
		if (!e) return;
		switch (call.service) {
			case "toggle": e.on = !e.on; break;
			case "turn_off": e.on = false; break;
			case "turn_on":
				if (e.type === "scene") { e.flash = Date.now(); break; }
				e.on = true;
				if (d.brightness_pct != null) e.lvl = d.brightness_pct / 100;
				if (d.rgb_color) { e.rgb = "#" + d.rgb_color.map(function (v) { return (v < 16 ? "0" : "") + v.toString(16); }).join(""); e.mode = "color"; }
				if (d.color_temp_kelvin != null) { e.kelvin = d.color_temp_kelvin; e.mode = "white"; }
				break;
			case "open_cover": e.lvl = 1; break;
			case "close_cover": e.lvl = 0; break;
			case "set_cover_position": e.lvl = d.position / 100; break;
			case "set_temperature": e.target = d.temperature; break;
			case "lock": e.on = true; break;
			case "unlock": e.on = false; break;
			case "trigger": e.running = Date.now(); if (st.demo) e.last = "now"; break;
		}
	}

	// ---------------------------------------------------------------- les cartes
	// ctx : { c (couleurs), call(domain, service, entity, data), redraw() }
	function head(kind, on, name, area, c) {
		var h = el("div", "c-head");
		h.appendChild(pic(kind, on, c));
		var who = el("div", "c-who"); who.appendChild(el("p", "c-nm", name)); who.appendChild(el("p", "c-ar", area));
		h.appendChild(who);
		return h;
	}
	function areaName(st, id) { return ((st && st.areas) || []).filter(function (a) { return a.id === id; }).map(function (a) { return a.name; })[0] || ""; }
	// toucher sur la barre (± 20 px) : sa valeur (0 à 1) ; ailleurs : null
	function onBar(ev, b) {
		var r = b.getBoundingClientRect(), pad = 20 * r.height / BAR;
		if (ev.clientY < r.top - pad || ev.clientY > r.bottom + pad) return null;
		return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
	}
	function draw(inn, e, x) {
		var c = x.c, st = x.st;
		inn.className = "in card"; inn.innerHTML = "";
		if (e.na) { inn.classList.add("na"); inn.appendChild(head(e.type === "th" ? "climate" : e.type, false, e.name, "Unavailable", c)); return; }
		var w = function () { return Math.max(60, (inn.clientWidth || 387) - 48); };
		var area = areaName(st, e.area);

		if (e.type === "light") {
			var group = e.members != null, white = e.mode === "white";
			var h = head(group ? "group" : "light", e.on, e.name, group ? e.membersOn + " / " + e.members + " on" : area, c);
			if (e.color || e.white) {
				var btns = el("div", "c-btns"), colorBtn = el("button", "c-btn"), tempBtn = el("button", "c-btn");
				colorBtn.type = tempBtn.type = "button";
				colorBtn.setAttribute("aria-label", "Color"); tempBtn.setAttribute("aria-label", "White temperature");
				colorBtn.appendChild(cross(LIGHT_COLORS[colorIndex(e.rgb)], white ? 0.4 : 1, c));
				tempBtn.appendChild(cross(KELVINS[kelvinIndex(e.kelvin)][1], white ? 1 : 0.4, c));
				colorBtn.addEventListener("click", function (ev) {
					ev.stopPropagation();
					var i = white ? colorIndex(e.rgb) : (colorIndex(e.rgb) + 1) % LIGHT_COLORS.length;
					x.call("light", "turn_on", e.id, { rgb_color: rgbOf(LIGHT_COLORS[i]) });
				});
				tempBtn.addEventListener("click", function (ev) {
					ev.stopPropagation();
					var i = white ? (kelvinIndex(e.kelvin) + 1) % KELVINS.length : kelvinIndex(e.kelvin);
					x.call("light", "turn_on", e.id, { color_temp_kelvin: KELVINS[i][0] });
				});
				colorBtn.hidden = !e.color; tempBtn.hidden = !e.white;
				btns.appendChild(colorBtn); btns.appendChild(tempBtn); h.appendChild(btns);
			}
			inn.appendChild(h);
			var b = bar(w(), e.lvl, BAR, c, e.on); inn.appendChild(b);
			inn.addEventListener("click", function (ev) {
				var f = onBar(ev, b);
				if (f !== null) x.call("light", "turn_on", e.id, { brightness_pct: Math.max(5, Math.round(f * 100)) });
				else x.call("light", "toggle", e.id);
			});
			return;
		}
		if (e.type === "th") {
			inn.classList.add("ro");
			inn.appendChild(head("climate", false, e.name, area, c));
			var vals = el("div", "c-vals");
			[[fmt1(e.temp), "°C", "Temperature"], [e.hum == null ? "--" : String(Math.round(e.hum)), "%", "Humidity"]].forEach(function (y) {
				var v0 = el("div", "c-v"), vp = el("p", "val", y[0]); vp.appendChild(el("small", "", y[1]));
				v0.appendChild(vp); v0.appendChild(el("p", "k", y[2])); vals.appendChild(v0);
			});
			inn.appendChild(vals);
			return;
		}
		if (e.type === "auto") {
			var running = e.running && Date.now() - e.running < 1600;
			var ha = head("auto", running, e.name, !e.on ? "Disabled" : running ? "Running…" : "Ran · " + (st && st.demo ? e.last : ago(e.last)), c);
			if (running) ha.querySelector(".c-ar").classList.add("go");
			if (!e.on) { inn.classList.add("ro"); ha.style.opacity = 0.45; }
			inn.appendChild(ha);
			if (e.on) inn.addEventListener("click", function () { x.call("automation", "trigger", e.id); setTimeout(x.redraw, 1700); });
			return;
		}

		// autres entités : pictogramme, nom, pièce ; dessous, ce qui sert (barre, valeurs, état) sur toute la largeur
		var on = isOn(e), flash = e.flash && Date.now() - e.flash < 1500;
		var ro = e.type === "sensor" || e.type === "power";
		if (ro) inn.classList.add("ro");
		var hd = head(e.type, on || flash, e.name, area, c);
		inn.appendChild(hd);
		var stateRow = function (text, hot) { var p0 = el("p", "c-st" + (hot ? " go" : ""), text); inn.appendChild(p0); return p0; };
		if (e.type === "climate") {
			var cb = el("div", "c-btns"), plus = el("button", "c-btn"), minus = el("button", "c-btn"), step = e.step || 0.5;
			plus.type = minus.type = "button"; plus.setAttribute("aria-label", "Raise target"); minus.setAttribute("aria-label", "Lower target");
			plus.appendChild(cross(c.lit, 1, c)); minus.appendChild(cross(c.lit, 1, c, ["...", "###", "..."]));
			plus.addEventListener("click", function (ev) { ev.stopPropagation(); if (e.target != null) x.call("climate", "set_temperature", e.id, { temperature: Math.min(e.max || 35, e.target + step) }); });
			minus.addEventListener("click", function (ev) { ev.stopPropagation(); if (e.target != null) x.call("climate", "set_temperature", e.id, { temperature: Math.max(e.min || 7, e.target - step) }); });
			cb.appendChild(plus); cb.appendChild(minus); hd.appendChild(cb);
			inn.classList.add("ro");
		}
		if (e.type === "climate" || ro) {
			var vs = el("div", "c-vals" + (e.type === "climate" ? " tight" : "")), items = e.type === "climate"
				? [[fmt1(e.cur), "°C", "Current"], [fmt1(e.target), "°C", "Target"]]
				: [[e.value == null ? "--" : String(e.value), e.unit || "", e.type === "power" ? "Power" : e.name]];
			items.forEach(function (y, i) {
				var v0 = el("div", "c-v"), vp = el("p", "val", y[0]); vp.appendChild(el("small", "", y[1]));
				var k = el("p", "k", y[2]);
				if (e.type === "climate" && i === 1 && on) k.classList.add("go");
				v0.appendChild(vp); v0.appendChild(k); vs.appendChild(v0);
			});
			inn.appendChild(vs);
		}
		if (e.type === "cover") {
			var cvb = bar(w(), e.lvl, BAR, c, true); inn.appendChild(cvb);
			inn.addEventListener("click", function (ev) {
				var f = onBar(ev, cvb);
				if (f !== null) x.call("cover", "set_cover_position", e.id, { position: Math.round(f * 10) * 10 });
				else x.call("cover", e.lvl > 0 ? "close_cover" : "open_cover", e.id);
			});
		}
		if (e.type === "lock") {
			// garder le doigt 1 s : la barre se remplit, puis verrouille ou déverrouille
			var lb = el("div"), lt = stateRow((e.on ? "Locked" : "Unlocked") + " · hold 1 s", e.on);
			inn.insertBefore(lb, lt); lb.hidden = true;
			var raf = null, t0 = 0;
			var stop = function () { if (raf) cancelAnimationFrame(raf); raf = null; lb.hidden = true; lt.hidden = false; };
			inn.addEventListener("pointerdown", function (ev) {
				ev.preventDefault(); t0 = performance.now();
				(function stepf(now) {
					var p = Math.min(1, (now - t0) / 1000);
					lt.hidden = true; lb.hidden = false; lb.innerHTML = ""; lb.appendChild(bar(w(), p, BAR, c, true));
					if (p >= 1) { raf = null; x.call("lock", e.on ? "unlock" : "lock", e.id); return; }
					raf = requestAnimationFrame(stepf);
				})(t0);
			});
			["pointerup", "pointerleave", "pointercancel"].forEach(function (n) { inn.addEventListener(n, stop); });
		}
		if (e.type === "plug") { stateRow(e.on ? "On" : "Off", e.on); inn.addEventListener("click", function () { x.call(domain(e.id), "toggle", e.id); }); }
		if (e.type === "scene") {
			stateRow(flash ? "Activated" : "Tap to run", flash);
			inn.addEventListener("click", function () { x.call(domain(e.id), "turn_on", e.id); setTimeout(x.redraw, 1600); });
		}
	}
	// listes : mises à jour (garder le doigt 1 s sur une ligne l'installe) et intégrations
	function drawList(inn, kind, x) {
		var c = x.c, st = x.st || {};
		inn.className = "in card ro list"; inn.innerHTML = "";
		var ups = (st.updates || []), svc = st.services || [];
		var bad = svc.filter(function (s) { return s.st !== "ok"; }).length;
		inn.appendChild(head(kind === "update" ? "update" : "services", kind === "update" ? ups.length > 0 : bad === 0, kind === "update" ? "Updates" : "Services",
			kind === "update" ? (ups.length ? ups.length + " available" : "Up to date") : (svc.length - bad) + " / " + svc.length + " running", c));
		var list = el("div", "c-list"), max = Math.max(1, Math.floor(((inn.clientHeight || 500) - 140) / 42));
		if (kind === "update") {
			ups.slice(0, max).forEach(function (u) {
				var li = el("div", "c-li hold"); li.setAttribute("role", "button"); li.setAttribute("aria-label", "Hold to install " + u.name);
				li.appendChild(el("span", "n", u.name)); li.appendChild(el("span", "r up", u.installing ? "Installing…" : u.ver || ""));
				var raf = null, t0 = 0, fill = el("div", "fill"); li.appendChild(fill);
				var stop = function () { if (raf) cancelAnimationFrame(raf); raf = null; fill.innerHTML = ""; };
				li.addEventListener("pointerdown", function (ev) {
					if (u.installing) return;
					ev.preventDefault(); t0 = performance.now();
					(function stepf(now) {
						var p = Math.min(1, (now - t0) / 1000); fill.innerHTML = ""; fill.appendChild(bar(li.clientWidth || 339, p, 6, c, true));
						if (p >= 1) { raf = null; x.call("update", "install", u.id); return; }
						raf = requestAnimationFrame(stepf);
					})(t0);
				});
				["pointerup", "pointerleave", "pointercancel"].forEach(function (n) { li.addEventListener(n, stop); });
				list.appendChild(li);
			});
			list.appendChild(el("p", "c-more", !ups.length ? "Nothing to install" : ups.length > max ? "+ " + (ups.length - max) + " more" : "Hold a line 1 s to install"));
		} else {
			svc.slice(0, max).forEach(function (s) {
				var li = el("div", "c-li"); li.appendChild(el("i", s.st === "ok" ? "ok" : s.st === "err" ? "err" : ""));
				li.appendChild(el("span", "n", s.name));
				li.appendChild(el("span", "r" + (s.st === "err" ? " err" : ""), s.st === "ok" ? "Running" : s.st === "err" ? "Error" : "Stopped"));
				list.appendChild(li);
			});
			if (svc.length > max) list.appendChild(el("p", "c-more", "+ " + (svc.length - max) + " more"));
		}
		inn.appendChild(list);
	}
	function colorsOf(s) { return { lit: s.lit, unlit: s.showUnlit ? s.unlit : null, accent: s.accent, label: s.label }; }
	function paint(root, c) { root.style.setProperty("--accent", c.accent); root.style.setProperty("--lit", c.lit); root.style.setProperty("--label", c.label); }

	// une carte seule, sur l'exemple (section Cartes de la maquette) : key = id d'une entité de demo(), ou list:update / list:services
	var DEMO_ST = null;
	function card(key, rows, settings) {
		DEMO_ST = DEMO_ST || demo();
		var s = {}, k; settings = settings || {}; for (k in DEFAULTS) s[k] = settings[k] === undefined ? DEFAULTS[k] : settings[k];
		var c = colorsOf(s), root = el("div", "dot-homeassistant"), inn = el("div", "in");
		root.style.width = "387px"; root.style.height = (rows * (400 / 6 + 20) - 20) + "px";
		inn.style.width = "100%"; inn.style.height = "100%";
		root.appendChild(inn); paint(root, c);
		var x = { c: c, st: DEMO_ST, redraw: redraw, call: function (d, sv, id, data) { applyLocal(DEMO_ST, { domain: d, service: sv, entity: id, data: data }); redraw(); } };
		function redraw() {
			var fresh = inn.cloneNode(false); root.replaceChild(fresh, inn); inn = fresh;
			if (key.indexOf("list:") === 0) drawList(inn, key.slice(5), x);
			else { var e = DEMO_ST.entities.filter(function (y) { return y.id === key; })[0]; if (e) draw(inn, e, x); }
		}
		setTimeout(redraw, 0); redraw();
		return root;
	}

	// ---------------------------------------------------------------- l'écran
	var MARKUP =
		'<span class="w-dot"></span>' +
		'<p class="w-lbl w-name" data-hub-home>DOT HOME ASSISTANT</p>' +
		'<p class="w-lbl w-state" data-k="state"></p>' +
		'<div class="tabs" role="tablist" aria-label="Rooms" data-k="tabs"></div>' +
		'<div class="guide" data-k="guide" hidden></div>' +
		'<div class="grid" data-k="grid"></div>' +
		'<div class="picker" data-k="picker" hidden></div>' +
		'<div class="w-empty" data-k="empty" hidden><p class="big" data-k="big"></p><p class="sm" data-k="sm"></p></div>';

	function mount(stage, opts) {
		opts = opts || {};
		var size = SLOTS[opts.size] ? opts.size : "xl";
		var getSettings = typeof opts.settings === "function" ? opts.settings : function () { return opts.settings || {}; };
		function settings() { var s = getSettings() || {}, o = {}; for (var k in DEFAULTS) o[k] = s[k] === undefined || s[k] === null ? DEFAULTS[k] : s[k]; return o; }
		var real = typeof opts.state === "function";
		var demoSt = real ? null : demo();
		var tab = "fav", adding = null, layouts = {}, layoutText = null, st = null;

		stage.classList.add("dot-homeassistant", "dha-stage");
		stage.innerHTML = MARKUP;
		function v(k) { return stage.querySelector('[data-k="' + k + '"]'); }
		function editing() { return !!(typeof opts.edit === "function" ? opts.edit() : opts.edit) && COLS[size] > 0; }

		function call(d, sv, id, data) {
			var cl = { domain: d, service: sv, entity: id, data: data || {} };
			applyLocal(st, cl);
			if (real && opts.onCall) opts.onCall(cl);
			render();
		}

		// ------------------------------------------------ disposition
		function entities() { return (st && st.entities) || []; }
		function catalog() {
			var k = {};
			entities().forEach(function (e) { k[e.id] = { e: e, name: e.name, kind: KIND[e.type] || e.type, area: e.area, sizes: SIZES[e.type] || [3] }; });
			if (st && st.updates) k["list:update"] = { list: "update", name: "Updates", kind: "List", sizes: SIZES.list };
			if (st && st.services && st.services.length) k["list:services"] = { list: "services", name: "Services", kind: "List", sizes: SIZES.list };
			return k;
		}
		// sans disposition enregistrée : Favorites rempli (lumières, capteurs, automatisations, autres, listes) ;
		// une pièce, ses cartes ; une colonne après l'autre
		function autoLayout() {
			var keys = [], E = entities(), inTab = function (e) { return tab === "fav" || e.area === tab; };
			var take = function (f, n, h) { E.filter(function (e) { return f(e) && inTab(e) && !e.na; }).slice(0, n).forEach(function (e) { keys.push([e.id, h]); }); };
			if (tab === "fav") {
				take(function (e) { return e.type === "light" && e.members == null; }, 3, 2);
				take(function (e) { return e.type === "th"; }, 2, 3);
				take(function (e) { return e.type === "auto" && e.on; }, 2, 3);
				take(function (e) { return e.type === "climate" || e.type === "lock"; }, 2, 3);
				if (st.updates) keys.push(["list:update", 6]);
				if (st.services && st.services.length) keys.push(["list:services", 6]);
			} else {
				take(function (e) { return e.type === "light"; }, 12, 2);
				take(function (e) { return ["th", "climate", "cover", "lock", "plug", "scene"].indexOf(e.type) >= 0; }, 12, 3);
			}
			var col = 1, row = 1, out = [];
			keys.forEach(function (k) {
				if (row + k[1] - 1 > ROWS) { col++; row = 1; }
				if (col > COLS[size]) return;
				out.push({ key: k[0], col: col, row: row, h: k[1] }); row += k[1];
			});
			return out;
		}
		function layout() {
			var s = settings();
			if (s.layout !== layoutText) { layoutText = s.layout; try { layouts = JSON.parse(s.layout || "{}") || {}; } catch (e) { layouts = {}; } }
			var cat = catalog(), mine = layouts[tab];
			var lay = Array.isArray(mine) ? mine.filter(function (it) { return cat[it.key] && it.col >= 1 && it.col <= COLS[size]; }) : autoLayout();
			return lay;
		}
		function save(lay) {
			layouts[tab] = lay.map(function (it) { return { key: it.key, col: it.col, row: it.row, h: it.h }; });
			layoutText = JSON.stringify(layouts);
			if (opts.onLayout) opts.onLayout(layoutText);
			render();
		}
		function free(lay, col, row, h, skip) {
			if (row < 1 || row + h - 1 > ROWS || col < 1 || col > COLS[size]) return false;
			return !lay.some(function (it) { return it !== skip && it.col === col && it.row < row + h && row < it.row + it.h; });
		}

		// ------------------------------------------------ édition
		function editCard(b, it, lay) {
			var ed = el("div", "ed"), x = el("button", "ed-x", "×"), sizes = (catalog()[it.key] || {}).sizes || [it.h];
			var sz = el("button", "ed-sz", it.h === 2 ? "S" : it.h === 3 ? "M" : "L");
			x.type = sz.type = "button"; x.setAttribute("aria-label", "Remove"); sz.setAttribute("aria-label", "Card size");
			ed.appendChild(x); ed.appendChild(sz); b.appendChild(ed);
			sz.hidden = sizes.length < 2;
			x.addEventListener("click", function (ev) { ev.stopPropagation(); lay.splice(lay.indexOf(it), 1); save(lay); });
			sz.addEventListener("click", function (ev) {
				ev.stopPropagation();
				var i = sizes.indexOf(it.h);
				for (var n = 1; n < sizes.length; n++) { var h = sizes[(i + n) % sizes.length]; if (free(lay, it.col, it.row, h, it)) { it.h = h; break; } }
				save(lay);
			});
			[x, sz].forEach(function (bt) { bt.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); }); });
			var k = 1, x0 = 0, y0 = 0, drag = false;
			function target(ev) {
				var g = v("grid"), cw = (g.clientWidth + 20) / COLS[size], ch = (g.clientHeight + 20) / ROWS;
				return { col: it.col + Math.round((ev.clientX - x0) / k / cw), row: it.row + Math.round((ev.clientY - y0) / k / ch) };
			}
			ed.addEventListener("pointerdown", function (ev) {
				k = stage.getBoundingClientRect().width / SLOTS[size][0] || 1; x0 = ev.clientX; y0 = ev.clientY; drag = true;
				try { ed.setPointerCapture(ev.pointerId); } catch (e) {}
				b.classList.add("drag");
			});
			ed.addEventListener("pointermove", function (ev) {
				if (!drag) return;
				b.style.transform = "translate(" + (ev.clientX - x0) / k + "px," + (ev.clientY - y0) / k + "px)";
				var t = target(ev); b.classList.toggle("bad", !free(lay, t.col, t.row, it.h, it));
			});
			ed.addEventListener("pointerup", function (ev) {
				if (!drag) return; drag = false;
				var t = target(ev);
				if ((t.col !== it.col || t.row !== it.row) && free(lay, t.col, t.row, it.h, it)) { it.col = t.col; it.row = t.row; save(lay); }
				else render();
			});
			ed.addEventListener("pointercancel", function () { drag = false; render(); });
		}
		// « + » sur une case libre : choisir l'entité et la taille de sa carte (celles de l'onglet d'abord)
		function openPicker(lay) {
			var pk = v("picker"); pk.hidden = false; pk.innerHTML = "";
			var all = catalog(), used = lay.map(function (it) { return it.key; });
			var hd = el("div", "pk-head");
			hd.appendChild(el("p", "w-lbl", "Add a card · column " + adding.col + " · row " + adding.row));
			var cancel = el("button", "pk-cancel", "Cancel"); cancel.type = "button";
			cancel.addEventListener("click", function () { adding = null; render(); });
			hd.appendChild(cancel); pk.appendChild(hd);
			var list = el("div", "pk-list"), keys = Object.keys(all).filter(function (key) { return used.indexOf(key) < 0; });
			var here = keys.filter(function (key) { return tab !== "fav" && all[key].area === tab; }), rest = keys.filter(function (key) { return here.indexOf(key) < 0; });
			function row(key) {
				var it = all[key], r = el("div", "pk-row"), who = el("div", "pk-who");
				who.appendChild(el("p", "pk-nm", it.name)); who.appendChild(el("p", "pk-k", it.kind + (it.area ? " · " + areaName(st, it.area) : "")));
				r.appendChild(who);
				it.sizes.slice().sort(function (a, b) { return a - b; }).forEach(function (h) {
					var bt = el("button", "pk-sz", h === 2 ? "S" : h === 3 ? "M" : "L"); bt.type = "button"; bt.title = SIZE_NAME[h];
					bt.disabled = !free(lay, adding.col, adding.row, h);
					bt.addEventListener("click", function () { lay.push({ key: key, col: adding.col, row: adding.row, h: h }); adding = null; save(lay); });
					r.appendChild(bt);
				});
				list.appendChild(r);
			}
			if (here.length) { list.appendChild(el("p", "pk-sep", areaName(st, tab))); here.forEach(row); list.appendChild(el("p", "pk-sep", "Everything else")); }
			rest.forEach(row);
			if (!keys.length) list.appendChild(el("p", "pk-none", "Every entity is already on this tab"));
			pk.appendChild(list);
		}

		// ------------------------------------------------ rendu
		function render() {
			var s = settings(), c = colorsOf(s);
			st = real ? (opts.state() || { state: "offline", hint: "Connecting to Home Assistant…" }) : demoSt;
			paint(stage, c);
			var offline = st.state !== "online", cols = COLS[size];
			stage.classList.toggle("offline", offline);
			var lit = entities().filter(function (e) { return (e.type === "light" && e.members == null || e.type === "plug") && e.on && !e.na; }).length;
			v("state").textContent = offline ? "HOME · OFFLINE" : "HOME · " + lit + " ON";

			// onglets : Favorites, puis les pièces qui ont des entités
			var areas = offline ? [] : (st.areas || []).filter(function (a) { return entities().some(function (e) { return e.area === a.id; }); });
			var showTabs = s.showTabs && cols > 0 && !offline;
			if (!showTabs || (tab !== "fav" && !areas.some(function (a) { return a.id === tab; }))) tab = "fav";
			stage.classList.toggle("notabs", !showTabs);
			var tabs = v("tabs"); tabs.innerHTML = ""; tabs.hidden = !showTabs;
			[{ id: "fav", name: "Favorites" }].concat(areas).forEach(function (a) {
				var b = el("button", "tab", a.name); b.type = "button"; b.setAttribute("role", "tab");
				b.setAttribute("aria-selected", a.id === tab ? "true" : "false");
				b.addEventListener("click", function () { tab = a.id; adding = null; render(); });
				tabs.appendChild(b);
			});

			var grid = v("grid"), guide = v("guide"), picker = v("picker"), empty = v("empty");
			grid.innerHTML = ""; guide.innerHTML = ""; guide.hidden = true; picker.hidden = true;
			var noLayout = cols === 0;
			empty.hidden = !offline && !noLayout;
			grid.hidden = offline || noLayout;
			if (offline) { v("big").textContent = "Home Assistant offline"; v("sm").textContent = st.hint || "Check URL and token in Dot Companion"; }
			else if (noLayout) { v("big").textContent = "Too small"; v("sm").textContent = "Use M, L or XL"; }
			var edit = editing() && !offline;
			stage.classList.toggle("editing", edit);
			if (offline || noLayout) return;

			var lay = layout(), cat = catalog();
			var x = { c: c, st: st, call: call, redraw: render };
			lay.forEach(function (it) {
				var b = el("div", "cbox"), inn = el("div", "in");
				b.style.gridColumn = it.col; b.style.gridRow = it.row + " / span " + it.h;
				b.appendChild(inn); grid.appendChild(b);
				var item = cat[it.key];
				if (item.list) drawList(inn, item.list, x); else draw(inn, item.e, x);
				if (edit) editCard(b, it, lay);
			});
			// les barres et les listes dépendent de la taille de la carte : second passage une fois la grille posée
			if (!stage.__sized) { stage.__sized = true; requestAnimationFrame(function () { render(); }); }
			if (edit) {
				guide.hidden = false;
				for (var r = 1; r <= ROWS; r++) for (var q = 1; q <= cols; q++) {
					var cell = el("i");
					if (free(lay, q, r, 1)) {
						var add = el("button", "add", "+"); add.type = "button"; add.setAttribute("aria-label", "Add a card");
						(function (q, r) { add.addEventListener("click", function () { adding = { col: q, row: r }; render(); }); })(q, r);
						cell.appendChild(add);
					}
					guide.appendChild(cell);
				}
				if (adding) openPicker(lay);
			} else {
				adding = null;
				// case « Grille » de la maquette : les cases, sans édition
				if (s.grid) { guide.hidden = false; for (var gi = 0; gi < ROWS * cols; gi++) guide.appendChild(el("i")); }
			}
		}

		function setSize(s) {
			size = SLOTS[s] ? s : "xl";
			["s", "m", "l", "xl"].forEach(function (k) { stage.classList.toggle(k, k === size); });
		}
		setSize(size);
		render();
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
		return {
			render: render,
			setSize: function (s) { setSize(s); stage.__sized = false; render(); },
			size: function () { return size; },
			slot: function () { return SLOTS[size]; },
			resetLayout: function () { layouts = {}; layoutText = ""; if (opts.onLayout) opts.onLayout(""); render(); }
		};
	}

	window.DotHomeAssistant = { mount: mount, card: card, demo: demo, slots: SLOTS, defaults: DEFAULTS };
})();
