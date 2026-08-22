import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const SOURCE_DIR = path.resolve(process.env.SCHEDULE_SOURCE_DIR || PROJECT_ROOT);
const DATA_DIR = path.resolve(PROJECT_ROOT, "public", "data");
const OUTPUT_DIR = path.resolve(DATA_DIR, "v2");
const NORMALIZATION_FILE = path.resolve(SCRIPT_DIR, "class-normalization.json");

const SOURCE_BITS = {
  room: 1,
  course: 2,
  teacher: 4,
  class: 8,
};

function printUsage() {
  console.log("Usage:");
  console.log("  npm run build-data");
  console.log("  npm run build-data -- kbxx_classroom_ifr_2026-2027-1.html");
}

const cliArg = process.argv[2];
if (cliArg === "--help" || cliArg === "-h") {
  printUsage();
  process.exit(0);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required data file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getRows(tableHtml) {
  return [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
}

function getCells(rowHtml) {
  return [...rowHtml.matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
}

function findLatestClassroomSource() {
  const candidates = fs
    .readdirSync(SOURCE_DIR)
    .filter((fileName) => /^kbxx_classroom_ifr_.*\.html$/i.test(fileName))
    .sort((left, right) => right.localeCompare(left, "en", { numeric: true }));

  if (!candidates.length) {
    throw new Error(`No kbxx_classroom_ifr_*.html file found in ${SOURCE_DIR}.`);
  }

  return path.resolve(SOURCE_DIR, candidates[0]);
}

function unwrapClassroomSourceViewer(raw) {
  if (!raw.includes('class="line-wrap"')) {
    return raw;
  }
  const lines = [];
  const lineRe = /<td class="line-content">([\s\S]*?)<\/td>/g;
  let m;
  while ((m = lineRe.exec(raw)) !== null) {
    lines.push(m[1]);
  }
  const joined = lines.join("\n");
  const stripped = joined.replace(/<span[^>]*>|<\/span>/g, "");
  return stripped
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)));
}

const TIME_SLOT_MAP = {
  "0102": { start: "08:00", end: "09:40", auto: true },
  "0304": { start: "10:00", end: "11:40", auto: true },
  "0506": { start: "14:30", end: "16:10", auto: true },
  "0708": { start: "16:20", end: "18:00", auto: true },
  "0910": { start: "18:40", end: "20:20", auto: true },
  "1112": { start: "20:30", end: "22:10", auto: true }
};

const WEEKDAY_SHORT_LABELS = {
  "星期一": "周一",
  "星期二": "周二",
  "星期三": "周三",
  "星期四": "周四",
  "星期五": "周五",
  "星期六": "周六",
  "星期日": "周日"
};

function decodeHtml(input) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripTags(input) {
  return decodeHtml(input).replace(/<[^>]+>/g, " ");
}

function cleanClassroomText(input) {
  return stripTags(input)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function parseClassroomWeekText(weekText) {
  const normalized = weekText
    .replace(/[()（）]/g, "")
    .replace(/\s+/g, "")
    .replace(/周/g, "")
    .trim();

  if (!normalized) {
    return {
      weeks: [],
      startWeek: null,
      endWeek: null,
      weekType: "unknown",
      weekTypeLabel: "未知",
      weekRule: ""
    };
  }

  const segments = normalized.split(/[，,]/).map((segment) => segment.trim()).filter(Boolean);
  const weekSet = new Set();

  for (const segment of segments) {
    const rangeMatch = segment.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      const low = Math.min(start, end);
      const high = Math.max(start, end);
      for (let week = low; week <= high; week += 1) {
        weekSet.add(week);
      }
      continue;
    }

    if (/^\d+$/.test(segment)) {
      weekSet.add(Number(segment));
    }
  }

  const weeks = [...weekSet].sort((a, b) => a - b);
  const startWeek = weeks.length ? weeks[0] : null;
  const endWeek = weeks.length ? weeks[weeks.length - 1] : null;
  const allOdd = weeks.length > 0 && weeks.every((week) => week % 2 === 1);
  const allEven = weeks.length > 0 && weeks.every((week) => week % 2 === 0);
  const continuous = weeks.length > 0 && weeks.every((week, index) => index === 0 || week === weeks[index - 1] + 1);

  let weekType = "mixed";
  let weekTypeLabel = "混合周";

  if (!weeks.length) {
    weekType = "unknown";
    weekTypeLabel = "未知";
  } else if (allOdd) {
    weekType = "odd";
    weekTypeLabel = "单周";
  } else if (allEven) {
    weekType = "even";
    weekTypeLabel = "双周";
  } else if (continuous) {
    weekType = "all";
    weekTypeLabel = "全周";
  }

  return {
    weeks,
    startWeek,
    endWeek,
    weekType,
    weekTypeLabel,
    weekRule: normalized
  };
}

