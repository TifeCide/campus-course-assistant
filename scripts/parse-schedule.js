import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const SOURCE_DIR = path.resolve(process.env.SCHEDULE_SOURCE_DIR || PROJECT_ROOT);
const OUTPUT_FILE = path.resolve(PROJECT_ROOT, "public", "data", "schedule-index.json");

const PERIOD_CODES = ["0102", "0304", "0506", "0708", "0910", "1112"];
const WEEKDAYS = [
  { index: 1, label: "星期一", shortLabel: "周一" },
  { index: 2, label: "星期二", shortLabel: "周二" },
  { index: 3, label: "星期三", shortLabel: "周三" },
  { index: 4, label: "星期四", shortLabel: "周四" },
  { index: 5, label: "星期五", shortLabel: "周五" },
  { index: 6, label: "星期六", shortLabel: "周六" },
  { index: 7, label: "星期日", shortLabel: "周日" },
];

const SOURCES = {
  course: /^kbxx_kc_ifr_.*\.html$/i,
  teacher: /^kbxx_teacher_ifr_.*\.html$/i,
  class: /^kbxx_xzb_ifr_.*\.html$/i,
};

function findLatestSource(pattern) {
  const candidates = fs
    .readdirSync(SOURCE_DIR)
    .filter((fileName) => pattern.test(fileName))
    .sort((left, right) => right.localeCompare(left, "en", { numeric: true }));

  return candidates[0] ? path.resolve(SOURCE_DIR, candidates[0]) : null;
}

function decodeEntities(input) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function unwrapSourceViewer(raw) {
  if (!raw.includes('class="line-content"')) return raw;

  const lines = [...raw.matchAll(/<td class="line-content">([\s\S]*?)<\/td>/g)].map((match) => match[1]);
  return decodeEntities(lines.join("\n").replace(/<span[^>]*>|<\/span>/g, ""));
}

function cleanText(input) {
  return decodeEntities(input)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function getMainTable(html) {
  const marker = 'id="kbtable"';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) throw new Error("kbtable not found");

  const tableStart = html.lastIndexOf("<table", markerIndex);
  const tableEnd = html.indexOf("</table>", markerIndex);
  if (tableStart < 0 || tableEnd < 0) throw new Error("kbtable is incomplete");
  return html.slice(tableStart, tableEnd + "</table>".length);
}

