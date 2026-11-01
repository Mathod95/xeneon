// Mesure des zones d'une page de la charte (tools/design_edge.py) : pour chaque [data-zone] de #mini et chaque [data-part], police, marges, bords, mise en page.
() => {
  const mini = document.getElementById("mini");
  const hex = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c; const p = m[1].split(",").map(x => parseFloat(x));
    if (p.length === 4 && p[3] === 0) return null; const h = "#" + p.slice(0,3).map(v => Math.round(v).toString(16).padStart(2,"0")).join("").toUpperCase();
    return p.length === 4 && p[3] < 1 ? h + " à " + Math.round(p[3]*100) + " %" : h; };
  const px = v => { const n = parseFloat(v); return isNaN(n) ? v : (Math.round(n*10)/10) + ""; };
  const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  function text(el) {
    const c = getComputedStyle(el), fs = parseFloat(c.fontSize);
    const lh = c.lineHeight === "normal" ? "normal" : px(c.lineHeight) + " px";
    const ls = parseFloat(c.letterSpacing) ? (Math.round(parseFloat(c.letterSpacing)/fs*100)/100 + "em").replace(/^0\./, ".") : null;
    return { font: c.fontFamily.split(",")[0].replace(/"/g, ""), size: px(fs), lh, weight: c.fontWeight, ls,
      upper: c.textTransform === "uppercase", color: hex(c.color), align: c.textAlign, wrap: c.whiteSpace, ellipsis: c.textOverflow === "ellipsis" };
  }
  function box(el) {
    const c = getComputedStyle(el), o = {};
    const pad = [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].map(px);
    if (pad.some(v => v !== "0")) o.pad = pad;
    if (parseFloat(c.borderTopWidth)) o.border = { w: px(c.borderTopWidth), style: c.borderTopStyle, color: hex(c.borderTopColor) };
    else if (parseFloat(c.borderLeftWidth)) o.borderLeft = px(c.borderLeftWidth) + " px " + hex(c.borderLeftColor);
    else if (parseFloat(c.borderTopWidth) === 0 && parseFloat(c.borderBottomWidth)) o.borderBottom = px(c.borderBottomWidth) + " px " + hex(c.borderBottomColor);
    if (parseFloat(c.borderTopWidth) && c.borderTopWidth !== c.borderBottomWidth) o.borderTopOnly = true;
    const r = c.borderRadius; if (r && r !== "0px") o.radius = r.split(" ").map(px);
    const bg = hex(c.backgroundColor); if (bg) o.bg = bg;
    if (c.backgroundImage && c.backgroundImage !== "none") o.bgimg = c.backgroundImage.slice(0, 60);
    if (c.display.includes("grid")) { o.layout = "grid"; o.cols = c.gridTemplateColumns.split(" ").length; o.gap = [px(c.rowGap), px(c.columnGap)]; }
    else if (c.display.includes("flex")) { o.layout = "flex " + c.flexDirection; o.gap = [px(c.rowGap), px(c.columnGap)]; o.justify = c.justifyContent; o.alignItems = c.alignItems; }
    o.w = el.offsetWidth; o.h = el.offsetHeight;
    if (c.maxWidth !== "none") o.maxw = px(c.maxWidth);
    return o;
  }
  const bef = d => { const b = getComputedStyle(d, "::before"); return b.content !== "none" && b.content !== "normal" ? { w: px(b.width), h: px(b.height), bg: hex(b.backgroundColor), radius: b.borderRadius, content: b.content.slice(0, 20) } : null; };
  const sig = el => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).filter(k => k !== "first" && k !== "on" && k !== "cur" && k !== "is-part").join(".") : "");
  const out = [];
  [...mini.querySelectorAll("[data-zone]")].forEach(zone => {
    const z = { id: zone.dataset.zone, box: box(zone), items: [], structs: [] };
    if (z.box.radius && z.box.radius.join(" ") === "14") delete z.box.radius;
    let items = [...zone.querySelectorAll("[data-part]")];
    let byPart = true;
    if (!items.length) { byPart = false; items = [...zone.querySelectorAll("[data-sk]")].filter(e => !e.parentElement.closest("[data-sk]") ); }
    items.forEach(el => {
      const it = { label: byPart ? el.dataset.part : el.dataset.sk, sel: sig(el), box: box(el), text: ownText(el) ? text(el) : null, subs: [], before: bef(el) };
      if (el.closest(".hero")) delete it.box.radius;
      if (el.tagName === "CANVAS" || el.querySelector(":scope > canvas")) { const cv = el.tagName === "CANVAS" ? el : el.querySelector("canvas"); it.canvas = cv.offsetWidth + " × " + cv.offsetHeight; }
      const seen = new Set();
      [...el.querySelectorAll("*")].sort((a, b) => (a.matches(".on,.cur") ? 1 : 0) - (b.matches(".on,.cur") ? 1 : 0)).forEach(d => {
        if (d.classList.contains("badge") || d.closest(".badge")) return;
        if (!ownText(d) && !["CANVAS","LI","I"].includes(d.tagName)) { if (!(getComputedStyle(d).borderTopWidth !== "0px" || getComputedStyle(d, "::before").content !== "none")) return; }
        const s = sig(d); if (seen.has(s)) return; seen.add(s);
        it.subs.push({ sel: s, text: ownText(d) ? text(d) : null, box: box(d), before: bef(d) });
      });
      it.subs = it.subs.slice(0, 10);
      z.items.push(it);
    });
    const inItem = d => items.some(i => i === d || i.contains(d));
    const seenS = new Set();
    [...zone.querySelectorAll("*")].forEach(d => {
      if (d.classList.contains("badge") || inItem(d) || items.some(i => d.contains(i) && false)) return;
      const c = getComputedStyle(d);
      if (!(parseFloat(c.borderTopWidth) || hex(c.backgroundColor) || c.display.includes("grid"))) return;
      const sg = sig(d); if (seenS.has(sg) || ["canvas"].includes(d.tagName.toLowerCase())) return; seenS.add(sg);
      if (items.some(i => d.contains(i)) || !items.length || true) z.structs.push({ sel: sg, box: box(d), text: ownText(d) ? text(d) : null });
    });
    z.structs = z.structs.slice(0, 6);
    out.push(z);
  });
  return out;
}
