# 3D 공간 장면

신고 위치를 찍는 3D 장면들입니다. 공덕역 청년안심주택 e·seo(이서)의 평면도를 three.js 로 옮긴 것으로,
원본은 `dasigochim-3d-source` 저장소의 `eseo314_floorplans/3d/` 에 있습니다.

- 파일 이름 `{sceneId}_3d.html` 의 `sceneId` 가 백엔드 `building_units.scene_id`, `building_spaces.scene_id`,
  `reports.scene_id` 와 짝입니다.
- 원본에서 두 가지를 덧붙였습니다.
  1. 라벨 스프라이트에 공간 이름 저장 (`s.userData.text = text`) — 핀 근처 공간 이름을 찾는 데 씁니다.
  2. 파일 끝의 앱 연동 스크립트 — `?embed=1` 로 열면 버튼을 숨기고, `&mode=pick` 이면 탭한 지점에 핀을 꽂아
     `postMessage` 로 좌표를 보냅니다. 메시지 형식은 스크립트 주석을 보세요.
