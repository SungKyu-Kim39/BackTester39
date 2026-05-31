const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      if (url.pathname === "/api/search") {
        return jsonResponse(await search(url.searchParams.get("q") || ""));
      }

      if (url.pathname === "/api/history") {
        return csvResponse(await historyCsv(url.searchParams));
      }

      if (url.pathname === "/api/dividends") {
        return csvResponse(await dividendsCsv(url.searchParams));
      }

      return jsonResponse({
        ok: true,
        endpoints: ["/api/search?q=AAPL", "/api/history?s=AAPL&d1=20200101&d2=20260531", "/api/dividends?s=AAPL&d1=20200101&d2=20260531"],
      });
    } catch (error) {
      return jsonResponse({ error: error.message || "Request failed" }, 500);
    }
  },
};

async function search(query) {
  const q = query.trim();
  if (!q) return { quotes: [] };

  const yahooUrl = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  yahooUrl.searchParams.set("q", q);
  yahooUrl.searchParams.set("quotesCount", "12");
  yahooUrl.searchParams.set("newsCount", "0");
  yahooUrl.searchParams.set("enableFuzzyQuery", "true");

  const payload = await yahooJson(yahooUrl);
  const quotes = (payload.quotes || [])
    .filter((quote) => quote.symbol && ["EQUITY", "ETF", "MUTUALFUND"].includes(quote.quoteType))
    .map((quote) => ({
      symbol: displaySymbol(quote.symbol),
      yahoo: quote.symbol,
      name: quote.longname || quote.shortname || quote.symbol,
      market: quote.exchDisp || quote.exchange || "Yahoo Finance",
      currency: quote.currency || "USD",
      custom: true,
    }));

  return { quotes };
}

async function historyCsv(params) {
  const payload = await chart(params);
  return chartToCsv(payload);
}

async function dividendsCsv(params) {
  const payload = await chart(params);
  return dividendsToCsv(payload);
}

async function chart(params) {
  const symbol = requireParam(params, "s");
  const d1 = requireParam(params, "d1");
  const d2 = requireParam(params, "d2");

  const yahooUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  yahooUrl.searchParams.set("period1", String(toUnix(d1)));
  yahooUrl.searchParams.set("period2", String(toUnix(d2) + 86400));
  yahooUrl.searchParams.set("interval", "1d");
  yahooUrl.searchParams.set("events", "div");

  return yahooJson(yahooUrl);
}

async function yahooJson(url) {
  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": "BackTester39/1.0",
    },
    cf: { cacheTtl: 900, cacheEverything: true },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed: ${response.status}`);
  }

  return response.json();
}

function chartToCsv(payload) {
  const result = getChartResult(payload);
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const lines = ["Date,Open,High,Low,Close,Volume"];

  timestamps.forEach((timestamp, index) => {
    const close = quote.close?.[index];
    if (close == null || Number.isNaN(Number(close))) return;

    lines.push(
      [
        dateFromUnix(timestamp),
        quote.open?.[index] ?? "",
        quote.high?.[index] ?? "",
        quote.low?.[index] ?? "",
        close,
        quote.volume?.[index] ?? 0,
      ].join(","),
    );
  });

  return `${lines.join("\n")}\n`;
}

function dividendsToCsv(payload) {
  const result = getChartResult(payload);
  const dividends = result.events?.dividends || {};
  const lines = ["Date,Dividend"];

  Object.values(dividends)
    .map((event) => ({
      date: dateFromUnix(event.date),
      amount: event.amount,
    }))
    .filter((event) => event.date && event.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((event) => lines.push(`${event.date},${event.amount}`));

  return `${lines.join("\n")}\n`;
}

function getChartResult(payload) {
  const chart = payload.chart || {};
  if (chart.error) {
    throw new Error(chart.error.description || "Yahoo chart error");
  }

  const result = chart.result?.[0];
  if (!result) {
    throw new Error("No chart result");
  }

  return result;
}

function requireParam(params, name) {
  const value = params.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function toUnix(dateKey) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(4, 6));
  const day = Number(dateKey.slice(6, 8));
  return Math.floor(Date.UTC(year, month - 1, day) / 1000);
}

function dateFromUnix(timestamp) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function displaySymbol(symbol) {
  return symbol.replace("-", ".");
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function csvResponse(payload, status = 200) {
  return new Response(payload, {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
}
