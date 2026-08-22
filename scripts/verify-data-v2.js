import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const V2_DIR = path.resolve(PROJECT_ROOT, "public", "data", "v2");

const ROOM_SOURCE_BIT = 1;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compareNumericArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function getExpectedEventIds(events, fieldIndex, entityCount) {
  const result = Array.from({ length: entityCount }, () => []);
  events.forEach((event, eventId) => {
    const values = Array.isArray(event[fieldIndex]) ? event[fieldIndex] : [event[fieldIndex]];
    values.forEach((value) => {
      if (value >= 0) result[value].push(eventId);
    });
  });
  return result.map((ids) => [...new Set(ids)].sort((left, right) => left - right));
}

function createClassSearchTokens(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/班$/u, "")
    .match(/[\u3400-\u9fff]|\d+|[a-z]/gu) ?? [];
}

function verifyManifest(manifest) {
  for (const [name, metadata] of Object.entries(manifest.files ?? {})) {
    const filePath = path.resolve(V2_DIR, `${name}.json`);
    const content = fs.readFileSync(filePath, "utf8");
    assert(Buffer.byteLength(content) === metadata.bytes, `Manifest byte count mismatch: ${name}`);
    assert(sha256(content) === metadata.sha256, `Manifest hash mismatch: ${name}`);
  }
}

function verifyAvailabilityFromEvents(availability, rooms, events, maxWeek) {
  assert(availability.roomCount === rooms.rooms.length, "Availability room count mismatch");
  assert(
    availability.weeks.length === maxWeek,
    `Availability week count mismatch: ${availability.weeks.length} != ${maxWeek}`,
  );

  const expected = availability.weeks.map((days) =>
    days.map((periods) => periods.map(() => new Set())),
  );

  events.forEach((event) => {
    const [roomId, , , , weekday, period, weekMask, , sourceMask] = event;
    if (roomId < 0 || !(sourceMask & ROOM_SOURCE_BIT)) return;
    for (let week = 1; week <= maxWeek; week += 1) {
      if (weekMask & (1 << (week - 1))) expected[week - 1][weekday][period].add(roomId);
    }
  });

  let checkedSlots = 0;
  for (let week = 1; week <= maxWeek; week += 1) {
    for (let weekday = 1; weekday <= availability.weeks[week - 1].length; weekday += 1) {
      for (let period = 0; period < availability.weeks[week - 1][weekday - 1].length; period += 1) {
        const actual = availability.weeks[week - 1][weekday - 1][period];
        const rebuilt = [...expected[week - 1][weekday - 1][period]].sort((left, right) => left - right);
        assert(
          compareNumericArrays(rebuilt, actual),
          `Availability mismatch: week=${week}, weekday=${weekday}, period=${period}`,
        );
        checkedSlots += 1;
      }
    }
  }

  return checkedSlots;
}

function verifyDirectory(directory, events, common) {
  const definitions = [
    ["courses", 1, common.courses.length],
    ["teachers", 2, common.teachers.length],
    ["classes", 3, common.classes.length],
  ];

  for (const [name, eventFieldIndex, entityCount] of definitions) {
    const index = directory[name];
    const expected = getExpectedEventIds(events, eventFieldIndex, entityCount);
    assert(index.entities.length === entityCount, `Directory entity count mismatch: ${name}`);

    index.entities.forEach(([entityId, eventIds]) => {
      assert(entityId >= 0 && entityId < entityCount, `Invalid ${name} entity ID: ${entityId}`);
      assert(
        compareNumericArrays(eventIds, expected[entityId]),
        `Directory event mapping mismatch: ${name}[${entityId}]`,
      );
    });

    for (const [term, entityIds] of Object.entries(index.terms)) {
      assert(term, `Empty search term in ${name}`);
      entityIds.forEach((entityId) => {
        assert(entityId >= 0 && entityId < entityCount, `Invalid ${name} search entity ID: ${entityId}`);
      });
    }
  }

  common.classes.forEach((label, classId) => {
    for (const term of createClassSearchTokens(label)) {
      assert(
        directory.classes.terms[term]?.includes(classId),
        `Class search term is missing: ${label} -> ${term}`,
      );
    }
  });
}

function main() {
  const manifest = readJson(path.resolve(V2_DIR, "manifest.json"));
  const common = readJson(path.resolve(V2_DIR, "common.json"));
  const rooms = readJson(path.resolve(V2_DIR, "rooms.json"));
  const availability = readJson(path.resolve(V2_DIR, "availability.json"));
  const schedule = readJson(path.resolve(V2_DIR, "schedule.json"));
  const directory = readJson(path.resolve(V2_DIR, "directory.json"));

  verifyManifest(manifest);
  assert(!/[\u3400-\u9fff]/.test(JSON.stringify(schedule)), "schedule.json must not contain Chinese text");
  assert(
    common.classes.every((label) => !label.endsWith("班")),
    "Class labels must not retain a trailing 班 separator",
  );

  schedule.events.forEach((event, eventId) => {
    const [roomId, courseId, teacherIds, classIds, weekday, period, weekMask] = event;
    assert(roomId >= -1 && roomId < rooms.rooms.length, `Invalid room ID in event ${eventId}`);
    assert(courseId >= 0 && courseId < common.courses.length, `Invalid course ID in event ${eventId}`);
    assert(weekday >= 0 && weekday < common.weekdays.length, `Invalid weekday in event ${eventId}`);
    assert(period >= 0 && period < common.timeSlots.length, `Invalid period in event ${eventId}`);
    assert(Number.isInteger(weekMask) && weekMask > 0, `Invalid week mask in event ${eventId}`);
    teacherIds.forEach((id) => assert(id >= 0 && id < common.teachers.length, `Invalid teacher ID in event ${eventId}`));
    classIds.forEach((id) => assert(id >= 0 && id < common.classes.length, `Invalid class ID in event ${eventId}`));
  });

  const maxWeek = manifest.summary?.maxWeek ?? availability.weeks.length;
  const checkedSlots = verifyAvailabilityFromEvents(availability, rooms, schedule.events, maxWeek);
  verifyDirectory(directory, schedule.events, common);

  console.log(`v2 data verified: ${rooms.rooms.length} rooms, ${schedule.events.length} events, ${checkedSlots} availability slots.`);
}

main();
