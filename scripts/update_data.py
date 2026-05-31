import datetime as dt
import html
import json
import re
import time
from pathlib import Path
from time import mktime
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

BASE_STOCKS = [
    {"symbol": "AAPL", "yahoo": "AAPL", "name": "Apple Inc.", "market": "NASDAQ", "currency": "USD"},
    {"symbol": "MSFT", "yahoo": "MSFT", "name": "Microsoft Corp.", "market": "NASDAQ", "currency": "USD"},
    {"symbol": "NVDA", "yahoo": "NVDA", "name": "NVIDIA Corp.", "market": "NASDAQ", "currency": "USD"},
    {"symbol": "TSLA", "yahoo": "TSLA", "name": "Tesla Inc.", "market": "NASDAQ", "currency": "USD"},
    {"symbol": "GOOGL", "yahoo": "GOOGL", "name": "Alphabet Inc. Class A", "market": "NASDAQ", "currency": "USD"},
    {"symbol": "AMZN", "yahoo": "AMZN", "name": "Amazon.com Inc.", "market": "NASDAQ", "currency": "USD"},
    {"symbol": "META", "yahoo": "META", "name": "Meta Platforms Inc.", "market": "NASDAQ", "currency": "USD"},
    {"symbol": "BRK.B", "yahoo": "BRK-B", "name": "Berkshire Hathaway Inc.", "market": "NYSE", "currency": "USD"},
    {"symbol": "SPY", "yahoo": "SPY", "name": "SPDR S&P 500 ETF", "market": "NYSE Arca", "currency": "USD"},
    {"symbol": "QQQ", "yahoo": "QQQ", "name": "Invesco QQQ Trust", "market": "NASDAQ", "currency": "USD"},
    {"symbol": "SCHD", "yahoo": "SCHD", "name": "Schwab US Dividend Equity ETF", "market": "NYSE Arca", "currency": "USD"},
    {"symbol": "VOO", "yahoo": "VOO", "name": "Vanguard S&P 500 ETF", "market": "NYSE Arca", "currency": "USD"},
    {"symbol": "VTI", "yahoo": "VTI", "name": "Vanguard Total Stock Market ETF", "market": "NYSE Arca", "currency": "USD"},
    {"symbol": "IVV", "yahoo": "IVV", "name": "iShares Core S&P 500 ETF", "market": "NYSE Arca", "currency": "USD"},
    {"symbol": "DIA", "yahoo": "DIA", "name": "SPDR Dow Jones Industrial Average ETF", "market": "NYSE Arca", "currency": "USD"},
    {"symbol": "IWM", "yahoo": "IWM", "name": "iShares Russell 2000 ETF", "market": "NYSE Arca", "currency": "USD"},
    {"symbol": "XLK", "yahoo": "XLK", "name": "Technology Select Sector SPDR Fund", "market": "NYSE Arca", "currency": "USD"},
    {"symbol": "VGT", "yahoo": "VGT", "name": "Vanguard Information Technology ETF", "market": "NYSE Arca", "currency": "USD"},
    {"symbol": "JEPI", "yahoo": "JEPI", "name": "JPMorgan Equity Premium Income ETF", "market": "NYSE Arca", "currency": "USD"},
    {"symbol": "TQQQ", "yahoo": "TQQQ", "name": "ProShares UltraPro QQQ", "market": "NASDAQ", "currency": "USD"},
    {"symbol": "005930", "yahoo": "005930.KS", "name": "Samsung Electronics", "market": "KRX", "currency": "KRW"},
    {"symbol": "000660", "yahoo": "000660.KS", "name": "SK hynix", "market": "KRX", "currency": "KRW"},
]

TOP_COUNT = 200


def safe_name(symbol):
    return "".join(char if char.isalnum() or char in ".-" else "_" for char in symbol).upper()


def display_symbol(yahoo_symbol):
    return yahoo_symbol.replace("-", ".") if "-" in yahoo_symbol else yahoo_symbol