function getCellEntries(cellHtml) {
  const blocks = [...cellHtml.matchAll(/<div[^>]*class=["'][^"']*kbcontent1[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)]
    .map((match) => match[1]);

  if (!blocks.length) {
    return [];
  }

  return blocks
    .map((block) => {
      const lines = cleanClassroomText(block)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (!lines.length) {
        return null;
      }

      const weekLineIndex = lines.findIndex((line) => /[（(].*周[)）]/.test(line));
      const courseName = lines[0] || "";
      const teacher = weekLineIndex > 1 ? lines.slice(1, weekLineIndex).join(" / ") : (lines[1] || "");
      const weekText = weekLineIndex >= 0 ? lines[weekLineIndex] : "";
      const classGroup = weekLineIndex >= 0 ? lines.slice(weekLineIndex + 1).join(" / ") : lines.slice(2).join(" / ");
      const weekInfo = parseClassroomWeekText(weekText);

      return {
        courseName,
        teacher,
        classGroup,
        weekText: weekText || "",
        weeks: weekInfo.weeks,
        startWeek: weekInfo.startWeek,
        endWeek: weekInfo.endWeek,
        weekType: weekInfo.weekType,
        weekTypeLabel: weekInfo.weekTypeLabel,
        weekRule: weekInfo.weekRule
      };
    })
    .filter(Boolean);
}

function getFloorAndRoomParts(rawPart) {
  const normalized = String(rawPart || "").trim();
  const match = normalized.match(/(\d)(.*)/);

  if (!match) {
    return {
      floor: "未知",
      roomNumber: normalized || "未标注"
    };
  }

  return {
    floor: match[1],
    roomNumber: match[2] ? match[2] : match[1]
  };
}

function classifyRoom(name) {
  const hdMatch = name.match(/^厚德楼([AB])([0-9A-Za-z-]+)$/);
  if (hdMatch) {
    const parts = getFloorAndRoomParts(hdMatch[2]);
    return {
      zone: "厚德楼教学区",
      building: `厚德楼${hdMatch[1]}`,
      buildingCode: hdMatch[1],
      floor: parts.floor,
      roomNumber: parts.roomNumber
    };
  }

  const normalMatch = name.match(/^([1-4])-(.+)$/);
  if (normalMatch) {
    const parts = getFloorAndRoomParts(normalMatch[2]);
    return {
      zone: normalMatch[1] === "1" ? "普通教学区（1号楼）" : "普通教学区（2、3、4号楼）",
      building: `${normalMatch[1]}号楼`,
      buildingCode: normalMatch[1],
      floor: parts.floor,
      roomNumber: parts.roomNumber
    };
  }

  const labMatch = name.match(/^实验楼([AB])-?(.+)$/);
  if (labMatch) {
    const parts = getFloorAndRoomParts(labMatch[2]);
    return {
      zone: "实验楼教学区",
      building: `实验楼${labMatch[1]}`,
      buildingCode: labMatch[1],
      floor: parts.floor,
      roomNumber: parts.roomNumber
    };
  }

  const secondLabMatch = name.match(/^(第二实验楼|第二实验)(.+)$/);
  if (secondLabMatch) {
    const parts = getFloorAndRoomParts(secondLabMatch[2]);
    return {
      zone: "第二实验楼",
      building: "第二实验楼",
      buildingCode: "第二实验楼",
      floor: parts.floor,
      roomNumber: parts.roomNumber
    };
  }

  const namedBuildingMatch = name.match(/^(.+?(楼|馆))(.*)$/);
  if (namedBuildingMatch) {
    const tail = namedBuildingMatch[3].trim();
    const parts = getFloorAndRoomParts(tail);
    return {
      zone: namedBuildingMatch[1],
      building: namedBuildingMatch[1],
      buildingCode: namedBuildingMatch[1],
      floor: tail ? parts.floor : "未知",
      roomNumber: tail ? parts.roomNumber : "未标注"
    };
  }

  const hyphenMatch = name.match(/^([^-]+)-(.+)$/);
  if (hyphenMatch) {
    return {
      zone: hyphenMatch[1],
      building: hyphenMatch[1],
      buildingCode: hyphenMatch[1],
      floor: "未知",
      roomNumber: hyphenMatch[2]
    };
  }

  const alphaNumericMatch = name.match(/^([A-Za-z]+)(\d.*)$/);
  if (alphaNumericMatch) {
    const parts = getFloorAndRoomParts(alphaNumericMatch[2]);
    return {
      zone: alphaNumericMatch[1],
      building: alphaNumericMatch[1],
      buildingCode: alphaNumericMatch[1],
      floor: parts.floor,
      roomNumber: parts.roomNumber
    };
  }

  return {
    zone: name,
    building: name,
    buildingCode: name,
    floor: "未知",
    roomNumber: "未标注"
  };
}

function compareRoomNames(left, right) {
  return left.localeCompare(right, "zh-Hans-CN-u-co-pinyin-nu-latn", { numeric: true });
}

function parseClassroomSource(sourceFile) {
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Source HTML not found: ${sourceFile}`);
  }

  const raw = fs.readFileSync(sourceFile, "utf8");
  const html = unwrapClassroomSourceViewer(raw);
  const tableMatch = html.match(/<table[^>]*id=["']kbtable["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    throw new Error("Could not find #kbtable in source HTML.");
  }

  const rows = getRows(tableMatch[0]);
  if (rows.length < 3) {
    throw new Error("Unexpected table structure: not enough rows.");
  }

  const weekdayLabels = getCells(rows[0]).slice(1).map((cell) => cleanClassroomText(cell)).filter(Boolean);
  const periodHeaderCells = getCells(rows[1]).slice(1).map((cell) => cleanClassroomText(cell)).filter(Boolean);
  const periodsPerDay = weekdayLabels.length ? Math.floor(periodHeaderCells.length / weekdayLabels.length) : 0;
  const periodCodes = periodHeaderCells.slice(0, periodsPerDay);
  const timeSlots = periodCodes.map((code) => ({
    code,
    label: code,
    start: TIME_SLOT_MAP[code] ? TIME_SLOT_MAP[code].start : null,
    end: TIME_SLOT_MAP[code] ? TIME_SLOT_MAP[code].end : null,
    auto: Boolean(TIME_SLOT_MAP[code] && TIME_SLOT_MAP[code].auto)
  }));

  const weekdayMeta = weekdayLabels.map((label, index) => ({
    index: index + 1,
    label,
    shortLabel: WEEKDAY_SHORT_LABELS[label] || label
  }));

  const rooms = [];
  let totalEntries = 0;
  let maxWeek = 0;

  for (const rowHtml of rows.slice(2)) {
    const cells = getCells(rowHtml);
    if (!cells.length) {
      continue;
    }

    const roomName = cleanClassroomText(cells[0]);
    if (!roomName) {
      continue;
    }

    const classification = classifyRoom(roomName);
    const slots = {};
    const flatEntries = [];

    for (const weekday of weekdayMeta) {
      slots[String(weekday.index)] = {};
      for (const periodCode of periodCodes) {
        slots[String(weekday.index)][periodCode] = [];
      }
    }

    for (let cellIndex = 0; cellIndex < weekdayMeta.length * periodCodes.length; cellIndex += 1) {
      const cellHtml = cells[cellIndex + 1] || "";
      const weekdayIndex = Math.floor(cellIndex / periodCodes.length);
      const periodIndex = cellIndex % periodCodes.length;
      const weekday = weekdayMeta[weekdayIndex];
      const periodCode = periodCodes[periodIndex];
      const entries = getCellEntries(cellHtml).map((entry) => ({
        ...entry,
        weekday: weekday.index,
        weekdayLabel: weekday.label,
        periodCode
      }));

      if (!entries.length) {
        continue;
      }

      totalEntries += entries.length;
      for (const entry of entries) {
        if (entry.endWeek && entry.endWeek > maxWeek) {
          maxWeek = entry.endWeek;
        }
      }

      slots[String(weekday.index)][periodCode] = entries;
      flatEntries.push(...entries);
    }

    rooms.push({
      name: roomName,
      zone: classification.zone,
      building: classification.building,
      buildingCode: classification.buildingCode,
      floor: classification.floor,
      roomNumber: classification.roomNumber,
      slots,
      entries: flatEntries,
      entryCount: flatEntries.length
    });
  }

  rooms.sort((left, right) => compareRoomNames(left.name, right.name));

  const zoneSet = new Set();
  const floorSet = new Set();

  for (const room of rooms) {
    zoneSet.add(room.zone);
    floorSet.add(room.floor);
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(sourceFile),
    weekdays: weekdayMeta,
    timeSlots,
    summary: {
      totalRooms: rooms.length,
      totalEntries,
      maxWeek,
      totalZones: zoneSet.size,
      totalFloors: floorSet.size
    },
    rooms
  };
}

const SCHEDULE_PERIOD_CODES = ["0102", "0304", "0506", "0708", "0910", "1112"];

const SCHEDULE_WEEKDAYS = [
  { index: 1, label: "星期一", shortLabel: "周一" },
  { index: 2, label: "星期二", shortLabel: "周二" },
  { index: 3, label: "星期三", shortLabel: "周三" },
  { index: 4, label: "星期四", shortLabel: "周四" },
  { index: 5, label: "星期五", shortLabel: "周五" },
  { index: 6, label: "星期六", shortLabel: "周六" },
  { index: 7, label: "星期日", shortLabel: "周日" },
];

const SCHEDULE_SOURCES = {
  course: /^kbxx_kc_ifr_.*\.html$/i,
  teacher: /^kbxx_teacher_ifr_.*\.html$/i,
  class: /^kbxx_xzb_ifr_.*\.html$/i,
};

function findLatestScheduleSource(pattern) {
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

function unwrapScheduleSourceViewer(raw) {
  if (!raw.includes('class="line-content"')) return raw;

  const lines = [...raw.matchAll(/<td class="line-content">([\s\S]*?)<\/td>/g)].map((match) => match[1]);
  return decodeEntities(lines.join("\n").replace(/<span[^>]*>|<\/span>/g, ""));
}

function cleanScheduleText(input) {
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

function parseScheduleWeekText(weekText) {
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
  const lines = cleanScheduleText(block).split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  const weekIndex = lines.findIndex((line) => /[（(].*周[)）]/.test(line));
  if (weekIndex < 0 || weekIndex === lines.length - 1) return null;

  const roomName = lines.at(-1) || "";
  const weekText = lines[weekIndex];
  const payload = lines.slice(0, weekIndex);
  const week = parseScheduleWeekText(weekText);

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

function parseScheduleSource(filePath, kind) {
  const html = unwrapScheduleSourceViewer(fs.readFileSync(filePath, "utf8"));
  const table = getMainTable(html);
  const rows = getRows(table);
  const entries = [];
  const entityNames = new Set();

  rows.slice(2).forEach((rowHtml) => {
    const cells = getCells(rowHtml);
    const rowName = cleanScheduleText(cells[0] || "");
    if (!rowName) return;
    entityNames.add(rowName);

    cells.slice(1, 43).forEach((cellHtml, cellIndex) => {
      const weekday = SCHEDULE_WEEKDAYS[Math.floor(cellIndex / SCHEDULE_PERIOD_CODES.length)];
      const periodCode = SCHEDULE_PERIOD_CODES[cellIndex % SCHEDULE_PERIOD_CODES.length];
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

function parseScheduleSources() {
  const parsed = Object.entries(SCHEDULE_SOURCES).map(([kind, pattern]) => {
    const filePath = findLatestScheduleSource(pattern);
    if (!filePath) throw new Error(`No schedule source found for ${kind}.`);
    return [kind, parseScheduleSource(filePath, kind)];
  });

  const sourceData = Object.fromEntries(parsed);

  return {
    sourceFiles: Object.fromEntries(parsed.map(([kind, source]) => [kind, source.fileName])),
    courses: sourceData.course.entityNames,
    teachers: sourceData.teacher.entityNames,
    classes: sourceData.class.entityNames,
    entries: sourceData.class.entries,
    courseEntries: sourceData.course.entries,
    teacherEntries: sourceData.teacher.entries,
  };
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function compareLabels(left, right) {
  return left.localeCompare(right, "zh-Hans-u-co-pinyin", { numeric: true });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sortNumeric(values) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function toWeekMask(weeks) {
  return unique((weeks ?? []).map(Number).filter((week) => Number.isInteger(week) && week > 0 && week <= 30))
    .reduce((mask, week) => mask | (1 << (week - 1)), 0);
}

function getSha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeDataFile(fileName, payload) {
  const content = JSON.stringify(payload);
  const filePath = path.resolve(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, content, "utf8");
  return {
    path: `data/v2/${fileName}`,
    bytes: Buffer.byteLength(content),
    sha256: getSha256(content),
  };
}

function loadNormalizationConfig() {
  if (!fs.existsSync(NORMALIZATION_FILE)) {
    return { aliases: {}, splits: {} };
  }

  const value = readJson(NORMALIZATION_FILE);
  return {
    aliases: value?.aliases && typeof value.aliases === "object" ? value.aliases : {},
    splits: value?.splits && typeof value.splits === "object" ? value.splits : {},
  };
}

function getClassKey(value) {
  return normalizeText(value).replace(/\s+/g, "").replace(/班$/, "");
}

function splitDelimited(value) {
  return unique(
    normalizeText(value)
      .replace(/(?:\.{2,}|…+)/g, ",")
      .replace(/\s+\/\s+/g, ",")
      .split(/[、,，;；\n]+/)
      .map(normalizeText),
  );
}

function createClassResolver(knownClasses, config, validation) {
  const knownByKey = new Map();

  for (const className of knownClasses) {
    const key = getClassKey(className);
    if (key && !knownByKey.has(key)) knownByKey.set(key, className);
  }

  const resolve = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) return "";
    const alias = config.aliases[normalized] ?? config.aliases[getClassKey(normalized)];
    if (alias) return getClassKey(alias);
    return getClassKey(knownByKey.get(getClassKey(normalized)) ?? normalized);
  };

  function splitClassGroup(value) {
    const normalized = normalizeText(value);
    if (!normalized) return [];
    const override = config.splits[normalized] ?? config.splits[getClassKey(normalized)];
    if (Array.isArray(override) && override.length) {
      return unique(override.map(resolve));
    }

    return splitDelimited(normalized).map(resolve);
  }

  return { resolve, splitClassGroup };
}

function createRegistry(values) {
  const labels = unique(values.map(normalizeText)).sort(compareLabels);
  const byLabel = new Map(labels.map((label, index) => [label, index]));
  return {
    labels,
    idOf(value) {
      const label = normalizeText(value);
      const id = byLabel.get(label);
      if (id === undefined) throw new Error(`Dictionary label is missing: ${label}`);
      return id;
    },
  };
}

function createClassSearchTokens(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .match(/[\u3400-\u9fff]|\d+|[a-z]/gu) ?? [];
}

function createSearchTerms(label, kind) {
  const normalized = normalizeText(label).toLowerCase().replace(/\s+/g, "");
  const base = kind === "teachers"
    ? normalized.replace(/(?:老师|教授)$/u, "")
    : normalized;
  const values = new Set([normalized, base]);

  for (const value of values) {
    for (let index = 0; index < value.length; index += 1) {
      values.add(value.slice(index, index + 1));
      if (index < value.length - 1) values.add(value.slice(index, index + 2));
    }
  }
  if (kind === "classes") {
    createClassSearchTokens(base).forEach((term) => values.add(term));
  }

  return [...values].filter(Boolean);
}

function createDirectoryIndex(labels, eventIdsByEntity, kind, aliases = {}) {
  const terms = new Map();
  const entities = [];

  labels.forEach((label, id) => {
    const eventIds = sortNumeric(eventIdsByEntity[id] ?? []);
    entities.push([id, eventIds]);
    for (const term of createSearchTerms(label, kind)) {
      if (!terms.has(term)) terms.set(term, []);
      terms.get(term).push(id);
    }
  });

  for (const [alias, target] of Object.entries(aliases)) {
    const id = labels.indexOf(normalizeText(target));
    if (id < 0) continue;
    for (const term of createSearchTerms(alias, kind)) {
      if (!terms.has(term)) terms.set(term, []);
      terms.get(term).push(id);
    }
  }

  return {
    entities,
    terms: Object.fromEntries(
      [...terms.entries()]
        .sort(([left], [right]) => compareLabels(left, right))
        .map(([term, ids]) => [term, sortNumeric(ids)]),
    ),
  };
}

function buildV2Data(classroomData, scheduleData) {
  const normalization = loadNormalizationConfig();
  const validation = {
    invalidRecords: { count: 0, samples: [] },
    unknownRooms: { count: 0, samples: [] },
    ambiguousClassGroups: { count: 0, samples: [] },
  };

  const knownClasses = unique(scheduleData.classes ?? []);
  const classResolver = createClassResolver(knownClasses, normalization, validation);
  const periodIndexByCode = new Map((classroomData.timeSlots ?? []).map((slot, index) => [slot.code, index]));
  const roomRows = [...(classroomData.rooms ?? [])].sort((left, right) => compareLabels(left.name, right.name));
  const roomIdByName = new Map(roomRows.map((room, index) => [room.name, index]));
  const rawRecords = [];

  function addRecord(entry, source, roomNameOverride = "") {
    const roomName = normalizeText(roomNameOverride || entry.roomName);
    const courseName = normalizeText(entry.courseName);
    const period = periodIndexByCode.get(entry.periodCode);
    const weekday = Number(entry.weekday) - 1;
    const weekMask = toWeekMask(entry.weeks);

    if (!roomName || !courseName || !Number.isInteger(period) || weekday < 0 || !weekMask) {
      validation.invalidRecords.count += 1;
      if (validation.invalidRecords.samples.length < 20) {
        validation.invalidRecords.samples.push({
          source,
          roomName,
          courseName,
          weekday: entry.weekday,
          periodCode: entry.periodCode,
          weeks: entry.weeks ?? [],
        });
      }
      return;
    }

    const classGroup = normalizeText(entry.classGroup);
    rawRecords.push({
      source,
      roomName,
      courseName,
      teachers: splitDelimited(entry.teacher),
      classes: classResolver.splitClassGroup(classGroup),
      classGroup,
      weekday,
      period,
      weekMask,
    });
  }

  for (const room of roomRows) {
    for (const entry of room.entries ?? []) addRecord(entry, "room", room.name);
  }
  for (const entry of scheduleData.courseEntries ?? []) addRecord(entry, "course");
  for (const entry of scheduleData.teacherEntries ?? []) addRecord(entry, "teacher");
  for (const entry of scheduleData.entries ?? []) addRecord(entry, "class");

  const courses = createRegistry(rawRecords.map((record) => record.courseName));
  const teachers = createRegistry([
    ...(scheduleData.teachers ?? []),
    ...rawRecords.flatMap((record) => record.teachers),
  ]);
  const classes = createRegistry([
    ...knownClasses.flatMap(classResolver.splitClassGroup),
    ...rawRecords.flatMap((record) => record.classes),
  ]);
  const classGroups = createRegistry(rawRecords.map((record) => record.classGroup));
  const zones = createRegistry(roomRows.map((room) => room.zone));
  const buildings = createRegistry(roomRows.map((room) => room.building));
  const floors = createRegistry(roomRows.map((room) => room.floor));

  const rooms = roomRows.map((room, id) => ({
    id,
    name: room.name,
    zone: zones.idOf(room.zone),
    building: buildings.idOf(room.building),
    floor: floors.idOf(room.floor),
    roomNumber: room.roomNumber,
  }));

  const eventsByKey = new Map();
  for (const record of rawRecords) {
    const roomId = roomIdByName.get(record.roomName);
    if (roomId === undefined) {
      validation.unknownRooms.count += 1;
      if (validation.unknownRooms.samples.length < 20) validation.unknownRooms.samples.push(record.roomName);
    }

    const eventKey = [
      record.roomName,
      courses.idOf(record.courseName),
      record.weekday,
      record.period,
      record.weekMask,
    ].join("\u001f");

    if (!eventsByKey.has(eventKey)) {
      eventsByKey.set(eventKey, {
        room: roomId ?? -1,
        course: courses.idOf(record.courseName),
        teachers: new Set(),
        classes: new Set(),
        classGroups: new Set(),
        weekday: record.weekday,
        period: record.period,
        weekMask: record.weekMask,
        sourceMask: 0,
      });
    }

    const event = eventsByKey.get(eventKey);
    record.teachers.forEach((label) => event.teachers.add(teachers.idOf(label)));
    record.classes.forEach((label) => event.classes.add(classes.idOf(label)));
    if (record.classGroup) event.classGroups.add(classGroups.idOf(record.classGroup));
    event.sourceMask |= SOURCE_BITS[record.source];
  }

  const events = [...eventsByKey.values()]
    .sort((left, right) => left.room - right.room
      || left.weekday - right.weekday
      || left.period - right.period
      || left.course - right.course
      || left.weekMask - right.weekMask)
    .map((event) => [
      event.room,
      event.course,
      sortNumeric([...event.teachers]),
      sortNumeric([...event.classes]),
      event.weekday,
      event.period,
      event.weekMask,
      sortNumeric([...event.classGroups]),
      event.sourceMask,
    ]);

  const maxWeek = Number(classroomData.summary?.maxWeek) || 18;
  const weekOccupancy = Array.from(
    { length: maxWeek },
    () => Array.from(
      { length: classroomData.weekdays?.length ?? 7 },
      () => Array.from(
        { length: classroomData.timeSlots?.length ?? 6 },
        () => new Set(),
      ),
    ),
  );

  events.forEach((event) => {
    const [roomId, , , , weekday, period, weekMask, , sourceMask] = event;
    if (roomId < 0 || !(sourceMask & SOURCE_BITS.room)) return;
    for (let week = 1; week <= maxWeek; week += 1) {
      if (weekMask & (1 << (week - 1))) weekOccupancy[week - 1][weekday][period].add(roomId);
    }
  });

  const availability = {
    schemaVersion: 2,
    roomCount: rooms.length,
    weeks: weekOccupancy.map((days) => days.map((periods) => periods.map((roomIds) => sortNumeric([...roomIds])))),
  };

  const eventsByCourse = Array.from({ length: courses.labels.length }, () => []);
  const eventsByTeacher = Array.from({ length: teachers.labels.length }, () => []);
  const eventsByClass = Array.from({ length: classes.labels.length }, () => []);
  events.forEach((event, eventId) => {
    const [, courseId, teacherIds, classIds] = event;
    eventsByCourse[courseId].push(eventId);
    teacherIds.forEach((teacherId) => eventsByTeacher[teacherId].push(eventId));
    classIds.forEach((classId) => eventsByClass[classId].push(eventId));
  });

  const common = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      classroom: classroomData.sourceFile ?? "",
      ...(scheduleData.sourceFiles ?? {}),
    },
    weekdays: classroomData.weekdays ?? [],
    timeSlots: classroomData.timeSlots ?? [],
    zones: zones.labels,
    buildings: buildings.labels,
    floors: floors.labels,
    courses: courses.labels,
    teachers: teachers.labels,
    classes: classes.labels,
    classGroups: classGroups.labels,
  };

  const schedule = {
    schemaVersion: 2,
    eventFields: ["room", "course", "teachers", "classes", "weekday", "period", "weekMask", "classGroups", "sourceMask"],
    events,
  };

  const directory = {
    schemaVersion: 2,
    courses: createDirectoryIndex(courses.labels, eventsByCourse, "courses"),
    teachers: createDirectoryIndex(teachers.labels, eventsByTeacher, "teachers"),
    classes: createDirectoryIndex(classes.labels, eventsByClass, "classes", normalization.aliases),
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const files = {
    common: writeDataFile("common.json", common),
    rooms: writeDataFile("rooms.json", { schemaVersion: 2, rooms }),
    availability: writeDataFile("availability.json", availability),
    schedule: writeDataFile("schedule.json", schedule),
    directory: writeDataFile("directory.json", directory),
  };

  const manifest = {
    schemaVersion: 2,
    generatedAt: common.generatedAt,
    files,
    summary: {
      rooms: rooms.length,
      events: events.length,
      courses: courses.labels.length,
      teachers: teachers.labels.length,
      classes: classes.labels.length,
      maxWeek,
    },
    validation,
  };
  writeDataFile("manifest.json", manifest);

  console.log(`Generated v2 data in ${OUTPUT_DIR}`);
  console.log(`Rooms: ${rooms.length}; events: ${events.length}; courses: ${courses.labels.length}; teachers: ${teachers.labels.length}; classes: ${classes.labels.length}.`);
  console.log(`Validation: invalid=${validation.invalidRecords.count}; unknownRooms=${validation.unknownRooms.count}; ambiguousClasses=${validation.ambiguousClassGroups.count}.`);
}

function main() {
  const SOURCE_FILE = cliArg
    ? path.resolve(SOURCE_DIR, cliArg)
    : findLatestClassroomSource();

  console.log(`Parsing classroom schedule: ${path.basename(SOURCE_FILE)}`);
  const classroomData = parseClassroomSource(SOURCE_FILE);
  console.log(`Parsed ${classroomData.rooms.length} classrooms and ${classroomData.summary.totalEntries} schedule entries.`);
  console.log(`Max detected week: ${classroomData.summary.maxWeek}`);

  const scheduleData = parseScheduleSources();
  console.log(`Parsed ${scheduleData.entries.length} canonical schedule entries.`);
  console.log(`Courses: ${scheduleData.courses.length}; teachers: ${scheduleData.teachers.length}; classes: ${scheduleData.classes.length}.`);

  buildV2Data(classroomData, scheduleData);
}

main();
