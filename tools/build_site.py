#!/usr/bin/env python3
"""Construit le site GitHub Pages.

- site/index.html : page d'accueil (tools/site/index.html) remplie avec la liste
  des widgets du README, leur statut et la présence d'une maquette ;
- site/<slug>/index.html : copie de widgets/<slug>/mockups/reference.html.

- site/releases/index.html : Dot Release, les versions (tools/site/releases.html,
  données dans tools/site/releases.json).

Option --fragment FICHIER : écrit seulement la page d'accueil, sans en-tête HTML,
avec des liens absolus vers le site en ligne (pour l'aperçu en artefact).
Option --releases-fragment FICHIER : pareil pour Dot Release.
"""
import argparse
import base64
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
ARTIFACT_PAGE = "https://claude.ai/artifact/Fvc7r4TmmuaMhB9BPvc1Wo"
ARTIFACT_RELEASE = "https://claude.ai/artifact/UZKaJbjN2o7HXNDCtsuyBd"
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
  const frame = document.getElementById('frame') || document.getElementById('frameXL');
  const stage = document.getElementById('stage') || document.getElementById('stageXL') || document.getElementById('hub');
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
            stage = page.locator("#stage, #stageXL, #hub").first
            out[slug] = stage.screenshot(type="jpeg", quality=88)
        browser.close()
    return out


def releases(home_url, target, title):
    data = json.dumps(json.loads(RELEASES_DATA.read_text(encoding="utf-8")), ensure_ascii=False).replace("</", "<\\/")
    page = RELEASES_TEMPLATE.read_text(encoding="utf-8")
    return (page.replace("__DATA__", data).replace("__HOME_TARGET__", target)
            .replace("__HOME__", home_url).replace("__TITLE__", title))


def document(full):
    """Page complète à partir d'un fragment (le style va dans <head>)."""
    cut = full.index('<div class="wrap">')
    return (
        "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        + full[:cut] + "</head>\n<body>\n" + full[cut:] + "\n</body>\n</html>\n"
    )


def home(base, title, shots, rel_url="releases/", rel_target=""):
    data = json.dumps(widgets(), ensure_ascii=False).replace("</", "<\\/")
    prev = json.dumps(shots).replace("</", "<\\/")
    page = TEMPLATE.read_text(encoding="utf-8")
    return (page.replace("__DATA__", data).replace("__PREVIEWS__", prev)
            .replace("__BASE__", base).replace("__TITLE__", title)
            .replace("__RELEASES_TARGET__", rel_target).replace("__RELEASES__", rel_url))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fragment")
    ap.add_argument("--releases-fragment")
    args = ap.parse_args()

    if args.releases_fragment:
        pathlib.Path(args.releases_fragment).write_text(releases(ARTIFACT_PAGE, BLANK, "Dot Release"), encoding="utf-8")
        if not args.fragment:
            return

    slugs = [w["slug"] for w in widgets() if w["mockup"]]
    shots = previews(slugs)

    if args.fragment:
        uris = {k: "data:image/jpeg;base64," + base64.b64encode(v).decode() for k, v in shots.items()}
        pathlib.Path(args.fragment).write_text(home(LIVE, "Dot Page", uris, ARTIFACT_RELEASE, BLANK), encoding="utf-8")
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
        (SITE / slug / "index.html").write_text(html, encoding="utf-8")
        if slug in shots:
            (SITE / slug / "preview.jpg").write_bytes(shots[slug])
        count += 1

    full = home("", "Dot Hub · Mathod", {k: k + "/preview.jpg" for k in shots})
    (SITE / "index.html").write_text(document(full), encoding="utf-8")
    (SITE / "releases").mkdir()
    (SITE / "releases" / "index.html").write_text(document(releases("../", "", "Releases · Dot Hub")), encoding="utf-8")
    print(f"{len(widgets())} widget(s), {count} maquette(s) -> {SITE}")


if __name__ == "__main__":
    main()
