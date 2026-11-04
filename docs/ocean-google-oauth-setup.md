# Ocean Desk 2.0 — Google OAuth 및 개인별 진행 기록 연동 체크리스트

**상태: 코드만 작성한 개발 브랜치. 운영 로그인·운영 DB 미연결.**

## 결정된 인증 전략
- **Google 계정 로그인 기본**, 이메일 링크 로그인은 선택적 예비 방식.
- Supabase Auth가 발급한 `auth.users.id`를 사용자 데이터의 유일한 소유자 키로 사용.
- 같은 Google 계정이면 PC/휴대전화에서도 동일한 지갑, 수집한 환경, 서버 집중 이력이 조회됨.
- 브라우저의 기존 `localStorage` 데모 퍼즐·티켓은 공식 계정에 **자동 이관하지 않음**.
- 기록을 전송하는 기능은 RLS + 서버측 검증 완료 후 활성화.
- 산·자연으로 확장 시에도 동일 `auth.users.id`를 사용해 계정 데이터 유지.

## OAuth 설정 순서 (승인된 스테이징 환경에서)
1. Google Cloud Console → Google Auth Platform → OAuth 동의 화면(Audience/Branding) 설정.
2. Web application OAuth 클라이언트 생성. 서비스의 **정확한 HTTPS Origin** 등록.
3. Authorized redirect URI는 **스테이징 Supabase Google Provider 화면에서 표시하는 콜백 URL**을 등록. 일반적인 패턴: `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Supabase Dashboard → Authentication → Providers → Google 활성화. Google OAuth **Client ID / Secret은 Supabase에만 저장**.
5. Supabase Authentication → URL Configuration에서 서비스의 실제 리디렉션 URL을 허용 목록에 등록.
6. 승인된 스테이징 Supabase에 최소한 보상 스키마, 서버 집중 세션/취소 함수, `docs/ocean-focus-history-rls-draft.sql`을 순서대로 적용하고 RLS 검사.
7. 스테이징 HTML에 **공개 가능한 publishable key**와 URL만 사용해 설정:
   `window.OD_SUPABASE_CONFIG={enabled:true,googleEnabled:true,serverFocusEnabled:false,url:"https://<staging-ref>.supabase.co",publishableKey:"sb_publishable_..."};`
8. 다른 Google 계정 두 개로 데이터 간섭이 없는지, 로그아웃·세션 만료·재로그인·모바일 로그인 동작을 검증.
9. 서버 세션 기능을 별도 검증한 뒤 `serverFocusEnabled:true`로 활성화.
10. 위 작업을 통과한 이후에만 운영 사이트 배포 검토.

## 완료 기준
- 동일 Google 계정: 다른 기기에서 같은 퍼즐·티켓·보유 공간·최근 집중 세션 내역 조회
- 다른 Google 계정: 본인 데이터만 조회 가능 (RLS)
- 비로그인: 개인 데이터 조회 불가
- 로그아웃: 화면의 개인 데이터 즉시 삭제
- 새로고침: 인증 세션 정상 복원
- Google OAuth 실패/취소: 기존 타이머는 정상 동작
- 브라우저 콘솔·HTML·GitHub에 OAuth Client Secret 또는 service_role 키 노출 금지
- 가입 초기 지갑 생성은 **서버 API에서만** 수행
- 기존 로컬 데모 보상 자동 동기화 금지
- 타이머 기록과 서버가 인정한 보상은 별개로 표기 (실제 광고 완료 검증 전 보상 미지급)
- 서비스 확장: environment_id / region_id로 바다·산·자연 공간을 구분하고 사용자 ID는 유지

## 아직 해결할 점
- 현재 Google OAuth Client ID/Secret과 Provider 활성화 여부가 확인되지 않았음.
- 별도 Supabase 개발 브랜치가 없으며 비용 승인 없이 생성하지 않음.
- 실제 Supabase OAuth 로그인을 통한 E2E 테스트 미진행.
- 집중 기록은 `od_focus_attempts`에 서버 검증 시 저장하도록 설계됐으나 계정/기기 간 **중단된 세션 재개**는 별도 정책과 API가 필요.
- 광고 제공업체 콜백 검증 미연결: 지급되는 퍼즐은 데모에서만 가능.

참고:
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/database/postgres/row-level-security
