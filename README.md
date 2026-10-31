# OCEAN DESK 3D — 첫 GitHub 배포용 MVP

- **목적:** wellnesscome.com에서 운영할 3D 카페·공부방의 시범 버전
- **배치:** Ocean View Cafe 8석 + Quiet Study Room 8석
- **기능:** 카메라 회전/줌, 아바타 좌석 이동, 25분·50분 집중 타이머
- **기술:** Three.js ESM CDN, 정적 HTML
- **실행:** index.html을 정적 웹 서버 또는 Vercel 프로젝트 루트에서 서빙
- **Vercel 설정:** Framework Preset = Other; 별도 Build Command 없음
- **주의:** 실시간 다중접속, 인증, Supabase 동기화는 미구현. CDN 네트워크 연결 필요. 브라우저 검증 전 시범 단계입니다.
- **Supabase Seoul project:** gozsvzkqhpmimadtgfie. 비밀키를 공개 저장소에 추가하지 마세요.
- **도메인:** 현재 기존 Blogger DNS를 변경하지 않았습니다. Vercel 기본 URL 테스트 후 연결하세요.

추후 전체 웹사이트 콘텐츠·개인정보 처리방침·실시간 접속 기능을 확장할 예정입니다.