function getRows(tableHtml) {
  return [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
}

function getCells(rowHtml) {
  return [...rowHtml.matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
}

function parseWeekText(weekText) {
  const normalized = weekText.replace(/[()（）]/g, "").replace(/\s+/g, "").replace(/周/g, "");
  const weeks = new Set();

  for (const segment of normalized.split(/[，,]/).filter(Boolean)) {
    const range = segment.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Math.min(Number(range[1]), Number(range[2]));
      const end = Math.max(Number(range[1]), Number(range[2]));
      for (let week = start; week <= end; week += 1) weeks.add(week);
    } else if (/^\d+$/.test(segment)) {
      weeks.add(Number(segment));
    }
  }

  const values = [...weeks].sort((left, right) => left - right);
  const allOdd = values.length > 0 && values.every((week) => week % 2 === 1);
  const allEven = values.length > 0 && values.every((week) => week % 2 === 0);

  return {
    weeks: values,
    startWeek: values[0] ?? null,
    endWeek: values.at(-1) ?? null,
    weekType: allOdd ? "odd" : allEven ? "even" : values.length ? "mixed" : "unknown",
  };
}

function parseBlock(block, kind, rowName) {
  const lines = cleanText(block).split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  const weekIndex = lines.findIndex((line) => /[（(].*周[)）]/.test(line));
  if (weekIndex < 0 || weekIndex === lines.length - 1) return null;

  const roomName = lines.at(-1) || "";
  const weekText = lines[weekIndex];
  const payload = lines.slice(0, weekIndex);
  const week = parseWeekText(weekText);

  const entry = {
    courseName: "",
    teacher: "",
    classGroup: "",
    roomName,
    weekText,
    weeks: week.weeks,
  };

  if (kind === "course") {
    entry.courseName = rowName;
    entry.classGroup = payload[0] || "";
    entry.teacher = payload.slice(1).join(" / ");
  } else if (kind === "teacher") {
    entry.teacher = rowName;
    entry.courseName = payload[0] || "";
    entry.classGroup = payload.slice(1).join(" / ");
  } else {
    entry.classGroup = rowName;
    entry.courseName = payload[0] || "";
    entry.teacher = payload.slice(1).join(" / ");
  }

  if (!entry.courseName || !entry.roomName) return null;
  return entry;
}

function parseSource(filePath, kind) {
  const html = unwrapSourceViewer(fs.readFileSync(filePath, "utf8"));
  const table = getMainTable(html);
  const rows = getRows(table);
  const entries = [];
  const entityNames = new Set();

  rows.slice(2).forEach((rowHtml) => {
    const cells = getCells(rowHtml);
    const rowName = cleanText(cells[0] || "");
    if (!rowName) return;
    entityNames.add(rowName);

    cells.slice(1, 43).forEach((cellHtml, cellIndex) => {
      const weekday = WEEKDAYS[Math.floor(cellIndex / PERIOD_CODES.length)];
      const periodCode = PERIOD_CODES[cellIndex % PERIOD_CODES.length];
      const blocks = [...cellHtml.matchAll(/<div[^>]*class=["'][^"']*kbcontent1[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)];

      for (const match of blocks) {
        const entry = parseBlock(match[1], kind, rowName);
        if (!entry) continue;
        entries.push({
          ...entry,
          weekday: weekday.index,
          weekdayLabel: weekday.label,
          periodCode,
        });
      }
    });
  });

  return {
    fileName: path.basename(filePath),
    entityNames: [...entityNames].sort((left, right) => left.localeCompare(right, "zh-Hans-u-co-pinyin")),
    entries,
  };
}

function entryKey(entry) {
  return [
    entry.courseName,
    entry.teacher,
    entry.classGroup,
    entry.roomName,
    entry.weekText,
    entry.weekday,
    entry.periodCode,
  ].join("\u001f");
}

function main() {
  const parsed = Object.entries(SOURCES).map(([kind, pattern]) => {
    const filePath = findLatestSource(pattern);
    if (!filePath) throw new Error(`No schedule source found for ${kind}.`);
    return [kind, parseSource(filePath, kind)];
  });

  const sourceData = Object.fromEntries(parsed);
  const entryMap = new Map();
  for (const [, source] of parsed) {
    for (const entry of source.entries) entryMap.set(entryKey(entry), entry);
  }

  const entries = [...entryMap.values()].sort((left, right) => {
    return left.weekday - right.weekday
      || PERIOD_CODES.indexOf(left.periodCode) - PERIOD_CODES.indexOf(right.periodCode)
      || left.courseName.localeCompare(right.courseName, "zh-Hans-u-co-pinyin");
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceFiles: Object.fromEntries(parsed.map(([kind, source]) => [kind, source.fileName])),
    weekdays: WEEKDAYS,
    periodCodes: PERIOD_CODES,
    summary: {
      totalEntries: sourceData.class.entries.length,
      courses: sourceData.course.entityNames.length,
      teachers: sourceData.teacher.entityNames.length,
      classes: sourceData.class.entityNames.length,
      courseEntries: sourceData.course.entries.length,
      teacherEntries: sourceData.teacher.entries.length,
    },
    courses: sourceData.course.entityNames,
    teachers: sourceData.teacher.entityNames,
    classes: sourceData.class.entityNames,
    entries: sourceData.class.entries,
    courseEntries: sourceData.course.entries,
    teacherEntries: sourceData.teacher.entries,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload), "utf8");
  console.log(`Parsed ${payload.summary.totalEntries} canonical schedule entries.`);
  console.log(`Courses: ${payload.summary.courses}; teachers: ${payload.summary.teachers}; classes: ${payload.summary.classes}.`);
  console.log(`Output written to ${OUTPUT_FILE}`);
}

main();
