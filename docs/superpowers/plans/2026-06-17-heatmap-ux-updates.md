# ELT Heatmap UX Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four coordinated UX improvements to `templates/heatmap.html` — 0,0 graph origin, 20px rounded plot corners, wider risk list card, and a sleek HTML dropdown replacing the SVG category filter card.

**Architecture:** All changes are in a single file (`templates/heatmap.html`). The file is a self-contained Flask Jinja2 template containing inline CSS, inline SVG, and inline JavaScript. No build step, no bundler, no test framework — verification is manual in-browser against a running `python app.py` server. The HTML dropdown overlays the SVG using `position:fixed` and a `positionCatFilter()` function that maps SVG coordinates to screen pixels, identical to how `#zoom-ctrl` is positioned today.

**Tech Stack:** Flask 3.x (serves the template), vanilla JS/SVG, Roboto font (Google Fonts), no external JS libraries.

## Global Constraints

- All changes confined to `templates/heatmap.html` — no other files modified.
- No new dependencies, no CDN additions.
- Existing `_hiddenCatColors` Set, `updateCatFilter()`, and `catKeyElByColor` object must continue to work — only the elements stored in `catKeyElByColor` change from SVG `<g>` to HTML `.cat-dd-row` divs.
- Server runs on port 5001: `python app.py` → visit `http://localhost:5001`.
- SVG viewBox remains `0 0 1300 780`. Plot square `P = { x:130, y:20, w:600, h:680 }` unchanged.

---

## File Map

| File | What changes |
|------|-------------|
| `templates/heatmap.html` | All four changes — VR origin, rounded corners, CARD_W, dropdown |

---

### Task 1: GitHub backup + feature branch

**Files:**
- No source files changed — git operations only.

- [ ] **Step 1: Check git remote exists**

```powershell
cd C:\Users\cschweder\Documents\Coding\ELT_RiskManagmentDash
git remote -v
```
Expected: a line showing `origin` pointing to GitHub. If missing, run:
```powershell
git remote add origin https://github.com/<your-username>/ELT_RiskManagmentDash.git
```

- [ ] **Step 2: Push current master to GitHub as backup**

```powershell
git push -u origin master
```
Expected: `Branch 'master' set up to track remote branch 'master' from 'origin'.`

- [ ] **Step 3: Create and checkout feature branch**

```powershell
git checkout -b feature/heatmap-ux-updates
```
Expected: `Switched to a new branch 'feature/heatmap-ux-updates'`

- [ ] **Step 4: Verify clean working tree**

```powershell
git status
```
Expected: `nothing to commit, working tree clean`

---

### Task 2: Graph — 0,0 origin (VR + zoom + pan clamp fixes)

**Files:**
- Modify: `templates/heatmap.html` — 8 small edits to JS constants and clamp guards.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `VR` default `{xMin:0, xMax:5, yMin:0, yMax:5}`, zoom/pan/reset all clamped to 0 floor.

- [ ] **Step 1: Change default VR**

Find (line ~272):
```js
let VR = { xMin: 0.25, xMax: 5, yMin: 0.25, yMax: 5 };
```
Replace with:
```js
let VR = { xMin: 0, xMax: 5, yMin: 0, yMax: 5 };
```

- [ ] **Step 2: Change resetView()**

Find (line ~1127):
```js
function resetView() { VR = {xMin:0.25,xMax:5,yMin:0.25,yMax:5}; rerender(); }
```
Replace with:
```js
function resetView() { VR = {xMin:0,xMax:5,yMin:0,yMax:5}; rerender(); }
```

- [ ] **Step 3: Change zoom-out guard in doZoom()**

Find (line ~1116):
```js
if (nxMax - nxMin > 4.751 || nyMax - nyMin > 4.751) return;
```
Replace with:
```js
if (nxMax - nxMin > 5.001 || nyMax - nyMin > 5.001) return;
```
*(Old value 4.751 matched old range 0.25→5 = 4.75. New range 0→5 = 5.0, so guard becomes 5.001.)*

- [ ] **Step 4: Change doZoom() clamp floors**

