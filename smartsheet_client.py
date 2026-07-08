import os
import warnings
import smartsheet

# ── Netskope SSL proxy handling ───────────────────────────────────────────────
# Injects Windows cert store (which trusts the Netskope CA) into Python ssl.
try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

_CERT_BUNDLE = r"C:\certs\NetskopeCertBundle.crt"
if os.path.exists(_CERT_BUNDLE):
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _CERT_BUNDLE)
    os.environ.setdefault("SSL_CERT_FILE",       _CERT_BUNDLE)

try:
    from urllib3.exceptions import InsecureRequestWarning
    warnings.filterwarnings("ignore", category=InsecureRequestWarning)
except ImportError:
    pass
# ─────────────────────────────────────────────────────────────────────────────

_REQUIRED = ["Risk ID", "Risk Name", "Overall Likelihood", "Overall Severity"]

_TASK_SHEET_NAME = "Mitigation Tasks"


def _fmt_date(dt) -> str:
    """Format a SmartSheet row datetime to a readable date string."""
    if dt is None:
        return ""
    try:
        return dt.strftime("%d %b %Y")
    except Exception:
        return str(dt)[:10]


def get_task_data() -> dict[str, list[dict]]:
    """Return tasks grouped by Risk ID: { 'R01': [{...}, ...], 'R02': [...], ... }"""
    client = smartsheet.Smartsheet(os.environ["SMARTSHEET_ACCESS_TOKEN"])
    client.errors_as_exceptions(True)

    response = client.Sheets.list_sheets(include_all=True)
    sheet_id = next(
        (s.id for s in response.data if s.name == _TASK_SHEET_NAME), None
    )
    if sheet_id is None:
        return {}

    sheet = client.Sheets.get_sheet(sheet_id)
    col_map = {col.title: col.id for col in sheet.columns}

    def _val(cell_by_col, col_name: str) -> str:
        raw = cell_by_col.get(col_map.get(col_name, -1))
        return str(raw).strip() if raw is not None and raw != "" else ""

    tasks_by_risk: dict[str, list[dict]] = {}
    for row in sheet.rows:
        cell_by_col = {cell.column_id: cell.value for cell in row.cells}

        risk_id = _val(cell_by_col, "Risk ID")
        if not risk_id:
            continue

        # Progress % comes as a decimal (0.75 = 75%) — convert to int percentage
        raw_pct = cell_by_col.get(col_map.get("Progress %", -1))
        try:
            progress = int(float(raw_pct) * 100)
        except (TypeError, ValueError):
            progress = None

        task = {
            "task":               _val(cell_by_col, "Mitigation Task"),
            "task_status":        _val(cell_by_col, "Task Status"),
            "managers":           _val(cell_by_col, "Risk Manager(s)"),
            "responsible":        _val(cell_by_col, "Responsible"),
            "status":             _val(cell_by_col, "Status"),
            "progress":           progress,
            "start_date":         _val(cell_by_col, "Start Date"),
            "target_date":        _val(cell_by_col, "Target Date"),
            "trend":              _val(cell_by_col, "Trend Towards Target"),
            "trend_analysis":     _val(cell_by_col, "Trend Analysis"),
            "mitigation_strategy": _val(cell_by_col, "Mitigation Strategy"),
            "definition":         _val(cell_by_col, "Definition"),
            "severity":           cell_by_col.get(col_map.get("Severity",  -1)),
            "likelihood":         cell_by_col.get(col_map.get("Likelihood", -1)),
            "mitigation_type":    _val(cell_by_col, "Mitigation Type"),
            "gov_compliance":     _val(cell_by_col, "Governance/Compliance Risk"),
            "date_added":         _fmt_date(getattr(row, "created_at", None)),
        }

        tasks_by_risk.setdefault(risk_id, []).append(task)

    return tasks_by_risk


