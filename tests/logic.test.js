// 대시보드 로직 테스트 (UI 제외) — 실행: node --test tests/
// 외부 패키지 없이 Node 내장 node:test / node:vm 만 사용합니다.
// index.html 안의 LOGIC / DATA 블록을 그대로 읽어 실행하므로, 실제 페이지 코드를 검증합니다.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
function block(name) {
  const m = html.match(new RegExp("/\\* " + name + "-START[\\s\\S]*?/\\* " + name + "-END \\*/"));
  if (!m) throw new Error(name + " 블록 없음");
  return m[0];
}
// 같은 realm 에서 실행해야 deepStrictEqual 의 배열/객체 프로토타입 비교가 맞습니다.
const { Logic, DATA } = new Function(block("LOGIC") + "\n" + block("DATA") + "\nreturn { Logic: Logic, DATA: DATA };")();
const clone = (o) => JSON.parse(JSON.stringify(o));
const TODAY = "2026-11-23";

test("모든 인라인 스크립트가 문법 오류 없이 파싱된다", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 2);
  scripts.forEach((s) => assert.doesNotThrow(() => new vm.Script(s)));
  assert.doesNotThrow(() => JSON.parse(html.match(/id="board-state">([\s\S]*?)<\/script>/)[1]));
});

test("더미데이터 참조 무결성: 담당자·마일스톤 ID가 모두 존재하고 ID가 고유하다", () => {
  const mem = new Set(DATA.members.map((m) => m.id));
  const ms = new Set(DATA.milestones.map((m) => m.id));
  for (const t of DATA.tasks) { assert.ok(mem.has(t.assigneeId), t.id); assert.ok(ms.has(t.milestoneId), t.id); assert.ok(Logic.STATUSES.includes(t.status)); }
  for (const i of DATA.issues) { assert.ok(mem.has(i.assigneeId), i.id); assert.ok(ms.has(i.milestoneId), i.id); assert.ok(i.severity in Logic.SEV_ORDER); }
  for (const d of DATA.documents) assert.ok(mem.has(d.authorId), d.id);
  for (const list of [DATA.tasks, DATA.issues, DATA.documents]) assert.equal(new Set(list.map((x) => x.id)).size, list.length);
  assert.equal(DATA.tasks.length, 20); assert.equal(DATA.issues.length, 25); assert.equal(DATA.documents.length, 10);
});

test("날짜 계산: 일수 차이와 기준 주(월~일)", () => {
  assert.equal(Logic.daysBetween("2026-11-23", "2026-12-07"), 14);
  assert.equal(Logic.daysBetween("2026-12-31", "2027-01-04"), 4);
  assert.deepEqual({ ...Logic.weekRange(TODAY) }, { start: "2026-11-23", end: "2026-11-29" }); // 11-23 은 월요일
  assert.deepEqual({ ...Logic.weekRange("2026-11-29") }, { start: "2026-11-23", end: "2026-11-29" }); // 일요일
});

test("KPI: 진행률·열린 이슈·Critical·이번 주 마감·D-day", () => {
  const k = Logic.computeKpis(DATA, TODAY);
  assert.equal(k.doneTasks, 9);
  assert.equal(k.progress, 45);            // 9 / 20
  assert.equal(k.openIssues, 16);          // open + in_progress
  assert.equal(k.critical, 2);             // I-101, I-102
  assert.equal(k.dueThisWeek, 4);          // T-10~T-13 (11-25~11-28, 미완료)
  assert.equal(k.next.milestone.id, "M4");
  assert.equal(k.next.dday, 14);
});

test("마일스톤 진행률과 상태", () => {
  const m = Object.fromEntries(DATA.milestones.map((x) => [x.id, x]));
  assert.equal(Logic.milestoneProgress(DATA.tasks, "M1"), 100);
  assert.equal(Logic.milestoneProgress(DATA.tasks, "M3"), 27); // 3 / 11
  assert.equal(Logic.milestoneProgress(DATA.tasks, "없음"), 0);
  assert.equal(Logic.milestoneStatus(m.M1, DATA.tasks, TODAY), "done");
  assert.equal(Logic.milestoneStatus(m.M3, DATA.tasks, TODAY), "active");
  assert.equal(Logic.milestoneStatus(m.M4, DATA.tasks, TODAY), "planned");
  assert.equal(Logic.nextMilestone(DATA.milestones, "2027-01-20"), null);
});

test("칸반 이동이 KPI·마일스톤 진행률에 즉시 반영되고 원본은 바뀌지 않는다", () => {
  const data = clone(DATA);
  const moved = Logic.moveTask(data.tasks, "T-10", "done");
  assert.equal(data.tasks.find((t) => t.id === "T-10").status, "review"); // 불변
  data.tasks = moved;
  const k = Logic.computeKpis(data, TODAY);
  assert.equal(k.doneTasks, 10); assert.equal(k.progress, 50); assert.equal(k.dueThisWeek, 3);
  assert.equal(Logic.milestoneProgress(data.tasks, "M3"), 36); // 4 / 11
  assert.throws(() => Logic.moveTask(data.tasks, "T-10", "archived"));
});

