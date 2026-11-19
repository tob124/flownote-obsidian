const FOLDERS = { inbox: "收件箱", topics: "主题", reports: "回顾" };
const SOURCE_LIMIT = 8;
const EXCERPT_LIMIT = 700;
const MARKDOWN_PUNCTUATION = /[\\\x60*_{}\[\]()#+\-.!|<>$~]/g;

function oneLine(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function excerpt(value, limit) {
  const chars = Array.from(oneLine(value));
  return chars.length <= limit ? chars.join("") : chars.slice(0, limit).join("");
}

function text(value) {
  return oneLine(value).replaceAll("&", "&amp;").replace(MARKDOWN_PUNCTUATION, "\\$&");
}

function noteLink(path) {
  // Encode reserved characters without relying on vault-wide unique basenames.
  const target = path.split("/").map(part => encodeURIComponent(part)
    .replace(/[!'()*]/g, char => "%" + char.charCodeAt(0).toString(16))).join("/");
  const label = path.split("/").at(-1).replace(/\.md$/i, "");
  return "[" + text(label) + "](../" + target + ")";
}

function frontmatter(raw) {
  const match = raw.match(/^(\uFEFF)?---([^\S\r\n]*\r?\n)([\s\S]*?)^---[^\S\r\n]*(?:\r?\n|$)/mu);
  if (match?.index === 0) {
    return { yaml: match[3], body: raw.slice(match[0].length), bom: match[1] ?? "", eol: match[2].endsWith("\r\n") ? "\r\n" : "\n" };
  }
  return { yaml: null, body: raw.replace(/^\uFEFF/u, ""), bom: raw.startsWith("\uFEFF") ? "\uFEFF" : "", eol: raw.includes("\r\n") ? "\r\n" : "\n" };
}

function withFrontmatter(raw, fields, parseYaml, stringifyYaml) {
  const { yaml, body, bom, eol } = frontmatter(raw);
  if (yaml === null && /^---[ \t]*\r?\n/u.test(body)) {
    throw new Error("笔记属性区缺少结束标记，请先修正。");
  }
  const previous = yaml === null ? {} : (parseYaml(yaml) ?? {});
  if (typeof previous !== "object" || Array.isArray(previous)) {
    throw new Error("笔记属性区必须是 YAML 属性表。");
  }
  const updated = stringifyYaml({ ...previous, ...fields }).trimEnd().replace(/\r?\n/g, eol);
  return bom + "---" + eol + updated + eol + "---" + eol + body;
}

function cleanTags(value) {
  const entries = Array.isArray(value) ? value : String(value ?? "").split(/[,，\s]+/u);
  return [...new Set(entries.filter(entry => typeof entry === "string")
    .map(entry => entry.trim().replace(/^#/u, ""))
    .filter(entry => /^[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u.test(entry) && /[^0-9/]/u.test(entry) && entry.length <= 64))];
}

function tokens(value) {
  const result = new Set();
  for (const word of value.normalize("NFKC").toLowerCase().match(/\p{Script=Han}+|[a-z0-9]+/gu) ?? []) {
    if (!/^\p{Script=Han}/u.test(word)) {
      if (word.length >= 2) result.add(word);
      continue;
    }
    const chars = Array.from(word);
    if (chars.length === 1) result.add(word);
    for (let i = 0; i < chars.length - 1; i++) result.add(chars[i] + chars[i + 1]);
  }
  return result;
}

function selectSources(notes, question, limit = SOURCE_LIMIT) {
  const query = tokens(question);
  if (query.size === 0) return [];
  const ranked = notes.map(note => {
    const labels = tokens([note.title, note.topic, ...(note.tags ?? [])].join(" "));
    const body = tokens(note.body);
    const score = [...query].reduce((total, term) => total + (labels.has(term) ? 2 : 0) + (body.has(term) ? 1 : 0), 0);
    return { ...note, score };
  });
  return ranked.filter(note => note.score > 0)
    .sort((a, b) => b.score - a.score || b.created.localeCompare(a.created) || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function wiki(topic, notes, synthesis = null) {
  const ordered = [...notes].sort((a, b) => b.created.localeCompare(a.created));
  return [
    "# 主题 Wiki · " + text(topic), "",
    "共 " + ordered.length + " 条原始记录，按时间倒序。", "",
    ...(synthesis ? [
      "## AI 综合草稿", "",
      "本段综合了 " + synthesis.notes.length + " 条最近记录。引句经核对，归纳可由你修订。", "",
      ...findingLines(synthesis.notes, synthesis.findings),
      "## 按时间浏览记录", ""
    ] : []),
    ...ordered.flatMap(note => [
      "## " + text(note.title), "",
      noteLink(note.path) + (note.created ? " · " + text(note.created.slice(0, 10)) : ""), "",
      (note.summary ? "**整理摘要** " + text(note.summary) : "**原文摘录** " + text(excerpt(note.body, 200))), ""
    ])
  ].join("\n");
}

function evidenceForModel(notes) {
  return notes.map((note, index) => ({
    id: String(index + 1), topic: note.topic, title: note.title, date: note.created,
    excerpt: excerpt(note.body, EXCERPT_LIMIT)
  }));
}

function validateDream(result, evidence) {
  if (!result || !Array.isArray(result.findings)) {
    throw new Error("DeepSeek 返回的回顾格式无效。");
  }
  const allowed = new Map(evidence.map(item => [item.id, item.excerpt]));
  const findings = [];
  for (const item of result.findings.slice(0, 5)) {
    if (!item || typeof item.insight !== "string" || !Array.isArray(item.evidence)) continue;
    const insight = excerpt(item.insight, 420);
    const citations = item.evidence.slice(0, 4).flatMap(reference => {
      if (!reference || typeof reference.quote !== "string") return [];
      const id = String(reference.id);
      const quote = oneLine(reference.quote);
      return quote.length >= 6 && allowed.get(id)?.includes(quote) ? [{ id, quote }] : [];
    });
    if (insight && citations.length) findings.push({ insight, citations });
  }
  return findings;
}

function findingLines(notes, findings) {
  if (!findings.length) return ["没有通过原文引句校验的发现。", ""];
  return findings.flatMap(item => [
    "### " + text(item.insight), "",
    ...item.citations.flatMap(({ id, quote }) => [
      "> " + text(quote), "", noteLink(notes[Number(id) - 1].path), ""
    ])
  ]);
}

function dream(question, notes, findings = null) {
  const lines = ["# Dream · " + text(question), ""];
  if (findings === null) {
    lines.push("离线回顾，使用词项匹配选出候选旧笔记。", "");
  } else {
    lines.push("AI 回顾。引文已核对所读片段，联系和判断需要你确认。", "", "## 发现与依据", "");
    lines.push(...findingLines(notes, findings));
  }
  lines.push("## 候选旧记录", "");
  for (const note of notes) {
    lines.push("- " + noteLink(note.path) + (note.topic ? " · " + text(note.topic) : ""), "  > " + text(excerpt(note.body, 240)), "");
  }
  return lines.join("\n");
}

module.exports = { FOLDERS, SOURCE_LIMIT, cleanTags, dream, evidenceForModel, excerpt, frontmatter, oneLine, selectSources, validateDream, wiki, withFrontmatter };
