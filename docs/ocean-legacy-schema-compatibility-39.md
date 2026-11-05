# Ocean Desk 2.0 — 39차 서버 보상 구조와 기존 스키마의 격리 검증

## 범위
- 이번 테스트는 **GitHub Actions의 일회용 PostgreSQL 16** 컨테이너에서 실행했습니다. Supabase 실프로젝트에 SQL을 적용하지 않았습니다.
- 기존 서비스의 테이블 6개(`rooms`, `seats`, `room_instances`, `instance_seats`, `focus_sessions`, `personal_focus_sessions`)에 대한 **대표 샘플 스키마와 샘플 레코드**를 먼저 만듭니다.
- 그 다음 이전에 작성된 `od_*` 보상·집중 검증 SQL 초안 및 RLS 정책을 적용하고, 테스트에서 예전 레코드, RLS 활성화, 정책 유지를 확인합니다.
- 보상 서버의 기존 검증(중복 지급 차단, 사용자 간 권한 분리, 여행 티켓 원자적 차감, 서버 시간 검증, 집중 취소·복구)을 동일 컨테이너에서 반복합니다.

## 새로 추가한 파일 및 변경
- `tests/server/legacy_schema_fixture.sql`: 프로덕션에서 **이름과 일부 열 정의만 읽기 전용으로 확인한 뒤** 작성한 가짜 사용자/좌석/집중 기록 데이터. 실제 고객 데이터 포함 안 됨.
- `.github/workflows/ocean-desk-server.yml`: 신규 SQL 초안을 적용하기 전에 위 샘플 스키마를 설치.
- `tests/server/test_travel_draw.py`: 샘플 레코드/좌석 수/집중 계획/기존 테이블 RLS 및 정책이 신규 SQL 적용 후에도 유지되는지 확인.

## 해석할 때 주의할 점
- 이 검증은 신규 SQL이 대표적인 기존 구조와 충돌하지 않는지 확인하는 **부분적인 호환성 검사**입니다.
- 실제 Supabase 운영 DB에는 별도 인덱스·트리거·관계·정책이 있을 수 있으므로 **실제 DB 마이그레이션 성공을 보증하지 않습니다**.
- 운영 DB의 `od_wallets`, `od_owned_environments`, `od_focus_attempts`가 아직 없으며 Edge Functions도 현재 배포되어 있지 않습니다.
- 실제 Google OAuth, 기기 간 동기화, 광고 보상 서버 검증은 수행하지 않았습니다.
- 신규 Supabase 개발 브랜치·프로젝트 생성이나 추가 과금도 하지 않았습니다.

## 다음 단계
1. SQL 초안의 실제 프로젝트 스키마 종속성을 더 확인하고, 임시 PostgreSQL에서 테스트 사용자 간 권한 누락을 점검.
2. 이후 별도 Supabase 테스트 프로젝트/브랜치의 예상 비용과 보안 경계를 확인하고 승인받아 실 OAuth 테스트 환경 준비.
3. 운영 데이터베이스/도메인 배포는 별도 승인 후 진행.

**운영 보호:** GitHub `main`, 공개 Vercel 사이트, Supabase OCEAN DESK 운영 DB는 모두 변경하지 않았습니다.