test("보드 상태 저장/복원: 알 수 없는 ID·상태는 무시한다", () => {
  const st = { ...Logic.boardState(DATA.tasks), "T-01": "todo", "T-99": "done", "T-02": "weird" };
  const restored = Logic.applyBoardState(DATA.tasks, st);
  assert.equal(restored.find((t) => t.id === "T-01").status, "todo");
  assert.equal(restored.find((t) => t.id === "T-02").status, "done");
  assert.equal(restored.length, 20);
  assert.equal(Logic.applyBoardState(DATA.tasks, null).length, 20);
});

test("증감 이모지", () => {
  assert.deepEqual({ ...Logic.trend(16, 14) }, { diff: 2, emoji: "🔺", text: "+2" });
  assert.deepEqual({ ...Logic.trend(1, 3) }, { diff: -2, emoji: "🔻", text: "-2" });
  assert.equal(Logic.trend(5, 5).emoji, "➖");
});

test("이슈 필터: 심각도·상태·담당자·검색 조합", () => {
  assert.equal(Logic.filterIssues(DATA.issues, {}).length, 25);
  assert.equal(Logic.filterIssues(DATA.issues, { severity: "critical" }).length, 3);
  assert.equal(Logic.filterIssues(DATA.issues, { status: "__open" }).length, 16);
  assert.equal(Logic.filterIssues(DATA.issues, { severity: "critical", status: "__open" }).length, 2);
  const u6 = Logic.filterIssues(DATA.issues, { assignee: "u6", status: "open" }).map((i) => i.id);
  assert.deepEqual(u6, ["I-102", "I-120", "I-123"]);
  assert.deepEqual(Logic.filterIssues(DATA.issues, { q: "  결제 " }).map((i) => i.id), ["I-102", "I-123"]);
  assert.deepEqual(Logic.filterIssues(DATA.issues, { q: "i-117" }).map((i) => i.id), ["I-117"]);
  assert.equal(Logic.filterIssues(DATA.issues, { severity: "low", assignee: "u5" }).length, 0);
});

test("정렬: 심각도 순서, 날짜, 버전 숫자 비교, 동률은 ID 순", () => {
  const bySev = Logic.sortRows(DATA.issues, "severity", "desc");
  assert.equal(bySev[0].severity, "critical"); assert.equal(bySev.at(-1).severity, "low");
  assert.deepEqual(bySev.slice(0, 3).map((i) => i.id).sort(), ["I-101", "I-102", "I-122"]);
  assert.equal(Logic.sortRows(DATA.issues, "createdAt", "desc")[0].id, "I-117");
  assert.equal(Logic.sortRows(DATA.issues, "createdAt", "asc")[0].id, "I-116");
  const vers = Logic.sortRows([{ id: "a", version: "v1.10" }, { id: "b", version: "v1.9" }, { id: "c", version: "v0.2" }], "version", "asc");
  assert.deepEqual(vers.map((d) => d.id), ["c", "b", "a"]); // 1.9 < 1.10
  const tie = Logic.sortRows([{ id: "B", x: 1 }, { id: "A", x: 1 }], "x", "asc");
  assert.deepEqual(tie.map((r) => r.id), ["A", "B"]);
});

test("문서: 유형 필터, 검색, 기본 정렬(최종 수정일 내림차순)", () => {
  assert.equal(Logic.filterDocs(DATA.documents, { type: "PRD" }).length, 4);
  assert.deepEqual(Logic.filterDocs(DATA.documents, { q: "prd", type: "PRD" }).length, 4);
  const sorted = Logic.sortRows(DATA.documents, "updatedAt", "desc");
  assert.equal(sorted[0].id, "D-05"); assert.equal(sorted.at(-1).id, "D-01");
});

test("최근 업데이트: 문서·이슈를 합쳐 최신 5건", () => {
  const r = Logic.recentUpdates(DATA, 5);
  assert.equal(r.length, 5);
  assert.equal(r[0].ref, "I-117"); // 11-23
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].date >= r[i].date);
});

test("재게시 문서: board-state 만 교체하고 skeleton 형태를 지킨다", () => {
  const content = '<title>x</title><script type="application/json" id="board-state">{}</script><p>본문</p>';
  const doc = Logic.buildDocument(content, { "T-01": "done", evil: "</script><b>" });
  assert.ok(doc.startsWith('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>'));
  assert.ok(doc.endsWith("<p>본문</p></body></html>"));
  assert.ok(doc.includes("</style></head><body><title>x</title>"));
  const json = doc.match(/id="board-state">([\s\S]*?)<\/script>/)[1];
  assert.ok(!json.includes("</script"));                 // 스크립트 탈출 방지
  assert.equal(JSON.parse(json)["T-01"], "done");
  assert.equal(JSON.parse(json).evil, "</script><b>");
  assert.throws(() => Logic.buildDocument("<p>no state</p>", {}));
  // 실제 페이지 내용으로도 생성 가능
  assert.doesNotThrow(() => Logic.buildDocument(html, Logic.boardState(DATA.tasks)));
});
