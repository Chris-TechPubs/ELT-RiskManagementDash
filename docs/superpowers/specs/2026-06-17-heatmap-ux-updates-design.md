# ELT Heatmap UX Updates — Design Spec
**Date:** 2026-06-17
**Status:** Approved

---

## Overview

Three coordinated UI improvements to the ELT Risk Heatmap dashboard, targeting a cleaner, more corporate-modern appearance for the leadership audience. All changes are confined to `templates/heatmap.html`.

---

## Change 1 — Graph: 0,0 Origin + No Sub-1.0 Axis Labels + Rounded Corners

### 0,0 Origin
- Change the default `VR` from `{ xMin: 0.25, xMax: 5, yMin: 0.25, yMax: 5 }` to `{ xMin: 0, xMax: 5, yMin: 0, yMax: 5 }`.
- Update `resetView()` to match: `VR = { xMin: 0, xMax: 5, yMin: 0, yMax: 5 }`.
- Update pan clamping floors in the `mousemove` handler: `if (VR.xMin < 0)` / `if (VR.yMin < 0)` (from `0.25`).
- Update zoom clamping floors in `doZoom()`: same four clamp lines, change `0.25` → `0`.
- No logic changes needed for axis labels — the existing `if (v >= 0.99)` guard in `renderStatic()` already suppresses labels for values below 1.0.
- The gradient anchor (`updateGradientCoords()`) already calls `svgX(0)` / `svgY(0)`, so green correctly fills the new bottom-left corner at `(0,0)`.

### Rounded Corners (20px)
Three elements must all get `rx=20 ry=20` together — if any one is missed, corners will visually mismatch:

1. **Fill rect** in `renderStatic()`: `mk('rect', { x, y, width: w, height: h, fill: 'url(#gDiag)', rx: 20, ry: 20 }, layer)`
2. **Border rect** in `renderStatic()`: `mk('rect', { x, y, width: w, height: h, fill: 'none', stroke: ..., rx: 20, ry: 20 }, layer)`
3. **ClipPath rect** in the HTML `<defs>`: `<rect x="130" y="20" width="600" height="680" rx="20" ry="20"/>` — this is critical so dots/labels cannot bleed into the visually-rounded corners.

---

## Change 2 — Wider Risk List Card

### Sizing
- **Current:** `CARD_W = 293`, card left edge x≈738, right edge x≈1031.
- **New:** `CARD_W = 490`, right edge x≈1228 — visually aligns with where the category card currently ends.
- `CARD_PADX` stays at `40`. All other card geometry (`CARD_TPAD`, `HDR_H`, `RISK_H`, `fontSize`) unchanged.

### Name Truncation
- Remove the hard 44-character truncation (`r.name.length > 44 ? r.name.slice(0,42)+'…' : r.name`).
- Replace with: `r.name.length > 72 ? r.name.slice(0, 70) + '…' : r.name`
- The existing `risk-list-clip` clipPath already clips text at the card boundary, so overflow is naturally handled. The 72-char soft limit prevents extremely long names from being entirely unreadable if they do truncate.

### Clip rect
- The `risk-list-clip` clipPath rect in `renderLegend()` must update its `width` from `CARD_W` (old 293) to the new 490 to match the wider card.

---

## Change 3 — Category Filter Dropdown (HTML Overlay)

### What Gets Removed
- The entire category filter card SVG block in `renderLegend()` — the outer `mk('rect', ...)` background, the "Categories / Filter" header text, the divider line, and the `CAT_LABELS.forEach(...)` loop that builds the eye-icon rows.
- The `catKeyElByColor` object is no longer populated from SVG elements, but the `_hiddenCatColors` Set and `updateCatFilter()` function remain unchanged.

### HTML Structure (added to `<body>`)
```html
<div id="cat-filter-wrap">
  <button id="cat-filter-btn">
    <span id="cat-filter-dot">⬡</span>
    <span id="cat-filter-label">All Categories</span>
    <span id="cat-filter-chevron">▾</span>
  </button>
  <div id="cat-dropdown">
    <!-- rows injected by buildCatDropdown() -->
  </div>
</div>
```

