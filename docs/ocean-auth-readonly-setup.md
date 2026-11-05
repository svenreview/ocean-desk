# Ocean Desk 2.0 계정 및 서버 컬렉션 연결 (미배포)
 
현재 `index.html`은 로그인·서버 컬렉션 조회 창을 포함하지만 **기본 비활성화**입니다.
 
## 현재 안전 상태
 
- `window.OD_SUPABASE_CONFIG={enabled:false}` → 실제 인증 요청 없음.
- 테스트용 `localStorage`의 퍼즐·티켓·보유 공간을 서버로 전송하지 않음.
- 로그인 후에도 서버 `od_wallets` 및 `od_owned_environments`의 본인 데이터만 SELECT.
- 서버 지갑 생성이나 퍼즐 지급, 티켓 사용은 클라이언트에서 하지 않음.
- Vercel 공개 사이트 배포 전, **별도 검증 환경**에서 인증 및 RLS 검증을 완료해야 함.
 
## 활성화 조건 (향후)
 
1. 테스트용 Supabase 프로젝트에서 `docs/ocean-rewards-schema-draft.sql`을 검증 후 적용.
2. Supabase Auth의 이메일 로그인과 해당 미리보기 도메인을 Redirect allow list에 설정.
3. 정식 공개 가능한 **publishable key**만 브라우저에 설정 (secret/service-role key 금지).
4. `index.html`의 `OD_SUPABASE_CONFIG`를 `{enabled:true,url:"https://<test-project>.supabase.co",publishableKey:"sb_publishable_..."}`로 교체. **운영 프로젝트를 무단 연결하지 않음.**
5. 사용자별 RLS를 테스트한 뒤에만 코드 배포.
6. 로그인 관련 오류, 계정 탈퇴, 쿠키/브라우저 데이터 보관 및 개인정보 처리방침 검토.
 
**주의:** 빈 `od_wallets`는 오류가 아니라 서버 지갑 미생성을 의미합니다. 테스트용 로컬 보상 기록을 자동으로 이관하지 마세요.
 
## 배포 전 확인
 
- 다른 계정의 지갑·소유 공간이 조회되지 않아야 함.
- 비로그인 상태에서는 사용자별 데이터를 읽지 못해야 함.
- 브라우저에서 보상 테이블 INSERT/UPDATE/DELETE가 허용되면 안 됨.
- 서비스 역할 키가 HTML이나 JavaScript에 노출되면 안 됨.
- 이메일 리디렉션, 인증 세션 갱신, 로그아웃을 실기기에서 검사.
- 개인정보가 브라우저 콘솔·URL·진단 로그에 저장되지 않도록 확인.
 
공식 가이드: https://supabase.com/docs/guides/auth/auth-email-passwordless
