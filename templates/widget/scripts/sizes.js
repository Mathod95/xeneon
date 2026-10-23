/*
 * Détection de la taille d'emplacement XENEON EDGE.
 * Pose sur <html> : data-size="s|m|l|xl" et data-orientation="h|v".
 * Les styles ciblent ensuite html[data-size="m"] … pour une mise en page propre à chaque taille.
 */
(function () {
	"use strict";
	var SIZES = [
		{ size: "s", o: "h", w: 840, h: 344 },
		{ size: "m", o: "h", w: 840, h: 696 },
		{ size: "l", o: "h", w: 1688, h: 696 },
		{ size: "xl", o: "h", w: 2536, h: 696 },
		{ size: "s", o: "v", w: 696, h: 416 },
		{ size: "m", o: "v", w: 696, h: 840 },
		{ size: "l", o: "v", w: 696, h: 1688 },
		{ size: "xl", o: "v", w: 696, h: 2536 }
	];

	function detect() {
		var w = window.innerWidth, h = window.innerHeight;
		var best = SIZES[0], bestScore = Infinity;
		SIZES.forEach(function (s) {
			// distance relative sur la largeur et la hauteur : tolère les petits écarts de rendu
			var score = Math.abs(Math.log(w / s.w)) + Math.abs(Math.log(h / s.h));
			if (score < bestScore) { bestScore = score; best = s; }
		});
		var root = document.documentElement;
		root.setAttribute("data-size", best.size);
		root.setAttribute("data-orientation", best.o);
		// unité de base : 1rem = 1 % de la plus petite dimension, plafonnée pour rester lisible
		root.style.fontSize = Math.max(8, Math.min(w, h) / 36) + "px";
		window.dispatchEvent(new CustomEvent("edgesize", { detail: { size: best.size, orientation: best.o, width: w, height: h } }));
	}

	window.EdgeSize = { detect: detect };
	window.addEventListener("resize", detect);
	detect();
})();
