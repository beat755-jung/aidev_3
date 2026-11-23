# 완료 체크리스트 (3단계 : Implement)

> 작성일: 2026-11-23 · 대상: `dev_dashboard/` · 배포: **하지 않음** (요청대로 보류)

## 산출물

| 파일 | 내용 |
|---|---|
| `index.html` | 대시보드 본체 (HTML·CSS·JS 단일 파일, 4개 탭) |
| `tests/logic.test.js` | 로직 테스트 13개 (Node 내장 테스트 러너) |
| `plan.md` | 2단계 계획서 (변경 없음) |
| `done.md` | 본 문서 |

테스트 실행: `dev_dashboard` 폴더에서 `node --test tests/logic.test.js`

---

## - [x] 모든 기능 구현이 완료되었고 테스트를 통과했는가? 그리고 테스트 코드는 남아있는가?

**근거 1. 계획서 기능 ↔ 구현 위치**

| plan.md 항목 | 구현 (`index.html`) |
|---|---|
| §5① 개요: KPI 4개(진행률·열린 이슈·이번 주 마감·D-day), 전주 대비 증감 | `renderOverview()`, `Logic.computeKpis()`, `Logic.trend()` |
| §5① 심각도 막대, 태스크 상태 도넛, 최근 업데이트 5건 | `renderOverview()`, `donut()`, `Logic.recentUpdates()` |
| §5② 간트(월 눈금·오늘선·진행률·✅/⏩/⬜) | `gantt()`, `Logic.milestoneProgress/Status()` |
| §5② 칸반 4열, 포인터 드래그(마우스·터치), 키보드 ←/→ | `boardCols()`, `bindBoard()`, `commitMove()` |
| §5② 이동 즉시 KPI·간트 재계산 | `commitMove()`가 간트를 다시 그림, 개요는 렌더 시 `DATA.tasks`로 계산 |
| §5③ 이슈: 심각도·상태·담당자 필터, 검색, 초기화, 열 정렬, 건수, 연결 마일스톤 배지 | `renderIssues()`, `issueRows()`, `Logic.filterIssues()`, `Logic.sortRows()` |
| §5④ 문서: 유형 필터, 검색, 버전·작성자·최종 수정일·⭕/❌, 기본 최종 수정일 내림차순 | `renderDocs()`, `docRows()`, `Logic.filterDocs()` |
| §4-2 Rail(데스크톱) / 하단 탭바(900px 미만) | `.rail` CSS + `@media (max-width: 899px)` |
| §4-3 모션: 카운트업, 막대·도넛·간트 성장, FLIP, 탭 fade. 최초 1회/값 변화 시만, reduced-motion 대응 | `countUp()`, `grow()`, `changed()`, `@media (prefers-reduced-motion)` |
| §4-4 이모지: ⭕❌ ✅⬜ ➡️⏩ 🔺🔻➖ | 문서 확정, 완료 열·이슈 종료, 다음 마일스톤, KPI 증감 |
| §4-5 다크모드 토글 + localStorage 기억 | `#theme-toggle`, `:root[data-theme]` 토큰 |
| §6·§8 권한: 게시자 = 칸반 이동 + 재게시 저장, 보기 권한자 = 보기용 조작만 | `mode`(demo/view/edit), `user.isOwner()`, `scheduleSave()` → `artifact.publish()`, `Logic.buildDocument()` |

**근거 2. 테스트 실행 결과** (2026-11-23, Node v24.14.0)

```
✔ 모든 인라인 스크립트가 문법 오류 없이 파싱된다
✔ 더미데이터 참조 무결성: 담당자·마일스톤 ID가 모두 존재하고 ID가 고유하다
✔ 날짜 계산: 일수 차이와 기준 주(월~일)
✔ KPI: 진행률·열린 이슈·Critical·이번 주 마감·D-day
✔ 마일스톤 진행률과 상태
✔ 칸반 이동이 KPI·마일스톤 진행률에 즉시 반영되고 원본은 바뀌지 않는다
✔ 보드 상태 저장/복원: 알 수 없는 ID·상태는 무시한다
✔ 증감 이모지
✔ 이슈 필터: 심각도·상태·담당자·검색 조합
✔ 정렬: 심각도 순서, 날짜, 버전 숫자 비교, 동률은 ID 순
✔ 문서: 유형 필터, 검색, 기본 정렬(최종 수정일 내림차순)
✔ 최근 업데이트: 문서·이슈를 합쳐 최신 5건
✔ 재게시 문서: board-state 만 교체하고 skeleton 형태를 지킨다
ℹ tests 13 · pass 13 · fail 0
```

