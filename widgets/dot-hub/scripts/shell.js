/*
 * Dot Hub : coquille iCUE.
 * - vérifie que Dot Companion répond sur 127.0.0.1:47800, sinon affiche « COMPANION NOT RUNNING » ;
 * - affiche l'interface du compagnon dans une iframe plein cadre (/i/<uniqueId>) ;
 * - pont clavier : iCUE ne fait pas entrer le clavier dans une iframe, donc la coquille garde le focus
 *   dans un champ invisible et renvoie le texte au champ du module (kbd-want / kbd-text / kbd-key).
 */
(function () {
	"use strict";
	var BASE = "http://127.0.0.1:47800";
	var app = document.getElementById("app"), down = document.getElementById("down");
	var msg = document.getElementById("msg"), sub = document.getElementById("sub"), kb = document.getElementById("kb");
	var uid = "", online = false, started = false, fails = 0;

	function prop(name) {
		try { var v = Function("return typeof " + name + " !== 'undefined' ? " + name + " : undefined")(); if (v !== undefined && v !== null && v !== "") return v; } catch (e) {}
		return window[name];
	}
	function applyStyle() {
		var c = prop("hubAccentColor");
		if (c) document.documentElement.style.setProperty("--accent", c);
	}

	function show(isOnline) {
		if (isOnline) {
			if (!online || !app.getAttribute("src")) app.src = BASE + "/i/" + encodeURIComponent(uid || "preview");
			app.hidden = false; down.hidden = true;
		} else {
			app.hidden = true; down.hidden = false;
			msg.textContent = "COMPANION NOT RUNNING"; msg.className = "msg warn";
			sub.textContent = "START DOT COMPANION ON THIS PC · RETRYING";
		}
		online = isOnline;
	}

	function check() {
		var ctrl = window.AbortController ? new AbortController() : null;
		var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 2500);
		fetch(BASE + "/api/health", ctrl ? { signal: ctrl.signal, cache: "no-store" } : { cache: "no-store" })
			.then(function (r) { return r.json(); })
			.then(function (j) { clearTimeout(t); fails = 0; if (j && j.ok) show(true); else throw new Error("bad answer"); })
			.catch(function () { clearTimeout(t); fails++; if (fails >= 2 || !online) show(false); });
	}

	function start() {
		if (started) return;
		started = true;
		var u = prop("uniqueId");
		uid = u ? String(u) : "preview";
		applyStyle();
		check();
		setInterval(check, 4000);
	}

	// ---------------------------------------------------------------- pont clavier
	var SPECIAL = ["Backspace", "Delete", "Enter", "Escape", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
	function toApp(m) { if (app.contentWindow) app.contentWindow.postMessage(m, BASE); }
	window.addEventListener("message", function (e) {
		if (e.origin !== BASE) return;
		var d = e.data || {};
		if (d.type === "kbd-want") { kb.value = ""; kb.focus(); }
		else if (d.type === "kbd-release") { kb.blur(); }
	});
	kb.addEventListener("keydown", function (e) {
		if (SPECIAL.indexOf(e.key) >= 0) { e.preventDefault(); toApp({ type: "kbd-key", key: e.key }); }
	});
	kb.addEventListener("input", function () {
		if (kb.value) { toApp({ type: "kbd-text", text: kb.value }); kb.value = ""; }
	});

	window.DotHubShell = { start: start, applyStyle: applyStyle };
	setTimeout(start, 1500);
})();

// iCUE appelle onICUEInitialized une fois les réglages et uniqueId injectés.
// Affectation sans var ni window, hors du mode strict : voir CLAUDE.md.
icueEvents = {
	onICUEInitialized: function () { window.DotHubShell.start(); },
	onDataUpdated: function () { window.DotHubShell.applyStyle(); }
};
