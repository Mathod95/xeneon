/*
 * Dot Bambu Lab : page du module, servie par le compagnon dans Dot Hub.
 * Lit les réglages (variables globales posées par hub/module.js), demande l'état de l'imprimante au compagnon
 * (GET /api/bambulab/state?page=…) toutes les 2 s et confie le dessin à DotBambuLab (bambulab.js), le même rendu
 * que la maquette de référence. Commandes (lampe, pause, reprise, arrêt) : POST /api/bambulab/<commande>?page=….
 * Jamais de données d'exemple ici : sans réponse du compagnon, l'écran dit qu'il attend l'imprimante.
 */
(function () {
	"use strict";
	// Dot Hub (uid), et la page de Dot Hub dont on lit les réglages (page ; aperçu de la page de réglages)
	var P = window.__dotHubParams || {}, Q = new URLSearchParams(location.search);
	var uid = P.uid || Q.get("uid") || "", page = P.page || Q.get("page") || "";

	function get(name, def) {
		try { var v = window[name]; return v === undefined || v === null ? def : v; } catch (e) { return def; }
	}
	function bool(v) { return v === true || v === "true"; }
	function settings() {
		return {
			showAms: bool(get("showAms", true)),
			showUnlit: bool(get("showUnlitDots", true)),
			accent: String(get("dotAccentColor", "#10B981")),
			lit: String(get("litDotColor", "#F2F0E9")),
			unlit: String(get("unlitDotColor", "#1C1C1C")),
			label: String(get("labelColor", "#B8B6B0"))
		};
	}

	var query = "?uid=" + encodeURIComponent(uid) + "&page=" + encodeURIComponent(page);
	// aperçu dans la page de réglages du compagnon (window.__dotPreview, posé par hub/module.js) : aucune commande
	function post(cmd) { if (window.__dotPreview) return; fetch("/api/bambulab/" + cmd + query, { method: "POST" }).then(function () { setTimeout(poll, 800); }).catch(function () {}); }

	var stage = document.getElementById("stage"), state = null;
	var bl = DotBambuLab.mount(stage, {
		size: document.documentElement.getAttribute("data-size") || "xl",
		settings: settings,
		state: function () { return state; },
		onCommand: post
	});

	// la scène garde la taille de l'emplacement et est mise à l'échelle de la fenêtre
	function fit() {
		var size = document.documentElement.getAttribute("data-size") || "xl";
		if (size !== bl.size()) bl.setSize(size);
		var slot = bl.slot(), scale = Math.min(window.innerWidth / slot[0], window.innerHeight / slot[1]) || 1;
		stage.style.transform = "translate(" + (window.innerWidth - slot[0] * scale) / 2 + "px," + (window.innerHeight - slot[1] * scale) / 2 + "px) scale(" + scale + ")";
		bl.render();
	}

	function poll() {
		fetch("/api/bambulab/state" + query, { cache: "no-store" })
			.then(function (r) { return r.json(); })
			.then(function (j) { state = j; bl.render(); })
			.catch(function () { state = { state: "offline", hint: "Dot Companion not running" }; bl.render(); });
	}

	window.icueEvents = {
		onICUEInitialized: function () { poll(); },
		onDataUpdated: function () { bl.render(); poll(); }
	};
	window.addEventListener("edgesize", fit);
	fit();
	poll();
	setInterval(poll, 2000);
})();
