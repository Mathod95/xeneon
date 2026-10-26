/*
 * Dot Clock : page du module, servie par le compagnon dans Dot Hub.
 * Lit les réglages (variables globales posées par hub/module.js, mêmes noms que les x-icue-property),
 * détecte la taille d'emplacement (sizes.js) et confie le dessin à DotClock (clock.js), le même rendu
 * que la maquette de référence.
 */
(function () {
	"use strict";

	function get(name, def) {
		try {
			var v = window[name];
			return v === undefined || v === null ? def : v;
		} catch (e) { return def; }
	}

	var stage = document.getElementById("stage");
	var scale = 1;
	var clock = DotClock.mount(stage, {
		size: document.documentElement.getAttribute("data-size") || "xl",
		settings: function () { return DotClock.fromProperties(get); },
		pixelRatio: function () { return scale * (window.devicePixelRatio || 1); }
	});

	// la scène garde la taille de l'emplacement et est mise à l'échelle de la fenêtre (aperçu réduit dans iCUE)
	function fit() {
		var size = document.documentElement.getAttribute("data-size") || "xl";
		if (size !== clock.size()) clock.setSize(size);
		var slot = clock.slot();
		scale = Math.min(window.innerWidth / slot[0], window.innerHeight / slot[1]) || 1;
		stage.style.transform = "translate(" + (window.innerWidth - slot[0] * scale) / 2 + "px," + (window.innerHeight - slot[1] * scale) / 2 + "px) scale(" + scale + ")";
		clock.render();
	}

	var timer = null;
	function tick() {
		clock.render();
		clearTimeout(timer);
		timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 10);
	}

	window.icueEvents = {
		onICUEInitialized: function () { clock.resetZones(); clock.render(); },
		onDataUpdated: function () { clock.resetZones(); clock.render(); }
	};
	window.addEventListener("edgesize", fit);

	fit();
	tick();
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { clock.render(); });
})();
