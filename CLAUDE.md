# ELT Risk Management Dashboard — Context Document

## What This Is

A standalone Flask web application that replaces a manual SmartSheet-generated PNG heatmap with a live, interactive SVG risk heatmap. Built for Allegion's Executive Leadership Team (ELT) and hosted separately from the Keystone project.

The original workflow required someone to manually trigger a Claude AI plugin in SmartSheet, save the generated PNG, and upload it to the ELT dashboard. This app eliminates that entirely — the dashboard embeds a live iframe URL that always shows current data.

---

## Background / Origin

This project grew out of a meeting between the developer and an IT contact who had seen Keystone and wanted something similar for the ELT team. The IT contact wanted to improve an existing SmartSheet-generated heatmap. The ELT Risk Mitigation workspace in SmartSheet was the data source. The developer was made admin on that workspace.

---

## Architecture

### Stack
- **Python 3.13** (Windows Store Python — has Win32 sandbox limitations)
- **Flask 3.x** — single-file web app with 4 routes
- **smartsheet-python-sdk** — read-only access to SmartSheet API
- **truststore** — injects Windows cert store to fix Netskope SSL proxy issues
- **python-dotenv** — loads `.env` credentials

### File Structure
```
ELT_RiskManagmentDash/
├── app.py                  # Flask app — 4 routes, 5-min data cache
├── smartsheet_client.py    # Read-only SmartSheet fetch
├── templates/
│   └── heatmap.html        # Everything: SVG chart, labels, legend, zoom, modal
├── .env                    # API token (gitignored!)
├── .env.example            # Template for the token
├── requirements.txt        # flask, python-dotenv, smartsheet-python-sdk, truststore
└── CLAUDE.md               # This file
```

### Routes
- `/` → redirects to `/heatmap`
- `/heatmap` → renders the live interactive chart
- `/refresh` → busts the 5-minute data cache (useful after SmartSheet updates)
- `/health` → JSON status + risk count

### Data Flow
1. `app.py` calls `get_risk_data()` on first request (then caches 5 min)
2. `smartsheet_client.py` finds "Risks Master Sheet" by name, reads columns
3. Columns fetched: Risk ID, Risk Name, Overall Likelihood, Overall Severity, Category, Definition, Risk Status, Risk Owner, Manager(s)
4. Data is JSON-serialized into the HTML template via `{{ risks | tojson }}`
5. All chart rendering is pure client-side JavaScript/SVG

---

## SSL / Netskope Proxy Fix

**Critical**: Allegion uses a Netskope SSL inspection proxy. All HTTPS traffic is re-signed with a corporate cert. The SmartSheet SDK's `pinned_session` ignores `REQUESTS_CA_BUNDLE`. The fix (same as Keystone):

```python
import truststore
truststore.inject_into_ssl()
```

This injects the Windows certificate store (which already trusts Netskope) into Python's SSL module. Without this, every API call fails with `CERTIFICATE_VERIFY_FAILED: Basic Constraints of CA cert not marked critical`.

---

## The Chart — Technical Details

### Coordinate System
- SVG viewBox: `0 0 1300 780`
- Plot area: `P = { x: 130, y: 20, w: 600, h: 680 }`
- Legend starts at `LEG_X = P.x + P.w + 30 = 760`
- Data range controlled by `VR = { xMin, xMax, yMin, yMax }` (defaults 0–5 each axis)
- `svgX(v)` and `svgY(v)` map data → SVG pixels using VR

