/*
 * Détection de la taille d'emplacement XENEON EDGE : S, M, L ou XL.
 * Pose sur <html> : data-size="s|m|l|xl".
 * Les styles ciblent ensuite html[data-size="m"] … pour une mise en page propre à chaque taille.
 *
 * La détection se fait d'abord sur le rapport largeur / hauteur, qui ne change pas quand iCUE
 * affiche le widget en réduction (aperçu de l'éditeur). S et L ont le même rapport
 * (840 × 344 et 1688 × 696) : on les sépare alors par la hauteur réelle.
 */
(function () {
	"use strict";
	var SLOTS = { s: [840, 344], m: [840, 696], l: [1688, 696], xl: [2536, 696] };

	function classify(w, h) {
		var r = w / h;
		if (r >= 2.98) return "xl";
		if (r >= 2.02) return h >= 489 ? "l" : "s";
		return "m";
	}

	function detect() {
		var w = window.innerWidth, h = window.innerHeight;
		if (!w || !h) return;
		var size = classify(w, h), slot = SLOTS[size];
		var root = document.documentElement;
		root.setAttribute("data-size", size);
		// unité de base : 1rem = 1/36 de la plus petite dimension, plafonnée pour rester lisible
		root.style.fontSize = Math.max(8, Math.min(w, h) / 36) + "px";
		window.dispatchEvent(new CustomEvent("edgesize", {
			detail: { size: size, width: w, height: h, slotWidth: slot[0], slotHeight: slot[1], scale: Math.min(w / slot[0], h / slot[1]) }
		}));
	}

	window.EdgeSize = { detect: detect, slots: SLOTS };
	window.addEventListener("resize", detect);
	detect();
})();
