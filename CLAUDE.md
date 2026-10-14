# 교육장 음악 자동 재생 앱

교육장 등교·점심·하교 시간에 로컬 음악을 자동 재생/정지하는 Windows 데스크탑 앱.
사용자는 개발자가 아닌 연구원님이고, 등교 시간(08:30)에는 아무도 없이 혼자 동작해야 한다.
개발은 macOS, 배포는 Windows. 인터넷 없이 동작한다(MVP).

## 문서 (작업 전에 관련 문서를 먼저 읽는다)
- `docs/01-요구정의서.md` FR/NFR 번호 · `docs/02-PRD.md` 시나리오·범위
- `docs/03-아키텍처.md` 구조·IPC·데이터 · `docs/04-화면설계서.md` 화면·문구
- `docs/05-코드컨벤션.md` 규칙 · `docs/milestones.md` 단계별 작업과 완료 기준
- 문서와 요청이 충돌하거나 문서에 없는 결정이 필요하면 **추측하지 말고 멈추고 묻는다.**

## 기술 스택
TypeScript(strict) · Electron · electron-vite 계열 템플릿 · electron-builder(Windows)
music-metadata(ESM 전용, import 사용) · electron-log · Vitest · ESLint · Prettier
UI는 프레임워크 없이 HTML/CSS/TS. **목록에 없는 라이브러리는 추가 전에 사용자에게 묻는다.**

## 명령어 (1단계에서 package.json에 아래 이름으로 맞춘다)
- `npm run dev` 개발 실행 · `npm run build:win` Windows 설치 파일
- `npm run typecheck` · `npm run lint` · `npm run format` · `npm run test` (= `vitest run`)

## 폴더 구조
- `src/main` 메인 프로세스: scheduler, day-service, library, settings, window(창·자동 실행·재시작)
- `src/preload` contextBridge로 `window.api` 하나만 노출
- `src/renderer` 화면과 재생(HTML5 Audio), 문구는 `messages.ts`에만
- `src/shared` 타입, IPC 채널 상수, 날짜 유틸 (Electron/Node API 사용 금지)

## 핵심 설계 (바꾸려면 먼저 묻는다)
- **판단은 main, 소리는 renderer.** 재생 여부·다음 곡 번호·휴무일은 main만 결정한다.
- **스케줄러는 상태 판정 방식.** 매초 "지금 재생해야 하는가"를 계산해 실제 상태와 맞춘다.
  특정 시각에 setTimeout으로 알람을 거는 방식은 쓰지 않는다 (늦게 켜진 경우를 놓친다).
- 판정 로직(재생 여부, 휴무일, 다음 곡 번호)은 **현재 시각을 인자로 받는 순수 함수**로 만든다.
- 공휴일은 `HolidayProvider` 함수를 통해서만 가져온다 (2차에 API로 교체 예정).
- 트레이·종료 확인 창 없음. 숨기기는 최소화(–), X는 바로 종료. 종료 직전(before-quit) 재생 위치를 저장한다.
- `app.requestSingleInstanceLock()`으로 중복 실행을 막는다.
- 시간표 기본값: 등교 08:30~09:00, 점심 13:00~14:00, 하교 17:50~18:30. 구간은 시작 포함·종료 미포함.

## 금지 사항
- `toISOString()`으로 날짜 만들기 (UTC라 한국 오전 9시 전 날짜가 하루 밀린다) → shared 날짜 유틸 사용
- 드래그앤드롭에서 `file.path` 사용 (Electron 32부터 제거) → preload에서 `webUtils.getPathForFile`
- `nodeIntegration: true`, `contextIsolation: false`, `sandbox: false`
- renderer에 `ipcRenderer` 노출, IPC 채널 이름을 문자열로 직접 쓰기 (`src/shared/ipc-channels.ts` 상수만)
- `any` 타입, renderer 코드에 한국어 문구 직접 쓰기 (`messages.ts`에만)
- 외부 URL 로드·네트워크 요청 (MVP는 오프라인)
- 위 규칙 일부는 `.claude/hooks/after-edit.mjs`가 편집 직후 검사한다. 걸리면 고치고 진행한다.

## 작업 방식
- 한 번에 `docs/milestones.md`의 한 단계만 진행한다 (`/step 번호`).
- 구현 전에 계획(만들/고칠 파일, 순서)을 먼저 보여주고 승인을 받는다.
- 끝내기 전에 typecheck·lint·test가 통과해야 한다 (Stop 훅이 자동 검사한다).
- 단계가 끝나면 **사용자가 직접 확인하는 방법**을 알려준다: 무엇을 실행하고 화면에서 무엇을 보면 되는지.
- 커밋은 사용자가 요청할 때만. 형식: `feat: 시간표 저장 기능 추가` (Conventional Commits + 한국어)
- 주석은 한국어로, "무엇"보다 "왜"를 적는다.

## 디자인
Figma: https://www.figma.com/design/Q7Qb5n7gAdBDj6oCWrW2o1
6단계에서 Figma MCP로 **프레임 하나씩** 가져와 구현한다 (파일 전체를 한 번에 읽지 않는다).
창 크기 960×640, 폰트 IBM Plex Sans KR (대체: Malgun Gothic).
