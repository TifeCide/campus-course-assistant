import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const OUTPUT_FILE = path.resolve(PROJECT_ROOT, "public", "data", "classroom-data.json");

function findLatestSourceFile() {
  const candidates = fs
    .readdirSync(PROJECT_ROOT)
    .filter((fileName) => /^kbxx_classroom_ifr_.*\.html$/i.test(fileName))
    .sort((left, right) => right.localeCompare(left, "en", { numeric: true }));

  if (!candidates.length) {
    throw new Error("No kbxx_classroom_ifr_*.html file found in the project root.");
  }

  return path.resolve(PROJECT_ROOT, candidates[0]);
}

function printUsage() {
  console.log("Usage:");
  console.log("  npm run parse");
  console.log("  npm run parse -- kbxx_classroom_ifr_2026-2027-1.html");
  console.log("  npm run update-data");
}

const cliArg = process.argv[2];
if (cliArg === "--help" || cliArg === "-h") {
  printUsage();
  process.exit(0);
}

/* With no argument, use the latest matching HTML file in the project root. */
const SOURCE_FILE = cliArg
  ? path.resolve(process.cwd(), cliArg)
  : findLatestSourceFile();

/* When a page is saved via "View Source" in Chrome/Edge, the actual HTML is */
/* encoded inside a <table class="line-wrap"> viewer. This unwraps it back to */
/* the original HTML by extracting line-content cells, stripping span tags, */
/* and decoding HTML entities. */
function unwrapSourceViewer(raw) {
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
  /* Strip all span tags used for syntax highlighting */
  const stripped = joined.replace(/<span[^>]*>|<\/span>/g, "");
  /* Decode HTML entities (&lt; &gt; &amp; &quot; &#nn; &#xnn;) */
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

function cleanText(input) {
  return stripTags(input)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function getRows(tableHtml) {
  return [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
}

function getCells(rowHtml) {
  return [...rowHtml.matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
}

function getCellEntries(cellHtml) {
  const blocks = [...cellHtml.matchAll(/<div[^>]*class=["'][^"']*kbcontent1[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)]
    .map((match) => match[1]);

  if (!blocks.length) {
    return [];
  }

  return blocks
    .map((block) => {
      const lines = cleanText(block)
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
      const weekInfo = parseWeekText(weekText);

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

function parseWeekText(weekText) {
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

function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`Source HTML not found: ${SOURCE_FILE}`);
  }

  const raw = fs.readFileSync(SOURCE_FILE, "utf8");
  const html = unwrapSourceViewer(raw);
  const tableMatch = html.match(/<table[^>]*id=["']kbtable["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    throw new Error("Could not find #kbtable in source HTML.");
  }

  const rows = getRows(tableMatch[0]);
  if (rows.length < 3) {
    throw new Error("Unexpected table structure: not enough rows.");
  }

  const weekdayLabels = getCells(rows[0]).slice(1).map((cell) => cleanText(cell)).filter(Boolean);
  const periodHeaderCells = getCells(rows[1]).slice(1).map((cell) => cleanText(cell)).filter(Boolean);
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

    const roomName = cleanText(cells[0]);
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

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(SOURCE_FILE),
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

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Parsed ${rooms.length} classrooms and ${totalEntries} schedule entries.`);
  console.log(`Max detected week: ${maxWeek}`);
  console.log(`Output written to ${OUTPUT_FILE}`);
}

main();
