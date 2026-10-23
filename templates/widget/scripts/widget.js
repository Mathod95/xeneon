/* Logique du widget. Remplacer le contenu de démonstration. */
(function () {
	"use strict";

	function applyColors() {
		var root = document.documentElement.style;
		if (typeof accentColor !== "undefined" && accentColor) root.setProperty("--accent", accentColor);
		if (typeof textColor !== "undefined" && textColor) root.setProperty("--text", textColor);
		if (typeof backgroundColor !== "undefined" && backgroundColor) root.setProperty("--bg", backgroundColor);
	}

	function render(e) {
		var d = e ? e.detail : { size: document.documentElement.dataset.size, orientation: document.documentElement.dataset.orientation, width: innerWidth, height: innerHeight };
		document.getElementById("sizeLabel").textContent =
			d.size.toUpperCase() + " " + (d.orientation === "h" ? "horizontal" : "vertical") + " · " + d.width + " × " + d.height;
	}

	window.icueEvents = {
		onICUEInitialized: function () { applyColors(); render(); },
		onDataUpdated: applyColors
	};

	window.addEventListener("edgesize", render);
	if (typeof iCUE_initialized !== "undefined" && iCUE_initialized) { applyColors(); }
	render();
})();
