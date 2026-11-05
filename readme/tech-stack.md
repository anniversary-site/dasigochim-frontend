# 기술 스택

다시고침 프론트엔드가 무엇으로 만들어졌고, 각 기술을 코드 어디에서 쓰는지 정리한 문서입니다.

- 버전 표기: `package.json`에 적힌 범위 그대로이고, 괄호 안은 현재 `node_modules`에 설치된 버전입니다.
- 런타임 의존성은 4개(`react`, `react-dom`, `react-router-dom`, `lucide-react`)뿐입니다. 3D와 지도는 npm 패키지가 아니라 CDN 스크립트로 불러옵니다.

[README로 돌아가기](../README.md) · [아키텍처 문서](architecture.md)

## 한눈에 보기

| 영역 | 기술 | 버전 |
| --- | --- | --- |
| UI 라이브러리 | React / React DOM | `^19.2.6` (19.2.6) |
| 라우팅 | React Router (`react-router-dom`) | `^7.15.1` (7.15.1) |
| 아이콘 | lucide-react | `^1.16.0` (1.16.0) |
| 언어 | TypeScript | `~6.0.2` (6.0.3) |
| 빌드·개발 서버 | Vite | `^8.0.12` (8.0.13) |
| React 플러그인 | `@vitejs/plugin-react` | `^6.0.1` (6.0.2) |
| 스타일 | Tailwind CSS + `@tailwindcss/vite` | `^4.3.0` (4.3.0) |
| 린트 | ESLint + typescript-eslint | `^10.3.0` (10.4.0) / `^8.59.2` (8.59.4) |
| 3D 평면도 | three.js (CDN) | r128 / `three@0.128.0` |
| 지도 | Kakao Maps JavaScript SDK (CDN) | `v2` (`services` 라이브러리) |
| 배포 | Vercel (`vercel.json` 리라이트) | - |

## 런타임 의존성

### React `^19.2.6`, React DOM `^19.2.6`

화면 전체를 함수형 컴포넌트와 훅으로 만들었습니다. 클래스 컴포넌트는 없습니다.

- 진입점: `src/main.tsx`에서 `createRoot`로 `<App />`을 `StrictMode`와 `BrowserRouter`로 감싸 렌더링합니다.
- 전역 상태는 따로 상태 관리 라이브러리 없이 React Context 하나로 처리합니다. `src/auth.ts`의 `AuthContext` / `useAuth`가 로그인 여부, 사용자 프로필, 주체 유형(`USER` / `ADMIN`)을 들고 있고, `src/App.tsx`가 값을 채웁니다.
- 서버 데이터는 각 화면에서 `useEffect` + `useState`로 직접 불러옵니다. 언마운트 뒤 상태 갱신을 막으려고 `cancelled` / `active` 플래그 패턴을 일관되게 씁니다 (예: `src/hooks/useNotifications.ts`, `src/pages/Admin/HousingAnalysisPage.tsx`).
- 커스텀 훅: `src/hooks/useNotifications.ts` (입주민 `/me`, 관리자 `/admin` 알림을 고르는 `source` 인자, 읽음 처리는 낙관적 업데이트 후 실패하면 되돌림)

### React Router `^7.15.1` (`react-router-dom`)

- `src/App.tsx`에서 `<Routes>` / `<Route>`로 경로를 선언하고, 가드 컴포넌트(`src/pages/UserPageGuard.tsx`, `src/pages/Admin/AdminGuard.tsx`)가 `<Navigate>`로 돌려보냅니다.
- `useNavigate`의 `state`로 돌아올 곳을 넘깁니다. 예: 프로필이 없으면 홈에서 `/profile`로 보내며 `{ from: "/report" }`를 함께 넘김 (`src/pages/Home/HomePage.tsx`).
- `useSearchParams`로 관리자 첫 화면의 탭을 주소에 남깁니다 (`/admin?view=map`, `src/pages/Admin/HousingAnalysisPage.tsx`). 새로고침·뒤로가기에도 탭이 유지됩니다.
- `useParams`로 관리자 신고 상세의 `:id`를 읽습니다 (`src/pages/Admin/AdminReportDetailPage.tsx`).

### lucide-react `^1.16.0`

SVG 아이콘 라이브러리입니다. 닫기(`X`), 보내기(`ArrowUp`), 챗봇 버튼(`MessageCircle`), 화살표(`ChevronRight`), 3D(`Box`) 같은 아이콘을 컴포넌트로 가져다 씁니다.

- 사용처: `src/components/admin/*`(AdminChatWidget, AdminTopNav, AdminSidebar, AdminBuildingScene3D), `src/components/report/*`, `src/components/layout/Header.tsx`, 그리고 `src/pages` 아래 대부분의 화면
- 일부 아이콘은 직접 그린 SVG 컴포넌트입니다 (`src/components/common/ShareIcon.tsx`, `ChevronDownIcon.tsx`).

## 개발 도구

### TypeScript `~6.0.2`

