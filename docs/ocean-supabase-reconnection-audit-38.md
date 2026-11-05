# Ocean Desk 2.0 — 38차 Supabase 재연결 상태 및 안전한 통합 순서

점검 기준: 2026-11-05 KST. **연결된 Supabase에서 읽기 전용으로 실제 조회한 내용**이며 운영 DB/인증 설정/Edge Functions에 변경을 가하지 않았습니다.

## 1. 현재 연결된 환경
- 연결된 조직: **OCEAN DESK** (`ijjzqqylwnwlwqpvbakk`).
- 연결된 프로젝트: **OCEAN DESK**, 서울 리전, ID `gozsvzkqhpmimadtgfie`, 상태 `ACTIVE_HEALTHY`.
- 소문자 `ocean-desk` 조직은 현재 연결 계정의 조직 목록에 조회되지 않음. 삭제 완료는 사용자 화면에서 재확인 가능.
- Supabase 개발 브랜치: **0개**.
- 현재 public 테이블 6개: `rooms`, `seats`, `room_instances`, `instance_seats`, `focus_sessions`, `personal_focus_sessions`.
- 모두 RLS 활성화. 기존 `focus_sessions` 및 `personal_focus_sessions`에는 사용자 ID 기반 `SELECT` / `INSERT` / `UPDATE` RLS 정책이 있음.
- Supabase Security Advisors: 조회 당시 알림 0건. 이는 전체 안전성 또는 실사용 OAuth 검증의 증명이 아님.
- 기존 DB 마이그레이션: 4개(카페 공간·좌석·개인 집중 관련).
- 현재 배포된 Supabase Edge Functions: **0개**.

## 2. 기존 개발 브랜치와 차이
GitHub `feature/bali-gallery-focus`의 `od-account.js`는 다음 조회를 실행하도록 작성됐습니다.
- `public.od_wallets`: 내 퍼즐·티켓 잔액
- `public.od_owned_environments`: 내 획득 공간
- `public.od_focus_attempts`: 내 서버 검증 집중 세션 이력

**위 3개 테이블은 현재 운영 public 스키마에 없음.** 따라서 지금 `od-runtime-config.js`의 `enabled:false`를 무작정 `true`로 변경하면 실제 계정 조회에 실패할 수 있습니다. 로그인 기능의 기본 비활성화 상태를 유지해야 합니다.

연관된 GitHub 초안:
- `docs/ocean-rewards-schema-draft.sql`: `od_regions`, `od_environments`, `od_wallets`, `od_owned_environments`, `od_reward_claims`, `od_travel_draws` 등과 RLS 정책(운영 미적용).
- `docs/ocean-server-focus-session-draft.sql` 및 연관 검증/조회 초안: 서버 집중 세션.
- `supabase/functions/od-wallet-initialize/index.ts` 등 Edge Function 초안: 운영 미배포.

기존 `focus_sessions`와 신규 `od_focus_attempts`는 목적·스키마가 다르므로 **자료를 자동 변환하거나 한쪽을 덮어쓰지 않습니다**. 기존 카페 관련 기능을 보호합니다.

## 3. 다음 연결을 위한 안전한 순서
1. 개발 브랜치의 최신 DB/Edge Function 초안을 단일 스테이징 환경에 적용해 거래/RLS/중복 지급 검사 재확인.
2. **별도 스테이징 환경 준비 여부와 비용 확인**: 프로젝트 또는 Supabase 개발 브랜치는 과금/무료 한도 가능성이 있으므로 비용·승인 없이 생성하지 않음. 기존 계정 유지 가능.
3. 테스트 환경에만 Google OAuth 및 정확한 HTTPS redirect URL 설정. Google Client Secret은 서버 설정에만 보관. GitHub/브라우저/채팅에 게시 금지.
4. 테스트 사용자 2개로 자기 기록 조회·타 사용자 접근 차단·로그아웃·토큰 갱신·PC/휴대전화 기기 간 동기화 검증.
5. 별도 승인 전에는 프로젝트 운영 테이블 생성, 신규 Edge Function 배포, 공개 Vercel 변경 또는 `main` 머지 금지.
6. 실제 광고 검증 기반 보상은 공급자 검증 증빙이 마련되기 전까지 계속 비활성.

## 4. 현재 결론
- **DB 용량 부족이나 연결 장애로 개발이 막힌 상태가 아님.**
- 신규 기능을 적용할 운영 DB 구조 및 배포된 서버 함수가 아직 없음.
- 바로 진행 가능한 작업: 로컬/임시 PostgreSQL 통합 시험, 마이그레이션·RLS 스테이징 점검, 클라이언트 오류 처리 검수, 안전한 테스트 환경 구성.
- 실제 Google 로그인·기기 간 동기화는 스테이징 환경과 인증 정보 설정이 필요함.
- 기존 운영 서비스와 데이터는 이번 점검 중 변경되지 않음.
