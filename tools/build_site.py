#!/usr/bin/env python3
"""Construit le site GitHub Pages.

- site/index.html : page d'accueil (tools/site/index.html) remplie avec la liste
  des widgets du README, leur statut et la présence d'une maquette ;
- site/<slug>/index.html : copie de widgets/<slug>/mockups/reference.html.

- site/releases/index.html : Dot Release, les versions (tools/site/releases.html,
  données dans tools/site/releases.json).

Option --fragment FICHIER : écrit seulement la page d'accueil, sans en-tête HTML,
avec des liens absolus vers le site en ligne (pour l'aperçu en artefact).
Option --releases-fragment FICHIER : pareil pour Dot Release ; --companion-fragment FICHIER pour
la page Dot Companion ; --companion-mockup DOSSIER pour la maquette de Dot Companion et ses fichiers.
- site/companion/index.html : la page Dot Companion (tools/site/companion.html) ;
- site/dot-companion/ : la maquette de Dot Companion (companion/mockups/reference.html).
"""
import argparse
import base64
import http.server
import json
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
TEMPLATE = ROOT / "tools" / "site" / "index.html"
LIVE = "https://mathod95.github.io/xeneon/"
RELEASES_TEMPLATE = ROOT / "tools" / "site" / "releases.html"
RELEASES_DATA = ROOT / "tools" / "site" / "releases.json"
# artefacts claude.ai : Dot Page et Dot Release se répondent par leurs boutons
ARTIFACT_PAGE = "https://claude.ai/artifact/9LuRfha2bygFfup1GQk4mB"
ARTIFACT_RELEASE = "https://claude.ai/artifact/2FPiRAKZ1qtuiTxjnDyUJh"
ARTIFACT_COMPANION = "https://claude.ai/artifact/DG6Y5j5NTaRhcXrUPyYzbQ"
ARTIFACT_COMPANION_MOCKUP = "https://claude.ai/artifact/BdvnCbdBqsspXWnYNLXA9d"
COMPANION_TEMPLATE = ROOT / "tools" / "site" / "companion.html"
# charte, anatomie de chaque type de page, avec ses deux fichiers communs
DESIGN = ROOT / "docs" / "design"
DESIGN_PAGES = ["homePage", "subPage", "modulePage", "releasePage"]
DESIGN_FILES = ["anatomy.css", "anatomy.js"]
BLANK = ' target="_blank" rel="noopener"'


def status_of(slug):
    readme = ROOT / "widgets" / slug / "README.md"
    text = readme.read_text(encoding="utf-8") if readme.exists() else ""
    m = re.search(r"\*\*Statut :\*\*\s*(.+)$", text, re.M)
    raw = m.group(1).strip() if m else "idée"
    label = re.sub(r"^[^\w(]+", "", raw).strip()
    low = label.lower()
    if "en cours" in low:
        kind = "wip"
    elif "spécifié" in low:
        kind = "spec"
    elif "conception" in low:
        kind = "design"
    else:
        kind = "idea"
    return label, kind


def widgets():
    rows = []
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    en_file = ROOT / "tools" / "site" / "modules.en.json"
    en = json.loads(en_file.read_text(encoding="utf-8")) if en_file.exists() else {}
    for line in text.splitlines():
        m = re.match(r"\|\s*\[(.+?)\]\(widgets/([\w-]+)\)\s*\|(.*?)\|\s*$", line)
        if not m:
            continue
        name, slug, desc = m.group(1), m.group(2), m.group(3).strip()
        label, kind = status_of(slug)
        rows.append({
            "name": name,
            "slug": slug,
            "desc": desc,
            "desc_en": en.get(slug, ""),
            "status": label,
            "kind": kind,
            "mockup": (ROOT / "widgets" / slug / "mockups" / "reference.html").exists(),
        })
    return rows


SHOT_JS = """
async () => {
  // chaque maquette nomme son cadre #frame et son écran XL #stage
  const frame = document.getElementById('frame');
  const stage = document.getElementById('stage');
  if (!frame || !stage) return false;
  document.querySelectorAll('.wrap').forEach(w => { w.style.maxWidth = 'none'; });
  frame.style.maxWidth = 'none';
  frame.style.width = (2536 + frame.offsetWidth - frame.clientWidth) + 'px';
  window.dispatchEvent(new Event('resize'));
  if (document.fonts) await document.fonts.ready;
  await new Promise(r => setTimeout(r, 400));
  return true;
}
"""


