let stocks = [
  { symbol: "AAPL", yahoo: "AAPL", name: "Apple Inc.", market: "NASDAQ", currency: "USD" },
  { symbol: "MSFT", yahoo: "MSFT", name: "Microsoft Corp.", market: "NASDAQ", currency: "USD" },
  { symbol: "NVDA", yahoo: "NVDA", name: "NVIDIA Corp.", market: "NASDAQ", currency: "USD" },
  { symbol: "TSLA", yahoo: "TSLA", name: "Tesla Inc.", market: "NASDAQ", currency: "USD" },
  { symbol: "GOOGL", yahoo: "GOOGL", name: "Alphabet Inc. Class A", market: "NASDAQ", currency: "USD" },
  { symbol: "AMZN", yahoo: "AMZN", name: "Amazon.com Inc.", market: "NASDAQ", currency: "USD" },
  { symbol: "META", yahoo: "META", name: "Meta Platforms Inc.", market: "NASDAQ", currency: "USD" },
  { symbol: "BRK.B", yahoo: "BRK-B", name: "Berkshire Hathaway Inc.", market: "NYSE", currency: "USD" },
  { symbol: "SPY", yahoo: "SPY", name: "SPDR S&P 500 ETF", market: "NYSE Arca", currency: "USD" },
  { symbol: "QQQ", yahoo: "QQQ", name: "Invesco QQQ Trust", market: "NASDAQ", currency: "USD" },
  { symbol: "SCHD", yahoo: "SCHD", name: "Schwab US Dividend Equity ETF", market: "NYSE Arca", currency: "USD" },
  { symbol: "VOO", yahoo: "VOO", name: "Vanguard S&P 500 ETF", market: "NYSE Arca", currency: "USD" },
  { symbol: "VTI", yahoo: "VTI", name: "Vanguard Total Stock Market ETF", market: "NYSE Arca", currency: "USD" },
  { symbol: "IVV", yahoo: "IVV", name: "iShares Core S&P 500 ETF", market: "NYSE Arca", currency: "USD" },
  { symbol: "DIA", yahoo: "DIA", name: "SPDR Dow Jones Industrial Average ETF", market: "NYSE Arca", currency: "USD" },
  { symbol: "IWM", yahoo: "IWM", name: "iShares Russell 2000 ETF", market: "NYSE Arca", currency: "USD" },
  { symbol: "XLK", yahoo: "XLK", name: "Technology Select Sector SPDR Fund", market: "NYSE Arca", currency: "USD" },
  { symbol: "VGT", yahoo: "VGT", name: "Vanguard Information Technology ETF", market: "NYSE Arca", currency: "USD" },
  { symbol: "JEPI", yahoo: "JEPI", name: "JPMorgan Equity Premium Income ETF", market: "NYSE Arca", currency: "USD" },
  { symbol: "TQQQ", yahoo: "TQQQ", name: "ProShares UltraPro QQQ", market: "NASDAQ", currency: "USD" },
  { symbol: "005930", yahoo: "005930.KS", name: "Samsung Electronics", market: "KRX", currency: "KRW" },
  { symbol: "000660", yahoo: "000660.KS", name: "SK hynix", market: "KRX", currency: "KRW" },
];

