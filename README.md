# BackTester39

주식과 ETF를 과거부터 매수했을 때 현재 평가액과 누적 수익률을 계산하는 반응형 웹 대시보드입니다.

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
- 최초 매수일이 상장 전이면 상장 직후 거래일로 자동 보정

## 배당 계산 방식

배당금은 배당 지급일 기준 보유 수량에서 소수점을 버린 정수 수량에 대해서만 계산합니다.

예를 들어 51.66주를 보유 중이면 배당은 51주에 대해서만 받습니다.

- `배당 재투자 OFF`: 배당금을 현금으로 누적 보유합니다.
- `배당 재투자 ON`: 배당금으로 같은 종목을 추가 매수합니다.

## 데이터 구조

프론트엔드는 GitHub Pages에서 정적으로 서빙하고, 가격/배당/검색 데이터는 Cloudflare Worker가 Yahoo Finance에서 실시간으로 가져옵니다.

Cloudflare Worker API:

[https://gentle-hat-70b2.kgf7740.workers.dev](https://gentle-hat-70b2.kgf7740.workers.dev)

주요 endpoint:

- `/api/search?q=AAPL`
- `/api/history?s=AAPL&d1=20200101&d2=20260531`
- `/api/dividends?s=AAPL&d1=20200101&d2=20260531`

이전처럼 CSV 파일을 저장소에 보관하지 않습니다. 따라서 대용량 `data/` 폴더 없이도 Yahoo Finance에서 검색 가능한 종목을 그때그때 조회할 수 있습니다.

## Cloudflare Worker 배포

Wrangler 없이 Cloudflare 대시보드에서 직접 배포할 수 있습니다.

1. Cloudflare Dashboard에서 `Workers & Pages`로 이동
2. `gentle-hat-70b2` Worker 선택
3. `Edit code` 또는 `Quick edit` 선택
4. 저장소의 `worker.js` 내용을 전체 복사해 붙여넣기
5. `Save and deploy`

배포 후 Worker URL의 `/api/search?q=NVDA`가 JSON을 반환하면 정상입니다.

## GitHub Pages 배포

이 저장소는 GitHub Pages 배포용 GitHub Actions로 구성되어 있습니다.

GitHub 저장소에서:

1. `Settings`로 이동
2. `Pages` 메뉴 선택
3. `Source`를 `GitHub Actions`로 설정
4. `Actions` 탭에서 `Deploy GitHub Pages` 워크플로 실행 상태 확인

배포가 완료되면 서비스 주소에서 대시보드를 사용할 수 있습니다.

## 로컬 실행

개발 중에는 로컬 서버를 켜는 방식이 적합합니다.

```powershell
uv run --python 3.11 python server.py
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:4173/
```
