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
 * { "<onglet>": [{ key, col, row, h, name?, pic?, hide?: [parties cachées], ro? }] }, voir parts()).
 * Sans `state`, l'exemple de la maquette (demo()) : les touchers le modifient.
 */
(function () {
	"use strict";

	var SLOTS = { s: [840, 344], m: [840, 696], l: [1688, 696], xl: [2536, 696] };
	var COLS = { xl: 6, l: 4, m: 2, s: 0 }, ROWS = 6, PITCH = 12, BAR = 12;
	var DEFAULTS = { showTabs: true, showUnlit: true, grid: false, accent: "#10b981", lit: "#f2f0e9", unlit: "#1c1c1c", label: "#b8b6b0", layout: "" };
	var SIZE_NAME = { 2: "Small · 1 × 2", 3: "Medium · 1 × 3", 6: "Tall · 1 × 6" };
	var KIND = { light: "Light", plug: "Switch", cover: "Cover", climate: "Thermostat", lock: "Lock", scene: "Scene", auto: "Automation", sensor: "Sensor", power: "Power", th: "Temperature · humidity", binary: "Binary sensor", state: "State", list: "List" };
	// tailles possibles d'une carte, en rangées (la première est celle par défaut)
	var SIZES = { light: [2, 3], plug: [2, 3], scene: [2, 3], auto: [2, 3], cover: [3], climate: [3], lock: [3], sensor: [3, 2], power: [3, 2], th: [3], binary: [2, 3], state: [3, 2], list: [6, 3] };
	// cartes qui montrent une valeur (capteur, état) : en petite taille, la valeur passe sous le nom
	var VALUE = { sensor: 1, power: 1, binary: 1, state: 1 };
	// cartes qui commandent quelque chose : le toucher peut être coupé (« Touch control »)
	var CONTROL = { light: 1, plug: 1, cover: 1, climate: 1, lock: 1, scene: 1, auto: 1 };
	var DOMAIN_NAME = { light: "Light", "switch": "Switch", input_boolean: "Toggle", fan: "Fan", cover: "Cover", climate: "Thermostat", lock: "Lock", scene: "Scene", script: "Script", automation: "Automation", sensor: "Sensor", binary_sensor: "Binary sensor", person: "Person", device_tracker: "Tracker", weather: "Weather", sun: "Sun", media_player: "Media player", input_select: "Select", select: "Select", input_number: "Number", number: "Number", input_text: "Text", vacuum: "Vacuum", alarm_control_panel: "Alarm", water_heater: "Water heater", humidifier: "Humidifier", calendar: "Calendar", button: "Button", input_button: "Button", siren: "Siren", valve: "Valve", lawn_mower: "Mower", remote: "Remote" };
	var DC_NAME = { temperature: "Temperature", humidity: "Humidity", power: "Power", energy: "Energy", battery: "Battery", illuminance: "Light", carbon_dioxide: "CO₂", pm25: "PM2.5", voltage: "Voltage", current: "Current", pressure: "Pressure", door: "Door", window: "Window", garage_door: "Garage door", opening: "Opening", motion: "Motion", occupancy: "Occupancy", presence: "Presence", moisture: "Moisture", smoke: "Smoke", connectivity: "Connectivity", plug: "Plug" };
	// icônes proposées dans le formulaire d'une carte, dans cet ordre
	var PIC_LIST = ["light", "group", "plug", "fan", "tv", "climate", "drop", "sun", "cover", "door", "lock", "home", "person", "sensor", "power", "scene", "auto", "update", "services", "dot"];

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
		services: ["#######", "#.....#", "#######", ".......", "#######", "#.....#", "#######"],
		fan: ["##...##", "###.###", ".##.##.", "...#...", ".##.##.", "###.###", "##...##"],
		tv: ["#######", "#.....#", "#.....#", "#.....#", "#######", "...#...", ".#####."],
		drop: ["...#...", "..###..", "..###..", ".#####.", ".#####.", ".#####.", "..###.."],
		sun: ["#..#..#", ".#...#.", "..###..", "#.###.#", "..###..", ".#...#.", "#..#..#"],
		door: [".#####.", ".#...#.", ".#...#.", ".#..##.", ".#...#.", ".#...#.", ".#####."],
		home: ["...#...", "..###..", ".#####.", "#######", ".#...#.", ".#.#.#.", ".#.#.#."],
		person: ["..###..", "..###..", "..###..", ".......", ".#####.", "#######", "#######"],
		dot: [".......", "..###..", ".#####.", ".#####.", ".#####.", "..###..", "......."]
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
	function pic(key, on, c, pitch) {
		var g = PICS[key] || PICS.sensor, P = pitch || PITCH, k = canvas(7 * P, 7 * P);
		for (var y = 0; y < 7; y++) for (var x = 0; x < 7; x++) {
			var col = g[y][x] === "#" ? (on ? c.accent : c.lit) : c.unlit;
			if (!col) continue;
			k.ctx.globalAlpha = g[y][x] === "#" && !on ? 0.55 : 1;
			k.ctx.fillStyle = col; dot(k.ctx, x * P + P / 2, y * P + P / 2, P * 0.38);
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
	// « partlycloudy », « not_home » → « Partly cloudy », « Not home »
	function pretty(v) {
		var t = String(v == null ? "" : v).replace(/^partlycloudy$/, "partly cloudy").replace(/^clear-night$/, "clear night").replace(/[_-]+/g, " ").trim();
		return t ? t.charAt(0).toUpperCase() + t.slice(1) : "--";
	}
	function domainName(id) { var d = domain(id); return DOMAIN_NAME[d] || pretty(d); }
	// texte d'un capteur binaire selon sa classe
	function binText(dc, on) {
		if (["door", "window", "garage_door", "opening"].indexOf(dc) >= 0) return on ? "Open" : "Closed";
		if (["motion", "occupancy", "presence"].indexOf(dc) >= 0) return on ? "Detected" : "Clear";
		if (dc === "moisture") return on ? "Wet" : "Dry";
		if (dc === "smoke" || dc === "gas") return on ? "Detected" : "Clear";
		if (dc === "connectivity") return on ? "Connected" : "Disconnected";
		return on ? "On" : "Off";
	}
	// valeur d'une carte capteur ou état : { v, u, k (libellé), on }
	function valueOf(e) {
		if (e.type === "binary") return { v: binText(e.dc, e.on), u: "", k: DC_NAME[e.dc] || "State", on: !!e.on };
		if (e.type === "state") return { v: pretty(e.value), u: e.unit || "", k: domainName(e.id), on: ["on", "home", "playing", "open", "active", "cleaning", "heat", "cool"].indexOf(e.value) >= 0, text: !/^-?[\d.]+$/.test(String(e.value)) };
		return { v: e.value == null ? "--" : String(e.value), u: e.unit || "", k: e.type === "power" ? "Power" : DC_NAME[e.dc] || "Value", on: false };
	}
	function defaultPic(e) {
		if (e.type === "th") return "climate";
		if (e.type === "light") return e.members != null ? "group" : "light";
		if (e.type === "binary") return ["door", "window", "garage_door", "opening"].indexOf(e.dc) >= 0 ? "door" : e.dc === "moisture" ? "drop" : "sensor";
		if (e.type === "plug") return domain(e.id) === "fan" ? "fan" : "plug";
		if (e.type === "state") return { person: "person", device_tracker: "person", weather: "sun", sun: "sun", media_player: "tv", fan: "fan" }[domain(e.id)] || "sensor";
		if (e.type === "sensor") return e.dc === "humidity" || e.dc === "moisture" ? "drop" : e.dc === "temperature" ? "climate" : "sensor";
		return PICS[e.type] ? e.type : "sensor";
	}
	// options d'une carte (enregistrées avec sa place) : name, pic, hide (parties cachées), ro (toucher coupé)
	function shown(o, k) { return !(o && o.hide && o.hide.indexOf(k) >= 0); }
	// parties d'une carte que le formulaire propose de cacher : [clé, libellé]
	function parts(item) {
		if (item.list) return [["sub", item.list === "update" ? "Count" : "Running count"]];
		var e = item.e, t = e.type, p = [["sub", t === "auto" ? "Last run" : t === "light" && e.members != null ? "Lights on" : "Room"]];
		if (t === "light") { p.push(["bar", "Brightness bar"]); if (e.color) p.push(["color", "Color button"]); if (e.white) p.push(["white", "White button"]); }
		if (t === "cover") p.push(["bar", "Position bar"]);
		if (t === "climate") p.push(["cur", "Current"], ["target", "Target"], ["btns", "± buttons"]);
		if (t === "th") p.push(["temp", "Temperature"], ["hum", "Humidity"]);
		if (VALUE[t]) p.push(["val", "Value"], ["unit", "Unit"], ["k", "Label"]);
		if (t === "plug" || t === "lock" || t === "scene") p.push(["st", "State"]);
		return p;
	}
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
			{ id: "light.ceiling", dev: "hue_ceiling", type: "light", name: "Ceiling", area: "living", on: true, lvl: 0.8, color: true, white: true, mode: "color", rgb: "#ffb35c", kelvin: 2700 },
			{ id: "light.desk", dev: "desk_lamp", type: "light", name: "Desk light", area: "office", on: true, lvl: 0.65, color: true, white: true, mode: "color", rgb: "#ff6fd8", kelvin: 4000 },
			{ id: "light.bed_lamp", dev: "bed_lamp", type: "light", name: "Bed lamp", area: "bedroom", on: false, lvl: 0.3, color: true, white: true, mode: "white", rgb: "#ffb35c", kelvin: 2700 },
			{ id: "light.floor", type: "light", name: "Floor lamp", area: "living", on: false, lvl: 0.5, color: false, white: true, mode: "white", kelvin: 2700 },
			{ id: "light.spots", type: "light", name: "Spots", area: "kitchen", on: true, lvl: 1, color: false, white: true, mode: "white", kelvin: 4000 },
			{ id: "light.porch", type: "light", name: "Porch", area: "entrance", on: false, lvl: 1, color: false, white: false },
			{ id: "light.living_room", type: "light", name: "Living room lights", area: "living", on: true, lvl: 0.8, color: true, white: true, mode: "color", rgb: "#ffb35c", kelvin: 2700, members: 2, membersOn: 1 },
			{ id: "th:bedroom", dev: "aqara_bedroom", type: "th", name: "Bedroom sensor", area: "bedroom", temp: 19.8, hum: 52 },
			{ id: "th:sofa", dev: "aqara_sofa", type: "th", name: "Sofa sensor", area: "living", temp: 21.4, hum: 47 },
			{ id: "automation.good_night", type: "auto", name: "Good night", on: true, last: "22:40" },
			{ id: "automation.movie_mode", type: "auto", name: "Movie mode", on: true, last: "yesterday" },
			{ id: "automation.leave_home", type: "auto", name: "Leave home", on: false, last: "08:12" },
			{ id: "climate.living", dev: "netatmo", type: "climate", name: "Thermostat", area: "living", cur: 21.4, target: 22, action: "heating", min: 7, max: 30, step: 0.5 },
			{ id: "lock.front_door", dev: "nuki", type: "lock", name: "Front door", area: "entrance", on: true },
			{ id: "cover.living_blinds", dev: "living_blinds", type: "cover", name: "Blinds", area: "living", lvl: 0.6 },
			{ id: "cover.bedroom_blinds", dev: "bedroom_blinds", type: "cover", name: "Blinds", area: "bedroom", lvl: 0 },
			{ id: "scene.movie_night", type: "scene", name: "Movie night", area: "living" },
			{ id: "sensor.power", dev: "coffee_plug", type: "power", name: "Power", area: "kitchen", value: 412, unit: "W" },
			{ id: "switch.coffee", dev: "coffee_plug", type: "plug", name: "Coffee machine", area: "kitchen", on: false },
			{ id: "switch.tv", dev: "tv", type: "plug", name: "TV", area: "living", on: true },
			{ id: "switch.monitor", type: "plug", name: "Monitor", area: "office", on: true },
			{ id: "sensor.co2", dev: "airthings", type: "sensor", name: "CO₂", area: "office", value: 640, unit: "ppm", dc: "carbon_dioxide" },
			{ id: "sensor.bedroom_temperature", dev: "aqara_bedroom", type: "sensor", name: "Bedroom temperature", area: "bedroom", value: 19.8, unit: "°C", dc: "temperature" },
			{ id: "sensor.bedroom_humidity", dev: "aqara_bedroom", type: "sensor", name: "Bedroom humidity", area: "bedroom", value: 52, unit: "%", dc: "humidity" },
			{ id: "binary_sensor.front_door", dev: "nuki", type: "binary", name: "Front door contact", area: "entrance", on: false, dc: "door" },
			{ id: "binary_sensor.hall_motion", dev: "hall_motion", type: "binary", name: "Hall motion", area: "entrance", on: true, dc: "motion" },
			{ id: "person.alex", type: "state", name: "Alex", value: "home" },
			{ id: "weather.home", type: "state", name: "Forecast", value: "partlycloudy" },
			{ id: "media_player.living_tv", dev: "tv", type: "state", name: "Living room TV", area: "living", value: "playing" },
			{ id: "sensor.washing_machine", type: "state", name: "Washing machine", area: "kitchen", value: "running" }
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
		var DV = [["hue_ceiling", "Hue ceiling"], ["desk_lamp", "Desk lamp"], ["bed_lamp", "Bed lamp"], ["aqara_bedroom", "Bedroom sensor"], ["aqara_sofa", "Sofa sensor"], ["netatmo", "Netatmo thermostat"], ["nuki", "Nuki smart lock"], ["coffee_plug", "Coffee plug"], ["tv", "Living room TV"], ["airthings", "Airthings Wave"], ["living_blinds", "Living room blinds"], ["bedroom_blinds", "Bedroom blinds"], ["hall_motion", "Hall motion sensor"]];
		var devices = DV.map(function (d) { return { id: d[0], name: d[1] }; });
		return { state: "online", demo: true, areas: areas, devices: devices, entities: E, updates: U, services: S };
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
	// x : { c (couleurs), st (état), call(domain, service, entity, data), redraw() } ; o : options de la carte et sa taille (h)
	function head(kind, on, name, sub, c) {
		var h = el("div", "c-head");
		h.appendChild(pic(kind, on, c));
		var who = el("div", "c-who"); who.appendChild(el("p", "c-nm", name));
		if (sub !== null) who.appendChild(el("p", "c-ar", sub));
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
	function vals(items, tight) {
		var vs = el("div", "c-vals" + (tight ? " tight" : ""));
		items.forEach(function (y) {
			var v0 = el("div", "c-v"), vp = el("p", "val" + (y[3] ? " txt" : ""), y[0]);
			if (y[1]) vp.appendChild(el("small", "", y[1]));
			v0.appendChild(vp);
			if (y[2] !== null) { var k = el("p", "k", y[2]); if (y[4]) k.classList.add("go"); v0.appendChild(k); }
			vs.appendChild(v0);
		});
		return vs;
	}
	function draw(inn, e, x, o) {
		o = o || {};
		var c = x.c, st = x.st, rows = o.h || 3, ctl = !o.ro;
		var name = o.name || e.name, icon = o.pic && PICS[o.pic] ? o.pic : defaultPic(e), sub = shown(o, "sub");
		inn.className = "in card"; inn.innerHTML = "";
		if (!ctl || !CONTROL[e.type]) inn.classList.add("ro");
		if (e.na) { inn.classList.add("na"); inn.appendChild(head(icon, false, name, "Unavailable", c)); return; }
		var w = function () { return Math.max(60, (inn.clientWidth || 387) - 48); };
		var area = areaName(st, e.area);

		if (e.type === "light") {
			var group = e.members != null, white = e.mode === "white";
			var h = head(icon, e.on, name, !sub ? null : group ? e.membersOn + " / " + e.members + " on" : area, c);
			var wantC = e.color && shown(o, "color"), wantW = e.white && shown(o, "white");
			if (wantC || wantW) {
				var btns = el("div", "c-btns"), colorBtn = el("button", "c-btn"), tempBtn = el("button", "c-btn");
				colorBtn.type = tempBtn.type = "button";
				colorBtn.setAttribute("aria-label", "Color"); tempBtn.setAttribute("aria-label", "White temperature");
				colorBtn.appendChild(cross(LIGHT_COLORS[colorIndex(e.rgb)], white ? 0.4 : 1, c));
				tempBtn.appendChild(cross(KELVINS[kelvinIndex(e.kelvin)][1], white ? 1 : 0.4, c));
				if (ctl) {
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
				} else colorBtn.disabled = tempBtn.disabled = true;
				colorBtn.hidden = !wantC; tempBtn.hidden = !wantW;
				btns.appendChild(colorBtn); btns.appendChild(tempBtn); h.appendChild(btns);
			}
			inn.appendChild(h);
			var b = null;
			if (shown(o, "bar")) { b = bar(w(), e.lvl, BAR, c, e.on); inn.appendChild(b); }
			if (ctl) inn.addEventListener("click", function (ev) {
				var f = b ? onBar(ev, b) : null;
				if (f !== null) x.call("light", "turn_on", e.id, { brightness_pct: Math.max(5, Math.round(f * 100)) });
				else x.call("light", "toggle", e.id);
			});
			return;
		}
		if (e.type === "th") {
			inn.appendChild(head(icon, false, name, sub ? area : null, c));
			var items = [];
			if (shown(o, "temp")) items.push([fmt1(e.temp), "°C", "Temperature"]);
			if (shown(o, "hum")) items.push([e.hum == null ? "--" : String(Math.round(e.hum)), "%", "Humidity"]);
			if (items.length) inn.appendChild(vals(items));
			return;
		}
		if (e.type === "auto") {
			var running = e.running && Date.now() - e.running < 1600;
			var ha = head(icon, running, name, !sub ? null : !e.on ? "Disabled" : running ? "Running…" : "Ran · " + (st && st.demo ? e.last : ago(e.last)), c);
			var ar = ha.querySelector(".c-ar"); if (running && ar) ar.classList.add("go");
			if (!e.on) { inn.classList.add("ro"); ha.style.opacity = 0.45; }
			inn.appendChild(ha);
			if (e.on && ctl) inn.addEventListener("click", function () { x.call("automation", "trigger", e.id); setTimeout(x.redraw, 1700); });
			return;
		}
		if (VALUE[e.type]) {
			// capteur, capteur binaire, autre état : en petite taille, la valeur sous le nom ; sinon la pièce, et la valeur en grand
			var vo = valueOf(e), unit = shown(o, "unit") ? vo.u : "";
			if (rows < 3) {
				var hs = head(icon, vo.on, name, shown(o, "val") ? vo.v + (unit ? " " + unit : "") : sub ? area : null, c);
				var a2 = hs.querySelector(".c-ar"); if (vo.on && a2 && shown(o, "val")) a2.classList.add("go");
				inn.appendChild(hs);
				return;
			}
			inn.appendChild(head(icon, vo.on, name, sub ? area : null, c));
			if (shown(o, "val")) inn.appendChild(vals([[vo.v, unit, shown(o, "k") ? vo.k : null, vo.text || e.type === "binary", vo.on]]));
			return;
		}

		// autres entités : pictogramme, nom, pièce ; dessous, ce qui sert (barre, valeurs, état) sur toute la largeur
		var on = isOn(e), flash = e.flash && Date.now() - e.flash < 1500;
		var hd = head(icon, on || flash, name, sub ? area : null, c);
		inn.appendChild(hd);
		var stateRow = function (text, hot) { var p0 = el("p", "c-st" + (hot ? " go" : ""), text); inn.appendChild(p0); return p0; };
		if (e.type === "climate") {
			if (shown(o, "btns")) {
				var cb = el("div", "c-btns"), plus = el("button", "c-btn"), minus = el("button", "c-btn"), step = e.step || 0.5;
				plus.type = minus.type = "button"; plus.setAttribute("aria-label", "Raise target"); minus.setAttribute("aria-label", "Lower target");
				plus.appendChild(cross(c.lit, 1, c)); minus.appendChild(cross(c.lit, 1, c, ["...", "###", "..."]));
				if (ctl) {
					plus.addEventListener("click", function (ev) { ev.stopPropagation(); if (e.target != null) x.call("climate", "set_temperature", e.id, { temperature: Math.min(e.max || 35, e.target + step) }); });
					minus.addEventListener("click", function (ev) { ev.stopPropagation(); if (e.target != null) x.call("climate", "set_temperature", e.id, { temperature: Math.max(e.min || 7, e.target - step) }); });
				} else plus.disabled = minus.disabled = true;
				cb.appendChild(plus); cb.appendChild(minus); hd.appendChild(cb);
			}
			inn.classList.add("ro");
			var ci = [];
			if (shown(o, "cur")) ci.push([fmt1(e.cur), "°C", "Current"]);
			if (shown(o, "target")) ci.push([fmt1(e.target), "°C", "Target", false, on]);
			if (ci.length) inn.appendChild(vals(ci, ci.length > 1));
		}
		if (e.type === "cover") {
			var cvb = null;
			if (shown(o, "bar")) { cvb = bar(w(), e.lvl, BAR, c, true); inn.appendChild(cvb); }
			if (ctl) inn.addEventListener("click", function (ev) {
				var f = cvb ? onBar(ev, cvb) : null;
				if (f !== null) x.call("cover", "set_cover_position", e.id, { position: Math.round(f * 10) * 10 });
				else x.call("cover", e.lvl > 0 ? "close_cover" : "open_cover", e.id);
			});
		}
		if (e.type === "lock") {
			// garder le doigt 1 s : la barre se remplit, puis verrouille ou déverrouille
			var lb = el("div"), lt = shown(o, "st") || ctl ? stateRow((e.on ? "Locked" : "Unlocked") + (ctl ? " · hold 1 s" : ""), e.on) : null;
			if (!ctl) return;
			inn.insertBefore(lb, lt); lb.hidden = true;
			var raf = null, t0 = 0;
			var stop = function () { if (raf) cancelAnimationFrame(raf); raf = null; lb.hidden = true; if (lt) lt.hidden = false; };
			inn.addEventListener("pointerdown", function (ev) {
				ev.preventDefault(); t0 = performance.now();
				(function stepf(now) {
					var p = Math.min(1, (now - t0) / 1000);
					if (lt) lt.hidden = true; lb.hidden = false; lb.innerHTML = ""; lb.appendChild(bar(w(), p, BAR, c, true));
					if (p >= 1) { raf = null; x.call("lock", e.on ? "unlock" : "lock", e.id); return; }
					raf = requestAnimationFrame(stepf);
				})(t0);
			});
			["pointerup", "pointerleave", "pointercancel"].forEach(function (n) { inn.addEventListener(n, stop); });
		}
		if (e.type === "plug") {
			if (shown(o, "st")) stateRow(e.on ? "On" : "Off", e.on);
			if (ctl) inn.addEventListener("click", function () { x.call(domain(e.id), "toggle", e.id); });
		}
		if (e.type === "scene") {
			if (shown(o, "st")) stateRow(flash ? "Activated" : ctl ? "Tap to run" : "Scene", flash);
			if (ctl) inn.addEventListener("click", function () { x.call(domain(e.id), "turn_on", e.id); setTimeout(x.redraw, 1600); });
		}
	}
	// listes : mises à jour (garder le doigt 1 s sur une ligne l'installe) et intégrations
	function drawList(inn, kind, x, o) {
		o = o || {};
		var c = x.c, st = x.st || {}, ctl = !o.ro;
		inn.className = "in card ro list"; inn.innerHTML = "";
		var ups = (st.updates || []), svc = st.services || [];
		var bad = svc.filter(function (s) { return s.st !== "ok"; }).length;
		var icon = o.pic && PICS[o.pic] ? o.pic : kind === "update" ? "update" : "services";
		inn.appendChild(head(icon, kind === "update" ? ups.length > 0 : bad === 0, o.name || (kind === "update" ? "Updates" : "Services"),
			!shown(o, "sub") ? null : kind === "update" ? (ups.length ? ups.length + " available" : "Up to date") : (svc.length - bad) + " / " + svc.length + " running", c));
		var list = el("div", "c-list"), max = Math.max(1, Math.floor(((inn.clientHeight || 500) - 140) / 42));
		if (kind === "update") {
			ups.slice(0, max).forEach(function (u) {
				var li = el("div", "c-li" + (ctl ? " hold" : "")); li.setAttribute("role", "button"); li.setAttribute("aria-label", "Hold to install " + u.name);
				li.appendChild(el("span", "n", u.name)); li.appendChild(el("span", "r up", u.installing ? "Installing…" : u.ver || ""));
				list.appendChild(li);
				if (!ctl) return;
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
			});
			list.appendChild(el("p", "c-more", !ups.length ? "Nothing to install" : ups.length > max ? "+ " + (ups.length - max) + " more" : ctl ? "Hold a line 1 s to install" : ""));
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
			if (key.indexOf("list:") === 0) drawList(inn, key.slice(5), x, { h: rows });
			else { var e = DEMO_ST.entities.filter(function (y) { return y.id === key; })[0]; if (e) draw(inn, e, x, { h: rows }); }
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
		var tab = "fav", layouts = {}, layoutText = null, st = null;

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
			entities().forEach(function (e) { k[e.id] = { e: e, name: e.name, kind: e.type === "th" ? KIND.th : domainName(e.id), area: e.area, dev: e.dev || "", sizes: SIZES[e.type] || [3] }; });
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
		// une place : { key, col, row, h } et ses options (name, pic, hide, ro), seulement quand elles changent quelque chose
		function clean(it) {
			var o = { key: it.key, col: it.col, row: it.row, h: it.h };
			if (it.name) o.name = it.name;
			if (it.pic) o.pic = it.pic;
			if (it.hide && it.hide.length) o.hide = it.hide.slice();
			if (it.ro) o.ro = true;
			return o;
		}
		function save(lay) {
			layouts[tab] = lay.map(clean);
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
				// toucher sans glisser : le formulaire de la carte
				if (Math.abs(ev.clientX - x0) / k < 10 && Math.abs(ev.clientY - y0) / k < 10) { b.classList.remove("drag"); b.style.transform = ""; openForm(lay, it, null); return; }
				var t = target(ev);
				if ((t.col !== it.col || t.row !== it.row) && free(lay, t.col, t.row, it.h, it)) { it.col = t.col; it.row = t.row; save(lay); }
				else render();
			});
			ed.addEventListener("pointercancel", function () { drag = false; render(); });
		}
		// formulaire d'une carte (« + » sur une case libre, ou toucher une carte en édition) : l'entité à choisir dans
		// la liste de Home Assistant (celles de l'onglet d'abord), puis nom, icône, taille, ce qui est montré et le toucher,
		// avec l'aperçu de la carte. Il reste en place pendant que l'état se met à jour (rien n'est perdu en cours de saisie).
		var form = null;
		function openForm(lay, it, at) {
			form = { idx: it ? lay.indexOf(it) : -1, col: it ? it.col : at.col, row: it ? it.row : at.row, key: it ? it.key : null, h: it ? it.h : 0,
				name: it ? it.name || (catalog()[it.key] || {}).name || "" : "", pic: it && it.pic || "", hide: (it && it.hide || []).slice(), ro: !!(it && it.ro), q: "" };
			buildForm();
		}
		function closeForm() { form = null; render(); }
		function formFree(h) { var lay = layout(); return free(lay, form.col, form.row, h, form.idx >= 0 ? lay[form.idx] : null); }
		function buildForm() {
			var pk = v("picker"), cat = catalog(), c = colorsOf(settings());
			pk.hidden = false; pk.innerHTML = ""; pk.className = "picker form";
			var hd = el("div", "pk-head");
			hd.appendChild(el("p", "w-lbl", (form.idx >= 0 ? "Edit card" : "Add a card") + " · column " + form.col + " · row " + form.row));
			var acts = el("div", "f-acts");
			function act(text, cls, f) { var b = el("button", "pk-cancel " + (cls || ""), text); b.type = "button"; b.addEventListener("click", f); acts.appendChild(b); return b; }
			if (form.idx >= 0) act("Remove", "f-rm", function () { var lay = layout(); lay.splice(form.idx, 1); form = null; save(lay); });
			act("Cancel", "", closeForm);
			var ok = act(form.idx >= 0 ? "Save" : "Add card", "f-ok", function () {
				if (!form.key || !cat[form.key]) return;
				var lay = layout(), it = { key: form.key, col: form.col, row: form.row, h: form.h, name: form.name !== cat[form.key].name ? form.name.trim() : "", pic: form.pic, hide: form.hide, ro: form.ro };
				if (form.idx >= 0) lay[form.idx] = it; else lay.push(it);
				form = null; save(lay);
			});
			hd.appendChild(acts); pk.appendChild(hd);

			var body = el("div", "f-body"); pk.appendChild(body);
			// colonne 1 : l'entité
			var c1 = el("div", "f-col f-ent"), search = el("input", "f-in");
			c1.appendChild(el("p", "f-lbl", "Entity"));
			search.type = "text"; search.placeholder = "Search name, device, room or entity id"; search.value = form.q; search.spellcheck = false;
			c1.appendChild(search);
			var list = el("div", "f-list"); c1.appendChild(list); body.appendChild(c1);
			var c2 = el("div", "f-col f-card"), c3 = el("div", "f-col f-show"), c4 = el("div", "f-col f-prev");
			body.appendChild(c2); body.appendChild(c3); body.appendChild(c4);

			var used = layout().map(function (it) { return it.key; });
			// la liste, rangée par appareil (ceux qui ont une entité dans l'onglet d'abord), puis les entités sans appareil
			// et les listes ; la recherche porte aussi sur le nom de l'appareil
			var devName = {};
			((st && st.devices) || []).forEach(function (d) { devName[d.id] = d.name; });
			function rows() {
				list.innerHTML = "";
				var q = form.q.toLowerCase().trim(), keys = Object.keys(cat).filter(function (key) {
					if (!q) return true;
					var it = cat[key];
					return (it.name + " " + key + " " + it.kind + " " + areaName(st, it.area) + " " + (devName[it.dev] || "")).toLowerCase().indexOf(q) >= 0;
				});
				var groups = {}, order = [];
				keys.forEach(function (key) {
					var it = cat[key], g = it.list ? "~lists" : it.dev && devName[it.dev] ? it.dev : "~other";
					if (!groups[g]) { groups[g] = []; order.push(g); }
					groups[g].push(key);
				});
				var inTab = function (g) { return tab !== "fav" && groups[g].some(function (key) { return cat[key].area === tab; }) ? 0 : 1; };
				var rank = function (g) { return g === "~lists" ? 3 : g === "~other" ? 2 : inTab(g); };
				order.sort(function (a, b) { return rank(a) - rank(b) || String(devName[a] || "").toLowerCase().localeCompare(String(devName[b] || "").toLowerCase()); });
				function row(key) {
					var it = cat[key], r = el("button", "f-row" + (key === form.key ? " on" : "")), who = el("span", "f-who");
					r.type = "button";
					who.appendChild(el("span", "pk-nm", it.name));
					who.appendChild(el("span", "pk-k", it.kind + (it.area ? " · " + areaName(st, it.area) : "") + (used.indexOf(key) >= 0 && key !== form.key ? " · on this tab" : "")));
					r.appendChild(pic(it.e ? defaultPic(it.e) : it.list === "update" ? "update" : "services", false, c, 6));
					r.appendChild(who);
					r.addEventListener("click", function () {
						if (form.key === key) return;
						form.key = key; form.name = it.name; form.pic = ""; form.hide = []; form.ro = false;
						form.h = it.sizes.filter(formFree)[0] || 0;
						rows(); options();
					});
					list.appendChild(r);
				}
				order.forEach(function (g) {
					var ks = groups[g].sort(function (a, b) { return (cat[a].e && cat[a].e.type === "th" ? 0 : 1) - (cat[b].e && cat[b].e.type === "th" ? 0 : 1) || cat[a].name.toLowerCase().localeCompare(cat[b].name.toLowerCase()); });
					var sep = el("p", "pk-sep f-dev", g === "~lists" ? "Lists" : g === "~other" ? "Without device" : devName[g]);
					var room = g.charAt(0) !== "~" && areaName(st, cat[ks[0]].area);
					if (room) sep.appendChild(el("span", "", " · " + room));
					list.appendChild(sep);
					ks.forEach(row);
				});
				if (!keys.length) list.appendChild(el("p", "pk-none", "No entity found"));
			}
			search.addEventListener("input", function () { form.q = search.value; rows(); });

			// colonnes 2 à 4 : nom, icône, taille ; parties montrées et toucher ; aperçu
			function options() {
				c2.innerHTML = ""; c3.innerHTML = ""; c4.innerHTML = "";
				var it = form.key && cat[form.key];
				ok.disabled = !it || !form.h;
				if (!it) { c2.appendChild(el("p", "pk-none", "Choose an entity")); return; }
				c2.appendChild(el("p", "f-lbl", "Name"));
				var nm = el("input", "f-in"); nm.type = "text"; nm.value = form.name; nm.placeholder = it.name; nm.spellcheck = false;
				nm.addEventListener("input", function () { form.name = nm.value; preview(); });
				c2.appendChild(nm);
				c2.appendChild(el("p", "f-lbl", "Icon"));
				var pics = el("div", "f-pics"), cur = form.pic || (it.e ? defaultPic(it.e) : it.list === "update" ? "update" : "services");
				PIC_LIST.forEach(function (key) {
					var b = el("button", "f-pic" + (key === cur ? " on" : "")); b.type = "button"; b.setAttribute("aria-label", key);
					b.appendChild(pic(key, key === cur, c, 6));
					b.addEventListener("click", function () { form.pic = key; options(); });
					pics.appendChild(b);
				});
				c2.appendChild(pics);
				c2.appendChild(el("p", "f-lbl", "Size"));
				var sz = el("div", "f-sizes");
				it.sizes.slice().sort(function (a, b) { return a - b; }).forEach(function (h) {
					var b = el("button", "f-chip" + (h === form.h ? " on" : ""), SIZE_NAME[h]); b.type = "button";
					b.disabled = !formFree(h);
					b.addEventListener("click", function () { form.h = h; options(); });
					sz.appendChild(b);
				});
				c2.appendChild(sz);

				c3.appendChild(el("p", "f-lbl", "Show"));
				function toggle(label, on, f) {
					var b = el("button", "f-tg" + (on ? " on" : "")); b.type = "button"; b.setAttribute("aria-pressed", on ? "true" : "false");
					b.appendChild(el("i")); b.appendChild(el("span", "", label));
					b.addEventListener("click", function () { f(); options(); });
					c3.appendChild(b);
				}
				parts(it).forEach(function (p) {
					toggle(p[1], form.hide.indexOf(p[0]) < 0, function () {
						var i = form.hide.indexOf(p[0]); if (i >= 0) form.hide.splice(i, 1); else form.hide.push(p[0]);
					});
				});
				if (it.list === "update" || (it.e && CONTROL[it.e.type])) toggle("Touch control", !form.ro, function () { form.ro = !form.ro; });
				preview();
			}
			function preview() {
				c4.innerHTML = "";
				var it = form.key && cat[form.key];
				if (!it || !form.h) return;
				c4.appendChild(el("p", "f-lbl", "Preview"));
				var hgt = form.h * (400 / 6 + 20) - 20, room = 384, k = Math.min(1, room / hgt);
				var wrap = el("div", "f-pv"), inn = el("div", "in");
				wrap.style.width = 387 * k + "px"; wrap.style.height = hgt * k + "px";
				inn.style.width = "387px"; inn.style.height = hgt + "px"; inn.style.transform = "scale(" + k + ")"; inn.style.transformOrigin = "0 0";
				wrap.appendChild(inn); c4.appendChild(wrap);
				var o = { h: form.h, name: form.name.trim() && form.name !== it.name ? form.name.trim() : "", pic: form.pic, hide: form.hide, ro: form.ro };
				var x = { c: c, st: st, call: function () {}, redraw: function () {} };
				var go = function () { if (it.list) drawList(inn, it.list, x, o); else draw(inn, it.e, x, o); };
				go(); requestAnimationFrame(go);
			}
			rows(); options();
			if (form.key) { var on = list.querySelector(".f-row.on"); if (on) on.scrollIntoView({ block: "nearest" }); }
			else setTimeout(function () { try { search.focus(); } catch (e) {} }, 0);
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
				b.addEventListener("click", function () { tab = a.id; form = null; render(); });
				tabs.appendChild(b);
			});

			var grid = v("grid"), guide = v("guide"), picker = v("picker"), empty = v("empty");
			grid.innerHTML = ""; guide.innerHTML = ""; guide.hidden = true;
			if (!form) { picker.hidden = true; picker.innerHTML = ""; }
			var noLayout = cols === 0;
			empty.hidden = !offline && !noLayout;
			grid.hidden = offline || noLayout;
			if (offline) { v("big").textContent = "Home Assistant offline"; v("sm").textContent = st.hint || "Check URL and token in Dot Companion"; }
			else if (noLayout) { v("big").textContent = "Too small"; v("sm").textContent = "Use M, L or XL"; }
			var edit = editing() && !offline;
			stage.classList.toggle("editing", edit);
			if (form && !edit) { form = null; picker.hidden = true; picker.innerHTML = ""; }
			if (offline || noLayout) return;

			var lay = layout(), cat = catalog();
			var x = { c: c, st: st, call: call, redraw: render };
			lay.forEach(function (it) {
				var b = el("div", "cbox"), inn = el("div", "in");
				b.style.gridColumn = it.col; b.style.gridRow = it.row + " / span " + it.h;
				b.appendChild(inn); grid.appendChild(b);
				var item = cat[it.key];
				if (item.list) drawList(inn, item.list, x, it); else draw(inn, item.e, x, it);
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
						(function (q, r) { add.addEventListener("click", function () { openForm(lay, null, { col: q, row: r }); }); })(q, r);
						cell.appendChild(add);
					}
					guide.appendChild(cell);
				}
			} else {
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
			resetLayout: function () { layouts = {}; layoutText = ""; form = null; if (opts.onLayout) opts.onLayout(""); render(); }
		};
	}

	window.DotHomeAssistant = { mount: mount, card: card, demo: demo, slots: SLOTS, defaults: DEFAULTS };
})();
