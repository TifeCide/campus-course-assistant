import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const DATA_DIR = path.resolve(PROJECT_ROOT, "public", "data");
const OUTPUT_DIR = path.resolve(DATA_DIR, "v2");
const CLASSROOM_DATA_FILE = path.resolve(DATA_DIR, "classroom-data.json");
const SCHEDULE_DATA_FILE = path.resolve(DATA_DIR, "schedule-index.json");
const NORMALIZATION_FILE = path.resolve(SCRIPT_DIR, "class-normalization.json");

const SOURCE_BITS = {
  room: 1,
  course: 2,
  teacher: 4,
  class: 8,
};

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required data file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function main() {
  const classroomData = readJson(CLASSROOM_DATA_FILE);
  const scheduleData = readJson(SCHEDULE_DATA_FILE);
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

main();
