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
- **Flask 3.x** — single-file web app (`app.py`): heatmap routes + Looker Studio viz stubs
- **smartsheet-python-sdk** — read-only access to SmartSheet API
- **truststore** — injects Windows cert store to fix Netskope SSL proxy issues
- **python-dotenv** — loads `.env` credentials

### File Structure
```
ELT_RiskManagmentDash/
├── app.py                  # Flask app — routes, three 5-min data caches (risks + tasks + trend history)
├── smartsheet_client.py    # Read-only SmartSheet fetch — three sheets
├── templates/
│   └── heatmap.html        # Everything (~6,700 lines): SVG chart, legend, zoom, modals, guide, trends
├── docs/                   # Netlify publish dir; docs/index.html = baked static snapshot
│   ├── AllegionLogo_Official.png
│   ├── launch.html         # Old bookmarklet/setup page (from SmartSheet-embed experiments)
│   └── superpowers/        # specs/ + plans/ — design docs for each feature batch (dated)
├── viz_files/              # Looker Studio community viz source (index.js/css) — legacy experiment
├── .env                    # API token (gitignored!)
├── requirements.txt        # flask, gunicorn, python-dotenv, smartsheet-python-sdk, truststore
├── netlify.toml            # publish = "docs"
├── render.yaml             # Render.com config (iframe-permissive CSP headers)
├── startup.txt             # gunicorn command for Azure App Service
└── CLAUDE.md               # This file
```
Untracked clutter (safe to ignore or delete): `*.pbix` Power BI experiments, `templates/heatmap.html.bak` and `.pre-guide-backup-*`, `fix_colors.py`/`fix_legend.py`/`fix_template.py` (one-off patch scripts), `test_smartsheet.html`, `heatmap_embed.html`, `Static/`, two empty `New folder*` dirs, `app_run.log`.

### Routes
- `/` → redirects to `/heatmap`
- `/heatmap` → renders the live interactive chart (passes `risks`, `tasks`, `trend_history`, `last_updated`)
- `/refresh` → busts ALL THREE caches (risks + tasks + trend history), redirects to heatmap
- `/health` → JSON status + risk count
- `/api/risks` → CORS-enabled JSON endpoint
- `/test` → serves `test_smartsheet.html` (dev scratch page)
- `/viz/manifest.json`, `/viz/index.js`, `/viz/index.css` → Looker Studio community viz that just iframes `https://elt-riskmanagementdash.onrender.com/heatmap` (Looker was explored as a SmartSheet-approved host; not the current path)

### Data Flow — Three Sheets
1. `app.py` calls `get_risk_data()`, `get_task_data()` and `get_trend_history()` on first request (each cached 5 min separately)
2. `smartsheet_client.py` fetches:
   - **"Risks Master Sheet"** — risk metadata, ownership, scores (found by name; override with `SMARTSHEET_SHEET_NAME`)
   - **"Mitigation Tasks"** (sheet ID `797846895808388`, found by name) — per-task data linked to risks by Risk ID
   - **"Risk Trend History"** (hard-coded sheet ID `1794037649461124`) — quarterly snapshots of each risk's severity/likelihood, used for trend ghost dots
3. All three are JSON-serialized into the template:
   - `const RISKS = {{ risks | tojson }}` — array of risk objects
   - `const TASKS = {{ tasks | tojson }}` — dict keyed by Risk ID → array of task objects
   - `const TREND_HISTORY` — dict keyed by Risk ID → chronologically sorted array of `{period, year, quarter, severity, likelihood}`
4. All rendering is pure client-side JavaScript/SVG