Find (lines ~1120-1123):
```js
  if (VR.xMin < 0.25) { VR.xMin = 0.25; VR.xMax = 0.25 + _xrz; }
  if (VR.xMax > 5)    { VR.xMax = 5;    VR.xMin = 5 - _xrz; }
  if (VR.yMin < 0.25) { VR.yMin = 0.25; VR.yMax = 0.25 + _yrz; }
  if (VR.yMax > 5)    { VR.yMax = 5;    VR.yMin = 5 - _yrz; }
```
Replace with:
```js
  if (VR.xMin < 0) { VR.xMin = 0; VR.xMax = _xrz; }
  if (VR.xMax > 5) { VR.xMax = 5; VR.xMin = 5 - _xrz; }
  if (VR.yMin < 0) { VR.yMin = 0; VR.yMax = _yrz; }
  if (VR.yMax > 5) { VR.yMax = 5; VR.yMin = 5 - _yrz; }
```

- [ ] **Step 5: Change pan clamp floors in mousemove handler**

Find (lines ~1173-1178 in the mousemove handler, inside `window.addEventListener('mousemove', ...)`):
```js
  if (VR.xMin < 0.25) { VR.xMin = 0.25; VR.xMax = 0.25 + _xr; }
  if (VR.xMax > 5)    { VR.xMax = 5;    VR.xMin = 5 - _xr; }
  if (VR.yMin < 0.25) { VR.yMin = 0.25; VR.yMax = 0.25 + _yr; }
  if (VR.yMax > 5)    { VR.yMax = 5;    VR.yMin = 5 - _yr; }
```
Replace with:
```js
  if (VR.xMin < 0) { VR.xMin = 0; VR.xMax = _xr; }
  if (VR.xMax > 5) { VR.xMax = 5; VR.xMin = 5 - _xr; }
  if (VR.yMin < 0) { VR.yMin = 0; VR.yMax = _yr; }
  if (VR.yMax > 5) { VR.yMax = 5; VR.yMin = 5 - _yr; }
```

- [ ] **Step 6: Change panToRisk() clamp floors**

Find (lines ~244-245 inside `panToRisk`):
```js
  const tXMin = Math.max(0.25, Math.min(5 - rW, tx - rW / 2));
  const tYMin = Math.max(0.25, Math.min(5 - rH, ty - rH / 2));
```
Replace with:
```js
  const tXMin = Math.max(0, Math.min(5 - rW, tx - rW / 2));
  const tYMin = Math.max(0, Math.min(5 - rH, ty - rH / 2));
```

- [ ] **Step 7: Start server and verify in browser**

