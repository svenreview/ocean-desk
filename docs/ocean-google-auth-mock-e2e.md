# Ocean Desk 2.0 — Google 인증 모의 E2E 검증 (20차)

**결과:** GitHub Actions Chromium 브라우저 테스트 12개(기존 8개 + 인증 4개), Node 인증/지갑 단위 테스트 8개, 임시 PostgreSQL 서버 거래/RLS 테스트 성공.

## 범위
- \`tests/fixtures/supabase-auth-browser-mock.js\`: 계정 alpha/beta를 별도 지갑과 보유 환경으로 제공하는 브라우저 전용 Supabase Mock.
- \`tests/auth-account.spec.mjs\`: Google OAuth provider/redirect, 로그인 A/B 전환, 계정별 지갑·갤러리 분리, 로그아웃 후 로컬 데모 복원.
- \`.github/workflows/ocean-desk-smoke.yml\`: 기존 브라우저 검사와 인증 시나리오를 함께 실행.
- **실제 계정/비밀키를 사용하지 않고**, 모의 브라우저에서 인증/화면 로직만 검증.

## 실제 Google 로그인 연동 전 남은 외부 설정
1. 별도 승인된 Supabase 스테이징 환경 준비(운영 DB 사용 금지).
2. Google Auth Platform에서 OAuth Web application Client ID/Client Secret 생성.
3. Google OAuth 승인된 도메인과 Supabase 공식 Callback URL 허용.
4. Supabase Auth → Providers → Google 활성화 및 Client Secret 등록.
5. Supabase Auth URL Configuration에서 스테이징 웹 리디렉션 등록.
6. 최소 권한 및 각종 보상 SQL/Edge Function을 스테이징 환경에서 검증 후 배포.
7. Google 계정 2개와 PC/휴대전화로 로그인·로그아웃·동시 세션·계정 전환 E2E 검증.
8. 모든 실제 기능이 검증되기 전까지 \`OD_SUPABASE_CONFIG.enabled:false\`를 유지.

## 보안
- 브라우저와 GitHub에 Google OAuth Client Secret, Supabase 서비스 역할 키를 저장하지 않음.
- 실제 로그인 관련 비밀값은 Supabase Provider 비밀 설정에서만 처리.
- 다른 사용자 지갑·컬렉션 표시를 피하기 위해 인증 전환 시 기존 계정 스냅샷 즉시 폐기.
- 로컬 데모 보상은 개인 계정 지갑에 이관하지 않음.
- 광고 제공사 검증 없이는 정식 보상 적립 불가.

## 중요 한계
**현재 가능한 검증은 모의 Supabase 인증과 임시 PostgreSQL 거래입니다.**
실제 OAuth 리디렉션, Google 동의 화면, Supabase 인증 서비스 연결,
모바일/PC 데이터 동기화 등은 아직 종단 간 검증하지 않았습니다.

공식 문서: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