function mergeStocks(baseStocks, extraStocks) {
  const merged = new Map();
  [...baseStocks, ...extraStocks].forEach((stock) => {
    if (!stock?.symbol || !stock?.yahoo) return;
    merged.set(stock.symbol.toUpperCase(), {
      currency: "USD",
      market: "US",
      ...stock,
    });
  });
  return [...merged.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

async function loadStockUniverse() {
  try {
    const response = await fetch("data/stocks.json", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    stocks = mergeStocks(stocks, payload.stocks || []);
    renderSuggestions();
  } catch {
    // The bundled defaults are enough when the expanded universe is unavailable.
  }
}

const form = document.querySelector("#backtestForm");
const searchInput = document.querySelector("#tickerSearch");
const suggestions = document.querySelector("#suggestions");
const buyModeInputs = document.querySelectorAll("input[name='buyMode']");
const inputTypeInputs = document.querySelectorAll("input[name='inputType']");
const recurringOnly = document.querySelectorAll(".recurring-only");
const amountFields = document.querySelectorAll(".amount-field");
const sharesFields = document.querySelectorAll(".shares-field");
const statusBox = document.querySelector("#status");
const selectedTitle = document.querySelector("#selectedTitle");
const chart = document.querySelector("#performanceChart");
const tooltip = document.querySelector("#tooltip");
const ctx = chart.getContext("2d");

let selectedStock = stocks[0];
let chartPoints = [];
let activeSuggestion = -1;
let remoteSuggestions = [];
let remoteSuggestionsQuery = "";
let searchRequestId = 0;

const WORKER_API_BASE = "https://gentle-hat-70b2.kgf7740.workers.dev";

function historyFileName(stock) {
  const symbol = stock.yahoo || stock.symbol.replace(".", "-");
  return symbol.replace(/[^A-Z0-9.-]/gi, "_").toUpperCase();
}

const corsProxies = [
  (url) => `https://r.jina.ai/${url}`,
  (url) => `https://r.jina.ai/${url.replace("https://", "http://")}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function moneyFormatter(options = {}) {
  const code = selectedStock?.currency || "USD";
  return new Intl.NumberFormat(code === "KRW" ? "ko-KR" : "en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: code === "KRW" ? 0 : 2,
    ...options,
  });
}

function formatMoney(value) {
  return moneyFormatter().format(value);
}

function formatCompactMoney(value) {
  return moneyFormatter({ notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function getMode() {
  return document.querySelector("input[name='buyMode']:checked").value;
}

function getInputType() {
  return document.querySelector("input[name='inputType']:checked").value;
}

function syncModeUi() {
  const recurring = getMode() === "recurring";
  recurringOnly.forEach((node) => node.classList.toggle("hidden", !recurring));
}

function syncInputTypeUi() {
  const amount = getInputType() === "amount";
  amountFields.forEach((node) => node.classList.toggle("hidden", !amount));
  sharesFields.forEach((node) => node.classList.toggle("hidden", amount));
}

function normalizeQuery(value) {
  return value.trim().toLowerCase();
}

function renderSuggestions() {
  const query = normalizeQuery(searchInput.value);
  if (!query) {
    suggestions.classList.remove("visible");
    suggestions.innerHTML = "";
    remoteSuggestions = [];
    remoteSuggestionsQuery = "";
    return;
  }

  if (remoteSuggestionsQuery && remoteSuggestionsQuery !== query) {
    remoteSuggestions = [];
  }

  const matches = stocks
    .filter((stock) => {
      const haystack = `${stock.symbol} ${stock.name} ${stock.market}`.toLowerCase();
      return haystack.includes(query);
    })
    .slice(0, 7);

  for (const stock of remoteSuggestions) {
    if (matches.length >= 10) break;
    if (!matches.some((match) => match.yahoo === stock.yahoo || match.symbol === stock.symbol)) {
      matches.push(stock);
    }
  }

  const customSymbol = query.toUpperCase();
  if (
    customSymbol.length >= 1 &&
    /^[A-Z0-9.-]+$/.test(customSymbol) &&
    !matches.some((stock) => stock.symbol.toLowerCase() === query)
  ) {
    matches.push({
      symbol: customSymbol,
      yahoo: customSymbol,
      name: "직접 입력 티커",
      market: "Yahoo Finance",
      currency: "USD",
      custom: true,
    });
  }

  activeSuggestion = -1;
  suggestions.innerHTML = matches
    .map(
      (stock, index) => `
        <button class="suggestion" type="button" data-index="${index}">
          <strong>${stock.symbol}</strong> ${stock.name}
          <span>${stock.market} · ${stock.yahoo}</span>
        </button>
      `,
    )
    .join("");
  suggestions.classList.toggle("visible", matches.length > 0);
  suggestions.querySelectorAll(".suggestion").forEach((button, index) => {
    button.addEventListener("click", () => selectStock(matches[index]));
  });
  requestRemoteSuggestions(query);
}

async function requestRemoteSuggestions(query) {
  if (query.length < 2) return;
  if (remoteSuggestionsQuery === query) return;
  const requestId = ++searchRequestId;

  try {
    const url = `${WORKER_API_BASE}/api/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    if (requestId !== searchRequestId) return;

    remoteSuggestionsQuery = query;
    remoteSuggestions = (payload.quotes || []).map((stock) => ({
      currency: "USD",
      market: "Yahoo Finance",
      ...stock,
      custom: true,
    }));
    renderSuggestions();
  } catch {
    // Static suggestions and direct ticker input remain available.
  }
}

function selectStock(stock) {
  selectedStock = stock;
  searchInput.value = `${stock.symbol} · ${stock.name}`;
  selectedTitle.textContent = `${stock.name} · ${stock.symbol}`;
  document.querySelector("#currencyPrefix").textContent = stock.currency === "KRW" ? "₩" : "$";
  suggestions.classList.remove("visible");
  setStatus(`${stock.symbol} 선택됨. 조건을 입력하고 계산하세요.`);
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function parseCsv(csv) {
  const headerIndex = csv.indexOf("Date,Open,High,Low,Close,Volume");
  if (headerIndex >= 0) {
    csv = csv.slice(headerIndex);
  }

  const lines = csv.trim().split(/\r?\n/);
  const rows = [];
  for (const line of lines.slice(1)) {
    const [date, open, high, low, close, volume] = line.split(",");
    const closeNumber = Number(close);
    if (!date || !Number.isFinite(closeNumber)) continue;
    rows.push({
      date,
      close: closeNumber,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      volume: Number(volume),
    });
  }
  return rows;
}

function parseDividends(csv) {
  if (!csv || !csv.trim()) return [];
  const headerIndex = csv.indexOf("Date,Dividend");
  if (headerIndex >= 0) {
    csv = csv.slice(headerIndex);
  }

  return csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [date, dividend] = line.split(",");
      return { date, dividend: Number(dividend) };
    })
    .filter((row) => row.date && Number.isFinite(row.dividend) && row.dividend > 0);
}

async function fetchHistory(stock, startDate) {
  const start = new Date(startDate);
  start.setFullYear(start.getFullYear() - 1);
  const today = new Date();
  const d1 = toDateKey(start);
  const d2 = toDateKey(today);
  const yahooSymbol = stock.yahoo || stock.symbol.replace(".", "-");
  const appOrigin = location.protocol === "file:" ? "http://127.0.0.1:4173" : location.origin;
  const apiUrl = `${appOrigin}/api/history?s=${encodeURIComponent(yahooSymbol)}&d1=${d1}&d2=${d2}`;
  const workerUrl = `${WORKER_API_BASE}/api/history?s=${encodeURIComponent(yahooSymbol)}&d1=${d1}&d2=${d2}`;
  const staticUrl = `data/${historyFileName(stock)}.csv`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${Math.floor(start.getTime() / 1000)}&period2=${Math.floor(today.getTime() / 1000)}&interval=1d`;
  const csv = await fetchText(url, { workerUrl, apiUrl, staticUrl, custom: stock.custom });
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("가격 데이터를 찾을 수 없습니다.");
  return rows;
}

async function fetchDividends(stock) {
  const today = new Date();
  const yahooSymbol = stock.yahoo || stock.symbol.replace(".", "-");
  const workerUrl = `${WORKER_API_BASE}/api/dividends?s=${encodeURIComponent(yahooSymbol)}&d1=19000101&d2=${toDateKey(today)}`;

  try {
    const response = await fetch(workerUrl, { cache: "no-store" });
    if (response.ok) return parseDividends(await response.text());
  } catch {
    // Fall back to cached static data below.
  }

  const staticUrl = `data/${historyFileName(stock)}_dividends.csv`;

  try {
    const response = await fetch(staticUrl, { cache: "no-store" });
    if (!response.ok) return [];
    return parseDividends(await response.text());
  } catch {
    return [];
  }
}

async function fetchText(url, options = {}) {
  const { workerUrl = null, apiUrl = null, staticUrl = null, custom = false } = options;
  const targets = [
    ...(workerUrl ? [{ label: "Cloudflare Worker", url: workerUrl }] : []),
    ...(staticUrl ? [{ label: "저장된 GitHub Pages 데이터", url: staticUrl }] : []),
    ...(apiUrl ? [{ label: "로컬 API", url: apiUrl }] : []),
    { label: "직접 요청", url },
    ...corsProxies.map((proxy, index) => ({ label: `대체 경로 ${index + 1}`, url: proxy(url) })),
  ];
  const errors = [];

  for (const target of targets) {
    try {
      const response = await fetch(target.url, { cache: "no-store" });
      if (!response.ok) {
        errors.push(`${target.label}: ${response.status}`);
        continue;
      }

      const text = await response.text();
      if (text.includes("Date,Open,High,Low,Close,Volume")) return text;
      errors.push(`${target.label}: 응답 형식 불일치`);
    } catch (error) {
      errors.push(`${target.label}: ${error.message || "요청 실패"}`);
    }
  }

  if (custom) {
    throw new Error(
      "해당 티커 데이터를 가져오지 못했습니다. Cloudflare Worker 배포 상태 또는 Yahoo Finance 티커를 확인하세요.",
    );
  }

  throw new Error(
    `가격 데이터를 가져오지 못했습니다. GitHub Pages 데이터 또는 네트워크를 확인하세요. (${errors.slice(-3).join(", ") || "원인 불명"})`,
  );
}

function addPeriod(date, frequency) {
  const next = new Date(date);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  if (frequency === "quarterly") next.setMonth(next.getMonth() + 3);
  if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  return next;
}

function simulate(rows, dividends, options) {
  const start = new Date(options.startDate);
  const filtered = rows.filter((row) => new Date(row.date) >= start);
  if (!filtered.length) throw new Error("선택한 매수일 이후 가격 데이터가 없습니다.");

  let shares = 0;
  let invested = 0;
  let dividendCash = 0;
  let dividendsReceived = 0;
  let dividendsReinvested = 0;
  let nextBuyDate = new Date(options.startDate);
  let hasSingleBuy = false;
  const trades = [];
  const series = [];
  const dividendsByDate = new Map();

  for (const dividend of dividends) {
    if (!dividendsByDate.has(dividend.date)) dividendsByDate.set(dividend.date, []);
    dividendsByDate.get(dividend.date).push(dividend);
  }

  for (const row of filtered) {
    const rowDate = new Date(row.date);
    let shouldBuy = false;

    if (options.mode === "single" && !hasSingleBuy && rowDate >= nextBuyDate) {
      shouldBuy = true;
      hasSingleBuy = true;
    }

    if (options.mode === "recurring" && rowDate >= nextBuyDate) {
      shouldBuy = true;
      while (nextBuyDate <= rowDate) {
        nextBuyDate = addPeriod(nextBuyDate, options.frequency);
      }
    }

    if (shouldBuy) {
      let boughtShares = 0;
      let spent = 0;
      if (options.inputType === "amount") {
        boughtShares = options.fractional
          ? options.amount / row.close
          : Math.floor(options.amount / row.close);
        spent = boughtShares * row.close;
      } else {
        boughtShares = options.shares;
        spent = boughtShares * row.close;
      }

      if (boughtShares > 0) {
        shares += boughtShares;
        invested += spent;
        trades.push({
          type: "buy",
          date: row.date,
          price: row.close,
          shares: boughtShares,
          spent,
        });
      }
    }

    const dayDividends = dividendsByDate.get(row.date) || [];
    for (const dividend of dayDividends) {
      const eligibleShares = Math.floor(shares);
      const received = eligibleShares * dividend.dividend;
      if (received <= 0) continue;

      dividendsReceived += received;

      if (options.dividendReinvest) {
        const reinvestedShares = received / row.close;
        shares += reinvestedShares;
        dividendsReinvested += received;
        trades.push({
          type: "dividend-reinvest",
          date: row.date,
          price: row.close,
          shares: reinvestedShares,
          spent: received,
          dividendPerShare: dividend.dividend,
          eligibleShares,
        });
      } else {
        dividendCash += received;
        trades.push({
          type: "dividend-cash",
          date: row.date,
          price: row.close,
          shares: 0,
          spent: received,
          dividendPerShare: dividend.dividend,
          eligibleShares,
        });
      }
    }

    const stockValue = shares * row.close;
    const value = stockValue + dividendCash;
    series.push({
      date: row.date,
      price: row.close,
      value,
      stockValue,
      dividendCash,
      dividendsReceived,
      dividendsReinvested,
      invested,
      shares,
      returnRate: invested > 0 ? (value - invested) / invested : 0,
    });
  }

  const latest = series.at(-1);
  if (!latest || invested <= 0) {
    throw new Error("해당 조건으로 체결된 매수가 없습니다. 금액 또는 수량을 늘려보세요.");
  }

  return { series, trades, latest, dividendsReceived, dividendsReinvested, dividendCash };
}

function updateMetrics(result) {
  const latest = result.latest;
  const returnEl = document.querySelector("#metricReturn");
  document.querySelector("#metricValue").textContent = formatMoney(latest.value);
  document.querySelector("#metricInvested").textContent = formatMoney(latest.invested);
  document.querySelector("#metricShares").textContent = number.format(latest.shares);
  returnEl.textContent = percent.format(latest.returnRate);
  returnEl.classList.toggle("positive", latest.returnRate >= 0);
  returnEl.classList.toggle("negative", latest.returnRate < 0);
  document.querySelector("#chartSubtitle").textContent =
    `${result.series[0].date}부터 ${latest.date}까지 · 최신 종가 ${formatMoney(latest.price)} · 누적 배당 ${formatMoney(result.dividendsReceived || 0)}`;
}

function updateTrades(trades) {
  document.querySelector("#tradeCount").textContent = `${trades.length}건`;
  const rows = trades
    .slice(-12)
    .reverse()
    .map(
      (trade) => `
        <tr>
          <td>${tradeLabel(trade)}</td>
          <td>${trade.date}</td>
          <td>${formatMoney(trade.price)}</td>
          <td>${trade.shares > 0 ? number.format(trade.shares) : "-"}</td>
          <td>${formatMoney(trade.spent)}</td>
        </tr>
      `,
    )
    .join("");
  document.querySelector("#tradesBody").innerHTML = rows;
}

function tradeLabel(trade) {
  if (trade.type === "dividend-reinvest") return "배당 재투자";
  if (trade.type === "dividend-cash") return "배당 현금";
  return "매수";
}

function map(value, min, max, start, end) {
  if (max === min) return (start + end) / 2;
  return start + ((value - min) / (max - min)) * (end - start);
}

function drawChart(points, hoverIndex = -1) {
  const rect = chart.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  chart.width = Math.max(800, Math.floor(rect.width * dpr));
  chart.height = Math.max(420, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = chart.width / dpr;
  const height = chart.height / dpr;
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 24, right: 62, bottom: 42, left: 62 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const prices = points.map((point) => point.price);
  const values = points.map((point) => point.value);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const maxValue = Math.max(...values);

  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#91a0b5";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    const priceLabel = formatCompactMoney(map(i, 0, 4, maxPrice, minPrice));
    const valueLabel = formatCompactMoney(map(i, 0, 4, maxValue, 0));
    ctx.fillText(priceLabel, 8, y + 4);
    ctx.fillText(valueLabel, width - pad.right + 10, y + 4);
  }

  const xFor = (index) => pad.left + (index / Math.max(1, points.length - 1)) * plotW;
  const yPrice = (point) => map(point.price, minPrice, maxPrice, pad.top + plotH, pad.top);
  const yValue = (point) => map(point.value, 0, maxValue, pad.top + plotH, pad.top);

  drawLine(points, xFor, yPrice, "#67a7ff", 2);
  drawLine(points, xFor, yValue, "#2ee59d", 2.4);

  ctx.fillStyle = "#91a0b5";
  const dateSteps = Math.min(5, points.length - 1);
  for (let i = 0; i <= dateSteps; i += 1) {
    const index = Math.round((points.length - 1) * (i / dateSteps));
    const x = xFor(index);
    ctx.fillText(points[index].date.slice(2), x - 22, height - 14);
  }

  if (hoverIndex >= 0 && points[hoverIndex]) {
    const point = points[hoverIndex];
    const x = xFor(hoverIndex);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
    drawPoint(x, yPrice(point), "#67a7ff");
    drawPoint(x, yValue(point), "#2ee59d");
  }
}

function drawLine(points, xFor, yFor, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawPoint(x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function showTooltip(event) {
  if (!chartPoints.length) return;
  const rect = chart.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const index = Math.round((x / rect.width) * (chartPoints.length - 1));
  const point = chartPoints[Math.max(0, Math.min(chartPoints.length - 1, index))];
  drawChart(chartPoints, index);
  tooltip.innerHTML = `
    <strong>${point.date}</strong>
    종가: ${formatMoney(point.price)}<br>
    평가액: ${formatMoney(point.value)}<br>
    투자금: ${formatMoney(point.invested)}<br>
    배당 현금: ${formatMoney(point.dividendCash || 0)}<br>
    누적 배당: ${formatMoney(point.dividendsReceived || 0)}<br>
    누적수익률: ${percent.format(point.returnRate)}
  `;
  tooltip.style.left = `${Math.min(Math.max(x, 105), rect.width - 105)}px`;
  tooltip.style.top = `${event.clientY - rect.top}px`;
  tooltip.classList.remove("hidden");
}

function hideTooltip() {
  tooltip.classList.add("hidden");
  if (chartPoints.length) drawChart(chartPoints);
}

function readOptions() {
  return {
    mode: getMode(),
    inputType: getInputType(),
    startDate: document.querySelector("#startDate").value,
    frequency: document.querySelector("#frequency").value,
    amount: Number(document.querySelector("#amount").value),
    shares: Number(document.querySelector("#shares").value),
    fractional: document.querySelector("#fractional").checked,
    dividendReinvest: document.querySelector("#dividendReinvest").checked,
  };
}

function validateOptions(options) {
  if (!selectedStock) throw new Error("종목을 먼저 선택하세요.");
  if (!options.startDate) throw new Error("최초 매수일을 입력하세요.");
  if (options.inputType === "amount" && options.amount <= 0) {
    throw new Error("매수 금액은 0보다 커야 합니다.");
  }
  if (options.inputType === "shares" && options.shares <= 0) {
    throw new Error("매수 수량은 0보다 커야 합니다.");
  }
}

function warnUser(message) {
  document.body.setAttribute("data-last-alert", message);
  if (!new URLSearchParams(location.search).has("suppressAlerts")) {
    window.alert(message);
  }
}

function adjustStartDateToListing(rows, options) {
  const firstTradingDate = rows[0]?.date;
  if (!firstTradingDate || options.startDate >= firstTradingDate) return false;

  const message = `${selectedStock.symbol}의 첫 거래일은 ${firstTradingDate}입니다. 입력한 최초 매수일이 상장 이전이라 최초 매수일을 ${firstTradingDate}로 자동 변경합니다.`;
  warnUser(message);
  document.querySelector("#startDate").value = firstTradingDate;
  options.startDate = firstTradingDate;
  setStatus(message);
  return true;
}

async function runBacktest() {
  const button = form.querySelector("button[type='submit']");
  try {
    const options = readOptions();
    validateOptions(options);
    button.disabled = true;
    setStatus(`${selectedStock.symbol} 과거 데이터를 불러오는 중입니다.`);
    const [rows, dividends] = await Promise.all([
      fetchHistory(selectedStock, options.startDate),
      fetchDividends(selectedStock),
    ]);
    const adjustedStartDate = adjustStartDateToListing(rows, options);
    setStatus("데이터 로딩 완료. 매수 시뮬레이션을 계산하는 중입니다.");
    const result = simulate(rows, dividends, options);
    chartPoints = result.series;
    updateMetrics(result);
    updateTrades(result.trades);
    drawChart(chartPoints);
    const prefix = adjustedStartDate ? "상장일 기준으로 최초 매수일을 보정했습니다. " : "";
    setStatus(`${prefix}${selectedStock.symbol} 기준 ${result.trades.length}건의 매수/배당 이벤트를 계산했습니다.`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
}

buyModeInputs.forEach((input) => input.addEventListener("change", syncModeUi));
inputTypeInputs.forEach((input) => input.addEventListener("change", syncInputTypeUi));
searchInput.addEventListener("input", renderSuggestions);
searchInput.addEventListener("focus", () => {
  searchInput.select();
  renderSuggestions();
});
searchInput.addEventListener("keydown", (event) => {
  const items = [...suggestions.querySelectorAll(".suggestion")];
  if (!items.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeSuggestion = Math.min(items.length - 1, activeSuggestion + 1);
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    activeSuggestion = Math.max(0, activeSuggestion - 1);
  }
  if (event.key === "Enter" && activeSuggestion >= 0) {
    event.preventDefault();
    items[activeSuggestion].click();
  }
  items.forEach((item, index) => item.classList.toggle("active", index === activeSuggestion));
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-field")) suggestions.classList.remove("visible");
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  runBacktest();
});
chart.addEventListener("mousemove", showTooltip);
chart.addEventListener("mouseleave", hideTooltip);
window.addEventListener("resize", () => {
  if (chartPoints.length) drawChart(chartPoints);
});

selectStock(stocks[0]);
loadStockUniverse();
syncModeUi();
syncInputTypeUi();
drawChart([
  { date: "2020-01-02", price: 75, value: 1000, invested: 1000, returnRate: 0 },
  { date: "2021-01-04", price: 129, value: 1720, invested: 1000, returnRate: 0.72 },
  { date: "2022-01-03", price: 182, value: 2426, invested: 1000, returnRate: 1.426 },
  { date: "2023-01-03", price: 125, value: 1666, invested: 1000, returnRate: 0.666 },
  { date: "2024-01-02", price: 185, value: 2466, invested: 1000, returnRate: 1.466 },
]);
