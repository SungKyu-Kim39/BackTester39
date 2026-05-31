# BackTester Dashboard

Responsive web dashboard for simple stock and ETF backtesting.

## Features

- Search by company name or ticker
- One-time or recurring purchase simulation
- Amount-based or share-based buying
- Fractional or integer-share purchase mode
- Dividend cash holding or dividend reinvestment
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

## GitHub Pages Deploy

This repository is ready for GitHub Pages. The browser reads cached CSV files from
`data/`, so no paid web server is required.

GitHub Actions included:

- `Deploy GitHub Pages`: publishes the static dashboard on every push to `main`
- `Update market data`: refreshes `data/*.csv` on weekdays, and can be run manually

In GitHub, open **Settings > Pages** and select **GitHub Actions** as the source.

## Updating Data Locally

```powershell
uv run --python 3.11 python scripts/update_data.py
```

The local Python server is still available for development:

```powershell
uv run --python 3.11 python server.py
```
