from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import datetime as dt
import json
import os
from pathlib import Path
from time import mktime, strptime
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "4173"))


class BacktesterHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/history":
            self.send_history(parsed.query)
            return

        super().do_GET()

    def send_history(self, query):
        params = parse_qs(query)
        symbol = params.get("s", [""])[0]
        d1 = params.get("d1", [""])[0]
        d2 = params.get("d2", [""])[0]

        if not symbol or not d1 or not d2:
            self.send_error(400, "Missing s, d1, or d2")
            return

        period1 = int(mktime(strptime(d1, "%Y%m%d")))
        period2 = int(mktime(strptime(d2, "%Y%m%d")))
        yahoo_query = urlencode({"period1": period1, "period2": period2, "interval": "1d"})
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?{yahoo_query}"
        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 BackTester/1.0",
            },
        )

        try:
            with urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
            body = yahoo_chart_to_csv(payload)
        except Exception as exc:
            self.send_error(502, f"History request failed: {exc}")
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))


def yahoo_chart_to_csv(payload):
    chart = payload.get("chart", {})
    if chart.get("error"):
        raise ValueError(chart["error"].get("description", "Yahoo chart error"))

    result = chart["result"][0]
    timestamps = result.get("timestamp", [])
    quote = result["indicators"]["quote"][0]
    lines = ["Date,Open,High,Low,Close,Volume"]

    for index, timestamp in enumerate(timestamps):
        close = quote["close"][index]
        if close is None:
            continue

        date = dt.datetime.utcfromtimestamp(timestamp).strftime("%Y-%m-%d")
        values = [
            date,
            quote["open"][index],
            quote["high"][index],
            quote["low"][index],
            close,
            quote["volume"][index] or 0,
        ]
        lines.append(",".join("" if value is None else str(value) for value in values))

    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    os.chdir(ROOT)
    server = ThreadingHTTPServer((HOST, PORT), BacktesterHandler)
    print(f"BackTester running at http://{HOST}:{PORT}")
    server.serve_forever()
