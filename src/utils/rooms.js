import { OCCUPIED_ENTRY } from "../constants";

/* 获取指定教室在特定周次、星期几和节次代码下的所有课程条目。如果教室或相关数据不存在，则返回一个空数组： */
export function getRoomEntries(room, weekday, periodCode, week) {
  const slotEntries = room?.slots?.[String(weekday)]?.[periodCode];
  if (slotEntries) {
    return slotEntries.filter((entry) => entry.weeks.includes(Number(week)));
  }

  const periodIndex = room?.periodIndexByCode?.[periodCode];
  const slotIndex = (Number(weekday) - 1) * (room?.periodCount ?? 0) + periodIndex;
  const weekMask = room?.occupancyMasks?.[slotIndex] ?? 0;
  return weekMask & (1 << (Number(week) - 1)) ? [OCCUPIED_ENTRY] : [];
}

/* 获取指定教室在特定周次、星期几和多个节次代码下的所有课程条目。通过调用 getRoomEntries 函数并将结果展平为一个数组返回： */
export function getRoomEntriesForPeriods(room, weekday, periodCodes, week) {
  return periodCodes.flatMap((periodCode) => getRoomEntries(room, weekday, periodCode, week));
}

/* 获取指定教室在当前时间之后的下一个课程条目。如果教室或数据不存在，则返回 null。通过计算当前节次的位置，并遍历所有时间段和星期几，找到下一个课程条目并返回： */
export function getNextCourse(room, data, week, weekday, periodCodes) {
  if (!room || !data) return null;

  const currentSlotIndex = Math.max(
    0,
    data.timeSlots.findIndex((slot) => slot.code === periodCodes[0]),
  );
  const currentPosition = (Number(weekday) - 1) * data.timeSlots.length + currentSlotIndex;
  const occurrences = [];

  data.weekdays.forEach((day) => {
    data.timeSlots.forEach((slot, slotIndex) => {
      const entries = getRoomEntries(room, day.index, slot.code, week);
      entries.forEach((entry) => {
        occurrences.push({
          entry,
          day,
          slot,
          position: (day.index - 1) * data.timeSlots.length + slotIndex,
        });
      });
    });
  });

  occurrences.sort((a, b) => a.position - b.position);
  return (
    occurrences.find((item) => item.position > currentPosition) ??
    occurrences[0] ??
    null
  );
}

/* 获取指定教室在一周内的概览信息，包括每个星期几的总节次、已占用节次和空闲节次。返回一个包含每个星期几概览信息的数组： */
export function getWeeklyRoomOverview(room, data, week) {
  return data.weekdays.map((day) => {
    const total = data.timeSlots.length;
    const occupied = data.timeSlots.filter(
      (slot) => getRoomEntries(room, day.index, slot.code, week).length > 0,
    ).length;
    return {
      ...day,
      total,
      occupied,
      free: total - occupied,
    };
  });
}

/* 比较两个教室对象的排序顺序，首先按建筑物名称进行拼音排序，如果建筑物相同，则按楼层数字排序，如果楼层也相同，则按教室名称进行拼音排序。返回一个整数值，用于确定排序顺序： */
function compareRooms(a, b) {
  const buildingDiff = a.building.localeCompare(b.building, "zh-Hans-u-co-pinyin");
  if (buildingDiff !== 0) return buildingDiff;
  const floorDiff = Number(a.floor) - Number(b.floor);
  if (floorDiff !== 0) return floorDiff;
  return a.name.localeCompare(b.name, "zh-Hans-u-co-pinyin", { numeric: true });
}


/* 将教室列表按建筑物和楼层进行分组，返回一个包含建筑物、楼层和教室信息的数组。首先按建筑物名称进行拼音排序，然后按楼层数字排序，最后按教室名称进行拼音排序。每个建筑物对象包含楼层信息，每个楼层对象包含对应的教室列表： */
export function groupRoomsByBuildingAndFloor(rooms) {
  const buildingMap = new Map();

  for (const room of [...rooms].sort(compareRooms)) {
    if (!buildingMap.has(room.building)) {
      buildingMap.set(room.building, { building: room.building, floors: new Map(), total: 0 });
    }

    const building = buildingMap.get(room.building);
    building.total += 1;

    if (!building.floors.has(room.floor)) {
      building.floors.set(room.floor, []);
    }
    building.floors.get(room.floor).push(room);
  }

  return [...buildingMap.values()]
    .sort((a, b) => a.building.localeCompare(b.building, "zh-Hans-u-co-pinyin"))
    .map((building) => ({
      ...building,
      floors: [...building.floors.entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([floor, floorRooms]) => ({
          floor,
          rooms: [...floorRooms].sort(compareRooms),
        })),
    }));
}
