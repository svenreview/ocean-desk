# Ocean Desk 2.0 — 19차 Google 로그인 통합 안전성 점검

**상태: Draft PR / Google OAuth 클라이언트·실제 Supabase 제공자 미설정. 운영 사이트 및 DB 미변경.**

## 구현
- `od-auth-flow.mjs`: `signInWithOAuth({provider:'google'})` 호출과 현재 경로를 기준으로 안전한 OAuth 복귀 URL 구성. 쿼리·해시 내 개인 정보는 리디렉션에 포함하지 않음.
- `od-account.js`: 로그아웃 또는 로그인 제공자 이벤트로 세션이 바뀌는 순간 계정 데이터 스냅샷을 지우고, 이전 비동기 인증 결과는 차단.
- 브라우저 비활성 기본 설정 유지. 승인된 스테이징 환경만 `enabled:true`, `googleEnabled:true` 설정.
- `tests/auth-flow.test.mjs`: Google 제공자 선택, 리디렉션 URI, 오류 전파, 오래된 인증 상태 무효화 단위 테스트.
- 기존 `tests/wallet-bootstrap.test.mjs` 및 Chromium 회귀 테스트도 자동 실행.

## 실제 연결 시 필요한 외부 설정
1. Google Cloud Console에서 OAuth 동의 화면과 Web application OAuth 클라이언트를 생성합니다.
2. 해당 클라이언트의 정확한 사이트 origin 및 Supabase Dashboard에 안내된 OAuth callback URL을 허용합니다.
3. Supabase Authentication → Providers → Google에 Client ID / Secret을 **비공개로** 입력합니다.
4. Supabase URL configuration에서 실제 스테이징 도메인 리디렉션을 허용합니다.
5. 별도 승인된 스테이징 DB에 RLS 및 지갑·집중 기록 SQL을 적용하고 Edge Functions를 배포합니다.
6. 두 개의 Google 계정 및 PC/휴대전화로 로그인 성공/거부, 재접속, 로그아웃, 계정 전환과 소유 기록 격리를 검증합니다.

## 완료 기준
- 다른 계정 정보가 잠깐이라도 보이지 않음.
- OAuth가 실패하거나 거부되어도 기존 파도 소리·뽀모도로를 사용할 수 있음.
- 로컬 테스트 보상과 실제 계정 지갑은 합산되지 않음.
- 생성된 지갑이 없는 사용자는 서버의 검증된 지갑 초기화 RPC만 사용.
- GitHub 저장소 및 브라우저에 Google Client Secret, Supabase service_role 값이 포함되지 않음.

**주의:** 단위 테스트/임시 DB 회귀 테스트는 실제 Google OAuth 로그인이나 두 기기 동기화를 검증하지 않습니다. 외부 OAuth·DB 설정을 아직 완료하지 않았으므로 운영 로그인은 활성화할 수 없습니다.

공식: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
