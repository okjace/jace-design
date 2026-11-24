// Combine two people's edits to the same design without asking anyone.
// base = the version both started from, ours = this editor's, theirs = what's saved now.
// Per page and per element: whoever changed it wins; if both did, ours wins. Adds and deletes on both sides are kept.

// Compare what people actually edited. Text line breaks and heights are measured by each computer from the
// fonts it has, so they can differ between two people without anyone changing anything: ignore them.
function stable(v) {
  return JSON.stringify(v, function (key, value) {
    if (key === 'lines') return undefined;
    if (key === 'h' && this && this.type === 'text') return undefined;
    return value;
  });
}
const same = (a, b) => a === b || stable(a) === stable(b);
const byId = (list) => new Map((list || []).map((x) => [x.id, x]));

function pick(base, ours, theirs) {
  if (same(ours, base)) return theirs;
  return ours;
}

/** Merge lists of things with ids (pages, elements). mergeItem(b, o, t) merges one item present on both sides. */
function mergeList(base = [], ours = [], theirs = [], mergeItem = (b, o, t) => pick(b, o, t)) {
  const B = byId(base), O = byId(ours), T = byId(theirs);
  const out = [];
  // Start from their order, dropping what we deleted (unless they changed it since).
  for (const t of theirs) {
    const b = B.get(t.id), o = O.get(t.id);
    if (!o) {
      if (b && same(b, t)) continue; // we deleted it and they didn't touch it
      out.push(t); // they added it, or changed something we deleted: keep their work
      continue;
    }
    out.push(b ? mergeItem(b, o, t) : o);
  }
  // Add what we added, next to where it sits in ours.
  ours.forEach((o, i) => {
    if (T.has(o.id)) return;
    if (B.has(o.id)) { if (!same(B.get(o.id), o)) out.push(o); return; } // they deleted it but we changed it: keep ours
    const prev = ours.slice(0, i).reverse().find((x) => out.some((y) => y.id === x.id));
    const at = prev ? out.findIndex((y) => y.id === prev.id) + 1 : 0;
    out.splice(at, 0, o);
  });
  // Our own reordering wins when they didn't reorder.
  const ids = (l) => l.map((x) => x.id).join(',');
  if (ids(base) === ids(theirs) && ids(base) !== ids(ours)) {
    const order = new Map(ours.map((x, i) => [x.id, i]));
    out.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  }
  return out;
}

function mergePage(b, o, t) {
  const page = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(t)])) {
    if (k === 'elements') continue;
    page[k] = pick(b[k], o[k], t[k]);
  }
  page.elements = mergeList(b.elements, o.elements, t.elements);
  return page;
}

/** Merge whole designs (pages/elements). Documents and spreadsheets: ours wins. */
export function mergeDesigns(base, ours, theirs) {
  if (!base || !theirs || ours?.kind === 'doc' || ours?.kind === 'sheet') return ours;
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])) {
    if (k === 'pages' || k === 'assets') continue;
    out[k] = pick(base[k], ours[k], theirs[k]);
  }
  out.pages = mergeList(base.pages, ours.pages, theirs.pages, mergePage);
  out.assets = mergeList(base.assets, ours.assets, theirs.assets);
  return out;
}
