#!/usr/bin/env python3
"""Construit le site GitHub Pages à partir des maquettes de référence.

Chaque widgets/<slug>/mockups/reference.html est copié dans site/<slug>/index.html,
et site/index.html liste les maquettes trouvées.
"""
import html
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"


def widget_info(widget_dir):
    readme = widget_dir / "README.md"
    name = widget_dir.name.replace("-", " ").title()
    status = ""
    if readme.exists():
        text = readme.read_text(encoding="utf-8")
        m = re.search(r"^# (.+)$", text, re.M)
        if m:
            name = m.group(1).strip()
        m = re.search(r"\*\*Statut :\*\*\s*(.+)$", text, re.M)
        if m:
            status = m.group(1).strip()
    return name, status


def main():
    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir()

    items = []
    for ref in sorted(ROOT.glob("widgets/*/mockups/reference.html")):
        widget_dir = ref.parent.parent
        slug = widget_dir.name
        (SITE / slug).mkdir()
        shutil.copyfile(ref, SITE / slug / "index.html")
        name, status = widget_info(widget_dir)
        items.append(
            f'<a class="card" href="{slug}/"><span class="name">{html.escape(name)}</span>'
            f'<span class="status">{html.escape(status)}</span></a>'
        )

    page = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Xeneon Widgets</title>
<style>
  :root {{ --page:#111111; --card:#080808; --line:#1C1C1C; --text:#F2F0E9; --muted:#B8B6B0; --accent:#10B981; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--page); color:var(--text);
         font-family:"Segoe UI", Selawik, system-ui, sans-serif; }}
  main {{ max-width:960px; margin:0 auto; padding:48px 16px; }}
  .brand {{ display:flex; align-items:center; gap:10px; font-weight:700; letter-spacing:.2em; }}
  .brand::before {{ content:""; width:12px; height:12px; border-radius:50%; background:var(--accent); }}
  h1 {{ font-size:32px; margin:32px 0 4px; }}
  p {{ color:var(--muted); margin:0 0 32px; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:16px; }}
  .card {{ display:flex; flex-direction:column; gap:8px; padding:24px; background:var(--card);
          border:1px solid var(--line); border-radius:12px; color:inherit; text-decoration:none; }}
  .card:hover {{ border-color:var(--accent); }}
  .name {{ font-size:20px; font-weight:700; }}
  .status {{ color:var(--muted); font-size:14px; }}
</style>
</head>
<body>
<main>
  <div class="brand">MATHOD</div>
  <h1>Xeneon Widgets</h1>
  <p>Maquettes de référence des widgets iCUE pour la CORSAIR XENEON EDGE.</p>
  <div class="grid">
    {chr(10).join("    " + i for i in items).strip()}
  </div>
</main>
</body>
</html>
"""
    (SITE / "index.html").write_text(page, encoding="utf-8")
    print(f"{len(items)} maquette(s) -> {SITE}")


if __name__ == "__main__":
    main()
