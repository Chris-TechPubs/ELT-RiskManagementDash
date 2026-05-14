import time
from flask import Flask, render_template, jsonify, redirect, url_for
from dotenv import load_dotenv

load_dotenv()

from smartsheet_client import get_risk_data

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.jinja_env.auto_reload = True

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


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5001)
