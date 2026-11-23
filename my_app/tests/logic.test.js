// topForce 영웅 대시보드 로직 테스트 (UI 제외) — 실행: node --test tests/logic.test.js
// Node 내장 모듈만 사용. index.html 안의 LOGIC 블록과 인라인 데이터를 그대로 읽어 검증합니다.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const json = JSON.parse(fs.readFileSync(path.join(root, "data", "heroes.json"), "utf8"));
const logicSrc = html.match(/\/\* LOGIC-START[\s\S]*?\/\* LOGIC-END \*\//)[0];
const Logic = new Function(logicSrc + "\nreturn Logic;")();
const inline = JSON.parse(html.match(/<script type="application\/json" id="hero-data">([\s\S]*?)<\/script>/)[1]);
const H = inline.heroes;
const names = (l) => l.map((h) => h.name);

test("인라인 스크립트 문법 검사 + 데이터 자리표시자 제거 확인", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 2);
  scripts.forEach((s) => assert.doesNotThrow(() => new vm.Script(s)));
  assert.ok(!html.includes("__HERO_DATA__"));
});

test("index.html 데이터가 data/heroes.json 과 완전히 같다", () => {
  assert.deepEqual(inline, json);
});

test("데이터 무결성: 허용값·중복 없음·수량", () => {
  assert.deepEqual(Logic.validate(H), []);
  assert.equal(H.length, 31);
  assert.deepEqual(Logic.countBy(H, "rarity", Logic.RARITY_ORDER), { UR: 15, SSR: 12, SR: 4 });
  assert.deepEqual(Logic.countBy(H, "class", Logic.CLASSES), { "보병": 13, "전차": 9, "헬기": 9 });
  // validate 가 잘못된 값을 잡아내는지
  const bad = [{ name: "X", rarity: "LR", class: "함선", role: "공격", tier: "S", note: "n" }, { name: "X", rarity: "UR", class: "보병", role: "공격", tier: "Z", note: "" }];
  assert.ok(Logic.validate(bad).length >= 4);
});

test("티어 점수: S+=8 … D=1, 알 수 없는 값은 0", () => {
  assert.equal(Logic.tierScore("S+"), 8);
  assert.equal(Logic.tierScore("A"), 5);
  assert.equal(Logic.tierScore("D"), 1);
  assert.equal(Logic.tierScore("?"), 0);
});

test("필터: 항목 내 OR, 항목 간 AND, 티어 범위·정확 일치, 검색", () => {
  assert.equal(Logic.filterHeroes(H, {}).length, 31);
  assert.equal(Logic.filterHeroes(H, { rarity: ["UR"] }).length, 15);
  assert.equal(Logic.filterHeroes(H, { rarity: ["SSR", "SR"] }).length, 16);
  assert.equal(Logic.filterHeroes(H, { cls: ["헬기"], rarity: ["UR"] }).length, 5);
  assert.deepEqual(names(Logic.filterHeroes(H, { role: ["버프"] })), ["Rasim"]);
  assert.deepEqual(names(Logic.filterHeroes(H, { minTier: "S+" })).sort(), ["Amy", "Boone", "Brock", "Zakarov"]);
  assert.equal(Logic.filterHeroes(H, { minTier: "S" }).length, 7);
  assert.equal(Logic.filterHeroes(H, { minTier: "A" }).length, 16);
  assert.deepEqual(names(Logic.filterHeroes(H, { tier: ["D"] })).sort(), ["Colton", "Luke", "Marcus", "Samantha"]);
  assert.deepEqual(names(Logic.filterHeroes(H, { q: "  몬스터 " })), ["Victor", "Sparks", "Rosa", "Raffa", "Holland"]);
  assert.deepEqual(names(Logic.filterHeroes(H, { q: "amy" })), ["Amy"]);
  assert.equal(Logic.filterHeroes(H, { role: ["버프"], cls: ["전차"] }).length, 0);
});

test("정렬: 티어순(동률 등급→이름), 등급순, 이름순", () => {
  const byTier = Logic.sortHeroes(H, "tier");
  assert.deepEqual(names(byTier.slice(0, 4)), ["Amy", "Boone", "Brock", "Zakarov"]);
  for (let i = 1; i < byTier.length; i++) assert.ok(Logic.tierScore(byTier[i - 1].tier) >= Logic.tierScore(byTier[i].tier));
  const byRar = Logic.sortHeroes(H, "rarity");
  assert.equal(byRar[0].rarity, "UR"); assert.equal(byRar.at(-1).rarity, "SR");
  assert.equal(byRar[0].name, "Amy"); // UR 중 S+ 이름순 첫 번째
  const byName = Logic.sortHeroes(H, "name");
  assert.equal(byName[0].name, "Alexander"); assert.equal(byName.at(-1).name, "Zakarov");
  assert.equal(H[0].name, "Zakarov"); // 원본 불변
});

test("티어표 그룹: 모든 칸 합계 31명, 칸 내용 확인", () => {
  const g = Logic.tierGrid(H);
  let total = 0;
  for (const t of Logic.TIER_ORDER) for (const c of Logic.CLASSES) total += g[t][c].length;
  assert.equal(total, 31);
  assert.deepEqual(names(g["S+"]["헬기"]), ["Amy", "Brock"]);
  assert.deepEqual(names(g["S+"]["보병"]), ["Zakarov"]);
  assert.deepEqual(names(g["D"]["전차"]), ["Samantha"]);
  assert.deepEqual(g["S"]["전차"].map((h) => h.name), ["Mira"]);
});

test("분포 집계: 병종×등급, 티어 분포, 역할 비율, 평균 티어", () => {
  assert.deepEqual(Logic.crossTab(H, "class", Logic.CLASSES, "rarity", Logic.RARITY_ORDER), {
    "보병": { UR: 5, SSR: 6, SR: 2 }, "전차": { UR: 5, SSR: 3, SR: 1 }, "헬기": { UR: 5, SSR: 3, SR: 1 }
  });
  const tiers = Logic.countBy(H, "tier", Logic.TIER_ORDER);
  assert.deepEqual(tiers, { "S+": 4, "S": 3, "A+": 5, "A": 4, "B+": 4, "B": 3, "C+": 4, "D": 4 });
  assert.equal(Object.values(tiers).reduce((a, b) => a + b, 0), 31);
  assert.deepEqual(Logic.countBy(H, "role", Logic.ROLES), { "공격": 19, "방어": 11, "버프": 1 });
  assert.deepEqual(Logic.avgTierByClass(H), { "보병": 4.15, "전차": 4.67, "헬기": 4.89 });
  assert.deepEqual(Logic.avgTierByClass([]), { "보병": 0, "전차": 0, "헬기": 0 });
});

test("상세 패널의 '같은 병종·같은 티어' 목록", () => {
  const amy = H.find((h) => h.name === "Amy");
  assert.deepEqual(names(Logic.related(H, amy)), ["Brock"]);
  const rasim = H.find((h) => h.name === "Rasim");
  assert.deepEqual(names(Logic.related(H, rasim)), []);
});
