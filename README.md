# BackTester39

주식과 ETF의 과거 가격 데이터를 기반으로 투자 시나리오를 계산하는 반응형 웹 대시보드입니다.

## 서비스 주소

[https://sungkyu-kim39.github.io/BackTester39/](https://sungkyu-kim39.github.io/BackTester39/)

## 주요 기능

- 기업명 또는 티커 검색
- 1회성 매수 / 주기적 매수 시뮬레이션
- 금액 기준 매수 / 수량 기준 매수
- 소수점 매수 / 정수 수량 매수 선택
- 배당 현금 보유 / 배당 재투자 선택
- 현재 평가액, 총 투자금, 보유 수량, 누적 수익률 계산
- 종목 가격 변화와 평가액 변화를 차트로 표시
- 차트 hover 시 종가, 평가액, 투자금, 배당 현금, 누적 배당 표시
- 최근 매수 및 배당 이벤트 내역 표시

## 배당 계산 방식

배당금은 배당 지급일 기준 보유 수량에서 소수점을 버린 정수 수량에 대해서만 계산합니다.

예를 들어 51.66주를 보유 중이면 배당은 51주에 대해서만 받습니다.

- `배당 재투자 OFF`: 배당금을 현금으로 누적 보유합니다.
- `배당 재투자 ON`: 배당금으로 같은 종목을 추가 매수합니다.

## 데이터

앱은 Cloudflare Worker API를 먼저 호출하고, 실패하면 `data/` 폴더의 CSV 파일을 fallback으로 사용합니다.

Worker API:

[https://gentle-hat-70b2.kgf7740.workers.dev](https://gentle-hat-70b2.kgf7740.workers.dev)

Worker endpoint:

- `/api/search?q=AAPL`
- `/api/history?s=AAPL&d1=20200101&d2=20260531`
- `/api/dividends?s=AAPL&d1=20200101&d2=20260531`

정적 fallback 데이터:

- 가격 데이터: `data/QQQ.csv`
- 배당 데이터: `data/QQQ_dividends.csv`
- 데이터 목록: `data/manifest.json`

현재 데이터에는 기본 ETF/한국 종목에 더해 다음 목록이 포함됩니다.

- 미국 상장사 시가총액 상위 200개
- Yahoo Finance 거래량 상위 후보를 최근 5거래일 누적 거래량으로 재정렬한 상위 200개

중복을 제거한 현재 계산 가능 종목 수는 `data/stocks.json` 기준 362개입니다.

데이터 출처:

- 시가총액 목록: CompaniesMarketCap 미국 상장사 시가총액 순위
- 가격, 배당, 거래량 데이터: Yahoo Finance chart API

## Cloudflare Worker 배포

Wrangler 없이 Cloudflare 대시보드에서 직접 배포할 수 있습니다.

1. Cloudflare Dashboard에서 `Workers & Pages`로 이동
2. `gentle-hat-70b2` Worker 선택
3. `Edit code` 또는 `Quick edit` 선택
4. 저장소의 `worker.js` 내용을 전체 복사해 붙여넣기
5. `Save and deploy`

배포 후 Worker URL의 `/api/search?q=NVDA`가 JSON을 반환하면 정상입니다.

## GitHub Pages 배포

이 저장소는 GitHub Pages 배포용으로 구성되어 있습니다.

GitHub 저장소에서:

1. `Settings`로 이동
2. `Pages` 메뉴 선택
3. `Source`를 `GitHub Actions`로 설정
4. `Actions` 탭에서 `Deploy GitHub Pages` 워크플로 실행 상태 확인

배포가 완료되면 서비스 주소에서 대시보드를 사용할 수 있습니다.

## 데이터 자동 갱신

`.github/workflows/update-data.yml` 워크플로가 평일마다 Yahoo Finance 데이터를 가져와 `data/*.csv`와 `data/*_dividends.csv`를 갱신합니다.

수동 갱신도 가능합니다.

```powershell
uv run --python 3.11 python scripts/update_data.py
```

갱신된 CSV를 커밋하고 push하면 GitHub Pages에 반영됩니다.

## 로컬 실행

정적 파일만 확인할 수도 있지만, 개발 중에는 로컬 서버를 켜는 방식이 편합니다.

```powershell
uv run --python 3.11 python server.py
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:4173/
```
