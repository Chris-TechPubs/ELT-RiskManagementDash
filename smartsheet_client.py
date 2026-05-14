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
        cell_by_col = {cell.column_id: cell.value for cell in row.cells}

        risk_id   = cell_by_col.get(col_map["Risk ID"])
        risk_name = cell_by_col.get(col_map["Risk Name"])
        likelihood = cell_by_col.get(col_map["Overall Likelihood"])
        severity   = cell_by_col.get(col_map["Overall Severity"])

        if not risk_id or likelihood is None or severity is None:
            continue

        def get_optional(col_name: str) -> str:
            raw = cell_by_col.get(col_map.get(col_name, -1))
            return str(raw).strip() if raw else ""

        try:
            risks.append({
                "id":         str(risk_id).strip(),
                "name":       str(risk_name).strip() if risk_name else str(risk_id),
                "likelihood": float(likelihood),
                "severity":   float(severity),
                "category":   get_optional("Category"),
                "definition": get_optional("Definition"),
                "status":     get_optional("Risk Status"),
                "owner":      get_optional("Risk Owner"),
                "managers":   get_optional("Manager(s)"),
            })
        except (ValueError, TypeError):
            continue

    return risks