def request_text(url):
    request = Request(
        url,
        headers={
            "Accept": "text/html,application/json",
            "User-Agent": "Mozilla/5.0 BackTester/1.0",
        },
    )
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def scrape_top_market_cap_stocks(limit=TOP_COUNT):
    stocks = []
    seen = set()
    page = 1

    while len(stocks) < limit and page <= 5:
        suffix = "" if page == 1 else f"?page={page}"
        url = f"https://companiesmarketcap.com/usa/largest-companies-in-the-usa-by-market-cap/{suffix}"
        body = request_text(url)
        rows = re.findall(r"<tr>(.*?)</tr>", body, flags=re.DOTALL)

        for row in rows:
            code_match = re.search(r'<div class="company-code">(.*?)</div>', row, flags=re.DOTALL)
            name_match = re.search(r'<div class="company-name">(.*?)</div>', row, flags=re.DOTALL)
            market_cap_match = re.search(r'<td class="td-right" data-sort="(\d+)">', row)
            if not code_match or not name_match:
                continue

            yahoo = html.unescape(re.sub(r"<.*?>", "", code_match.group(1))).strip()
            yahoo = re.sub(r"\s+", "", yahoo)
            name = html.unescape(re.sub(r"<.*?>", "", name_match.group(1))).strip()
            if not yahoo or yahoo in seen:
                continue

            seen.add(yahoo)
            stocks.append(
                {
                    "symbol": display_symbol(yahoo),
                    "yahoo": yahoo,
                    "name": name,
                    "market": "US",
                    "currency": "USD",
                    "rankMarketCap": len(stocks) + 1,
                    "marketCap": int(market_cap_match.group(1)) if market_cap_match else None,
                    "source": "companiesmarketcap-us-top-market-cap",
                }
            )
            if len(stocks) >= limit:
                break

        page += 1
        time.sleep(0.2)

    return stocks


def fetch_yahoo_most_active_candidates(limit=TOP_COUNT):
    url = f"https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count={limit}"
    payload = json.loads(request_text(url))
    quotes = payload["finance"]["result"][0].get("quotes", [])
    stocks = []

    for quote in quotes:
        symbol = quote.get("symbol")
        if not symbol:
            continue
        stocks.append(
            {
                "symbol": display_symbol(symbol),
                "yahoo": symbol,
                "name": quote.get("longName") or quote.get("shortName") or symbol,
                "market": quote.get("fullExchangeName") or quote.get("exchange") or "US",
                "currency": quote.get("currency") or "USD",
                "dayVolume": quote.get("regularMarketVolume") or quote.get("averageDailyVolume3Month") or 0,
                "source": "yahoo-most-actives",
            }
        )

    return stocks


def weekly_volume_from_payload(payload):
    quote = payload["chart"]["result"][0]["indicators"]["quote"][0]
    volumes = [volume or 0 for volume in quote.get("volume", [])]
    return sum(volumes[-5:])


def build_stock_universe():
    stocks_by_yahoo = {stock["yahoo"]: {**stock, "tags": ["base"]} for stock in BASE_STOCKS}

    for stock in scrape_top_market_cap_stocks(TOP_COUNT):
        current = stocks_by_yahoo.setdefault(stock["yahoo"], {**stock, "tags": []})
        current.update({key: value for key, value in stock.items() if value is not None})
        current.setdefault("tags", []).append("market_cap_top_200")

    volume_candidates = fetch_yahoo_most_active_candidates(TOP_COUNT)
    volume_ranked = []
    for stock in volume_candidates:
        try:
            payload = fetch_payload(stock["yahoo"], days=14)
            stock["weeklyVolume"] = weekly_volume_from_payload(payload)
            volume_ranked.append(stock)
        except Exception as exc:
            print(f"skipped weekly volume for {stock['yahoo']}: {exc}")
        time.sleep(0.1)

    volume_ranked.sort(key=lambda item: item.get("weeklyVolume", 0), reverse=True)
    for rank, stock in enumerate(volume_ranked[:TOP_COUNT], start=1):
        current = stocks_by_yahoo.setdefault(stock["yahoo"], {**stock, "tags": []})
        current.update({key: value for key, value in stock.items() if value is not None})
        current.setdefault("tags", []).append("weekly_volume_top_200")
        current["rankWeeklyVolume"] = rank

    return sorted(stocks_by_yahoo.values(), key=lambda item: item["symbol"])


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


def fetch_payload(symbol, days=None):
    start = dt.datetime.utcnow() - dt.timedelta(days=days) if days else dt.datetime(2000, 1, 1)
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
    stocks = build_stock_universe()
    manifest = {
        "updatedAt": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "symbols": {},
        "stockCount": 0,
        "sources": {
            "marketCapTop200": "https://companiesmarketcap.com/usa/largest-companies-in-the-usa-by-market-cap/",
            "weeklyVolumeTop200": "Yahoo Finance most_actives candidates sorted by trailing five trading-day volume",
        },
    }

    generated_stocks = []
    for index, stock in enumerate(stocks, start=1):
        symbol = stock["yahoo"]
        try:
            payload = fetch_payload(symbol)
        except Exception as exc:
            print(f"skipped {symbol}: {exc}")
            continue

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
        generated_stocks.append(stock)
        print(f"[{index}/{len(stocks)}] updated {symbol} -> data/{file_name}, data/{dividends_file_name}")

    manifest["stockCount"] = len(generated_stocks)

    (DATA_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (DATA_DIR / "stocks.json").write_text(
        json.dumps(
            {
                "updatedAt": manifest["updatedAt"],
                "stocks": generated_stocks,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