- 설정: `tsconfig.json`이 `tsconfig.app.json`(앱 코드, `src`)과 `tsconfig.node.json`(Vite 설정 파일)을 참조하는 프로젝트 레퍼런스 구조입니다.
- `tsconfig.app.json` 주요 옵션: `target: es2023`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`
- 경로 별칭: `@/*` → `src/*` (`tsconfig.app.json`의 `paths`, `vite.config.ts`의 `resolve.alias` 양쪽에 설정)
- 빌드 스크립트 `npm run build`는 먼저 `tsc -b`로 타입 검사를 하고, 통과해야 `vite build`를 실행합니다.
- 공용 도메인 타입은 `src/types/index.ts`(Report, Building, BuildingSpace, BuildingUnit, User, ScenePin 등), API 전용 타입은 각 `src/api/*.ts`에 있습니다.

### Vite `^8.0.12` + `@vitejs/plugin-react` `^6.0.1`

설정 파일은 `vite.config.ts`입니다.

- 플러그인: `react()`, `tailwindcss()`
- 개발 서버: 포트 `5175`, `host: true`(같은 네트워크의 휴대폰으로 모바일 화면 확인 가능)
- 프록시: `/api`, `/files`(그리고 `/api/v1`)를 `VITE_API_PROXY_TARGET`(기본값 `http://127.0.0.1:8080`)으로 넘깁니다. 브라우저에서는 같은 출처로 보이므로 로컬에서도 CORS 설정이 필요 없습니다.
- 환경 변수는 `import.meta.env`로 읽습니다. 코드에서 실제로 쓰는 값은 세 개입니다.

  | 변수 | 읽는 곳 | 용도 |
  | --- | --- | --- |
  | `VITE_API_BASE_URL` | `src/api/http.ts` | API 기본 경로 (없으면 `/api/v1`) |
  | `VITE_GUEST_LOGIN_ENABLED` | `src/constants/login.ts` | `"true"`일 때만 테스트 로그인 패널 노출 |
  | `VITE_KAKAO_APP_KEY` | `src/lib/kakaoMap.ts` | 카카오맵 SDK 키 |

  `VITE_API_PROXY_TARGET`은 앱 코드가 아니라 `vite.config.ts`에서 `loadEnv`로 읽습니다.

### Tailwind CSS `^4.3.0` + `@tailwindcss/vite` `^4.3.0`

Tailwind v4 방식이라 `tailwind.config.js`가 없습니다. CSS 파일 안에서 설정합니다.

- `src/index.css`: `@import "tailwindcss";` 다음 `@theme { ... }` 블록에 디자인 토큰(색상 `--color-primary`, 텍스트·배경·테두리 색, 위험도 색, 글꼴 스택 등)을 CSS 변수로 정의합니다. 이 토큰이 `bg-risk-high`, `text-text-primary`, `bg-sogang-500` 같은 유틸리티 클래스로 쓰입니다.
- 위험도 라벨과 클래스 매핑은 `src/constants/risk.ts`에 한곳으로 모았습니다.
- `src/housing.css`: 관리자 화면(`.housing-app`, `.housing-chat`, `.admin-chat-fab` 등)용 일반 CSS입니다. `index.css`에서 `@import`합니다. 관리자 화면은 이 클래스와 Tailwind 유틸리티를 섞어 씁니다.
- 글꼴은 `Pretendard`를 우선으로 지정하지만, 웹폰트를 따로 불러오지는 않으므로 설치되어 있지 않으면 시스템 글꼴로 대체됩니다.

### ESLint `^10.3.0`

설정 파일은 `eslint.config.js`(flat config)입니다. `dist`는 무시하고 `**/*.{ts,tsx}`에 아래 규칙 세트를 적용합니다.

| 패키지 | 버전 | 역할 |
| --- | --- | --- |
| `@eslint/js` | `^10.0.1` | ESLint 기본 추천 규칙 |
| `typescript-eslint` | `^8.59.2` | TypeScript 파서·추천 규칙 |
| `eslint-plugin-react-hooks` | `^7.1.1` | 훅 규칙 (`flat.recommended`) |
| `eslint-plugin-react-refresh` | `^0.5.2` | Vite HMR에 맞는 export 규칙 (`configs.vite`) |
| `globals` | `^17.6.0` | 브라우저 전역 변수 정의 |

카카오 SDK처럼 타입이 없는 전역 객체를 다루는 파일(`src/lib/kakaoMap.ts`, `src/components/admin/RegionKakaoMap.tsx`)에는 파일 맨 위에서 `no-explicit-any`를 꺼 두었습니다.

### 타입 정의

| 패키지 | 버전 |
| --- | --- |
| `@types/react` | `^19.2.14` |
| `@types/react-dom` | `^19.2.3` |
| `@types/node` | `^24.12.3` (`vite.config.ts`의 `path` 사용) |

## CDN으로 불러오는 외부 라이브러리

### three.js r128 (3D 평면도)

`public/scenes/*_3d.html`은 청년주택 세대·층·공용공간의 3D 평면도를 담은 **독립 HTML 파일**입니다(현재 38개). React 번들에 포함되지 않고, 각 파일이 직접 CDN에서 three.js를 불러옵니다.

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
```

- 쓰는 기능: `Scene` / 카메라 / `OrbitControls`(회전·확대), `Raycaster`(탭한 지점의 3D 좌표 구하기), 메시로 만든 핀(구 + 원기둥 + 바닥 고리), 라벨 스프라이트
- 앱에서는 `src/components/scene/SceneViewer.tsx`가 이 파일을 `iframe`으로 띄우고 `postMessage`로 핀을 주고받습니다. 자세한 프로토콜은 [아키텍처 문서의 3D 장면 임베드](architecture.md#3d-장면-임베드-프로토콜)를 보세요.
- 원본 출처와 덧붙인 부분은 [`public/scenes/README.md`](../public/scenes/README.md)에 있습니다.

### Kakao Maps JavaScript SDK v2 (관리자 지역 지도)

- 로더: `src/lib/kakaoMap.ts`의 `loadKakao()`가 `https://dapi.kakao.com/v2/maps/sdk.js?appkey=...&autoload=false&libraries=services` 스크립트를 한 번만 `<head>`에 넣고, `kakao.maps.load()`가 끝나면 resolve합니다. 키가 없거나 예시 값이면 `hasKakaoKey`가 `false`가 되어 아예 불러오지 않습니다.
- 지오코딩: `geocode()`가 `kakao.maps.services.Geocoder().addressSearch`로 단지 주소·지역명을 좌표로 바꿉니다. 지번 꼬리(`외 66필지`, `일원` 등)를 떼고, 못 찾으면 번지를 뺀 동 단위로 다시 찾습니다. 결과는 `Map`에 캐시합니다.
- 화면: `src/components/admin/RegionKakaoMap.tsx`가 `kakao.maps.Map`을 만들고 시·군·구 또는 청년주택마다 `CustomOverlay`로 민원 건수 마커를 올린 뒤 `setBounds`로 화면을 맞춥니다. 지도를 못 불러오면 `fallback`으로 받은 기본 배치 마커를 대신 보여줍니다.

## 사용하는 브라우저 API

| API | 사용처 | 용도 |
| --- | --- | --- |
| `fetch` | `src/api/http.ts` | 모든 REST 호출, 401 시 토큰 갱신 후 한 번 재시도 |
| `FormData` | `src/api/reports.ts` | 신고 사진 업로드 (`photos` 필드, multipart) |
| `localStorage` | `src/api/http.ts`, `src/components/admin/AdminSpaceMapView.tsx` | JWT(access/refresh)·주체 유형 저장, 관리자 3D 지도에서 마지막으로 본 단지 기억 |
| `window.postMessage` / `message` 이벤트 | `src/components/scene/SceneViewer.tsx`, `public/scenes/*_3d.html` | 앱 ↔ 3D 장면 iframe 간 핀 좌표 주고받기 |
| `Event` + `window.dispatchEvent` | `src/api/http.ts` → `src/App.tsx` | 토큰 갱신 실패 시 `dasigochim:unauthorized` 이벤트로 전역 로그아웃 |
| `<input type="file" accept="image/*" capture="environment">` | `src/pages/Report/ReportFlowPage.tsx` | 휴대폰 후면 카메라 바로 열기 (앨범 선택용 입력도 따로 있음) |
| `URL.createObjectURL` / `revokeObjectURL` | `src/pages/Report/ReportFlowPage.tsx`, `src/utils/complaintChatAnswer.ts` | 찍은 사진 미리보기, CSV 파일 다운로드 링크 만들기 |
| `Blob` + `<a download>` | `src/utils/complaintChatAnswer.ts` | 관리자 챗봇의 민원 CSV 내보내기 (엑셀 호환을 위해 BOM 추가, 수식 주입 방지 처리) |
| `ResizeObserver` | `src/pages/Report/ReportFlowPage.tsx` | 헤더·하단 입력 영역 높이를 재서 채팅 스크롤 여백 맞추기 |
| `Element.scrollIntoView` | `src/components/admin/AdminChatWidget.tsx` | 챗봇 새 메시지로 스크롤 |
| `window.open` | `src/pages/Admin/AdminReportDetailPage.tsx` | 생성된 신고서 파일을 새 탭으로 열기 |
| `Intl.DateTimeFormat` | `AdminBuildingScene3D.tsx`, `NotificationItem.tsx`, `HomePage.tsx` | 한국어 날짜 표기 |
| `URLSearchParams` | `src/api/admin.ts`, `src/api/buildings.ts`, 3D 장면 HTML | 쿼리 문자열 만들기·읽기 (`?embed=1&mode=pick`) |

## 배포 환경

- **Vercel**: 정적 빌드 결과물(`dist/`)을 배포합니다.
- **`vercel.json` 리라이트**
  - `/api/:path*`, `/files/:path*` → EC2 백엔드의 같은 경로 (프록시)
  - `/(.*)` → `/index.html` (SPA 클라이언트 라우팅)
- 백엔드와 AI 서버는 `dasigochim-deployment` 저장소의 Docker Compose로 EC2에서 실행됩니다.
