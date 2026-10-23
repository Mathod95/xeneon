/*
 * Détection de la taille d'emplacement XENEON EDGE.
 * Pose sur <html> : data-size="s|m|l|xl" et data-orientation="h|v".
 * Les styles ciblent ensuite html[data-size="m"] … pour une mise en page propre à chaque taille.
 *
 * La détection se fait d'abord sur le rapport largeur / hauteur, qui ne change pas quand iCUE
 * affiche le widget en réduction (aperçu de l'éditeur). Seuls S et L horizontaux ont le même
 * rapport (840 × 344 et 1688 × 696) : on les sépare alors par la hauteur réelle.
 */
(function () {
	"use strict";
	var SLOTS = {
		h: { s: [840, 344], m: [840, 696], l: [1688, 696], xl: [2536, 696] },
		v: { s: [696, 416], m: [696, 840], l: [696, 1688], xl: [696, 2536] }
	};

	// bornes = moyennes géométriques entre les rapports voisins
	function classify(w, h) {
		var r = w / h;
		if (r >= 2.98) return { size: "xl", o: "h" };
		if (r >= 2.02) return { size: h >= 489 ? "l" : "s", o: "h" };
		if (r >= 1.42) return { size: "s", o: "v" };
		if (r >= 1.0) return { size: "m", o: "h" };
		if (r >= 0.584) return { size: "m", o: "v" };
		if (r >= 0.336) return { size: "l", o: "v" };
		return { size: "xl", o: "v" };
	}

	function detect() {
		var w = window.innerWidth, h = window.innerHeight;
		if (!w || !h) return;
		var best = classify(w, h);
		var slot = SLOTS[best.o][best.size];
		var root = document.documentElement;
		root.setAttribute("data-size", best.size);
		root.setAttribute("data-orientation", best.o);
		// unité de base : 1rem = 1/36 de la plus petite dimension, plafonnée pour rester lisible
		root.style.fontSize = Math.max(8, Math.min(w, h) / 36) + "px";
		window.dispatchEvent(new CustomEvent("edgesize", {
			detail: { size: best.size, orientation: best.o, width: w, height: h, slotWidth: slot[0], slotHeight: slot[1], scale: Math.min(w / slot[0], h / slot[1]) }
		}));
	}

	window.EdgeSize = { detect: detect, slots: SLOTS };
	window.addEventListener("resize", detect);
	detect();
})();