def get_risk_data() -> list[dict]:
    client = smartsheet.Smartsheet(os.environ["SMARTSHEET_ACCESS_TOKEN"])
    client.errors_as_exceptions(True)

    sheet_name = os.environ.get("SMARTSHEET_SHEET_NAME", "Risks Master Sheet")

    # Find the sheet by name — avoids relying on the URL's alphanumeric ID
    response = client.Sheets.list_sheets(include_all=True)
    sheet_id = next(
        (s.id for s in response.data if s.name == sheet_name), None
    )
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found in your SmartSheet account")

    sheet = client.Sheets.get_sheet(sheet_id)

    col_map = {col.title: col.id for col in sheet.columns}
    missing = [c for c in _REQUIRED if c not in col_map]
    if missing:
        raise ValueError(f"Sheet is missing expected columns: {missing}")

    risks = []
    for row in sheet.rows:
        # Store full cell objects so we can access both .value and .display_value
        cell_by_col_obj = {cell.column_id: cell for cell in row.cells}
        cell_by_col     = {cid: c.value for cid, c in cell_by_col_obj.items()}

        risk_id    = cell_by_col.get(col_map["Risk ID"])
        risk_name  = cell_by_col.get(col_map["Risk Name"])
        likelihood = cell_by_col.get(col_map["Overall Likelihood"])
        severity   = cell_by_col.get(col_map["Overall Severity"])

        if not risk_id or likelihood is None or severity is None:
            continue

        def get_optional(col_name: str) -> str:
            raw = cell_by_col.get(col_map.get(col_name, -1))
            return str(raw).strip() if raw else ""

        def get_display(col_name: str) -> str:
            """Return display name, preferring display_value over value."""
            cell = cell_by_col_obj.get(col_map.get(col_name, -1))
            if cell is None:
                return ""
            disp = getattr(cell, "display_value", None)
            if disp:
                return str(disp).strip()
            return str(cell.value).strip() if cell.value else ""

        def get_emails(col_name: str) -> str:
            """
            Return email(s) for a Contact List / Multi-Contact column.
            For CONTACT_LIST:  cell.value = email, cell.display_value = name
            For MULTI_CONTACT: cell.object_value.value = list of Contact objects
            Falls back to '' if the column is a plain text field.
            """
            cell = cell_by_col_obj.get(col_map.get(col_name, -1))
            if cell is None:
                return ""
            # Multi-contact: object_value is a MULTI_CONTACT object
            ov = getattr(cell, "object_value", None)
            if ov is not None:
                contacts = getattr(ov, "value", None) or []
                emails = [getattr(c, "email", "") for c in contacts if getattr(c, "email", "")]
                if emails:
                    return ", ".join(emails)
            # Single contact: cell.value is the email address
            val = str(cell.value).strip() if cell.value else ""
            if "@" in val:
                return val
            return ""

        try:
            risks.append({
                # Core
                "id":            str(risk_id).strip(),
                "name":          str(risk_name).strip() if risk_name else str(risk_id),
                "likelihood":    float(likelihood),
                "severity":      float(severity),
                "category":      get_optional("Category"),
                "definition":    get_optional("Definition"),
                # Page 1 — Overview
                "status":        get_optional("Risk Status"),
                "action_status": get_optional("Action Plan Status"),
                "control_eff":   get_optional("Control Effectiveness"),
                "risk_level":    get_optional("Risk Level"),
                "quarter":       get_optional("Quarter"),
                # Page 2 — Risk Data
                "risk_score":         get_optional("Risk Score"),
                "residual_likelihood": get_optional("Residual Likelihood"),
                "residual_impact":    get_optional("Residual Impact"),
                "residual_score":     get_optional("Residual Score"),
                "review_date":        get_optional("Review Date"),
                "last_reviewed":      get_optional("Recent Reviewed"),
                "review_overdue":     get_optional("Review Overdue?"),
                # Page 3 — Ownership & Mitigation
                "elt_owner":     get_display("ELT Owner"),
                "owner":         get_display("Risk Owner"),
                "owner_email":   get_emails("Risk Owner"),
                "managers":      get_display("Manager(s)"),
                "manager_email": get_emails("Manager(s)"),
                "other_managers": get_display("Other Managers"),
                "mitigation_health":  get_optional("Mitigation Health"),
                "mitigation_pct":     get_optional("Mitigation Completion %"),
                "tasks_total":        get_optional("Total Migitation Tasks"),
                "tasks_done":         get_optional("Completed Mitigation Tasks"),
                # Row metadata (SmartSheet system fields)
                "date_added":         _fmt_date(getattr(row, "created_at", None)),
                "date_modified":      _fmt_date(getattr(row, "modified_at", None)),
            })
        except (ValueError, TypeError):
            continue

    return risks
