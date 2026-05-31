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


def fetch_symbol(symbol):
    start = dt.datetime(1990, 1, 1)
    end = dt.datetime.utcnow() + dt.timedelta(days=1)
    query = urlencode(
        {
            "period1": int(mktime(start.timetuple())),
            "period2": int(mktime(end.timetuple())),
            "interval": "1d",
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
        payload = json.loads(response.read().decode("utf-8"))
    return yahoo_chart_to_csv(payload)


def main():
    DATA_DIR.mkdir(exist_ok=True)
    manifest = {
        "updatedAt": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "symbols": {},
    }

    for symbol in SYMBOLS:
        csv = fetch_symbol(symbol)
        file_name = f"{safe_name(symbol)}.csv"
        (DATA_DIR / file_name).write_text(csv, encoding="utf-8", newline="\n")
        manifest["symbols"][symbol] = file_name
        print(f"updated {symbol} -> data/{file_name}")

    (DATA_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
