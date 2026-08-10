import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const DATA_DIR = path.resolve(PROJECT_ROOT, "public", "data");
const V2_DIR = path.resolve(DATA_DIR, "v2");

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

function verifyManifest(manifest) {
  for (const [name, metadata] of Object.entries(manifest.files ?? {})) {
    const filePath = path.resolve(V2_DIR, `${name}.json`);
    const content = fs.readFileSync(filePath, "utf8");
    assert(Buffer.byteLength(content) === metadata.bytes, `Manifest byte count mismatch: ${name}`);
    assert(sha256(content) === metadata.sha256, `Manifest hash mismatch: ${name}`);
  }
}

function verifyAvailability(legacy, rooms, availability) {
  const roomIdByName = new Map(rooms.rooms.map((room) => [room.name, room.id]));
  let checkedSlots = 0;

  for (let week = 1; week <= legacy.summary.maxWeek; week += 1) {
    for (let weekday = 1; weekday <= legacy.weekdays.length; weekday += 1) {
      for (let period = 0; period < legacy.timeSlots.length; period += 1) {
        const periodCode = legacy.timeSlots[period].code;
        const expected = legacy.rooms
          .filter((room) => (room.slots[String(weekday)]?.[periodCode] ?? [])
            .some((entry) => entry.weeks.includes(week)))
          .map((room) => roomIdByName.get(room.name))
          .sort((left, right) => left - right);
        const actual = availability.weeks[week - 1][weekday - 1][period];
        assert(
          compareNumericArrays(expected, actual),
          `Availability mismatch: week=${week}, weekday=${weekday}, period=${periodCode}`,
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
}

function main() {
  const legacy = readJson(path.resolve(DATA_DIR, "classroom-data.json"));
  const manifest = readJson(path.resolve(V2_DIR, "manifest.json"));
  const common = readJson(path.resolve(V2_DIR, "common.json"));
  const rooms = readJson(path.resolve(V2_DIR, "rooms.json"));
  const availability = readJson(path.resolve(V2_DIR, "availability.json"));
  const schedule = readJson(path.resolve(V2_DIR, "schedule.json"));
  const directory = readJson(path.resolve(V2_DIR, "directory.json"));

  verifyManifest(manifest);
  assert(!/[\u3400-\u9fff]/.test(JSON.stringify(schedule)), "schedule.json must not contain Chinese text");
  assert(
    common.classes.every((label) => !/.*\d{2,}[A-Z]{2,}班?$/.test(label)),
    "Combined class labels remain in the class dictionary",
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

  const checkedSlots = verifyAvailability(legacy, rooms, availability);
  verifyDirectory(directory, schedule.events, common);

  console.log(`v2 data verified: ${rooms.rooms.length} rooms, ${schedule.events.length} events, ${checkedSlots} availability slots.`);
}

main();
