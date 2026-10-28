/*
 * Dot Steam : page du module, servie par le compagnon dans Dot Hub.
 * Lit les réglages (variables globales posées par hub/module.js), demande l'état de Steam au compagnon
 * (GET /api/steam/state) toutes les 3 s et confie le dessin à DotSteam (steam.js), le même rendu que la
 * maquette de référence. Lancer un jeu : POST /api/steam/launch/<appid> ; ouvrir une page de Steam :
 * POST /api/steam/open/<page> ; changer son statut : POST /api/steam/status/<statut>.
 */
(function () {
	"use strict";
	var uid = (window.__dotHubParams || {}).uid || new URLSearchParams(location.search).get("uid") || "";

	function get(name, def) {
		try { var v = window[name]; return v === undefined || v === null ? def : v; } catch (e) { return def; }
	}

	// aperçu dans la page de réglages du compagnon (window.__dotPreview, posé par hub/module.js) : rien ne se lance
	function post(url) { if (window.__dotPreview) return; fetch(url, { method: "POST" }).catch(function () {}); }

	var stage = document.getElementById("stage"), scale = 1, state = null;
	var steam = DotSteam.mount(stage, {
		size: document.documentElement.getAttribute("data-size") || "xl",
		art: function (appid, kind) { return kind === "avatar" ? "/api/steam/avatar" : "/api/steam/art/" + appid + "/" + kind; },
		onLaunch: function (appid) { post("/api/steam/launch/" + appid); },
		onOpen: function (page) { post("/api/steam/open/" + page); },
		onStatus: function (status) { post("/api/steam/status/" + status); setTimeout(poll, 1500); },
		pixelRatio: function () { return scale * (window.devicePixelRatio || 1); }
	});

	function draw() { if (state) steam.render(state, DotSteam.fromProperties(get)); }

	// la scène garde la taille de l'emplacement et est mise à l'échelle de la fenêtre
	function fit() {
		var size = document.documentElement.getAttribute("data-size") || "xl";
		if (size !== steam.size()) steam.setSize(size);
		var slot = steam.slot();
		scale = Math.min(window.innerWidth / slot[0], window.innerHeight / slot[1]) || 1;
		stage.style.transform = "translate(" + (window.innerWidth - slot[0] * scale) / 2 + "px," + (window.innerHeight - slot[1] * scale) / 2 + "px) scale(" + scale + ")";
		draw();
	}

	function poll() {
		fetch("/api/steam/state?uid=" + encodeURIComponent(uid), { cache: "no-store" })
			.then(function (r) { return r.json(); })
			.then(function (j) { state = j; draw(); })
			.catch(function () {});
	}

	window.icueEvents = {
		onICUEInitialized: function () { poll(); },
		onDataUpdated: function () { draw(); poll(); }
	};
	window.addEventListener("edgesize", fit);
	fit();
	poll();
	setInterval(poll, 3000);
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();
