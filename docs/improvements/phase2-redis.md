# Phase 2: Redis 패턴 활용

> Redis의 다양한 데이터 구조와 패턴을 실제 문제 해결에 적용

---

## 개선 전 문제점

| 문제 | 설명 |
|------|------|
| 캐시만 사용 | String GET/SET + 5분 TTL이 전부 |
| 캐시 무효화 없음 | 상품 수정 후에도 5분간 stale 데이터 반환 |
| 3개 서비스 미사용 | USERFC, ORDERFC, PAYMENTFC는 Redis 클라이언트만 생성하고 사용 안 함 |
| 데이터 구조 미활용 | Hash, Sorted Set, Set 등 Redis 강점인 다양한 자료구조 미사용 |

---

## 구현 예정

- [ ] 2-1. 캐시 무효화 전략 (상품 수정/삭제 시 즉시 삭제)
- [ ] 2-2. 캐시 hit/miss 통계 + /debug/redis 엔드포인트
- [ ] 2-3. Sorted Set 기반 슬라이딩 윈도우 Rate Limiter
- [ ] 2-4. 실시간 인기 상품 랭킹 (ZINCRBY, ZREVRANGE)
- [ ] 2-5. JWT 토큰 블랙리스트 (USERFC)

---

*Phase 2 구현 후 상세 내용이 채워집니다.*