### Gradient
- Single `linearGradient` with `gradientUnits="userSpaceOnUse"`
- Anchored to data coordinates (0,0) → (5,5): `updateGradientCoords()` called on every render
- This makes the gradient visually pan/zoom correctly with the data
- Colors: green (#8BC34A) → hold green → yellow (#FFEE58) → orange (#FF9800) → red (#E53935)
- Stop positions: 0%, 25%, 46%, 61%, 100% — yellow is a narrow band, not a wide zone

### Risk Grouping
- Risks are snapped to nearest 0.5 unit: `snap(v) = Math.round(v * 2) / 2`
- Risks at the same snapped (likelihood, severity) share one dot and one label box
- This dramatically reduces label count in dense areas

### Label Placement Algorithm (`buildItems`)
A greedy "scan and guarantee" algorithm:
1. Sort groups highest severity first
2. For each group, call `findValidY(cx, lw, lh, cy, 'above')` and `findValidY(... 'below')`
3. `findValidY` scans outward from the dot, checking `isValid()` at each position
4. `isValid()` runs three strict checks:
   - **Label-label**: exact rectangle intersection with all placed labels
   - **Label-dot**: exact circle-rectangle nearest-point distance for all OTHER dots
   - **Connector clearance**: vertical line at cx must not cross any placed label or dot
5. Picks the direction with the shorter valid connector
6. Tracks all placed rects in `placedRects[]` so subsequent labels see them as obstacles

**Key insight**: `placedRects` must be checked IN THE SAME PASS as `allDots`. If two dots share the same x column, the first-placed label blocks the second from occupying the same zone.

### Dot Rendering (`drawPieDot`)
- Each dot is a pie-chart of SVG circle arcs (one arc per unique category colour)
- `stroke-dasharray` trick: N circles each showing 1/N of the circumference via dasharray
- Rotation starts at 12 o'clock via `stroke-dashoffset = C/4 - i * seg`
- Black fill center, white base ring for contrast
- CSS animation `dotSpin` applied to a `<g class="dot-spin">` wrapper on hover

### SVG Structure
```
<g id="chart-inner">
  <g id="static-layer">        ← gradient, grid lines, axis labels, border
  </g>
  <g clip-path="url(#chartClip)">   ← CLIP WRAPPER (never transforms)
    <g id="risks-layer">       ← dots, labels, connectors
    </g>
  </g>
</g>
<g id="legend-layer">          ← risk list + category key (never clips/transforms)
</g>
```

**Critical**: The clipPath must be on a STATIC PARENT of `risks-layer`, not on `risks-layer` itself. If the clip is on `risks-layer` and you apply `transform` to `risks-layer`, the clip moves with it (SVG applies clip in the element's own coordinate system). This caused the pan-drag to reveal content outside the plot square until fixed.

### Bezier Connectors
- Dots at `likelihood = 2.5` (the vertical quadrant divider) get Bezier connectors
- A straight vertical connector at x = svgX(2.5) would fuse visually with the thick divider line
- Quadratic Bezier: `Q cx+32 midY` curves 32px to the right at the midpoint
- Detection: `Math.abs(cx - svgX(2.5)) < 3`

---

## Zoom / Pan

### Approach: Data Range (`VR`)
The chart does NOT use SVG viewBox manipulation or group transforms for zoom. Instead, `VR` (the visible data range) is changed and the chart re-renders.

- **Why**: viewBox zoom affects the WHOLE SVG including legend; group transforms move the entire chart square. Data range zoom keeps the plot square fixed and only the data inside changes.
- **Zoom**: `doZoom(factor, pivotDataX, pivotDataY)` — keeps pivot point fixed
- **Max zoom out**: `VR.xMax - VR.xMin > 5.001` check prevents zooming beyond original range
- **Mouse wheel**: zooms toward cursor position
- **Buttons**: +/−/⌂ in a fixed bar at the bottom center

### Pan
- `mousedown` sets `panState = { ..., moved: false }`
- `mousemove` sets `panState.moved = true`, updates VR, renders static layer fresh, applies `transform="translate(dx,dy)"` to `risks-layer` (no label recalculation)
- `mouseup`: **only calls `rerender()` if `panState.moved === true`**

**Critical**: Without the `moved` check, every click (mousedown → mouseup) triggers `rerender()` which destroys the dot SVG elements before the `click` event fires. This caused the click modal to silently do nothing.

### Pan Performance
During drag:
1. `static-layer` re-renders (fast: O(22 tick marks))
2. `risks-layer` gets a `transform` (GPU-accelerated translate, zero JS cost)
3. On mouseup: full `rerender()` with correct label positions

---

## Lessons Learned / What NOT To Do

### Don't mess with these
- **`nativeEvent()` / `startSystemResize()`** — not applicable here (Flask, not PyQt)
- **`REQUESTS_CA_BUNDLE` env var** — SmartSheet SDK's `pinned_session` ignores it; only `truststore.inject_into_ssl()` works
- **Force-directed label placement** — tried many iterations. The `findValidY` scan approach with strict `isValid()` checking is the ONLY approach that reliably avoids all dot overlaps.
- **Putting clip-path on a transformed element** — the clip follows the transform. Always put the clip on a static parent wrapper.

### Algorithm failures tried
1. **Greedy 8-candidate placement** — fails in dense clusters (all candidates blocked, all default to same fallback)
2. **Force-directed repulsion** — Phase 1 (label-label) and Phase 2 (dot-clearance) fight each other in an oscillating loop
3. **Butterfly pattern** (high severity → above, low → below) — failed for dots near the 2.5 midline
4. **MAX_CONN cap** — cap on connector length caused labels to fall back into positions that covered other dots
5. **Ascending vs descending sort order** — changed label placement order dramatically; descending severity is correct (most constrained first)

### What works
- **Greedy scan** in `findValidY` with exact `isValid()` checks guarantees no overlaps
- **`placedRects[]` tracking** prevents two labels in the same column from picking the same direction
- **0.5 snap grouping** reduces label count and matches the original SmartSheet chart behavior
- **`requestAnimationFrame` throttle** for pan rendering prevents excessive redraws

---

## Colors

### Category Colors (matched to original SmartSheet chart)
```javascript
'strategic':                '#e07020'  // orange
'operational':              '#007A8A'  // teal-cyan
'technology/cybersecurity': '#7a5c00'  // olive/gold
'human capital':            '#1a7a1a'  // green
'governance/compliance':    '#c0208c'  // magenta
'environmental/external':   '#74B8F5'  // sky blue (light)
'financial':                '#1E3AAA'  // medium navy
```

### Allegion Brand
- **Allegion Grey**: `#404041` (RGB 64,64,65) — used for all modal/tooltip backgrounds (solid, no transparency)
- **Border**: `#5A5A5C`
- **Text**: `#E8EAED`
- **Muted**: `#A8A8AA`

---

## SmartSheet API Notes

- API tokens are account-level (not workspace-level)
- Use `list_sheets(include_all=True)` to find sheet by name — don't rely on URL alphanumeric ID
- The "Risks Master Sheet" URL uses a Base62-encoded ID different from the numeric API ID
- Column "Manager(s)" has an apostrophe — handled correctly in Python dict keys
- The `Category` column value strings may have varied capitalization/formatting; `catColor()` normalizes with `.toLowerCase().replace(/\s*risks?\s*$/, '')`

---

## Deployment Notes

- Runs on port 5001 locally (`python app.py`)
- Intended for Azure App Service (same tier as Keystone)
- SmartSheet dashboard embeds via "Web Content" widget with the hosted URL
- HTTPS is required for SmartSheet embedding (Azure provides this automatically)
- No authentication needed on the endpoint (it's read-only data, internal use)
- Cache TTL: 5 minutes. Hit `/refresh` to force reload after SmartSheet updates.

---

## Future Ideas / Deferred Work

- **Azure deployment** — not yet deployed, still running locally
- **Category column variations** — if data uses "Strategic" vs "Strategic Risks", the normalization covers this but verify with actual data
- **More SmartSheet columns** — Risk Score, Overall Risk Rating could enrich the modal
- **Label merging** — `mergeClose()` exists to combine nearby label boxes with per-dot connectors; MAX_DOT_DIST=80 prevents merging dots more than 80px apart
- **Bezier routing** — when straight connectors still cross something, Bezier arcs around obstacles; implemented for the vertical center line only
- **Responsive label refresh on zoom** — currently labels are recalculated only on mouseup; could also recalculate after zoom settles

---

## Environment Setup

```
cd C:\Users\cschweder\Documents\Coding\ELT_RiskManagmentDash
pip install -r requirements.txt
# Create .env from .env.example and fill in SMARTSHEET_ACCESS_TOKEN
python app.py
# Visit http://localhost:5001
```
