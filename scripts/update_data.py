import datetime as dt
import json
from pathlib import Path
from time import mktime
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

SYMBOLS = [
    "AAPL",
    "MSFT",
    "NVDA",
    "TSLA",
    "GOOGL",
    "AMZN",
    "META",
    "BRK-B",
    "SPY",
    "QQQ",
    "SCHD",
    "VOO",
    "VTI",
    "IVV",
    "DIA",
    "IWM",
    "XLK",
    "VGT",
    "JEPI",
    "TQQQ",
    "005930.KS",
    "000660.KS",
]


def safe_name(symbol):
    return "".join(char if char.isalnum() or char in ".-" else "_" for char in symbol).upper()


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


def yahoo_dividends_to_csv(payload):
    chart = payload.get("chart", {})
    if chart.get("error"):
        raise ValueError(chart["error"].get("description", "Yahoo chart error"))

    result = chart["result"][0]
    dividends = result.get("events", {}).get("dividends", {})
    rows = []

    for event in dividends.values():
        timestamp = event.get("date")
        amount = event.get("amount")
        if timestamp is None or amount is None:
            continue
        date = dt.datetime.utcfromtimestamp(timestamp).strftime("%Y-%m-%d")
        rows.append((date, amount))

    lines = ["Date,Dividend"]
    for date, amount in sorted(rows):
        lines.append(f"{date},{amount}")

    return "\n".join(lines) + "\n"


def fetch_payload(symbol):
    start = dt.datetime(1990, 1, 1)
    end = dt.datetime.utcnow() + dt.timedelta(days=1)
    query = urlencode(
        {
            "period1": int(mktime(start.timetuple())),
            "period2": int(mktime(end.timetuple())),
            "interval": "1d",
            "events": "div",
        }
    )
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?{query}"
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 BackTester/1.0",
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    DATA_DIR.mkdir(exist_ok=True)
    manifest = {
        "updatedAt": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "symbols": {},
    }

    for symbol in SYMBOLS:
        payload = fetch_payload(symbol)
        csv = yahoo_chart_to_csv(payload)
        dividends_csv = yahoo_dividends_to_csv(payload)
        file_name = f"{safe_name(symbol)}.csv"
        dividends_file_name = f"{safe_name(symbol)}_dividends.csv"
        (DATA_DIR / file_name).write_text(csv, encoding="utf-8", newline="\n")
        (DATA_DIR / dividends_file_name).write_text(
            dividends_csv,
            encoding="utf-8",
            newline="\n",
        )
        manifest["symbols"][symbol] = {
            "prices": file_name,
            "dividends": dividends_file_name,
        }
        print(f"updated {symbol} -> data/{file_name}, data/{dividends_file_name}")

    (DATA_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
