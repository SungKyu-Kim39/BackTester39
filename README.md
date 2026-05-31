# BackTester Dashboard

Responsive web dashboard for simple stock and ETF backtesting.

## Features

- Search by company name or ticker
- One-time or recurring purchase simulation
- Amount-based or share-based buying
- Fractional or integer-share purchase mode
- Price and portfolio-value chart with hover details
- Local Python proxy for Yahoo Finance daily chart data

## Run Locally

```powershell
uv run --python 3.11 python server.py
```

Open:

```text
http://127.0.0.1:4173/
```

## Deploy

This app needs a Python web process because browsers block direct market-data requests from static pages. Deploy it as a web service, not as GitHub Pages.

Render settings:

- Build command: leave empty or use `pip install -r requirements.txt`
- Start command: `python server.py`
- Environment variable: `HOST=0.0.0.0`

