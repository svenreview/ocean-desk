# Ocean Desk 2.0 — 24차 실제 OAuth 연결 전 사전점검

**결과:** 연결된 Supabase 계정에서 확인되는 프로젝트는 `OCEAN DESK` 한 개뿐이며 별도의 Supabase 개발 브랜치가 없습니다. 운영 프로젝트 ID는 `gozsvzkqhpmimadtgfie`입니다. 운영 DB에 SQL을 실행하거나 Edge Function을 배포하지 않았습니다.

## 이번에 실제로 만든 것
- `scripts/ocean-staging-preflight.mjs`: 부작용 없는 검증 함수. 구글 OAuth 테스트 설정에서 **운영 Supabase 프로젝트 또는 운영 사이트를 사용하면 실패**합니다.
- 별도 스테이징 Supabase HTTPS 주소, `sb_publishable_` 공개 키, 정확한 사이트 origin, Google Web OAuth Client ID 형식을 검사합니다.
- 검사 자체는 네트워크 통신, DB 변경, OAuth 승인·로그인 수행을 하지 않습니다.
- `tests/staging-preflight.test.mjs`: 별도 스테이징은 통과 / 운영 DB·운영 도메인·잘못된 키·호스트는 실패하는 4가지 시나리오 그룹.
- GitHub Actions 브라우저 작업에 안전성 테스트 추가.

## 실제 Google 로그인 E2E를 시작하기 위한 필수 조건
1. **별도 스테이징 Supabase 프로젝트 또는 개발 브랜치 준비:** 프로젝트/브랜치 생성은 과금 가능성이 있어 비용 확인과 명시적 동의 후에만 실행합니다.
2. Google Auth Platform에서 Web application OAuth Client ID/Secret을 생성합니다. 비밀키를 GitHub나 채팅에 붙이지 않고 해당 Supabase 프로젝트의 Google Provider 설정 화면에 직접 등록합니다.
3. 스테이징 사이트의 정확한 HTTPS Origin과 Supabase Google callback URL, Supabase Auth Redirect URL을 상호 등록합니다.
4. 스테이징 데이터베이스에 마이그레이션을 순서대로 적용하고 RLS, 서버 Edge Functions, 첫 로그인 지갑을 확인합니다.
5. 스테이징 공개 설정 `od-runtime-config.js`만 활성화하고 Google 로그인 → 동일 계정 PC/휴대전화 → 다른 계정 격리 → 집중 세션 복구를 검증합니다.
6. 검증에 성공하기 전에는 **운영 사이트/운영 Supabase DB/main 브랜치 변경 금지**입니다.

## 범위와 한계
이번 사전점검은 Google OAuth 비밀정보를 보유하거나 Google 로그인에 성공했음을 뜻하지 않습니다. 실제 로그인과 실기기 동기화는 아직 완료되지 않았습니다. 테스트로 생성된 퍼즐은 실사용자 보상으로 이전하지 않습니다.

공식 가이드:
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