### Columns fetched — Risks Master Sheet
Risk ID, Risk Name, Overall Likelihood, Overall Severity, Category, Definition, Risk Status, Action Plan Status, Control Effectiveness, Risk Level, Quarter, Risk Score, Residual Likelihood, Residual Impact, Residual Score, Review Date, Recent Reviewed, Review Overdue?, ELT Owner, Risk Owner (+ email), Manager(s) (+ email), Other Managers, Mitigation Health, Mitigation Completion %, Total **Migitation** Tasks (sic — the sheet's column title is misspelled; the code matches it), Completed Mitigation Tasks

Also from SmartSheet row system fields: `date_added` (row `created_at`) and `date_modified` (row `modified_at`), formatted `DD Mon YYYY`.

Some fetched fields (Risk Score, Residual *) are no longer displayed — see "ELT Feedback Status" below. They are still in the payload.

### Columns fetched — Mitigation Tasks sheet
Risk ID, Mitigation Task, Task Status, Risk Manager(s), Responsible, Status, Progress % (0.0–1.0 decimal), Start Date, Target Date, Trend Towards Target (emoji: 👁▶⚠️), Trend Analysis, Mitigation Strategy, Definition, Severity, Likelihood, Mitigation Type, Governance/Compliance Risk, plus `date_added` (row `created_at`)

### Columns fetched — Risk Trend History sheet
Risk ID, Period Key (e.g. `2025-Q4`), Year, Quarter, Severity, Likelihood. Rows missing any of ID/period/severity/likelihood are skipped; duplicates per (Risk ID, Period Key) are collapsed (last row wins). **How/when this sheet gets populated is outside this app** — confirm the process with the data owner before relying on it for the ELT's "rolling log" ask.

---

## SSL / Netskope Proxy Fix

**Critical**: Allegion uses Netskope SSL inspection. All HTTPS traffic is re-signed with a corporate cert. The SmartSheet SDK's `pinned_session` ignores `REQUESTS_CA_BUNDLE`. The fix:

```python
import truststore
truststore.inject_into_ssl()
```

This injects the Windows certificate store (which already trusts Netskope) into Python's SSL module.

---

## Server Restart — CRITICAL NOTE

**Always use PowerShell `Stop-Process -Force` to kill the server, never `pkill`.**
`pkill` from Git Bash sends SIGTERM which Windows ignores for Python. The old process keeps running on port 5001, serving stale cached data. Two processes can silently coexist on the same port with one being ignored.

```powershell
Get-NetTCPConnection -LocalPort 5001 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Python code changes (`.py` files) require a server restart. Flask `TEMPLATES_AUTO_RELOAD = True` only reloads `.html` templates.

---

## The Chart — Technical Details

### Coordinate System
- SVG viewBox: `0 0 1300 780`
- Plot area: `P = { x: 130, y: 20, w: 600, h: 680 }`
- Legend starts at `LEG_X = P.x + P.w + 30 = 760`
- Data range controlled by `VR = { xMin, xMax, yMin, yMax }` (defaults 0–5 each axis)
- `svgX(v)` and `svgY(v)` map data → SVG pixels

### Gradient
- Single `linearGradient` with `gradientUnits="userSpaceOnUse"`, anchored to data coords (0,0)→(5,5)
- Colors: green → hold green → yellow (narrow band) → orange → red

### Risk Grouping
- Risks snapped to nearest 0.5: `snap(v) = Math.round(v * 2) / 2`
- Risks at same snapped position share one dot and label box

### Label Placement (`buildItems`)
Greedy scan with `findValidY()` checking: label-label intersect, label-dot clearance, connector clearance. `placedRects[]` tracked in same pass. Descending severity sort order is critical.

### Dot Rendering (`drawPieDot`)
Pie-chart dots using `stroke-dasharray` trick. Each category gets one arc. `transform-box: fill-box; transform-origin: center` for hover animations.

### SVG Structure
```
#chart-inner
  #static-layer        ← gradient, grid, axis labels, border
  clip-path wrapper    ← STATIC parent (never transforms)
    #risks-layer       ← dots, labels, connectors (transforms on pan)
#legend-layer          ← risk list + category key (never clips/transforms)
```

**Critical**: clipPath must be on a STATIC parent of `#risks-layer`. If clip is on a transformed element, it moves with the transform.

---

## Modal System

### Risk Modal
- Glass overlay (z-index 1000) with frosted backdrop-filter
- Multi-risk tabs at top (when a dot contains multiple risks)
- 4-page nav: Overview / Risk Data / Ownership / **Tasks**
- Animated sliding indicator line under active page tab
- Indicator snaps via `setTimeout(100ms)` after open (not rAF — rAF fires before CSS transitions settle)
- Width dynamically expands on Tasks tab: `taskCount * 354 + 100`, MIN_W = 808px, capped at `window.innerWidth - 48`
- `_W_TRANSITION` constant shared between height animation and width transitions so they run simultaneously

### Tasks Tab
- Cards rendered by `_buildTasksPage(r)` using `_sortedTasks(r)` (respects `_taskSortOrder`)
- Sort bar: 3 pills (% Done / A-Z / Severity) slide out from behind the Tasks label on enter, slide back on exit
- `#modal-page-area.tasks-mode` class: cards fill modal height (`align-items: stretch`), each card `overflow-y: auto`
- Card max-height = available modal height; card internal scroll handles tall content
- Wheel: scrolls card vertically first, falls through to row horizontal scroll at card scroll limits
- Expand button (`open_in_full`) in each card's top-right corner; header has `padding-right: 34px` so badge never overlaps
- Task card pulse: `outline` (not `box-shadow`) — outline bypasses `overflow: hidden` clipping in parent containers
- Card width formula: `taskCount * 354 + 100` accounts for box padding (88px) + scroll row padding (14px) + border (2px) + scrollbar clearance (~10px)

### Task Detail Modal (z-index 1100 — above risk modal)
- Opens from expand button on task cards
- Shows: risk badge, task name, status, progress bar, stats grid (severity, likelihood, responsible, dates, trend, managers, mitigation type, gov/compliance)
- Three text sections: Definition, Mitigation Strategy, Trend Analysis
- Viewport: `overflow-x: hidden; overflow-y: auto` — clips horizontal slide, scrolls vertically
- Scroll only enabled when content is genuinely > 4px taller than container (`_updateTdmScroll()` tolerance check)
- `transform: translateX(0)` cleared after animation to remove stacking context that causes spurious 1-2px scroll
- Prev/Next arrows navigate within the risk's sorted task list; counter shows "N / total"
- Slide animation: exit 170ms → content swap + scroll reset → enter 300ms spring

### Person Profile Modal (z-index 220)
- Opens from people search results or spotlight names
- Shows: name, auto-generated email (`firstname.lastname@allegion.com`), grouped sections for Risk Owner / ELT Owner / Managing / Mitigation Tasks
- Email generated by splitting name on whitespace, skipping initials (single-letter + period), taking first + last parts

### Search Modal (z-index 210)
- Full two-column view: Tasks (left) / People (right)
- Own search bar, bidirectionally synced with main search bar
- "Include Task Content" toggle — searches task name + definition only (NOT strategy/analysis)
- Definition snippets shown when match is in definition not title (shows context around match)
- Both bars update risk list, quick panel, and modal results simultaneously

---

## Search System

### Quick Panel (`#search-results-panel`)
- Appears LEFT of search bar (over chart area) — never obscures risk list
- Positioned via JS: `panel.style.right = (window.innerWidth - rect.left + 8) + 'px'`
- Quick panel searches task **names only** (definition matches show false positives without context)
- People search: matches display name substring
- "Show all N →" link opens full search modal
- Max 5 results per section in quick panel

### People Index (`_getPeopleIndex()`)
- Built lazily on first search keystroke, cached in `_peopleIndex`
- Walks all RISKS + TASKS, extracts unique names split on comma and slash
- Stores for each name: ownerOf[], eltOwnerOf[], managerOf[], tasksOf[]
- Email generated from name at index-build time

### Task Pulse Highlight
When a task is opened from search results:
- `openModal([risk], 0, 3, taskName, searchQuery)` — 4th/5th params
- After 220ms: `_highlightTaskCard(taskName, searchQuery)` runs
- Finds card by `data-task` attribute, applies `outline` pulse animation (5s, 3 pulses)
- Also highlights matching chars in the task name AND the visible definition panel
- Saves original panel text, restores on cleanup at 5200ms

---

## Filter System

### Filters
- **Category filter**: `_hiddenCatColors` Set — category colors toggled off
- **Multi-filter**: `_activeFilters` — status, health, quarter, overdue boolean
- **Search**: `_searchActive` flag — `legend-layer.search-active` CSS class
- **Spotlight**: `_spotlightOwner` string — dims everything except spotlight subject

### Reset All Filters
- `resetAllFilters()` hard-resets `_dimCount = 0` FIRST (prevents darkened list from stale counters)
- Then clears categories, multi-filters, search, spotlight
- `_updateResetBtn()` hooked into: `updateFilterChip`, `updateCatFilterBtn`, `openSearch`, `closeSearch`, `activateSpotlight`, `clearSpotlight`
- Red "Reset All" chip uses `.status-chip` class — must NOT have `style="display:none"` inline (inline style overrides the `.visible` CSS class)

### Dim State
- `_dimCount` counter tracks how many sources are dimming the legend
- `rerender()` and `renderRisks()` hard-reset `_dimCount = 0`
- `resetAllFilters()` also hard-resets before processing to prevent stale count after multi-filter clear

---

### Owner Filter (dropdown)
- `_ownerFilter` string; `buildOwnerDropdown()` / `setOwnerFilter()` / `_isOwnerMatch(r)`
- `_getAllOwners()` splits Risk Owner, ELT Owner, Manager(s) and Other Managers on comma/slash → alphabetical list
- `_isOwnerMatch` is an **exact** (case-insensitive) name match against any of those four fields, so a person shows up for every risk they own, co-own or manage. It does NOT do "transitive" expansion (selecting A also shows B's items that A co-owns) — see ELT feedback note below.
- Distinct from **Spotlight** (`activateSpotlight`, dims everything but one person's items, opened from people search)

---

## Chart Panels (Top 10)

- Two pills on the chart: **Top 10 Risks – Severity** and **Top 10 Tasks – Severity** (`openChartPanel('top10' | 'tasks')`, `CHART_PANEL_META`, builders keyed `top10` / `tasks`)
- Sorted by severity desc, then likelihood desc; **respects active filters** (`_isRiskVisible`), so it re-ranks as filters change
- Items click through to the risk modal (tasks open straight to the Tasks tab with the task pulse-highlighted)
- A separate always-visible `#top10-panel` (`buildTop10`/`positionTop10`) also exists below the risk list; it is clamped to stay on-screen on short viewports (commit ab8033a)

---

## Trend Overlays (historical movement)

Data source: `TREND_HISTORY` (Risk Trend History sheet, quarterly). Code: `renderTrendOverlays()`, `toggleTrendRisk`, `activateTrend`, `clearAllTrends`, `_applyTrendWithAnimation`, all in `heatmap.html`.

- **Entry points**: a trend button in the risk modal header (`_onModalTrendClick`, closes the modal and trends that risk) and a `+`/`−` toggle on trended legend rows. `_trendRisks` Set holds the trended risk IDs. Trend mode hides non-trended risks (and suppresses normal legend hover/dim/auto-pan while active).
- **Rendering**: dashed trail through each quarter's (likelihood, severity) → ghost dots (`#trend-layer`) with period labels. Clicking a ghost dot opens the **historical snapshot card** (`_showHistCard`) with the quarter, L/S values and a worsened/improved delta.
- **Disambiguation when several risks are trended** (spec: `docs/superpowers/specs/2026-07-23-trend-disambiguation-design.md`):
  1. Each risk's visuals are wrapped in `<g class="trend-risk-group" data-risk-id>`; hovering a trended legend row isolates it (`.trend-isolated` / `.trend-dimmed`); a pin icon locks it (`_trendPinnedRiskId`, cleared by background click or pin re-click)
  2. Per-risk **shape** (`TRAIL_SHAPE`, `drawShapeMarker`) and **dash** pattern (`TRAIL_DASH`) indexed by insertion order (`riskIdx`); current dot gets a halo ring + shape badge — `drawPieDot` is untouched
  3. **Same-category hue shading** (`shadeColor`, `HUE_SHADE_STEPS = [0,35,70,-20]`) via a per-category counter; 5th+ same-category trend reuses the last shade and relies on shape+dash
- Isolation does NOT call `dimLegend()`.

---

## User Guide

- Modal with two panes (grouped nav + detail), live nav search, ~24 entries in 8 categories defined in `GUIDE_FEATURES` (Getting Started, Reading the Chart, Filtering & Search, The Risk Modal, Tasks, Trend Overlays, People, Chart Panels). Each entry has a small SVG preview mockup. Nav categories are collapsible.
- **Click-to-inspect**: persistent header button; click any UI element → `_findGuideMatch` (nearest-element matching) selects its entry; Esc cancels; flashes a message when nothing matches.
- Auto-opens on first visit per browser (`localStorage` key `hm_guide_seen_v1`; bump the suffix to re-show it to everyone). The guide button sits in the corner slot of the (hidden) fullscreen button, z-index above all modals.
- **When you add or change a user-facing feature, add/update its `GUIDE_FEATURES` entry** — and keep curly quotes in guide strings (straight apostrophes broke the JS once, commit 7da0995).
- Guide SVG previews need explicit pixel `width/height` — the global `svg{width:100%}` rule otherwise blows them up.

---

## ELT Feedback Status

Source: `Heatmap feedback from ELT.txt` (8 Jul 2026, untracked). Status verified against code on 19 Oct 2026:

| ELT ask | Status |
|---|---|
| Risk Data tab: drop risk score and residual section | Done — Risk Data tab shows L/S, Review, and Record only (`residual = ''`, score computed but unused) |
| Hover tooltip: remove risk score | Done — tooltip shows only L/S + overdue/health alerts |
| Reword "At Risk" status | Done in UI — `_displayStatus()` maps "At Risk" → "Needs Attention". Wording may still need sign-off ("might be up to Cody") |
| Date risk added / date task added | Done — row `created_at` → Risk "Date Added" + "Last Modified", Task "Task Added". (These are SmartSheet row-creation dates, not a dedicated "date identified" column.) |
| Keep Risk Status in background, not displayed | Partial — verify where Risk Status is still shown |
| Risk **end date** | **Not done** — no field fetched or shown; needs a column in SmartSheet first |
| Owner dropdown for per-person view | Done (exact-name match; see Owner Filter) |
| …co-owner expansion (Dave Ilardi → also Tim Eckersly's items he co-owns) | **Unclear / not implemented as described** — current filter shows risks where the person appears in any owner/manager field, but does not pull in the *other* co-owner's wider portfolio. Clarify intended behavior with ELT |
| Top 10 severity list that updates | Done (Top 10 Risks/Tasks pills; re-ranks with filters) |
| Trends button per risk + rolling historical log + ghost-line | Done on the front end (trend button, ghost dots, snapshot card, multi-risk disambiguation). **Back-end dependency**: the Risk Trend History sheet must be kept populated, and the ELT's "go back to months and years of choice" ask is not met — history is quarterly and there is no date picker |
| Snapshot button → printable report | **Not done** — no print stylesheet or `window.print` anywhere |

---

## Zoom / Pan

### Approach: Data Range (`VR`)
The chart does NOT use SVG transforms for zoom. `VR` (visible data range) changes and chart re-renders. This keeps the plot square fixed; only data inside changes.

### Pan Performance
During drag: `static-layer` re-renders (fast), `risks-layer` gets GPU-accelerated `transform`. On mouseup: full `rerender()` only if `panState.moved === true` (prevents click → mouseup from destroying dots before click event fires).

---

## Timestamp
- `app.py`: `dt.strftime('%d %b %Y, %I:%M %p').replace(', 0', ', ')` — 12-hour AM/PM format
- Displayed as "Data as of 07 Jul 2026, 4:38 PM" in chart footer

---

## Colors

### Category Colors
```javascript
'strategic':                '#e07020'  // orange
'operational':              '#007A8A'  // teal-cyan
'technology/cybersecurity': '#7a5c00'  // olive/gold
'human capital':            '#1a7a1a'  // green
'governance/compliance':    '#c0208c'  // magenta
'environmental/external':   '#74B8F5'  // sky blue
'financial':                '#1E3AAA'  // medium navy
```

### Allegion Brand
- **Orange**: `#FF671F`
- **Dark grey**: `#2D2D2E` (background elements)
- **Border**: `#3F3F40`
- **Text**: `#E8EAED`
- **Muted**: `#A8A8AA`

---

## SmartSheet API Notes

- API tokens are account-level (not workspace-level)
- Use `list_sheets(include_all=True)` to find sheet by name
- "Mitigation Tasks" sheet ID: `797846895808388` (confirmed stable)
- Contact columns: `cell.value` = email for CONTACT_LIST; `cell.object_value.value` = list of Contact objects for MULTI_CONTACT
- `Progress %` column returns 0.0–1.0 decimal — multiply by 100 for display
- `Trend Towards Target` column stores actual emoji characters (👁 ▶ ⚠️) in TEXT_NUMBER column
- `Overdue` column returns `#INVALID OPERATION` (formula-based) — check `Review Overdue?` column on Risks Master Sheet instead
- `String(r.review_overdue).toLowerCase() === 'true'` — Python `str(True)` = `'True'` (capital T), must normalize

---

## Deployment Notes

### Local dev
- `cd C:\Users\cschweder\Documents\Coding\ELT_RiskManagmentDash && python app.py` → http://localhost:5001
- Use PowerShell to kill (see Server Restart note above)

### Netlify static deployment (CURRENT)
- **Live URL**: `https://allegion-risk-heatmap.netlify.app`
- `netlify.app` domain whitelisted by Allegion SmartSheet System Admin ✅
- Publishes `docs/` folder; `docs/index.html` = baked static HTML
- **Bake command** (Flask must be running on 5001):
  ```python
  python -c "
  import urllib.request, truststore
  truststore.inject_into_ssl()
  with urllib.request.urlopen('http://localhost:5001/heatmap') as r:
      html = r.read().decode('utf-8')
  html = html.replace('/static/AllegionLogo_Official.png', 'AllegionLogo_Official.png')
  open('docs/index.html', 'w', encoding='utf-8').write(html)
  print('Baked', len(html), 'bytes')
  "
  ```
- Then: `git add docs/index.html && git commit -m "chore: bake..." && git push origin master`
- Data is snapshot from bake time — not live. Must rebake + push to update.
- Last bake: 29 Oct 2026 (commit dcd22b9); Netlify auto-deploys from GitHub master on push. **Any change to `heatmap.html` is invisible on Netlify until rebaked.** Trend history, Top 10, guide etc. are all in the baked file.
- The baked file is ~480 KB; the live `/heatmap` render takes ~5 s on a cold cache (3 SmartSheet calls).

### Other hosts tried
- **Render.com** (`render.yaml`, `elt-riskmanagementdash.onrender.com`) — still hard-coded in the `/viz/*` Looker stubs in `app.py`
- **Looker Studio community viz** (`/viz/*`, `viz_files/`) — iframe wrapper experiment; not the current path
- **Power BI** (`*.pbix`) — early experiments, untracked

### SmartSheet Web Content widget embedding
- SmartSheet dashboard → Web Content widget → URL: `https://allegion-risk-heatmap.netlify.app`
- No form workaround needed with whitelisted domain

### Azure App Service (long-term — needs IT)
- `startup.txt`: `gunicorn --bind=0.0.0.0 --timeout 600 app:app`
- Would serve live data on every load
- Deferred pending IT provisioning

---

## Lessons Learned / What NOT To Do

### Server Management
- **Never `pkill` on Windows** — use `Stop-Process -Force` in PowerShell. Two Flask processes can coexist silently on the same port; stale process serves old cached data with no error.
- **Python code changes require restart** — `TEMPLATES_AUTO_RELOAD` only reloads `.html` files.

### CSS / Animation
- **`box-shadow` is clipped by `overflow: hidden`** on ANY ancestor. Use `outline` for highlights that must appear outside overflow-clipped containers. `outline` renders in a separate layer that bypasses the overflow stack.
- **`transform: translateX(0)` is not a no-op** — it creates a compositor layer and changes sub-pixel text rendering, causing 1-2px layout shifts. Always clear inline transform styles after animations complete.
- **`overflow: hidden` kills child scrolling** — use `overflow-x: hidden; overflow-y: auto` when you need to clip one axis and scroll the other.
- **`scrollbar-gutter: stable` causes reflow** — reserving 5px for scrollbar makes content 5px narrower, which can reflow text and push it over the container height by 1-2px, triggering a spurious scrollbar. Use JS tolerance check (`scrollHeight > clientHeight + 4`) instead.
- **`max-width` transitions work** — animating between two `max-width` values is smooth if both are concrete px values (not `auto`). Use this for expand/collapse animations.
- **Firefox: `transform-box: fill-box` on a `<g>` is unreliable for hover/animated transforms.** Chrome resolves it fine; Firefox re-measures the group's box mid-animation or applies the origin against the wrong box. Two real symptoms, both fixed Oct 2026: (1) legend rows "shook" on hover — row scale origin came from a bbox that included the rotating chevron, so the hit area slid out from under the pointer and `mouseenter`/`mouseleave` ping-ponged (46–72 events per hover vs 3 in Chrome); (2) hovered dots orbited the chart because the `dotSpin` keyframe rotated around the wrong origin (dot centre drifted up to ~520 px). **Fix pattern:** `transform-box: view-box; transform-origin: var(--x, 0px) var(--y, 0px)` in CSS, with the element's own user-space centre/edge set as custom properties in JS at creation (`--row-ox/--row-oy` on `.legend-row`, `--dot-ox/--dot-oy` on `.dot-scale-wrapper` + `.dot-spin`). Use custom properties, not inline `transform-origin` — the entrance animation clears inline `transformBox`/`transformOrigin` on rows when it finishes, which silently undid the first attempt. Plain `fill-box` is still used by `.status-ring`, `.legend-chevron` and `.dot-hover`; those measured fine in Firefox, so leave them unless they misbehave. Always test hover/animation changes in Firefox as well as Chrome.
- **Indicator timing** — `getBoundingClientRect()` returns zeros inside `display:none` modals. Even after `.add('open')`, CSS transitions may still be mid-flight. Use `setTimeout(100ms)` (not `rAF`) with `_updateIndicator(false)` (animated, not instant) to let layout settle.
- **`scrollbar-gutter: stable` + `overflow-y: auto`** = the scrollbar space is always reserved. Use `overflow-y: hidden` by default + JS check to selectively enable scroll, avoiding the feedback loop.

### JavaScript
- **Function declarations are hoisted** — `function foo()` defined at bottom of `<script>` is accessible at top. `const foo = () =>` is NOT hoisted.
- **Delegated event listeners survive innerHTML re-renders** — add listeners to stable parent elements (`#modal-page-area`, `#modal-page-nav`) not to dynamically-rendered children.
- **`passive: false` required for `preventDefault()` in wheel handlers** — browsers default to passive for scroll performance. Without it, `preventDefault()` is silently ignored.
- **Inline styles override CSS classes** — `element.style.display = 'none'` beats `.visible { display: flex }`. Never put `style="display:none"` on elements controlled by class toggling.
- **`_dimCount` leak** — multiple filter sources each call `dimLegend(true)`. Clearing filters must hard-reset `_dimCount = 0` and remove `legend-dimmed` class explicitly, not rely on each source to decrement properly.

### Data / SmartSheet
- **Two ghost processes = stale data** — if task data appears not to include newly-added fields after a Python change, check for zombie Flask processes first.
- **Diagnostic JSON regex** — `{.*?}` (non-greedy) stops at the first `}` in nested JSON. Use `json.JSONDecoder().raw_decode(html, start)` to properly parse nested JS objects from rendered HTML.
- **`t.definition` vs `r.definition`** — task-level definitions are unique per task (123/125 populated). Risk-level `r.definition` is shared across all tasks for the same risk. Use `t.definition` for per-task content; `r.definition` only as a fallback.
- **Quick search: names only** — searching task definitions in the quick panel shows false positives (task appears in results but no match is visible in the title). Quick panel = names only; full modal = names + definitions with context snippets.

### Layout Patterns
- **Tasks tab modal width**: `taskCount * 354 + 100`. The 100 = 88px box padding + 14px scroll row padding + 2px border + ~10px scrollbar margin. Formula was 74px initially causing consistent ~26px underwidth.
- **`align-items: stretch` + child `overflow-y: auto`** = cards fill available height and scroll internally. Key for iframe contexts where viewport height is constrained.
- **`flex: 0 0 Npx` cards** in a horizontal scroll row — fixed width, don't grow or shrink. Essential for consistent card appearance.

---

## Future Work
1. **Outstanding ELT asks** (see "ELT Feedback Status"): printable snapshot report, risk end date, co-owner expansion clarification, date-range trend history
2. **Azure App Service** — needs IT; startup.txt configured
3. **Scheduled rebake** — GitHub Action to auto-rebake on a schedule (e.g., nightly). Note: a Flask server with SmartSheet access is needed at bake time, so this needs a runner that can reach SmartSheet
4. **Client-side SmartSheet API** — JS fetch eliminates Flask; token in code acceptable for internal read-only
5. **Render.com** ($7/mo) — render.yaml configured, alternative to Azure
6. **Housekeeping** — delete untracked clutter listed under File Structure; split `heatmap.html` (6.7k lines) if it gets harder to work in
