/*
 * Dot Hub : script ajouté par le compagnon à la page de chaque module.
 * - lit les réglages de l'instance dans le compagnon et les expose comme le ferait iCUE
 *   (une variable globale par x-icue-property, puis icueEvents.onDataUpdated) ;
 * - suit les changements faits dans la page de réglages (sondage toutes les 2 s) ;
 * - appui long (1 s) n'importe où : retour à l'accueil Dot Home ;
 * - « Identify » depuis la page de réglages : affiche le nom de l'instance ;
 * - pont clavier : un champ de saisie du module demande le clavier à la coquille iCUE.
 */
(function () {
	"use strict";
	var uid = new URLSearchParams(location.search).get("uid") || "";
	var moduleId = location.pathname.split("/")[2] || "";
	var api = "/api/instance/" + encodeURIComponent(uid);
	var version = -1, identifySeen = 0, first = true;

	function lit(v) { try { return Function("return (" + v + ")")(); } catch (e) { return v; } }

	// valeurs par défaut tirées des balises x-icue-property du module
	var DEFAULTS = {};
	document.querySelectorAll('meta[name="x-icue-property"]').forEach(function (m) {
		var key = m.getAttribute("content");
		if (key) DEFAULTS[key] = lit(m.getAttribute("data-default") || "''");
	});

	function apply(settings) {
		Object.keys(DEFAULTS).forEach(function (k) {
			window[k] = settings && Object.prototype.hasOwnProperty.call(settings, k) ? settings[k] : DEFAULTS[k];
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
				if (inst.module && inst.module !== moduleId) { location.href = "/i/" + encodeURIComponent(uid); return; }
				if (!inst.module) { location.href = "/home?uid=" + encodeURIComponent(uid); return; }
				if (inst.version !== version) { version = inst.version; apply(inst.settings); }
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

	// ---------------------------------------------------------------- appui long : accueil
	var pressTimer = null, x0 = 0, y0 = 0;
	function cancel() { clearTimeout(pressTimer); pressTimer = null; }
	document.addEventListener("pointerdown", function (e) {
		x0 = e.clientX; y0 = e.clientY; cancel();
		pressTimer = setTimeout(function () { location.href = "/home?uid=" + encodeURIComponent(uid); }, 1000);
	});
	document.addEventListener("pointermove", function (e) { if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 24) cancel(); });
	document.addEventListener("pointerup", cancel);
	document.addEventListener("pointercancel", cancel);

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

	apply(null);
	poll();
	setInterval(poll, 2000);
})();
