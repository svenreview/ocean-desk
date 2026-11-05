# Ocean Desk 2.0 — 40차 운영 스키마 차이 분석 및 호환성 강화

## 확인 방법
2026-11-05 KST, 기존 Supabase `gozsvzkqhpmimadtgfie`에 **SELECT 기반 카탈로그 조회만** 수행했습니다. 운영 데이터 변경·DDL·Edge Function 배포 없음.

실제 운영 `public`의 테이블 6개: `rooms`, `seats`, `room_instances`, `instance_seats`, `focus_sessions`, `personal_focus_sessions`.
- 모두 RLS 활성화.
- `public`의 위 테이블에 트리거는 조회되지 않음.
- `rooms.kind`는 `cafe` 또는 `study`만 허용. 이전 39차 테스트 픽스처의 `focus` 값은 **운영 DB에서 허용되지 않는 값**이어서 `study`로 바로잡음.
- `rooms.capacity`, `room_instances.capacity`는 1~100.
- `focus_sessions.planned_minutes`, `personal_focus_sessions.planned_minutes`는 값이 있는 경우 1~240.
- 좌석 번호 양수, 같은 룸/인스턴스의 좌석 번호 UNIQUE.
- `room_instances`는 룸별 인스턴스 번호 UNIQUE, ID/원본 룸 조합 UNIQUE.
- 두 집중 기록 테이블은 `(user_id, started_at DESC)` 인덱스를 사용.
- `focus_sessions`와 `personal_focus_sessions`는 기본적인 사용자 소유 RLS와 기존 역할별 `SELECT`/`INSERT`/`UPDATE` 권한을 보유.
- 공간·좌석·인스턴스 카탈로그는 `anon`과 `authenticated`에 SELECT만 부여됨.

## 구현 및 자동 확인
- `tests/server/legacy_schema_fixture.sql`: 현재 확인된 제약·중복 금지·인덱스를 일회용 PostgreSQL 픽스처에 반영.
- `tests/server/test_travel_draw.py`: SQL 초안 적용 후 기존 레코드 보존뿐 아니라 제약조건·인덱스·RLS·정책·트리거 수가 대표 환경에서 유지되는지 확인.
- 기존 신규 보상/집중 서비스의 접근권한·동시성·중복지급 검증 함께 실행.

## 미해결 및 제한
- 테스트 DB의 스키마가 **운영 Supabase를 완전히 복제한 것은 아닙니다.** 실제 컬럼 기본값, 정책별 세부 조건, 인스턴스/좌석 생성 로직과 extensions 등 추가 차이가 존재할 수 있습니다.
- 신규 `od_wallets`, `od_owned_environments`, `od_focus_attempts` 등은 아직 운영 DB에 없으며, 신규 Edge Functions도 미배포 상태입니다.
- 별도 비용·승인 없이 Supabase 개발 브랜치/프로젝트를 생성하지 않습니다.
- 실제 Google OAuth 및 기기 간 동기화는 아직 검증되지 않았습니다.
- 운영 `main`, Vercel 서비스, Supabase 프로젝트 데이터/권한 설정은 변경하지 않았습니다.

## 권장 다음 단계
개발 브랜치의 스테이징 SQL과 Edge Function을 통합하는 **격리 테스트 강화** 후, 배포 전에 비용과 롤백 방법을 명시한 마이그레이션 계획을 승인받습니다.