def previews(slugs):
    """Capture XL (2536 x 696) de chaque maquette, en JPEG. Vide si Playwright manque."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright absent : pas d'aperçus")
        return {}
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 2800, "height": 1400})
        for slug in slugs:
            ref = ROOT / "widgets" / slug / "mockups" / "reference.html"
            page.goto(ref.as_uri())
            page.wait_for_timeout(300)
            if not page.evaluate(SHOT_JS):
                continue
            # l'emplacement XL exactement (2536 × 696) : dans le boîtier de l'Edge, sa position tombe entre deux pixels
            b = page.locator("#stage").bounding_box()
            out[slug] = page.screenshot(type="jpeg", quality=88, full_page=True,
                                        clip={"x": round(b["x"]), "y": round(b["y"]), "width": 2536, "height": 696})
        browser.close()
    return out


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Serveur de fichiers local sans journal (captures de la maquette de Dot Companion)."""
    def log_message(self, *args):
        pass


def settings_shot(mockup_dir):
    """Capture de la page de réglages seule (l'iframe de la vue « Réglages · navigateur » de la maquette de Dot Companion), en JPEG. None si Playwright manque."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None
    import functools, threading
    # la maquette charge la page de réglages dans une iframe : il faut un vrai serveur, pas file://
    handler = functools.partial(QuietHandler, directory=str(mockup_dir))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1440, "height": 1200})
            page.goto("http://127.0.0.1:%d/" % srv.server_address[1])
            page.wait_for_timeout(2000)
            # la page seule, sans la barre du navigateur simulé
            shot = page.locator("#settingsFrame").screenshot(type="jpeg", quality=85)
            browser.close()
    finally:
        srv.shutdown()
    return shot


# vidéo de la page de réglages pour Dot Companion : le pointeur ajoute une page avec « + », choisit Dot Clock et la règle.
# Enregistrée dans la maquette de Dot Companion (vraie page de réglages, API simulée), en temps réel, puis encodée en WebM
# (VP9) avec le ffmpeg fourni par Playwright. Gardée dans .cache/ tant que la maquette et ses fichiers ne changent pas.
DEMO_VERSION = "1"
DEMO_SIZE = (1200, 800)
DEMO_FPS = 25
DEMO_CURSOR = """
(function () {
  var c = document.createElement("div");
  c.innerHTML = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M1.5 1.5 L1.5 24 L7.2 18.6 L11 27.5 L15 25.8 L11.3 17 L19 17 Z" fill="#f2f0e9" stroke="#080808" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  c.style.cssText = "position:fixed;left:0;top:0;z-index:99999;pointer-events:none;transition:transform .9s cubic-bezier(.45,0,.2,1)";
  document.body.appendChild(c);
  var st = document.createElement("style");
  st.textContent = ".demoRing{position:fixed;z-index:99998;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border:2px solid #10B981;border-radius:50%;animation:demoRing .55s ease-out forwards}@keyframes demoRing{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}";
  document.head.appendChild(st);
  window.demoMove = function (x, y, ms) { c.style.transitionDuration = ms + "ms"; c.style.transform = "translate(" + x + "px," + y + "px)"; };
  window.demoRing = function (x, y) { var r = document.createElement("div"); r.className = "demoRing"; r.style.left = x + "px"; r.style.top = y + "px"; document.body.appendChild(r); setTimeout(function () { r.remove(); }, 700); };
  // la page de réglages seule, en plein cadre
  document.getElementById("settingsFrame").style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:9999;border:0;margin:0;border-radius:0";
})();
"""


def ffmpeg_path():
    """Le ffmpeg installé avec Playwright (il sait lire du MJPEG et écrire du WebM VP9), sinon celui du système."""
    import glob, os
    base = os.environ.get("PLAYWRIGHT_BROWSERS_PATH") or os.path.expanduser("~/.cache/ms-playwright")
    for f in sorted(glob.glob(os.path.join(base, "ffmpeg-*", "ffmpeg-*"))):
        if os.access(f, os.X_OK) and not f.endswith(".txt"):
            return f
    return shutil.which("ffmpeg")


def settings_demo(mockup_dir):
    """(vidéo WebM, première image JPEG) du parcours dans la page de réglages, ou None (Playwright ou ffmpeg absent, parcours cassé)."""
    import hashlib
    h = hashlib.sha256((DEMO_VERSION + DEMO_CURSOR).encode())
    for f in sorted(pathlib.Path(mockup_dir).rglob("*")):
        if f.is_file():
            h.update(str(f.relative_to(mockup_dir)).encode()); h.update(f.read_bytes())
    cache = ROOT / ".cache" / "settings-demo"
    key = h.hexdigest()[:16]
    if (cache / (key + ".webm")).exists() and (cache / (key + ".jpg")).exists():
        return (cache / (key + ".webm")).read_bytes(), (cache / (key + ".jpg")).read_bytes()
    ff = ffmpeg_path()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None
    if not ff:
        return None
    import functools, threading
    handler = functools.partial(QuietHandler, directory=str(mockup_dir))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    W, H = DEMO_SIZE
    frames = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            ctx = browser.new_context(viewport={"width": W, "height": H})
            page = ctx.new_page()
            page.goto("http://127.0.0.1:%d/" % srv.server_address[1])
            page.wait_for_timeout(2000)
            page.evaluate(DEMO_CURSOR)
            page.wait_for_timeout(800)
            frame = page.locator("#settingsFrame").content_frame
            doc = [f for f in page.frames if f != page.main_frame][0]
            wait = page.wait_for_timeout

            def scroll(js_top, smooth=True):
                y = doc.evaluate("() => " + js_top)
                doc.evaluate("([y, s]) => scrollTo({ top: y, behavior: s ? 'smooth' : 'instant' })", [y, smooth])

            def go(loc, after, ms=900):
                b = loc.bounding_box()
                x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
                page.evaluate("([x, y, ms]) => demoMove(x, y, ms)", [x, y, ms])
                wait(ms + 120)
                page.mouse.move(x, y)
                page.evaluate("([x, y]) => demoRing(x, y)", [x, y])
                page.mouse.click(x, y)
                wait(after)

            # départ : la carte DOT HUB en vue, le pointeur en bas à droite
            scroll("document.querySelector('.card.hub').getBoundingClientRect().top + scrollY - 24", False)
            page.evaluate("([x, y]) => demoMove(x, y, 0)", [W * 0.8, H * 0.85])
            wait(400)
            cdp = ctx.new_cdp_session(page)

            def on_frame(e):
                frames.append((e["metadata"]["timestamp"], e["data"]))
                cdp.send("Page.screencastFrameAck", {"sessionId": e["sessionId"]})
            cdp.on("Page.screencastFrame", on_frame)
            cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": W, "maxHeight": H})
            wait(700)
            go(frame.frame_locator(".card.hub iframe").locator(".tile.add"), 900)
            scroll("(function (c) { return c[c.length - 1].getBoundingClientRect().top + scrollY - 24; })(document.querySelectorAll('.card.page'))")
            wait(1000)
            pick = frame.frame_locator(".card.page iframe").first
            go(pick.locator(".pickbtn"), 800)
            go(pick.get_by_text("DOT CLOCK"), 1600)
            scroll("1e5")
            wait(1100)
            opts = frame.locator(".card.page .settings")
            go(opts.locator("label", has_text="12 h"), 1300)
            go(opts.locator("label", has_text="Thin"), 1300)
            go(opts.locator(".preset", has_text="Rouge A"), 1300)
            go(opts.locator("label", has_text="Show seconds"), 2200)
            cdp.send("Page.stopScreencast")
            browser.close()
    except Exception as e:  # parcours cassé (maquette changée) : on garde l'image fixe
        print("vidéo des réglages non générée :", e)
        return None
    finally:
        srv.shutdown()
    if not frames:
        return None
    cache.mkdir(parents=True, exist_ok=True)
    out = cache / (key + ".webm")
    if not encode_webm(ff, frames, out, crf="28"):
        return None
    frames.sort()
    (cache / (key + ".jpg")).write_bytes(base64.b64decode(frames[0][1]))
    return out.read_bytes(), (cache / (key + ".jpg")).read_bytes()


# en-tête du site en haut de chaque maquette (modulePage) : le même que Dot Page, Dot Companion et Dot Release,
# ajouté par le build (une seule source pour les 19 maquettes). Styles rangés sous .site-top pour ne pas se mêler
# à ceux des maquettes ; aucun bouton allumé (une maquette n'est pas une page du menu).
SITE_TOP = """
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap">
<style>
.site-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; font-family: "Segoe UI", Selawik, system-ui, sans-serif; font-size: 16px; line-height: 1.55; color: #f2f0e9; }
.site-top .brand { display: flex; align-items: center; gap: 10px; height: 42px; font-weight: 700; letter-spacing: .22em; font-size: 15px; color: #f2f0e9; text-decoration: none; }
.site-top .brand::before { content: ""; width: 12px; height: 12px; border-radius: 50%; background: #10b981; }
.site-top .topr { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
.site-top .ext { font-family: "Fira Code", "Cascadia Mono", Consolas, monospace; font-size: 13px; line-height: 1.55; letter-spacing: .16em; text-transform: uppercase; color: #b8b6b0; text-decoration: none; padding: 10px 16px; border: 1px solid #1f1f1f; border-radius: 999px; background: #080808; }
.site-top .ext:hover { color: #f2f0e9; border-color: #333; }
.site-top .lang { display: flex; gap: 4px; padding: 4px; border: 1px solid #1f1f1f; border-radius: 999px; background: #080808; }
.site-top .chip { height: auto; margin: 0; font-family: "Fira Code", "Cascadia Mono", Consolas, monospace; font-size: 12px; font-weight: 400; line-height: normal; letter-spacing: .16em; text-transform: uppercase; padding: 6px 12px; border-radius: 999px; border: 0; background: #080808; color: #b8b6b0; cursor: pointer; overflow: visible; white-space: nowrap; }
.site-top .chip[aria-pressed="true"] { background: #f2f0e9; color: #080808; border: 0; }
.site-top a:focus-visible, .site-top button:focus-visible { outline: 2px solid #10b981; outline-offset: 3px; }
</style>
<div class="top site-top">
  <a class="brand" href="__HOME__">DOT HUB</a>
  <div class="topr">
    <div class="lang" role="group" aria-label="Language">
      <button type="button" class="chip" data-lang="fr" aria-pressed="false">FR</button>
      <button type="button" class="chip" data-lang="en" aria-pressed="false">EN</button>
    </div>
    <a class="ext" href="__COMPANION__">Companion</a>
    <a class="ext" href="__RELEASES__">Releases</a>
    <a class="ext" href="https://github.com/Mathod95/xeneon" target="_blank" rel="noopener">GitHub ↗</a>
  </div>
</div>
<script>
(function () {
  // même choix de langue que le site (gardé dans le navigateur) ; la maquette elle-même reste en français
  var chips = document.querySelectorAll(".site-top .chip"), lang;
  try { lang = localStorage.getItem("dotpage-lang"); } catch (e) {}
  lang = lang || ((navigator.language || "en").slice(0, 2) === "fr" ? "fr" : "en");
  function show() { chips.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false"); }); }
  chips.forEach(function (b) { b.addEventListener("click", function () { lang = b.getAttribute("data-lang"); try { localStorage.setItem("dotpage-lang", lang); } catch (e) {} show(); }); });
  show();
})();
</script>
"""


def with_site_top(html, urls):
    """La maquette avec l'en-tête du site en haut de sa page (juste après <div class="wrap">)."""
    top = SITE_TOP
    for k, v in urls.items():
        top = top.replace("__" + k + "__", v)
    return html.replace('<div class="wrap">', '<div class="wrap">' + top, 1)


# maquette de Dot Companion : companion/mockups/reference.html (base = racine du dépôt), avec les fichiers qu'elle charge
COMPANION_MOCKUP = ROOT / "companion" / "mockups" / "reference.html"
COMPANION_FILES = [
    "companion/web/settings.html",
    "companion/web/home.html",
    "companion/web/hub/module.js",
    "widgets/dot-clock/index.html",
    "widgets/dot-clock/styles",
    "widgets/dot-clock/scripts",
    "widgets/dot-clock/resources",
    "widgets/dot-steam/index.html",
    "widgets/dot-steam/styles",
    "widgets/dot-steam/scripts",
    "widgets/dot-steam/resources",
    "widgets/dot-bambulab/index.html",
    "widgets/dot-bambulab/styles",
    "widgets/dot-bambulab/scripts",
]


def companion_mockup(out):
    out.mkdir(parents=True, exist_ok=True)
    html = COMPANION_MOCKUP.read_text(encoding="utf-8")
    html = html.replace('<base href="../../">\n', "").replace('<base href="../../">', "")
    html = with_site_top(html, {"HOME": "../", "COMPANION": "../companion/", "RELEASES": "../releases/"})
    (out / "index.html").write_text(html, encoding="utf-8")
    for f in COMPANION_FILES:
        dst = out / f
        dst.parent.mkdir(parents=True, exist_ok=True)
        if (ROOT / f).is_dir():
            shutil.copytree(ROOT / f, dst, dirs_exist_ok=True)
        else:
            shutil.copy(ROOT / f, dst)


def links(page, urls, target):
    """Boutons qui relient les pages : sur le site, liens relatifs ; dans les artefacts, adresses des artefacts."""
    for k, u in urls.items():
        page = page.replace("__" + k + "_TARGET__", target).replace("__" + k + "__", u)
    return page


def releases(urls, target, title):
    data = json.dumps(json.loads(RELEASES_DATA.read_text(encoding="utf-8")), ensure_ascii=False).replace("</", "<\\/")
    page = RELEASES_TEMPLATE.read_text(encoding="utf-8")
    return links(page.replace("__DATA__", data).replace("__TITLE__", title), urls, target)


# vidéo WebM à partir d'images horodatées (vidéo des réglages de Dot Companion)
def encode_webm(ff, frames, out, crop=None, fps=25, crf="32"):
    """Images JPEG horodatées (temps réel) -> WebM VP9 à cadence fixe. True si le fichier est écrit."""
    import subprocess
    frames = sorted(frames)
    t0, t1 = frames[0][0], frames[-1][0]
    vf = ["-vf", "crop=%d:%d:%d:%d" % crop] if crop else []
    cmd = [ff, "-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", str(fps), "-i", "pipe:0", *vf,
           "-c:v", "libvpx-vp9", "-crf", crf, "-b:v", "0", "-deadline", "good", "-cpu-used", "4", "-row-mt", "1",
           "-pix_fmt", "yuv420p", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    i = 0
    for k in range(int((t1 - t0) * fps) + 1):
        t = t0 + k / fps
        while i + 1 < len(frames) and frames[i + 1][0] <= t:
            i += 1
        proc.stdin.write(base64.b64decode(frames[i][1]))
    proc.stdin.close()
    return proc.wait() == 0 and pathlib.Path(out).exists()



# rendus en direct dans la Showcase de Dot Page : le module expose window.<Nom>.mount(scène, { size, settings, animate })
# dans scripts/<fichier>.js, avec ses styles rangés sous .dot-<fichier> dans styles/<fichier>.css (une seule source avec la
# maquette). Dot Page les intègre dans la page ; ailleurs, la capture fixe.
LIVE_MODULES = {
    "dot-clock": ("clock", "DotClock", ["font"]),   # police à points chargée avant le rendu
    "dot-audio": ("audio", "DotAudio"),
    "dot-spotify": ("spotify", "DotSpotify"),
    "dot-bambulab": ("bambulab", "DotBambuLab"),
    "dot-plex": ("plex", "DotPlex"),
    "dot-github": ("github", "DotGitHub"),
    "dot-glucose": ("glucose", "DotGlucose"),
}


def live_modules():
    """({slug: {global, css}}, scripts concaténés) des modules rendus en direct sur Dot Page."""
    meta, js = {}, []
    for slug, entry in LIVE_MODULES.items():
        name, glob, deps = (entry + ([],))[:3]
        base = ROOT / "widgets" / slug
        css, scripts = base / "styles" / (name + ".css"), [base / "scripts" / (d + ".js") for d in deps + [name]]
        if css.is_file() and all(f.is_file() for f in scripts):
            # les @font-face ne marchent pas dans un Shadow DOM : Dot Page charge déjà Fira Code
            text = re.sub(r"@font-face\s*\{[^}]*\}\s*", "", css.read_text(encoding="utf-8"))
            meta[slug] = {"global": glob, "css": text}
            js.extend(f.read_text(encoding="utf-8") for f in scripts)
    return meta, "\n".join(js)

def companion(urls, target, title):
    return links(COMPANION_TEMPLATE.read_text(encoding="utf-8").replace("__TITLE__", title), urls, target)


def settings_media(mockup_dir):
    """{nom de fichier: contenu} de la page de réglages montrée par Dot Companion : vidéo et image d'attente, ou capture seule."""
    demo = settings_demo(mockup_dir)
    if demo:
        return {"settings.webm": demo[0], "settings.jpg": demo[1]}
    shot = settings_shot(mockup_dir)
    return {"settings.jpg": shot} if shot else {}


def document(full):
    """Page complète à partir d'un fragment (le style va dans <head>)."""
    cut = full.index('<div class="wrap">')
    return (
        "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        + full[:cut] + "</head>\n<body>\n" + full[cut:] + "\n</body>\n</html>\n"
    )


def home(base, title, shots, urls=None, rel_target=""):
    urls = urls or {"RELEASES": "releases/", "COMPANION": "companion/"}
    data = json.dumps(widgets(), ensure_ascii=False).replace("</", "<\\/")
    prev = json.dumps(shots).replace("</", "<\\/")
    meta, live_js = live_modules()
    live = json.dumps(meta, ensure_ascii=False).replace("</", "<\\/")
    page = TEMPLATE.read_text(encoding="utf-8")
    page = (page.replace("__DATA__", data).replace("__PREVIEWS__", prev).replace("__LIVE__", live)
            .replace("__LIVE_JS__", live_js.replace("</script", "<\\/script"))
            .replace("__BASE__", base).replace("__TITLE__", title))
    return links(page, urls, rel_target)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fragment")
    ap.add_argument("--releases-fragment")
    ap.add_argument("--companion-fragment")
    ap.add_argument("--companion-mockup", help="dossier : la maquette de Dot Companion et ses fichiers, pour l'artefact")
    args = ap.parse_args()

    # artefacts : les boutons mènent aux autres artefacts
    art = {"HOME": ARTIFACT_PAGE, "RELEASES": ARTIFACT_RELEASE, "COMPANION": ARTIFACT_COMPANION, "MOCKUP": ARTIFACT_COMPANION_MOCKUP}
    if args.releases_fragment:
        pathlib.Path(args.releases_fragment).write_text(releases(art, BLANK, "Dot Release"), encoding="utf-8")
    if args.companion_fragment:
        # artefact d'un seul fichier : la vidéo et son image d'attente intégrées dans la page
        import tempfile
        page = companion(art, BLANK, "Dot Companion")
        with tempfile.TemporaryDirectory() as tmp:
            companion_mockup(pathlib.Path(tmp) / "m")
            media = settings_media(pathlib.Path(tmp) / "m")
        for name, mime in (("settings.webm", "video/webm"), ("settings.jpg", "image/jpeg")):
            if name in media:
                page = page.replace('"' + name + '"', '"data:' + mime + ";base64," + base64.b64encode(media[name]).decode() + '"')
        pathlib.Path(args.companion_fragment).write_text(page, encoding="utf-8")
    if args.companion_mockup:
        companion_mockup(pathlib.Path(args.companion_mockup))
    if (args.releases_fragment or args.companion_fragment or args.companion_mockup) and not args.fragment:
        return

    slugs = [w["slug"] for w in widgets() if w["mockup"]]
    shots = previews(slugs)

    if args.fragment:
        # les modules rendus en direct n'ont pas besoin de leur capture dans la page
        uris = {k: "data:image/jpeg;base64," + base64.b64encode(v).decode() for k, v in shots.items() if k not in live_modules()[0]}
        pathlib.Path(args.fragment).write_text(home(LIVE, "Dot Page", uris, art, BLANK), encoding="utf-8")
        return

    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir()
    count = 0
    for ref in sorted(ROOT.glob("widgets/*/mockups/reference.html")):
        slug = ref.parent.parent.name
        (SITE / slug).mkdir()
        html = ref.read_text(encoding="utf-8")
        if '<base href="../">' in html:
            # la maquette charge le vrai widget : on publie ses fichiers à côté, sans la base
            for sub in ("styles", "scripts", "resources"):
                src = ref.parent.parent / sub
                if src.is_dir():
                    shutil.copytree(src, SITE / slug / sub)
            # images du dossier mockups citées par la maquette (ex. capture réelle)
            for img in sorted(set(re.findall(r'(?:href|src)="mockups/([\w.-]+)"', html))):
                if (ref.parent / img).is_file():
                    (SITE / slug / "mockups").mkdir(exist_ok=True)
                    shutil.copy(ref.parent / img, SITE / slug / "mockups" / img)
            html = html.replace('<base href="../">\n', "").replace('<base href="../">', "")
        # la maquette charge les fichiers d'un autre widget (ex. Dot Hub affiche le vrai Dot Clock)
        for dep in sorted(set(re.findall(r'(?:href|src)="\.\./\.\./(dot-[\w-]+)/', html))):
            for sub in ("styles", "scripts", "resources"):
                src = ROOT / "widgets" / dep / sub
                if src.is_dir():
                    shutil.copytree(src, SITE / slug / dep / sub, dirs_exist_ok=True)
            html = html.replace('"../../' + dep + "/", '"' + dep + "/")
        html = with_site_top(html, {"HOME": "../", "COMPANION": "../companion/", "RELEASES": "../releases/"})
        (SITE / slug / "index.html").write_text(html, encoding="utf-8")
        if slug in shots:
            (SITE / slug / "preview.jpg").write_bytes(shots[slug])
        count += 1

    companion_mockup(SITE / "dot-companion")
    count += 1
    full = home("", "Dot Hub · Mathod", {k: k + "/preview.jpg" for k in shots})
    (SITE / "index.html").write_text(document(full), encoding="utf-8")
    sub = {"HOME": "../", "RELEASES": "../releases/", "COMPANION": "../companion/", "MOCKUP": "../dot-companion/"}
    (SITE / "releases").mkdir()
    (SITE / "releases" / "index.html").write_text(document(releases(sub, "", "Releases · Dot Hub")), encoding="utf-8")
    (SITE / "companion").mkdir()
    (SITE / "companion" / "index.html").write_text(document(companion(sub, "", "Dot Companion · Dot Hub")), encoding="utf-8")
    # la page de réglages en vidéo (sinon une capture fixe)
    for name, data in settings_media(SITE / "dot-companion").items():
        (SITE / "companion" / name).write_bytes(data)
    # charte, anatomie de chaque type de page (le fichier du dépôt et ses deux fichiers communs sont aussi ceux de l'artefact)
    for name in DESIGN_PAGES:
        out = SITE / "design" / name.lower()
        out.mkdir(parents=True)
        (out / "index.html").write_text(document((DESIGN / (name + ".html")).read_text(encoding="utf-8")), encoding="utf-8")
        for f in DESIGN_FILES:
            shutil.copy(DESIGN / f, out / f)
    # pages actuelles (docs/design/edge/, générées par tools/design_edge.py) : Dot Page, Dot Companion et Dot Release
    for name in ("homePage", "subPage", "releasePage", "modulePage"):
        src = DESIGN / "edge" / (name + ".html")
        if not src.is_file():
            continue
        out = SITE / "design" / "edge" / name.lower()
        out.mkdir(parents=True)
        (out / "index.html").write_text(document(src.read_text(encoding="utf-8").replace('"../anatomy.', '"anatomy.')), encoding="utf-8")
        for f in DESIGN_FILES:
            shutil.copy(DESIGN / f, out / f)
    print(f"{len(widgets())} widget(s), {count} maquette(s) -> {SITE}")


if __name__ == "__main__":
    main()
