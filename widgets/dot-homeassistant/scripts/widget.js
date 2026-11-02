/*
 * Dot Home Assistant : page du module, servie par le compagnon dans Dot Hub.
 * Lit les réglages (variables globales posées par hub/module.js), demande l'état de la maison au compagnon
 * (GET /api/homeassistant/state?page=…) toutes les 2 s et confie le dessin à DotHomeAssistant (homeassistant.js),
 * le même rendu que la maquette de référence. Commandes : POST /api/homeassistant/call?page=… ({ domain, service, entity, data }).
 * Dans l'aperçu de la page de réglages (window.__dotPreview) : aucune commande, la grille se modifie, et la disposition
 * est renvoyée à la page de réglages (message « dot-set »), qui l'enregistre dans le réglage haLayout.
 * Jamais de données d'exemple ici : sans réponse du compagnon, l'écran dit qu'il attend Home Assistant.
 */
(function () {
	"use strict";
	var P = window.__dotHubParams || {}, Q = new URLSearchParams(location.search);
	var uid = P.uid || Q.get("uid") || "", page = P.page || Q.get("page") || "";

	function get(name, def) {
		try { var v = window[name]; return v === undefined || v === null ? def : v; } catch (e) { return def; }
	}
	function bool(v) { return v === true || v === "true"; }
	function settings() {
		return {
			showTabs: bool(get("showRooms", true)),
			showUnlit: bool(get("showUnlitDots", true)),
			layout: String(get("haLayout", "")),
			accent: String(get("dotAccentColor", "#10B981")),
			lit: String(get("litDotColor", "#F2F0E9")),
			unlit: String(get("unlitDotColor", "#1C1C1C")),
			label: String(get("labelColor", "#B8B6B0"))
		};
	}

	var query = "?uid=" + encodeURIComponent(uid) + "&page=" + encodeURIComponent(page);
	function preview() { return !!window.__dotPreview; }
	function call(c) {
		if (preview()) return;
		fetch("/api/homeassistant/call" + query, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) })
			.then(function () { setTimeout(poll, 600); }).catch(function () {});
	}
	function saveLayout(json) {
		window.haLayout = json;
		if (window.parent !== window) window.parent.postMessage({ type: "dot-set", key: "haLayout", value: json }, "*");
	}

	var stage = document.getElementById("stage"), state = null;
	var ha = DotHomeAssistant.mount(stage, {
		size: document.documentElement.getAttribute("data-size") || "xl",
		settings: settings,
		state: function () { return state; },
		onCall: call,
		edit: preview,
		onLayout: saveLayout
	});

	// la scène garde la taille de l'emplacement et est mise à l'échelle de la fenêtre
	function fit() {
		var size = document.documentElement.getAttribute("data-size") || "xl";
		if (size !== ha.size()) ha.setSize(size);
		var slot = ha.slot(), scale = Math.min(window.innerWidth / slot[0], window.innerHeight / slot[1]) || 1;
		stage.style.transform = "translate(" + (window.innerWidth - slot[0] * scale) / 2 + "px," + (window.innerHeight - slot[1] * scale) / 2 + "px) scale(" + scale + ")";
		ha.render();
	}

	// pendant un geste (glisser une carte, appui long), on ne redessine pas
	var busy = false;
	document.addEventListener("pointerdown", function () { busy = true; });
	document.addEventListener("pointerup", function () { busy = false; });
	document.addEventListener("pointercancel", function () { busy = false; });
	function poll() {
		fetch("/api/homeassistant/state" + query, { cache: "no-store" })
			.then(function (r) { return r.json(); })
			.then(function (j) { state = j; if (!busy) ha.render(); })
			.catch(function () { state = { state: "offline", hint: "Dot Companion not running" }; if (!busy) ha.render(); });
	}

	window.icueEvents = {
		onICUEInitialized: function () { poll(); },
		onDataUpdated: function () { ha.render(); }
	};
	window.addEventListener("edgesize", fit);
	fit();
	poll();
	setInterval(poll, 2000);
})();
