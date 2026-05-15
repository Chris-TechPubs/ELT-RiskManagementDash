import time
from flask import Flask, render_template, jsonify, redirect, url_for
from dotenv import load_dotenv

load_dotenv()

from smartsheet_client import get_risk_data

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.jinja_env.auto_reload = True


@app.after_request
def allow_embedding(response):
    """Allow this app to be embedded in iframes (e.g. SmartSheet dashboards).
    X-Frame-Options is intentionally removed — its absence allows all embedding.
    CSP frame-ancestors * explicitly permits any origin to frame this content."""
    response.headers.discard('X-Frame-Options')  # remove entirely; ALLOWALL is non-standard
    response.headers['Content-Security-Policy'] = "frame-ancestors *"
    return response

_cache: dict = {"data": None, "ts": 0.0}
CACHE_TTL = 300  # 5 minutes — avoids hammering the SmartSheet API


def _cached_risks() -> list[dict]:
    if _cache["data"] is None or time.time() - _cache["ts"] > CACHE_TTL:
        _cache["data"] = get_risk_data()
        _cache["ts"] = time.time()
    return _cache["data"]


@app.route("/")
def index():
    return redirect(url_for("heatmap"))


@app.route("/test")
def test_page():
    import os
    from flask import send_file
    return send_file(os.path.join(os.path.dirname(__file__), 'test_smartsheet.html'))


@app.route("/heatmap")
def heatmap():
    risks = _cached_risks()
    return render_template("heatmap.html", risks=risks)


@app.route("/refresh")
def refresh():
    """Force a cache bust — useful after updating data in SmartSheet."""
    _cache["data"] = None
    _cache["ts"] = 0.0
    return redirect(url_for("heatmap"))


@app.route("/health")
def health():
    return jsonify({"status": "ok", "risks": len(_cache["data"] or [])})


@app.route("/api/risks")
def api_risks():
    """JSON endpoint for client-side rendering (CORS-enabled)."""
    risks = _cached_risks()
    response = jsonify(risks)
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response


# ── Looker Studio Community Visualization ─────────────────────────────────────
# The viz is a minimal iframe wrapper around the full heatmap.
# Looker Studio (on SmartSheet's approved list) hosts it; our heatmap renders inside.

def _cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

@app.route("/viz/manifest.json")
def viz_manifest():
    from flask import Response
    import json
    manifest = {
        "name": "ELT Risk Heatmap",
        "organization": "Allegion",
        "description": "Interactive ELT Risk Management Heatmap",
        "logoUrl": "https://fonts.gstatic.com/s/i/googlematerialicons/analytics/v12/gm_grey-24dp/1x/gm_analytics_gm_grey_24dp.png",
        "organizationUrl": "https://allegion.com",
        "package": {
            "componentsVersion": "3",
            "devMode": True,
            "jsUrl": "https://elt-riskmanagementdash.onrender.com/viz/index.js",
            "cssUrl": "https://elt-riskmanagementdash.onrender.com/viz/index.css"
        }
    }
    return _cors(Response(json.dumps(manifest, indent=2), mimetype='application/json'))

@app.route("/viz/index.js")
def viz_js():
    from flask import Response
    js = r"""
(function() {
  document.documentElement.style.cssText = 'height:100%;margin:0;padding:0;';
  document.body.style.cssText = 'margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#fff;';
  var f = document.createElement('iframe');
  f.src = 'https://elt-riskmanagementdash.onrender.com/heatmap';
  f.style.cssText = 'border:none;width:100%;height:100vh;display:block;';
  document.body.appendChild(f);
  // Required Looker Studio subscription (data from Looker Studio is unused —
  // the heatmap fetches directly from the SmartSheet API via our backend)
  function drawViz(data) {}
  dscc.subscribeToData(drawViz, {transform: dscc.objectTransform});
})();
"""
    return _cors(Response(js, mimetype='application/javascript'))

@app.route("/viz/index.css")
def viz_css():
    from flask import Response
    return _cors(Response('html,body{margin:0;padding:0;height:100%;overflow:hidden;}', mimetype='text/css'))


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5001)