- 테스트는 `index.html` 안의 `LOGIC` / `DATA` 블록을 직접 읽어 실행하므로, 복사본이 아닌 실제 페이지 코드를 검증합니다.
- 첫 실행에서 2건이 실패했으나 원인은 테스트 쪽(vm 컨텍스트 간 배열 비교)이었고, 같은 realm에서 실행하도록 테스트를 고친 뒤 전부 통과했습니다. 페이지 로직은 수정하지 않았습니다.

**근거 3. 테스트 코드 보존**: `tests/logic.test.js`가 남아 있습니다.

**범위 밖 (요청에 따라 제외)**: UI 동작(드래그 손맛, 애니메이션, 레이아웃, 다크모드 색)은 사용자가 직접 확인합니다. 아울러 게시자 판별(`isOwner`)과 재게시(`publish`)는 Artifact 뷰어 안에서만 동작하므로, 로컬에서는 재게시용 문서 생성(`buildDocument`)까지만 검증했습니다. 실제 저장 동작은 배포 후 확인이 필요합니다.

---

## - [x] Plan 문서에서 제시된 의존성과 규약 이외의 다른 의존성이 추가되지는 않았는가?

**근거**: 파일에서 외부 참조를 전부 추출한 결과

```
index.html 외부 URL
  https://fonts.googleapis.com        ← plan §2 IBM Plex Sans KR / IBM Plex Mono
  https://fonts.gstatic.com           ← 위 폰트 파일
tests/logic.test.js import
  node:assert/strict, node:fs, node:path, node:test, node:vm   ← 모두 Node 내장 모듈
```

- JS 라이브러리, 차트 라이브러리, CDN 스크립트: **없음**. 차트는 SVG를 직접 그렸습니다 (plan §2).
- `package.json`·`node_modules`: **없음**. 설치할 패키지가 없습니다.
- Artifact 런타임 기능 `user`, `artifact`는 plan §6에 명시된 것이며 외부 의존성이 아닙니다.
- 규약 준수: 단일 `index.html`, 해시 라우팅 `#overview` `#schedule` `#issues` `#docs`, 계산값 비저장(진행률·KPI는 매번 계산), 메인 컬러 `#1428A0`.
- **참고**: 테스트 실행에는 Node.js가 필요합니다. plan에 "콘솔 단위 확인"으로만 적혀 있던 부분을 Node 내장 테스트 러너로 구체화한 것이며, 추가 설치는 없습니다.

---

## - [x] 모호한 부분이 남아있지 않고 충분히 해소되었는가? 남아있다면 사용자에게 알림

**해소된 사항** (2단계 질문으로 확정, plan §8)
1. 저장 방식 → 페이지 재게시
2. 편집 범위 → 칸반 이동만
3. 보기 권한자 → 필터·정렬·검색·다크모드 허용, 칸반 드래그만 차단

**구현 중 직접 정한 사항 (알림)** — 계획서에 세부가 없어 아래처럼 정했습니다. 다르게 원하시면 말씀해 주세요.
1. **전주 대비 기준값**: 실제 이력이 없어 전주(11-16) 스냅샷을 더미로 고정했습니다 (`DATA.lastWeek`). 칸반을 옮겨도 비교 기준은 바뀌지 않습니다.
2. **"열린 이슈" 정의**: 상태가 `열림` + `처리 중`인 이슈입니다. `해결됨`·`종료`는 제외합니다.
3. **로컬 데모 모드**: `index.html`을 브라우저로 직접 열면 게시자 판별이 불가능해 편집 가능한 데모로 열리고, 변경 내용은 저장되지 않습니다. 헤더에 "🧪 로컬 데모 · 저장 안 됨"으로 표시됩니다.
4. **저장 묶음 처리**: 카드를 연달아 옮기면 마지막 이동 후 1.2초 뒤 한 번만 저장합니다.

**남은 확인 사항 (배포 단계)**
- 게시 시 `capabilities: { artifact: {}, user: {} }`를 선언해야 권한 분기와 저장이 동작합니다.
- 재게시 저장, 게시자/보기 권한자 분기는 Artifact 뷰어에서만 확인할 수 있어 배포 후 검증이 필요합니다.