### Positioning
- `positionCatFilter()` reads `hm.getBoundingClientRect()` and the SVG scale factor to map the risk list header row's SVG coordinates (`LEG_X`, `P.y + CARD_TPAD + HDR_H`) into screen pixels.
- Called on initial render and `window.addEventListener('resize', ...)`.
- `cat-filter-wrap` uses `position: fixed` (same as `#zoom-ctrl`).

### CSS Styling (corporate/dark)
```css
#cat-filter-wrap { position: fixed; z-index: 200; }

#cat-filter-btn {
  display: flex; align-items: center; gap: 7px;
  background: #2D2D2E; border: 1px solid #3F3F40;
  border-radius: 20px; padding: 4px 12px 4px 10px;
  color: #E8EAED; font-size: 11px; font-weight: 600;
  cursor: pointer; font-family: 'Roboto', sans-serif;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  transition: filter 0.15s;
}
#cat-filter-btn:hover { filter: brightness(1.15); }
#cat-filter-btn.filtered { border-color: #6699cc; color: #a8c0ff; }

#cat-dropdown {
  display: none; position: absolute; top: calc(100% + 6px); left: 0;
  background: #2D2D2E; border: 1px solid #3F3F40;
  border-radius: 10px; padding: 6px 0;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  min-width: 220px; z-index: 300;
}
#cat-dropdown.open { display: block; }

.cat-dd-row {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 14px; cursor: pointer;
  transition: background 0.12s;
}
.cat-dd-row:hover { background: rgba(255,255,255,0.06); }
.cat-dd-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
.cat-dd-label { flex: 1; font-size: 11px; font-weight: 600;
                font-family: 'Roboto', sans-serif; }
.cat-dd-check { font-size: 13px; color: #E8EAED;
                transition: opacity 0.15s; opacity: 1; }
.cat-dd-row.off .cat-dd-label { opacity: 0.38; }
.cat-dd-row.off .cat-dd-check { opacity: 0; }
```

### JavaScript

**`buildCatDropdown()`** — called once at init, creates one `.cat-dd-row` per `CAT_LABELS` entry:
- Sets `data-color` attribute on each row
- Click handler: toggle color in `_hiddenCatColors`, call `updateCatFilter()`, call `updateCatFilterBtn()`
- Populates `catKeyElByColor[col]` with the HTML row element so `updateCatFilter()` can toggle the `.off` class (replaces the SVG cat card element references). **`updateCatFilter()` must change its toggled class from `cat-filter-off` to `off`** to match the HTML row styling.

**`updateCatFilterBtn()`** — updates button label and `.filtered` class:
- If `_hiddenCatColors.size === 0`: label = "All Categories", remove `.filtered`
- Else: label = `${CAT_LABELS.length - _hiddenCatColors.size} of ${CAT_LABELS.length}`, add `.filtered`

**`updateCatFilter()`** — existing function, one change: replace `.cat-filter-off` with `.off` in the `classList.toggle` call. The `catKeyElByColor` entries now point to HTML `.cat-dd-row` elements instead of SVG `<g>` elements.

**Dropdown open/close:**
```js
document.getElementById('cat-filter-btn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('cat-dropdown').classList.toggle('open');
});
document.addEventListener('click', () => {
  document.getElementById('cat-dropdown').classList.remove('open');
});
```

---

## Files Changed
- `templates/heatmap.html` — all changes

## Files Removed from Rendering
- No files deleted; the SVG category card rendering block inside `renderLegend()` is simply removed.

---

## Out of Scope
- No changes to `app.py`, `smartsheet_client.py`, or deployment config.
- No changes to the modal, tooltip, zoom controls, or label placement algorithm.
- No changes to pan performance or `_fastRerender()`.
