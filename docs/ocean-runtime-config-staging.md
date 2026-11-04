# Ocean Desk 2.0 — 인증 설정 분리 및 안전한 활성화 (21차)

**상태:** GitHub 검토용 브랜치. 운영 사이트/운영 DB 미변경, 실제 Google OAuth 비활성화.

## 구성
- `od-runtime-config.js` — 브라우저 공개 설정 전용. 저장소 기본값은 `enabled:false`.
- `od-config-validator.mjs` — URL·배포 도메인·공개용 키 검증 실패 시 Supabase 연동 전부 차단.
- `od-account.js` / `od-focus-sync.js` — 동일한 검증 완료 설정만 사용.
- `tests/config-validator.test.mjs` — 비활성 상태, 허용된 출처, 잘못된 주소/키, 허용 목록 외 도메인 차단.

## 승인된 스테이징에서 활성화할 때
1. Supabase 별도 스테이징 프로젝트를 확인합니다.
2. Google OAuth 웹 클라이언트 및 Supabase Google Provider를 설정합니다.
3. Google OAuth 리디렉션 및 Supabase Auth URL 허용 목록에 **실제 스테이징 배포 도메인**을 등록합니다.
4. 스테이징 DB에서 SQL/Edge Functions/RLS 검증을 끝낸 후,
5. 스테이징 전용 `od-runtime-config.js`에서 아래 **공개 설정만** 채웁니다.

```js
window.OD_SUPABASE_CONFIG={
 enabled:true,
 googleEnabled:true,
 serverFocusEnabled:false,
 autoInitializeWallet:false,
 url:'https://YOUR-STAGING-PROJECT.supabase.co',
 publishableKey:'sb_publishable_YOUR_PUBLIC_KEY',
 allowedOrigins:['https://YOUR-EXACT-PREVIEW-HOST']
};
```

- 운영 프로젝트 URL/비밀키를 스테이징 설정으로 사용하지 않습니다.
- `allowedOrigins`는 웹 **출처(origin)**와 완전히 일치해야 합니다. 임의의 `*.vercel.app` 패턴 대신 정확한 호스트를 지정합니다.
- 브라우저에는 `sb_publishable_` 공개 키만 사용할 수 있습니다. `sb_secret_`, `service_role`, Google OAuth Client Secret은 절대로 입력하지 않습니다.
- 검증 실패 시 로그인/집중 서버 기능을 모두 끕니다. 기존 로컬 데모는 계속 작동합니다.
- Supabase URL과 공개 키는 비밀정보가 아닙니다. 인증/권한은 JWT·RLS·서버 전용 RPC에서 확인해야 합니다.

## 자동 테스트
- Chromium 브라우저 기존 테스트 및 모의 Google 계정 A/B 전환 시나리오.
- Node 인증/지갑/설정 검사 단위 테스트.
- 임시 PostgreSQL 거래/RLS 검사.
- 실제 OAuth 로그인·모바일/PC 같은 계정 동기화는 아직 확인하지 못했습니다.

## 향후
외부 OAuth 설정 → 승인된 Supabase 스테이징에서 2계정/2기기 테스트 → 운영 배포 승인 순서를 따릅니다.

공식 참고: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