```powershell
cd C:\Users\cschweder\Documents\Coding\ELT_RiskManagmentDash
python app.py
```
Visit `http://localhost:5001`. Verify:
- The green corner of the gradient now starts at the physical bottom-left of the plot (0,0 is the origin).
- Axis labels start at 1.0 — no 0.0 or 0.5 labels visible.
- Clicking ⌂ (reset) returns to full 0–5 view.
- Scroll-wheel zoom outward stops at the 0–5 boundary (can't zoom past it).
- Dragging the chart doesn't scroll past 0 on either axis.

- [ ] **Step 8: Commit**

```powershell
git add templates/heatmap.html
git commit -m "feat: set graph origin to 0,0 with no sub-1.0 axis labels"
```

---

### Task 3: Graph — 20px rounded corners

**Files:**
- Modify: `templates/heatmap.html` — 3 edits (clipPath rect + 2 rects in renderStatic).

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: plot square with `rx=20 ry=20` on all three elements that must match.

- [ ] **Step 1: Update the clipPath rect in `<defs>`**

Find (lines ~151-154 in the `<defs>` block):
```html
    <clipPath id="chartClip">
      <!-- Clip to the exact plot area (P.x=130, P.y=20, P.w=600, P.h=680) -->
      <rect x="130" y="20" width="600" height="680"/>
    </clipPath>
```
Replace with:
```html
    <clipPath id="chartClip">
      <!-- Clip to the exact plot area (P.x=130, P.y=20, P.w=600, P.h=680) -->
      <rect x="130" y="20" width="600" height="680" rx="20" ry="20"/>
    </clipPath>
```

- [ ] **Step 2: Update gradient fill rect in renderStatic()**

Find (inside `renderStatic()`, line ~667):
```js
  mk('rect', { x, y, width: w, height: h, fill: 'url(#gDiag)' }, layer);
```
Replace with:
```js
  mk('rect', { x, y, width: w, height: h, fill: 'url(#gDiag)', rx: 20, ry: 20 }, layer);
```

- [ ] **Step 3: Update border rect in renderStatic()**

Find (inside `renderStatic()`, line ~694 — the last rect in that function):
```js
  mk('rect',{x,y,width:w,height:h,fill:'none',stroke:'rgba(0,0,0,0.55)','stroke-width':1.5},layer);
```
Replace with:
```js
  mk('rect',{x,y,width:w,height:h,fill:'none',stroke:'rgba(0,0,0,0.55)','stroke-width':1.5,rx:20,ry:20},layer);
```

- [ ] **Step 4: Verify in browser**

Visit `http://localhost:5001`. Verify:
- All four corners of the heatmap are visually rounded.
- No risk dots or labels leak outside the rounded corners (clip is working).
- Grid lines don't poke out past the corners.
- Gradient colours still render correctly inside the rounded square.

- [ ] **Step 5: Commit**

```powershell
git add templates/heatmap.html
git commit -m "feat: add 20px rounded corners to heatmap plot square"
```

---

### Task 4: Wider risk list card (CARD_W 293 → 490)

**Files:**
- Modify: `templates/heatmap.html` — 2 edits inside `renderLegend()`.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `CARD_W = 490`, name truncation at 72 chars. The clip rect uses `CARD_W` directly so it auto-updates.

- [ ] **Step 1: Change CARD_W**

Find (inside `renderLegend()`, line ~809):
```js
  const CARD_W    = 293;
```
Replace with:
```js
  const CARD_W    = 490;
```

- [ ] **Step 2: Change name truncation limit**

Find (inside the `sorted.forEach` loop in `renderLegend()`, line ~842):
```js
    const name = r.name.length > 44 ? r.name.slice(0,42)+'…' : r.name;
```
Replace with:
```js
    const name = r.name.length > 72 ? r.name.slice(0,70)+'…' : r.name;
```

- [ ] **Step 3: Verify in browser**

Visit `http://localhost:5001`. Verify:
- Risk list card is noticeably wider — longer risk names no longer truncate prematurely.
- The card's right edge extends to approximately where the old category card's right edge was.
- Card does not overflow the SVG viewport (right edge stays within the viewBox).
- Risk names with > 44 chars now display fully (or up to 72 chars before the ellipsis).
- The risk-list-clip still clips correctly at the new card width (no text spills outside the card).

- [ ] **Step 4: Commit**

```powershell
git add templates/heatmap.html
git commit -m "feat: widen risk list card to 490px and relax name truncation to 72 chars"
```

---

### Task 5: Remove SVG category filter card from renderLegend()

**Files:**
- Modify: `templates/heatmap.html` — delete the category card block from `renderLegend()`.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `renderLegend()` no longer draws the category card. `catKeyElByColor` is now populated by Task 6 instead.
- **WARNING:** After this task, category filtering is temporarily broken until Task 6 is complete. Do not stop between Task 5 and Task 6.

- [ ] **Step 1: Delete the SVG category card block**

Find the comment and the entire block that follows it inside `renderLegend()`:
```js
  // Category filter card — doubled circles with animated eye icon
  const CAT_R      = 14;
  const CAT_ROW_H  = 36;
  const LEG_PAD_X  = 12;
  const LEG_PAD_Y  = 14;
  const CAT_HDR_H  = 28;
  const LEG_TEXT_X = CAT_R * 2 + 10;
  const legX = lx - CARD_PADX + CARD_W + 16;
  const legCardW = LEG_TEXT_X + 175 + LEG_PAD_X;
  const legCardHFit = LEG_PAD_Y + CAT_HDR_H + CAT_R + (CAT_LABELS.length - 1) * CAT_ROW_H + CAT_R + LEG_PAD_Y;

  mk('rect', {
    x: legX - LEG_PAD_X, y: P.y,
    width: legCardW, height: legCardHFit,
    rx: 10, ry: 10, fill: '#2D2D2E'
  }, layer);

  mktxt('Categories / Filter', {
    x: legX - LEG_PAD_X + legCardW / 2, y: P.y + LEG_PAD_Y + 11,
    'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 700,
    fill: '#E8EAED', 'font-family': FONT
  }, layer);
  mk('line', {
    x1: legX - LEG_PAD_X + 6, y1: P.y + LEG_PAD_Y + CAT_HDR_H - 4,
    x2: legX - LEG_PAD_X + legCardW - 6, y2: P.y + LEG_PAD_Y + CAT_HDR_H - 4,
    stroke: '#3F3F40', 'stroke-width': 1
  }, layer);

  let cy = P.y + LEG_PAD_Y + CAT_HDR_H + CAT_R;
  CAT_LABELS.forEach(([label, col]) => {
    const catG = mk('g', { class: 'cat-filter-btn' }, layer);
    catKeyElByColor[col] = catG;
    if (_hiddenCatColors.has(col)) catG.classList.add('cat-filter-off');

    const circX = legX + CAT_R;
    mk('circle', { cx: circX, cy, r: CAT_R, fill: col }, catG);

    // Eye icon centered in circle
    const eyeG = mk('g', { transform: `translate(${circX},${cy})` }, catG);
    const eyeOpen = mk('g', { class: 'eye-open' }, eyeG);
    mk('path', { d: 'M -9,0 Q 0,-7 9,0 Q 0,7 -9,0 Z',
      fill: 'none', stroke: '#000', 'stroke-width': '1.8',
      'stroke-linejoin': 'round' }, eyeOpen);
    mk('circle', { cx: '0', cy: '0', r: '2.6', fill: '#000' }, eyeOpen);
    const eyeClosed = mk('g', { class: 'eye-closed' }, eyeG);
    mk('path', { d: 'M -9,0 Q 0,-5 9,0',
      fill: 'none', stroke: '#000', 'stroke-width': '2.2',
      'stroke-linecap': 'round' }, eyeClosed);
    [[-4,2,-4,5.5], [0,2,0,6], [4,2,4,5.5]].forEach(([x1,y1,x2,y2]) =>
      mk('line', { x1, y1, x2, y2, stroke: '#000', 'stroke-width': '1.6',
        'stroke-linecap': 'round' }, eyeClosed));

    mktxt(label, {
      x: legX + LEG_TEXT_X, y: cy + 4,
      'font-size': 9.5, 'font-weight': 600, fill: '#ffffff', 'font-family': FONT
    }, catG);
    catG.addEventListener('click', () => {
      if (_hiddenCatColors.has(col)) _hiddenCatColors.delete(col);
      else _hiddenCatColors.add(col);
      updateCatFilter();
    });
    cy += CAT_ROW_H;
  });
```
Delete this entire block. The closing `}` of `renderLegend()` remains.

- [ ] **Step 2: Proceed immediately to Task 6**

Do not commit this task alone — filtering is broken. Continue to Task 6.

---

### Task 6: HTML dropdown — structure, CSS, and JavaScript

**Files:**
- Modify: `templates/heatmap.html` — add HTML to `<body>`, add CSS to `<style>`, add JS.

**Interfaces:**
- Consumes: `_hiddenCatColors`, `catKeyElByColor`, `CAT_LABELS`, `updateCatFilter()` from existing code.
- Produces: `buildCatDropdown()`, `positionCatFilter()`, `updateCatFilterBtn()` functions; `updateCatFilter()` updated to toggle `.off`.

- [ ] **Step 1: Add CSS to the `<style>` block**

Append the following inside the `<style>` block, just before the closing `</style>` tag:
```css
    /* ── Category filter dropdown ───────────────────────────────────────────── */
    #cat-filter-wrap { position: fixed; z-index: 200; }
    #cat-filter-btn {
      display: flex; align-items: center; gap: 7px;
      background: #2D2D2E; border: 1px solid #3F3F40;
      border-radius: 20px; padding: 4px 14px 4px 10px;
      color: #E8EAED; font-size: 11px; font-weight: 600; cursor: pointer;
      font-family: 'Roboto', sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4); transition: filter 0.15s;
      white-space: nowrap;
    }
    #cat-filter-btn:hover { filter: brightness(1.18); }
    #cat-filter-btn.filtered { border-color: #6699cc; color: #a8c0ff; }
    #cat-filter-chevron { font-size: 10px; transition: transform 0.2s; display: inline-block; }
    #cat-filter-btn.open #cat-filter-chevron { transform: rotate(180deg); }
    #cat-dropdown {
      display: none; position: absolute; top: calc(100% + 6px); left: 0;
      background: #2D2D2E; border: 1px solid #3F3F40;
      border-radius: 10px; padding: 6px 0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.65);
      min-width: 230px; z-index: 300;
    }
    #cat-dropdown.open { display: block; }
    .cat-dd-row {
      display: flex; align-items: center; gap: 10px;
      padding: 7px 16px; cursor: pointer; transition: background 0.12s;
    }
    .cat-dd-row:hover { background: rgba(255,255,255,0.07); }
    .cat-dd-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .cat-dd-label {
      flex: 1; font-size: 11px; font-weight: 600;
      font-family: 'Roboto', sans-serif; transition: opacity 0.15s;
    }
    .cat-dd-check { font-size: 12px; color: #E8EAED; transition: opacity 0.15s; opacity: 1; }
    .cat-dd-row.off .cat-dd-label { opacity: 0.35; }
    .cat-dd-row.off .cat-dd-check { opacity: 0; }
```

- [ ] **Step 2: Add HTML to `<body>`**

Find the existing `<div id="tooltip"></div>` line and insert the dropdown HTML just before it:
```html
<div id="cat-filter-wrap">
  <button id="cat-filter-btn">
    <span id="cat-filter-label">All Categories</span>
    <span id="cat-filter-chevron">▾</span>
  </button>
  <div id="cat-dropdown"></div>
</div>
```

- [ ] **Step 3: Update `updateCatFilter()` to use `.off` class**

Find the existing `updateCatFilter()` function:
```js
function updateCatFilter() {
  Object.entries(catKeyElByColor).forEach(([col, el]) =>
    el.classList.toggle('cat-filter-off', _hiddenCatColors.has(col)));
  RISKS.forEach(r => {
    const row = legendRowByRiskId[r.id];
    if (row) row.classList.toggle('legend-row-cat-off', _hiddenCatColors.has(catColor(r.category || '')));
  });
  rerender();
}
```
Replace with:
```js
function updateCatFilter() {
  Object.entries(catKeyElByColor).forEach(([col, el]) =>
    el.classList.toggle('off', _hiddenCatColors.has(col)));
  RISKS.forEach(r => {
    const row = legendRowByRiskId[r.id];
    if (row) row.classList.toggle('legend-row-cat-off', _hiddenCatColors.has(catColor(r.category || '')));
  });
  rerender();
}
```

- [ ] **Step 4: Add `updateCatFilterBtn()` function**

Add this function in the JS section, just before the `renderLegend()` function:
```js
function updateCatFilterBtn() {
  const btn = document.getElementById('cat-filter-btn');
  const lbl = document.getElementById('cat-filter-label');
  const hidden = _hiddenCatColors.size;
  if (hidden === 0) {
    lbl.textContent = 'All Categories';
    btn.classList.remove('filtered');
  } else {
    lbl.textContent = `${CAT_LABELS.length - hidden} of ${CAT_LABELS.length} shown`;
    btn.classList.add('filtered');
  }
}
```

- [ ] **Step 5: Add `buildCatDropdown()` function**

Add this function immediately after `updateCatFilterBtn()`:
```js
function buildCatDropdown() {
  const dd = document.getElementById('cat-dropdown');
  dd.innerHTML = '';
  CAT_LABELS.forEach(([label, col]) => {
    const row = document.createElement('div');
    row.className = 'cat-dd-row' + (_hiddenCatColors.has(col) ? ' off' : '');
    row.innerHTML =
      `<span class="cat-dd-dot" style="background:${col}"></span>` +
      `<span class="cat-dd-label" style="color:${col}">${label}</span>` +
      `<span class="cat-dd-check">✓</span>`;
    catKeyElByColor[col] = row;
    row.addEventListener('click', e => {
      e.stopPropagation();
      if (_hiddenCatColors.has(col)) _hiddenCatColors.delete(col);
      else _hiddenCatColors.add(col);
      updateCatFilter();
      updateCatFilterBtn();
    });
    dd.appendChild(row);
  });

  // Open/close toggle
  document.getElementById('cat-filter-btn').addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = dd.classList.toggle('open');
    document.getElementById('cat-filter-btn').classList.toggle('open', isOpen);
  });
  // Click outside closes dropdown
  document.addEventListener('click', () => {
    dd.classList.remove('open');
    document.getElementById('cat-filter-btn').classList.remove('open');
  });
}
```

- [ ] **Step 6: Add `positionCatFilter()` function**

Add this function immediately after `buildCatDropdown()`:
```js
function positionCatFilter() {
  const r = hm.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const scale   = Math.min(r.width / 1300, r.height / 780);
  const offsetX = (r.width  - 1300 * scale) / 2;
  const offsetY = (r.height -  780  * scale) / 2;
  // Align button right edge with right edge of risk list card (SVG x = 738 + 490 - 8 = 1220)
  // Vertically centered in the top-padding zone: card top = P.y=20, header text at y=40, mid = 30
  const svgBtnRightX = (LEG_X - 40 + 490 - 8);  // = 1220
  const svgBtnY      = P.y + 10;                  // = 30, mid of 20px top-padding zone
  const screenX = r.left + offsetX + svgBtnRightX * scale;
  const screenY = r.top  + offsetY + svgBtnY      * scale;
  const wrap = document.getElementById('cat-filter-wrap');
  wrap.style.left      = screenX + 'px';
  wrap.style.top       = screenY + 'px';
  wrap.style.transform = 'translateX(-100%) translateY(-50%)';
}
```

- [ ] **Step 7: Wire up init and resize**

Find the existing resize listener near the bottom of the script:
```js
window.addEventListener('resize', positionCtrl);
```
Replace with:
```js
window.addEventListener('resize', () => { positionCtrl(); positionCatFilter(); });
```

Find the final render call at the very bottom of the script:
```js
try { renderStatic(); renderRisks(); renderLegend(); } catch(e) { console.error('render error', e); }
setTimeout(positionCtrl, 0);
```
Replace with:
```js
try { renderStatic(); renderRisks(); renderLegend(); } catch(e) { console.error('render error', e); }
buildCatDropdown();
updateCatFilterBtn();
setTimeout(() => { positionCtrl(); positionCatFilter(); }, 0);
```

- [ ] **Step 8: Verify in browser**

Visit `http://localhost:5001`. Verify:
- A dark pill button labeled "All Categories ▾" appears near the top-right of the risk list card.
- Clicking the button opens a dark dropdown listing all 7 categories, each with a colored dot, colored label, and a ✓ checkmark.
- Clicking a category row hides/shows those risks on the chart — dots and legend rows dim as before.
- The checkmark disappears and the label dims when a category is toggled off.
- The button label changes to e.g. "5 of 7 shown" when categories are filtered.
- Clicking anywhere outside the dropdown closes it.
- Resizing the browser window keeps the button correctly positioned over the risk list card.
- The old separate "Categories / Filter" SVG card is gone.
- `⌂` reset still resets the view but does NOT reset category filters (correct — filters are user state).

- [ ] **Step 9: Commit**

```powershell
git add templates/heatmap.html
git commit -m "feat: replace SVG category card with HTML dropdown in risk list header"
```

---

### Task 7: Push feature branch to GitHub

**Files:**
- No source files changed — git operations only.

- [ ] **Step 1: Confirm all tasks committed**

```powershell
git log --oneline -5
```
Expected output (in order, newest first):
```
<hash> feat: replace SVG category card with HTML dropdown in risk list header
<hash> feat: widen risk list card to 490px and relax name truncation to 72 chars
<hash> feat: add 20px rounded corners to heatmap plot square
<hash> feat: set graph origin to 0,0 with no sub-1.0 axis labels
<hash> Add UX updates design spec (origin, rounded corners, wider list, category dropdown)
```

- [ ] **Step 2: Push feature branch**

```powershell
git push -u origin feature/heatmap-ux-updates
```
Expected: branch pushed, tracking set.

- [ ] **Step 3: Final smoke test**

Stop and restart the server to confirm nothing was broken by the full save/reload cycle:
```powershell
# Ctrl+C to stop existing server, then:
python app.py
```
Visit `http://localhost:5001`. Do a full walkthrough:
1. Graph shows 0,0 at bottom-left, green fills that corner.
2. Axis labels start at 1.0 on both axes.
3. Plot square has visibly rounded corners.
4. Risk list is wide; longer names display fully.
5. Category dropdown opens/closes cleanly and filters work.
6. Zoom, pan, reset, label toggle, and risk modal all still function normally.
7. Hovering a risk in the list pans the chart to it.
8. Clicking a dot opens the modal with tabs.
