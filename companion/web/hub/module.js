/*
 * Dot Hub : script ajouté par le compagnon à la page de chaque module.
 * - lit les réglages de l'instance dans le compagnon et les expose comme le ferait iCUE
 *   (une variable globale par x-icue-property, puis icueEvents.onDataUpdated) ;
 * - suit les changements faits dans la page de réglages (sondage toutes les 2 s) ;
 * - appui long (1 s) n'importe où, ou toucher un élément data-hub-home : retour à l'accueil Dot Home ;
 * - « Identify » depuis la page de réglages : affiche le nom de l'instance ;
 * - pont clavier : un champ de saisie du module demande le clavier à la coquille iCUE ;
 * - aperçu (?preview=1, page de réglages) : rien ne se déclenche au toucher, pas de retour à l'accueil,
 *   et les réglages arrivent tout de suite par postMessage ({ type: "dot-preview", settings, theme }).
 */
(function () {
	"use strict";
	// paramètres : dans l'adresse (?uid=…&preview=1), ou posés par la maquette de référence du compagnon
	var Q = window.__dotHubParams || {};
	new URLSearchParams(location.search).forEach(function (v, k) { if (!(k in Q)) Q[k] = v; });
	var uid = Q.uid || "";
	var moduleId = Q.module || location.pathname.split("/")[2] || "";
	var preview = Q.preview === "1" || Q.preview === true;
	window.__dotPreview = preview;
	var api = "/api/instance/" + encodeURIComponent(uid);
	var version = "", identifySeen = 0, first = true;

	function lit(v) { try { return Function("return (" + v + ")")(); } catch (e) { return v; } }

	// valeurs par défaut tirées des balises x-icue-property du module
	var DEFAULTS = {};
	document.querySelectorAll('meta[name="x-icue-property"]').forEach(function (m) {
		var key = m.getAttribute("content");
		if (key) DEFAULTS[key] = lit(m.getAttribute("data-default") || "''");
	});

	// couleurs communes (carte « Couleurs » des réglages) > réglages de l'instance > valeurs par défaut du module
	function apply(settings, theme) {
		Object.keys(DEFAULTS).forEach(function (k) {
			if (theme && Object.prototype.hasOwnProperty.call(theme, k)) window[k] = theme[k];
			else window[k] = settings && Object.prototype.hasOwnProperty.call(settings, k) ? settings[k] : DEFAULTS[k];
		});
		var ev = window.icueEvents;
		if (ev) {
			if (first && typeof ev.onICUEInitialized === "function") ev.onICUEInitialized();
			else if (typeof ev.onDataUpdated === "function") ev.onDataUpdated();
		}
		first = false;
	}

	function poll() {
		if (!uid) return;
		fetch(api, { cache: "no-store" })
			.then(function (r) { return r.ok ? r.json() : null; })
			.then(function (inst) {
				if (!inst) return;
				// aperçu : c'est la page de réglages qui recharge l'aperçu quand le module change
				if (!preview && inst.module && inst.module !== moduleId) { location.href = "/i/" + encodeURIComponent(uid); return; }
				if (!preview && !inst.module) { location.href = "/home?uid=" + encodeURIComponent(uid); return; }
				var v = inst.version + "/" + inst.theme_version;
				if (v !== version) { version = v; apply(inst.settings, inst.theme); }
				if (inst.identify && inst.identify !== identifySeen) {
					if (identifySeen) identify(inst.name);
					identifySeen = inst.identify;
				}
			})
			.catch(function () { /* compagnon arrêté : la coquille affiche l'écran d'erreur */ });
	}

	function identify(name) {
		var d = document.createElement("div");
		d.textContent = "● " + (name || "DOT HUB").toUpperCase();
		d.style.cssText = "position:fixed;inset:0;display:grid;place-items:center;background:rgba(8,8,8,.88);color:#10b981;font:500 6vmin 'Fira Code',Consolas,monospace;letter-spacing:.2em;z-index:99999";
		document.body.appendChild(d);
		setTimeout(function () { d.remove(); }, 3000);
	}

	// aperçu dans la page de réglages : les réglages arrivent tout de suite, sans attendre le sondage
	window.addEventListener("message", function (e) {
		var d = e.data || {};
		if (preview && d.type === "dot-preview") apply(d.settings || {}, d.theme || null);
	});

	// ---------------------------------------------------------------- appui long : accueil
	var pressTimer = null, x0 = 0, y0 = 0;
	function cancel() { clearTimeout(pressTimer); pressTimer = null; }
	document.addEventListener("pointerdown", function (e) {
		if (preview) return;
		x0 = e.clientX; y0 = e.clientY; cancel();
		pressTimer = setTimeout(function () { location.href = "/home?uid=" + encodeURIComponent(uid); }, 1000);
	});
	document.addEventListener("pointermove", function (e) { if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 24) cancel(); });
	document.addEventListener("pointerup", cancel);
	document.addEventListener("pointercancel", cancel);

	// ---------------------------------------------------------------- lien vers Dot Home
	// Les éléments marqués data-hub-home (ex. « ● DOT CLOCK ») ramènent à l'accueil.
	// Une zone invisible d'au moins 60 px les recouvre, pour un toucher facile.
	var homeZone = document.createElement("button");
	homeZone.type = "button";
	homeZone.setAttribute("aria-label", "Dot Home");
	homeZone.style.cssText = "position:fixed;z-index:9999;display:none;padding:0;margin:0;border:0;background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent";
	homeZone.addEventListener("click", function () { if (!preview) location.href = "/home?uid=" + encodeURIComponent(uid); });
	document.body.appendChild(homeZone);
	function placeHomeZone() {
		var els = Array.prototype.filter.call(document.querySelectorAll("[data-hub-home]"), function (e) { return !e.hidden && e.getClientRects().length; });
		if (!els.length) { homeZone.style.display = "none"; return; }
		var l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
		els.forEach(function (e) { var k = e.getBoundingClientRect(); l = Math.min(l, k.left); t = Math.min(t, k.top); r = Math.max(r, k.right); b = Math.max(b, k.bottom); });
		var w = Math.max(60, r - l + 24), h = Math.max(60, b - t + 24), cx = (l + r) / 2, cy = (t + b) / 2;
		homeZone.style.display = "block";
		homeZone.style.left = Math.max(0, cx - w / 2) + "px";
		homeZone.style.top = Math.max(0, cy - h / 2) + "px";
		homeZone.style.width = w + "px";
		homeZone.style.height = h + "px";
	}
	window.addEventListener("resize", placeHomeZone);
	setInterval(placeHomeZone, 1000);
	setTimeout(placeHomeZone, 50);

	// ---------------------------------------------------------------- pont clavier
	var field = null, bridged = false;
	function editable(el) { return el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|search|url|email|number|password|)$/i.test(el.type))); }
	document.addEventListener("focusin", function (e) {
		if (!editable(e.target)) return;
		field = e.target; bridged = false;
		if (window.parent !== window) setTimeout(function () { window.parent.postMessage({ type: "kbd-want" }, "*"); }, 0);
	});
	document.addEventListener("focusout", function (e) { if (e.target === field) bridged = true; });
	window.addEventListener("message", function (e) {
		var d = e.data || {};
		if (!field || !bridged || (d.type !== "kbd-text" && d.type !== "kbd-key")) return;
		var a = field.selectionStart == null ? field.value.length : field.selectionStart;
		var b = field.selectionEnd == null ? a : field.selectionEnd;
		if (d.type === "kbd-text") {
			field.value = field.value.slice(0, a) + d.text + field.value.slice(b);
			a += d.text.length;
			try { field.setSelectionRange(a, a); } catch (x) {}
		} else if (d.key === "Backspace" && a > 0) {
			field.value = field.value.slice(0, a - 1) + field.value.slice(b);
			try { field.setSelectionRange(a - 1, a - 1); } catch (x) {}
		} else if (d.key === "ArrowLeft" && a > 0) {
			try { field.setSelectionRange(a - 1, a - 1); } catch (x) {}
		} else if (d.key === "ArrowRight") {
			try { field.setSelectionRange(a + 1, a + 1); } catch (x) {}
		} else if (d.key === "Enter") {
			field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			field.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", bubbles: true }));
		}
		field.dispatchEvent(new Event("input", { bubbles: true }));
	});

	apply(null, null);
	poll();
	setInterval(poll, 2000);
})();
