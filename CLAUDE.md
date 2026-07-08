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
├── app.py                  # Flask app — routes, two 5-min data caches (risks + tasks)
├── smartsheet_client.py    # Read-only SmartSheet fetch — two sheets
├── templates/
│   └── heatmap.html        # Everything: SVG chart, labels, legend, zoom, all modals
├── docs/                   # Netlify publish dir; docs/index.html = baked static snapshot
│   └── AllegionLogo_Official.png
├── .env                    # API token (gitignored!)
├── .env.example
├── requirements.txt        # flask, gunicorn, python-dotenv, smartsheet-python-sdk, truststore
├── netlify.toml
├── startup.txt             # gunicorn command for Azure App Service
└── CLAUDE.md               # This file
```

### Routes
- `/` → redirects to `/heatmap`
- `/heatmap` → renders the live interactive chart (passes `risks`, `tasks`, `last_updated`)
- `/refresh` → busts BOTH caches (risks + tasks), redirects to heatmap
- `/health` → JSON status + risk count
- `/api/risks` → CORS-enabled JSON endpoint

### Data Flow — Two Sheets
1. `app.py` calls `get_risk_data()` AND `get_task_data()` on first request (each cached 5 min separately)
2. `smartsheet_client.py` fetches:
   - **"Risks Master Sheet"** — risk metadata, ownership, scores
   - **"Mitigation Tasks"** (sheet ID `797846895808388`) — per-task data linked to risks by Risk ID
3. Both are JSON-serialized into the template:
   - `const RISKS = {{ risks | tojson }}` — array of risk objects
   - `const TASKS = {{ tasks | tojson }}` — dict keyed by Risk ID → array of task objects
4. All rendering is pure client-side JavaScript/SVG

### Columns fetched — Risks Master Sheet
Risk ID, Risk Name, Overall Likelihood, Overall Severity, Category, Definition, Risk Status, Action Plan Status, Control Effectiveness, Risk Level, Quarter, Risk Score, Residual Likelihood, Residual Impact, Residual Score, Review Date, Recent Reviewed, Review Overdue?, ELT Owner, Risk Owner (+ email), Manager(s) (+ email), Other Managers, Mitigation Health, Mitigation Completion %, Total Mitigation Tasks, Completed Mitigation Tasks

### Columns fetched — Mitigation Tasks sheet
Risk ID, Mitigation Task, Task Status, Risk Manager(s), Responsible, Status, Progress % (0.0–1.0 decimal), Start Date, Target Date, Trend Towards Target (emoji: 👁▶⚠️), Trend Analysis, Mitigation Strategy, Definition, Severity, Likelihood, Mitigation Type, Governance/Compliance Risk

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
- **Live URL**: `https://delicate-florentine-c73974.netlify.app`
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

### SmartSheet Web Content widget embedding
- SmartSheet dashboard → Web Content widget → URL: `https://delicate-florentine-c73974.netlify.app`
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
1. **Azure App Service** — needs IT; startup.txt configured
2. **Scheduled rebake** — GitHub Action to auto-rebake on a schedule (e.g., nightly)
3. **Client-side SmartSheet API** — JS fetch eliminates Flask; token in code acceptable for internal read-only
4. **Render.com** ($7/mo) — render.yaml configured, alternative to Azure
