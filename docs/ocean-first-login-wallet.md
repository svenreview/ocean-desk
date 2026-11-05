# Ocean Desk 2.0 — 첫 로그인 시 계정 지갑 자동 준비 (18차)

**상태:** 개발 브랜치 구현 및 자동 테스트 통과, 실제 Supabase/Auth 운영환경 미배포.

## 목적
Google 로그인 사용자의 지갑이 없으면 서버에서 안전하게 0 퍼즐·0 티켓 지갑을 생성합니다.
이미 존재하는 사용자 지갑은 잔액/보유 컬렉션을 유지합니다.

## 구현
- `od-wallet-bootstrap.mjs`: 사용자 ID별 동시 초기화 요청을 한 건으로 합치고, 서버 응답의 사용자 ID와 잔액을 검증합니다.
- `od-account.js`: 개인 기록 조회 시 지갑이 없는 경우에만 `autoInitializeWallet:true` 설정에서 서버 초기화를 요청합니다. 성공하면 지갑을 재조회합니다.
- 기존 `서버 지갑 준비` 버튼도 같은 단일 요청 처리기를 사용합니다.
- `supabase/functions/od-wallet-initialize/index.ts`는 Supabase 인증 토큰으로 신원 확인 후 서버 전용 지갑 초기화 RPC를 호출하도록 설계돼 있습니다.
- `docs/ocean-wallet-initialize-rpc-draft.sql`은 기존 지갑에 `on conflict do nothing`을 사용하여 기존 잔액을 초기화하지 않습니다.

## 안전 설정
현재 기본 설정은 다음과 같습니다.

```js
window.OD_SUPABASE_CONFIG={
  enabled:false,
  googleEnabled:false,
  serverFocusEnabled:false,
  autoInitializeWallet:false
};
```

스테이징 Supabase에서 인증, RLS, 지갑 RPC, 로그인 유지 테스트를 검증한 뒤에만 `autoInitializeWallet:true`로 변경합니다.
운영환경 URL과 공개용 publishable key만 프런트엔드에서 사용합니다.
**OAuth Client Secret과 Supabase service_role 키는 HTML/브라우저/저장소에 절대 노출하지 않습니다.**

## 실패 처리
- 로그인 전: 지갑 초기화 요청 없음.
- 유효하지 않은 사용자 ID: 초기화 차단.
- 다른 사용자 ID 반환: 해당 응답 폐기.
- 서버/네트워크 오류: 사용자에게 실패 안내, 무한 자동 재시도하지 않음.
- 로그아웃 또는 계정 변경 중 완료된 오래된 조회: 화면 반영 차단.
- 기존 데모 퍼즐/티켓/공간: 서버로 업로드·합산하지 않음.

## 자동 테스트
- `tests/wallet-bootstrap.test.mjs`: 중복 요청 하나로 병합, 브라우저 데이터 미전송, 비로그인 거부, 잘못된 서버 응답 차단, 네트워크 복구.
- Chromium 브라우저 테스트 8건, wallet helper 테스트 5건 및 서버 통합 테스트 성공.
- 테스트 통과는 실제 Supabase 로그인 및 PC·휴대전화 동기화 E2E를 대체하지 않습니다.

## 다음 검증
1. 별도 승인된 스테이징 Supabase에 SQL 적용과 Edge Function 배포.
2. Google Cloud OAuth Client/Redirect 설정과 Supabase Google Provider 활성화.
3. Google 계정으로 로그인해 최초 지갑 0/0 생성 확인.
4. 같은 계정으로 두 기기 로그인하여 동일한 지갑/컬렉션 확인.
5. 재로그인, 중복 로그인 이벤트 및 로그아웃 중 네트워크 지연 검사.
6. Google 계정 A/B 개인별 데이터 격리 및 개인정보 노출 테스트.

관련 공식 문서: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
