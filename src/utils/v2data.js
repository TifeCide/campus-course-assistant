function getWeeksFromMask(weekMask, maxWeek) {
  const weeks = [];
  for (let week = 1; week <= maxWeek; week += 1) {
    if (weekMask & (1 << (week - 1))) weeks.push(week);
  }
  return weeks;
}

function getWeekPresentation(weekMask, maxWeek, cache) {
  if (cache.has(weekMask)) return cache.get(weekMask);

  const weeks = getWeeksFromMask(weekMask, maxWeek);
  const ranges = [];
  for (let index = 0; index < weeks.length;) {
    const start = weeks[index];
    let end = start;
    while (weeks[index + 1] === end + 1) {
      index += 1;
      end = weeks[index];
    }
    ranges.push(start === end ? String(start) : `${start}-${end}`);
    index += 1;
  }

  const allOdd = weeks.length > 0 && weeks.every((week) => week % 2 === 1);
  const allEven = weeks.length > 0 && weeks.every((week) => week % 2 === 0);
  const continuous = weeks.length > 0 && weeks.length === weeks.at(-1) - weeks[0] + 1;
  const presentation = {
    weeks,
    startWeek: weeks[0] ?? null,
    endWeek: weeks.at(-1) ?? null,
    weekRule: ranges.join(","),
    weekText: ranges.length ? `(${ranges.join(",")}周)` : "",
    weekType: allOdd ? "odd" : allEven ? "even" : continuous ? "all" : "mixed",
    weekTypeLabel: allOdd ? "单周" : allEven ? "双周" : continuous ? "全周" : "混合周",
  };
  cache.set(weekMask, presentation);
  return presentation;
}

export function createInitialDataFromV2(common, roomPayload, availability) {
  const periodIndexByCode = Object.fromEntries(common.timeSlots.map((slot, index) => [slot.code, index]));
  const slotCount = common.weekdays.length * common.timeSlots.length;
  const occupancyMasks = Array.from(
    { length: roomPayload.rooms.length },
    () => new Int32Array(slotCount),
  );

  availability.weeks.forEach((days, weekIndex) => {
    days.forEach((periods, weekdayIndex) => {
      periods.forEach((roomIds, periodIndex) => {
        roomIds.forEach((roomId) => {
          const masks = occupancyMasks[roomId];
          if (masks) masks[weekdayIndex * common.timeSlots.length + periodIndex] |= 1 << weekIndex;
        });
      });
    });
  });

  const rooms = roomPayload.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    zone: common.zones[room.zone] ?? "未知区域",
    building: common.buildings[room.building] ?? "未知楼栋",
    floor: common.floors[room.floor] ?? "未知",
    roomNumber: room.roomNumber,
    occupancyMasks: occupancyMasks[room.id] ?? new Int32Array(slotCount),
    periodIndexByCode,
    periodCount: common.timeSlots.length,
  }));

  return {
    generatedAt: common.generatedAt,
    sourceFile: common.sourceFiles?.classroom ?? "",
    weekdays: common.weekdays,
    timeSlots: common.timeSlots,
    summary: {
      totalRooms: rooms.length,
      totalEntries: 0,
      maxWeek: availability.weeks.length,
      totalZones: common.zones.length,
      totalFloors: common.floors.length,
    },
    rooms,
    v2Common: common,
  };
}

export function createRoomSlots(entries, data) {
  const slots = Object.fromEntries(
    data.weekdays.map((day) => [
      String(day.index),
      Object.fromEntries(data.timeSlots.map((slot) => [slot.code, []])),
    ]),
  );
  entries.forEach((entry) => {
    slots[String(entry.weekday)]?.[entry.periodCode]?.push(entry);
  });
  return slots;
}

export function createScheduleDataFromV2(schedule, data) {
  const common = data.v2Common;
  const weekPresentationCache = new Map();
  const roomNames = data.rooms.map((room) => room.name);
  const baseEntries = schedule.events.map((event, eventId) => {
    const [roomId, courseId, teacherIds, classIds, weekdayIndex, periodIndex, weekMask, classGroupIds] = event;
    const week = getWeekPresentation(weekMask, data.summary.maxWeek, weekPresentationCache);
    const teacherNames = teacherIds.map((id) => common.teachers[id]).filter(Boolean);
    const classNames = classIds.map((id) => common.classes[id]).filter(Boolean);
    const classGroups = classGroupIds.map((id) => common.classGroups[id]).filter(Boolean);
    const weekday = data.weekdays[weekdayIndex];
    const period = data.timeSlots[periodIndex];

    return {
      eventId,
      roomId,
      courseName: common.courses[courseId] ?? "未命名课程",
      teacher: teacherNames.join(" / "),
      classGroup: classNames.join("、") || classGroups.join("、"),
      rawClassGroups: classGroups,
      teacherNames,
      classNames,
      roomName: roomNames[roomId] ?? "未标注教室",
      weekday: weekday?.index ?? weekdayIndex + 1,
      weekdayLabel: weekday?.label ?? "",
      periodCode: period?.code ?? "",
      ...week,
    };
  });

  const entries = [];
  const teacherEntries = [];
  const courseEntries = [...baseEntries];
  baseEntries.forEach((entry) => {
    const teacherNames = entry.teacherNames.length ? entry.teacherNames : [entry.teacher];
    const classNames = entry.classNames.length ? entry.classNames : [entry.classGroup];
    teacherNames.filter(Boolean).forEach((teacher) => teacherEntries.push({ ...entry, teacher }));
    classNames.filter(Boolean).forEach((classGroup) => entries.push({ ...entry, classGroup }));
  });

  return { entries, courseEntries, teacherEntries, roomEntries: baseEntries };
}

export function hydrateRoomsWithSchedule(data, scheduleData) {
  const entriesByRoom = new Map();
  scheduleData.roomEntries.forEach((entry) => {
    if (entry.roomId < 0) return;
    if (!entriesByRoom.has(entry.roomId)) entriesByRoom.set(entry.roomId, []);
    entriesByRoom.get(entry.roomId).push(entry);
  });

  return {
    ...data,
    rooms: data.rooms.map((room) => {
      const entries = entriesByRoom.get(room.id) ?? [];
      return {
        ...room,
        entries,
        slots: createRoomSlots(entries, data),
      };
    }),
  };
}
