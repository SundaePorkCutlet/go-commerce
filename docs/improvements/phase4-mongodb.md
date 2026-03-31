# Phase 4: MongoDB 분석 활용

> 감사 로그를 단순 Insert 넘어 분석/조회/실시간 감시에 활용

---

## 개선 전 문제점

| 문제 | 설명 |
|------|------|
| InsertOne만 사용 | 감사 로그를 저장만 하고 조회/분석 불가 |
| 인덱스 없음 | 데이터 늘어나면 조회 성능 저하 |
| 분석 기능 미사용 | Aggregation Pipeline, Change Stream 미활용 |
| 데이터 정리 없음 | 로그가 무한히 쌓임 |

---

## 구현 예정

- [ ] 4-1. 감사 로그 조회 API (필터 + 커서 기반 페이지네이션)
- [ ] 4-2. Aggregation Pipeline 리포트
- [ ] 4-3. Change Stream → SSE 실시간 피드
- [ ] 4-4. TTL 인덱스 (90일 자동 삭제)

---

*Phase 4 구현 후 상세 내용이 채워집니다.*
