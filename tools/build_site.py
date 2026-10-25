#!/usr/bin/env python3
"""Construit le site GitHub Pages.

- site/index.html : page d'accueil (tools/site/index.html) remplie avec la liste
  des widgets du README, leur statut et la présence d'une maquette ;
- site/<slug>/index.html : copie de widgets/<slug>/mockups/reference.html.

Option --fragment FICHIER : écrit seulement la page d'accueil, sans en-tête HTML,
avec des liens absolus vers le site en ligne (pour l'aperçu en artefact).
"""
import argparse
import json
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
TEMPLATE = ROOT / "tools" / "site" / "index.html"
LIVE = "https://mathod95.github.io/xeneon/"


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
    for line in text.splitlines():
        m = re.match(r"\|\s*\[(.+?)\]\(widgets/([\w-]+)\)\s*\|(.*)\|(.*)\|\s*$", line)
        if not m:
            continue
        name, slug, desc, comp = m.group(1), m.group(2), m.group(3).strip(), m.group(4).strip()
        label, kind = status_of(slug)
        rows.append({
            "name": name,
            "slug": slug,
            "desc": desc,
            "comp": comp,
            "status": label,
            "kind": kind,
            "mockup": (ROOT / "widgets" / slug / "mockups" / "reference.html").exists(),
        })
    return rows


def home(base, title):
    data = json.dumps(widgets(), ensure_ascii=False).replace("</", "<\\/")
    page = TEMPLATE.read_text(encoding="utf-8")
    return page.replace("__DATA__", data).replace("__BASE__", base).replace("__TITLE__", title)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fragment")
    args = ap.parse_args()

    if args.fragment:
        pathlib.Path(args.fragment).write_text(home(LIVE, "Dot Page"), encoding="utf-8")
        return

    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir()
    count = 0
    for ref in sorted(ROOT.glob("widgets/*/mockups/reference.html")):
        slug = ref.parent.parent.name
        (SITE / slug).mkdir()
        shutil.copyfile(ref, SITE / slug / "index.html")
        count += 1

    full = home("", "Dot Widgets · Mathod")
    cut = full.index('<div class="wrap">')
    page = (
        "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        + full[:cut] + "</head>\n<body>\n" + full[cut:] + "\n</body>\n</html>\n"
    )
    (SITE / "index.html").write_text(page, encoding="utf-8")
    print(f"{len(widgets())} widget(s), {count} maquette(s) -> {SITE}")


if __name__ == "__main__":
    main()
