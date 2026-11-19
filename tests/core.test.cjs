const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../src/core.cjs");

function sampleRecords() {
  const folder = path.join(__dirname, "..", "FlowNote-Vault", core.FOLDERS.inbox);
  return fs.readdirSync(folder).map(name => {
    const { yaml, body } = core.frontmatter(fs.readFileSync(path.join(folder, name), "utf8"));
    const properties = Object.fromEntries(yaml.trim().split("\n").map(line => {
      const propertyEnd = line.indexOf(":");
      return [line.slice(0, propertyEnd), JSON.parse(line.slice(propertyEnd + 1))];
    }));
    return { ...properties, body, path: core.FOLDERS.inbox + "/" + name };
  });
}

test("整理属性保留正文、BOM、CRLF 和既有属性", () => {
  const original = '\uFEFF---\r\n{"kind":"flow-note","other":true}\r\n---\r\n\r\n  原话\r\n---\r\n下一行\r\n';
  const updated = core.withFrontmatter(original, { title: "新标题" }, JSON.parse, data => JSON.stringify(data, null, 2));
  assert.equal(core.frontmatter(updated).body, core.frontmatter(original).body);
  assert.equal(core.frontmatter(updated).eol, "\r\n");
  assert.equal(core.frontmatter(updated).bom, "\uFEFF");
  assert.deepEqual(JSON.parse(core.frontmatter(updated).yaml), { kind: "flow-note", other: true, title: "新标题" });
});

test("保护损坏的属性区", () => {
  assert.throws(() => core.withFrontmatter("---\nkind: flow-note\n", {}, JSON.parse, JSON.stringify), /结束标记/);
});

test("标签去重并接受 Obsidian 的嵌套标签", () => {
  assert.deepEqual(core.cleanTags("#读书，读书,实验/数据,123,lab,\u2603"), ["读书", "实验/数据", "lab"]);
});

test("示例 Dream 能找回两个主题下有关系的记录", () => {
  const notes = sampleRecords();
  const matches = core.selectSources(notes, "怎样从失败样本完善评价指标");
  assert.ok(matches.some(note => note.topic === "实验设计"));
  assert.ok(matches.some(note => note.topic === "观点复盘"));
  assert.ok(!matches.some(note => note.title === "吉他练习"));
  assert.deepEqual(core.selectSources(notes, "量子退火"), []);
});

test("只接收候选笔记中可核查的逐字引句", () => {
  const matches = core.selectSources(sampleRecords(), "失败样本");
  const evidence = core.evidenceForModel(matches);
  const quote = evidence[0].excerpt.slice(0, 14);
  const findings = core.validateDream({ findings: [{ insight: "一个看法", evidence: [
    { id: "1", quote }, { id: "9", quote }, { id: "2", quote: "并不存在的错误引文" }
  ] }, { insight: "另一个看法", evidence: [{ id: "1", quote: "编造的内容无法通过" }] }] }, evidence);
  assert.deepEqual(findings, [{ insight: "一个看法", citations: [{ id: "1", quote }] }]);
  assert.ok(core.dream("失败样本", matches, findings).includes(quote));
});

test("回顾链接能从回顾目录解析到实际源文件", () => {
  const notes = sampleRecords().filter(note => note.topic === "实验设计");
  const output = core.wiki("实验设计", notes);
  const rendered = [...output.matchAll(/\]\((\.\.\/[^)]+\.md)\)/gu)].map(match => decodeURIComponent(match[1]));
  assert.equal(rendered.length, notes.length);
  for (const href of rendered) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", "FlowNote-Vault", core.FOLDERS.reports, href)));
  }
  assert.ok(core.wiki("实验设计", notes, { notes: notes.slice(0, 1), findings: [] }).includes("本段综合了 1 条"));
});
