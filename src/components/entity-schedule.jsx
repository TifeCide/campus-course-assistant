import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Filter,
  X,
} from "lucide-react";
import { clamp, cn, timeToMinutes } from "../utils/misc";
import { getShanghaiParts } from "../utils/datetime";
import { DetailBackButton, ExpandableScheduleEntries, SelectField } from "./ui";

/* 创建一个函数，根据当前视图类型（课程、教师或班级）从课表数据中获取相应的条目列表。如果视图类型为课程，则返回课程条目列表；如果视图类型为教师，则返回教师条目列表；如果视图类型为班级，则返回班级条目列表；否则返回空数组： */
export function getScheduleSourceEntries(scheduleData, view) {
  if (view === "courses") return scheduleData?.courseEntries ?? [];
  if (view === "teachers") return scheduleData?.teacherEntries ?? [];
  if (view === "classes") return scheduleData?.entries ?? [];
  return [];
}

/* 创建一个函数，根据当前视图类型（课程、教师或班级）从条目中获取相应的实体值。如果视图类型为课程，则返回课程名称；如果视图类型为教师，则返回教师名称；如果视图类型为班级，则返回班级组名称；否则返回空字符串： */
export function getScheduleEntityValue(entry, view) {
  if (view === "courses") return entry.courseName;
  if (view === "teachers") return entry.teacher;
  if (view === "classes") return entry.classGroup;
  return "";
}

/* 创建一个函数，根据当前视图类型（课程、教师或班级）返回相应的对话框标题。如果视图类型为课程，则返回“课程课表”；如果视图类型为教师，则返回“教师课表”；如果视图类型为班级，则返回“班级课表”；否则返回“课表详情”： */
export function getEntityDialogTitle(view) {
  return {
    courses: "课程课表",
    teachers: "教师课表",
    classes: "班级课表",
  }[view] || "课表详情";
}

/* 创建一个函数，根据当前时间和课表数据获取实体的当前状态和下一次课程信息。如果没有条目或数据，或者选定的周次与当前周次不匹配，则返回 null。否则，计算当前时间所在的节次索引、当前定位和下一次课程，并返回包含当前条目、下一次课程和是否为当前周的对象： */
export function getEntityScheduleStatus(entries, data, selectedWeek, currentNow, currentTemporal) {
  if (!entries.length || !data || selectedWeek !== currentTemporal?.week) return null;
  const parts = getShanghaiParts(currentNow);
  const currentDay = parts.weekdayIndex;
  const currentMinutes = parts.hour * 60 + parts.minute;
  const slotIndex = data.timeSlots.findIndex((slot) => {
    const start = timeToMinutes(slot.start);
    const end = timeToMinutes(slot.end);
    return currentMinutes >= start && currentMinutes < end;
  });
  const nextSlotIndex = slotIndex >= 0
    ? slotIndex
    : data.timeSlots.findIndex((slot) => currentMinutes < timeToMinutes(slot.start));
  const currentPosition = slotIndex >= 0
    ? (currentDay - 1) * data.timeSlots.length + slotIndex
    : nextSlotIndex >= 0
      ? (currentDay - 1) * data.timeSlots.length + nextSlotIndex
      : currentDay * data.timeSlots.length;
  const sortedEntries = [...entries].sort((left, right) => {
    const leftIndex = data.timeSlots.findIndex((slot) => slot.code === left.periodCode);
    const rightIndex = data.timeSlots.findIndex((slot) => slot.code === right.periodCode);
    return left.weekday - right.weekday || leftIndex - rightIndex;
  });
  const currentEntries = slotIndex >= 0
    ? sortedEntries.filter((entry) => entry.weekday === currentDay && entry.periodCode === data.timeSlots[slotIndex]?.code)
    : [];
  const nextEntry = sortedEntries.find((entry) => {
    const entrySlotIndex = data.timeSlots.findIndex((slot) => slot.code === entry.periodCode);
    const entryPosition = (entry.weekday - 1) * data.timeSlots.length + entrySlotIndex;
    return entryPosition >= currentPosition && !currentEntries.includes(entry);
  }) || sortedEntries[0] || null;

  return {
    currentEntries,
    nextEntry,
    isCurrentWeek: true,
  };
}

function getClassGroupSummary(classGroup) {
  const separatorCount = (String(classGroup ?? "").match(/、/g) ?? []).length;
  return separatorCount >= 2 ? `共${separatorCount + 1}个班级` : "";
}

export function ScheduleClassGroup({ classGroup, onNavigate }) {
  const summary = getClassGroupSummary(classGroup);

  if (summary) {
    return <span className="text-[11px] font-medium text-gray-400">{summary}</span>;
  }

  return (
    <button className="block max-w-full truncate rounded text-left text-[11px] font-medium text-gray-700 transition-colors hover:text-primary-600" onClick={() => onNavigate("classes", classGroup)} type="button">
      {classGroup || "未标注班级"}
    </button>
  );
}

const SCHEDULE_GRID_COLS = "[grid-template-columns:72px_repeat(7,minmax(0,1fr))]";

/* 创建一个课程安排单元格组件，显示课程的名称、教师或班级、教室等信息，并提供导航和打开教室的操作。根据当前视图类型（课程或教师）显示相应的信息。接受课程条目、视图类型、教室对象、导航回调函数和打开教室回调函数作为属性： */
function EntityScheduleCell({ entry, view, room, onNavigate, onOpenRoom, onPreviewEntry }) {
  const primary = view === "courses" ? entry.classGroup : entry.courseName;
  const secondary = view === "teachers" ? entry.classGroup : entry.teacher;

  return (
    <div className="relative h-full rounded-md p-1 transition-shadow duration-150 hover:shadow-sm hover:ring-1 hover:ring-primary-200">
      <button
        className="absolute inset-0 z-10 rounded-md"
        onClick={(event) => onPreviewEntry(entry, event.currentTarget)}
        type="button"
        aria-label={`预览${entry.courseName || "课程"}安排`}
      />
      <div className="pointer-events-none space-y-0.5">
        {view === "courses" ? (
          <ScheduleClassGroup classGroup={primary} onNavigate={onNavigate} />
        ) : (
          <button className="block max-w-full truncate text-left text-[11px] font-semibold text-primary-700" onClick={() => onNavigate("courses", entry.courseName)} type="button" tabIndex={-1}>
            {primary || "未命名课程"}
          </button>
        )}
        {view !== "teachers" ? (
          <button className="block max-w-full truncate text-left text-[11px] text-gray-500" onClick={() => onNavigate("teachers", entry.teacher)} type="button" tabIndex={-1}>
            {secondary || "未标注教师"}
          </button>
        ) : (
          <ScheduleClassGroup classGroup={secondary} onNavigate={onNavigate} />
        )}
        {room ? (
          <button className="block max-w-full truncate text-left text-[10px] font-medium text-gray-400" onClick={() => onOpenRoom(room)} type="button" tabIndex={-1}>
            {entry.roomName}
          </button>
        ) : (
          <small className="block truncate text-[10px] text-gray-400">{entry.roomName || "未标注教室"}</small>
        )}
      </div>
    </div>
  );
}

function getEntryClassLabels(entry) {
  const values = entry?.classNames?.length
    ? entry.classNames
    : String(entry?.classGroup ?? "").split(/[、,，;；/]+/u);
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

export function SchedulePreviewPopover({ preview, onClose, onNavigate }) {
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!preview) return undefined;

    const handlePointerDown = (event) => {
      if (!popoverRef.current?.contains(event.target)) onClose();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose, preview]);

  if (!preview) return null;

  const { entry, anchorRect } = preview;
  const classLabels = getEntryClassLabels(entry);
  const cardWidth = Math.min(300, window.innerWidth - 24);
  const left = clamp(anchorRect.left, 12, Math.max(12, window.innerWidth - cardWidth - 12));
  const showAbove = anchorRect.bottom > window.innerHeight * 0.58;
  function navigate(view, label) {
    onClose();
    onNavigate(view, label);
  }

  return createPortal(
    <aside
      ref={popoverRef}
      className={cn(
        "fixed z-50 animate-dialog-in rounded-xl border border-gray-200 bg-white p-3.5 shadow-xl",
        showAbove && "-translate-y-full",
      )}
      style={{ left, top: showAbove ? anchorRect.top - 10 : anchorRect.bottom + 10, width: cardWidth }}
      role="dialog"
      aria-label="课程安排预览"
    >
      <div className="flex items-start gap-2.5">
        <span className="w-8 shrink-0 pt-0.5 text-[11px] font-medium text-gray-400">课程</span>
        <button className="min-w-0 flex-1 text-left text-sm font-semibold text-gray-900 transition-colors hover:text-primary-600" onClick={() => navigate("courses", entry.courseName)} type="button">
          {entry.courseName || "未命名课程"}
        </button>
        <button className="icon-btn -mt-0.5 -mr-0.5 h-6 w-6 shrink-0" onClick={onClose} type="button" aria-label="关闭预览" title="关闭预览">
          <X size={14} />
        </button>
      </div>
      <div className="mt-2 flex items-start gap-2.5">
        <span className="w-8 shrink-0 pt-0.5 text-[11px] font-medium text-gray-400">教师</span>
        <button className="min-w-0 flex-1 truncate text-left text-xs text-gray-600 transition-colors hover:text-primary-600" onClick={() => navigate("teachers", entry.teacher)} type="button">
          {entry.teacher || "未标注教师"}
        </button>
      </div>
      <div className="mt-1.5 flex items-start gap-2.5">
        <span className="w-8 shrink-0 pt-0.5 text-[11px] font-medium text-gray-400">班级</span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {classLabels.length ? (
            classLabels.map((classLabel) => (
              <button
                className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 transition-colors hover:bg-primary-50 hover:text-primary-700"
                key={classLabel}
                onClick={() => navigate("classes", classLabel)}
                type="button"
              >
                {classLabel}
              </button>
            ))
          ) : (
            <span className="text-xs text-gray-400">未标注班级</span>
          )}
        </div>
      </div>
    </aside>,
    document.body,
  );
}

/* 创建一个实体课表对话框组件，显示实体（课程、教师或班级）的课表信息，包括本周安排、关联信息、涉及教室、当前定位和当前状态等。接受实体对象、课表数据、数据、选定的周次、星期几、节次、当前时间、当前学期、最大周次、教室映射对象以及关闭回调函数、周次变化回调函数、筛选变化回调函数、导航回调函数和打开教室回调函数作为属性： */
export function EntityScheduleDialog({
  entity,
  scheduleData,
  data,
  selectedWeek,
  selectedWeekday,
  selectedPeriods,
  currentNow,
  currentTemporal,
  maxWeek,
  roomByName,
  onClose,
  onBack,
  canGoBack,
  backDepth,
  onWeekChange,
  onFilterChange,
  onNavigate,
  onOpenRoom,
  onPreviewEntry,
}) {
  /* 如果实体对象、课表数据或数据不存在，则返回 null，不渲染任何内容： */
  if (!entity || !scheduleData || !data) return null;

  const sourceEntries = getScheduleSourceEntries(scheduleData, entity.view);
  const allEntries = sourceEntries.filter((entry) => getScheduleEntityValue(entry, entity.view) === entity.label);
  const weekEntries = allEntries.filter((entry) => entry.weeks.includes(Number(selectedWeek)));
  const selectedEntries = weekEntries.filter(
    (entry) => entry.weekday === Number(selectedWeekday) && selectedPeriods.includes(entry.periodCode),
  );
  const relatedCourses = [...new Set(weekEntries.map((entry) => entry.courseName).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-Hans-u-co-pinyin"));
  const relatedTeachers = [...new Set(weekEntries.map((entry) => entry.teacher).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-Hans-u-co-pinyin"));
  const relatedClasses = [...new Set(weekEntries.map((entry) => entry.classGroup).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-Hans-u-co-pinyin"));
  const detailEntries = weekEntries.filter((entry) => {
    if (entity.courseFilter && entry.courseName !== entity.courseFilter) return false;
    if (entity.teacherFilter && entry.teacher !== entity.teacherFilter) return false;
    if (entity.classFilter && entry.classGroup !== entity.classFilter) return false;
    return true;
  });
  const liveStatus = getEntityScheduleStatus(detailEntries, data, selectedWeek, currentNow, currentTemporal);
  const courseCount = new Set(weekEntries.map((entry) => entry.courseName).filter(Boolean)).size;
  const teacherCount = new Set(weekEntries.map((entry) => entry.teacher).filter(Boolean)).size;
  const classCount = new Set(weekEntries.map((entry) => entry.classGroup).filter(Boolean)).size;
  const roomCount = new Set(weekEntries.map((entry) => entry.roomName).filter(Boolean)).size;
  const selectedDay = data.weekdays.find((day) => day.index === Number(selectedWeekday));
  const selectedPeriodLabel = data.timeSlots
    .filter((slot) => selectedPeriods.includes(slot.code))
    .map((slot) => slot.label)
    .join("、");
  const selectedEntriesForDisplay = selectedEntries.filter((entry) => detailEntries.includes(entry));
  const relatedLabel = entity.view === "courses"
    ? `${teacherCount} 位教师 / ${classCount} 个班级`
    : entity.view === "teachers"
      ? `${courseCount} 门课程 / ${classCount} 个班级`
      : `${courseCount} 门课程 / ${teacherCount} 位教师`;
  return (
    <>
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <DetailBackButton canGoBack={canGoBack} depth={backDepth} onBack={onBack} />
            <div className="text-[11px] font-medium tracking-wide text-gray-400">{getEntityDialogTitle(entity.view)}</div>
          </div>
          <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-gray-900">{entity.label}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1 text-[13px] text-gray-500">
              <CalendarDays size={13} className="text-gray-400" />
              第 {selectedWeek} 周完整安排
            </span>
            <SelectField
              className="w-32"
              label=""
              value={String(selectedWeek)}
              onChange={(value) => onWeekChange(Number(value))}
              options={Array.from({ length: maxWeek }, (_, index) => ({
                value: String(index + 1),
                label: `第 ${index + 1} 周`,
              }))}
            />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button className="icon-btn" onClick={onClose} type="button" aria-label="关闭">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="block text-[11px] text-gray-500">本周安排</span>
            <strong className="block truncate text-sm font-semibold text-gray-900">{weekEntries.length} 项</strong>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="block text-[11px] text-gray-500">关联信息</span>
            <strong className="block truncate text-sm font-semibold text-gray-900">{relatedLabel}</strong>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="block text-[11px] text-gray-500">涉及教室</span>
            <strong className="block truncate text-sm font-semibold text-gray-900">{roomCount} 间</strong>
          </div>
        </div>

        <div className="grid gap-2.5 md:grid-cols-2">
          <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 p-3.5">
            <Clock3 size={15} className="mt-0.5 shrink-0 text-primary-500" />
            <div className="min-w-0">
              <span className="block text-[11px] text-gray-500">当前定位</span>
              <strong className="block truncate text-sm font-semibold text-gray-900">
                {selectedDay?.shortLabel} {selectedPeriodLabel}
              </strong>
              <small className="mt-0.5 block text-xs text-gray-400">
                {selectedEntriesForDisplay.length ? `${selectedEntriesForDisplay.length} 项安排` : "暂无安排"}
              </small>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 p-3.5">
            <ArrowUpRight size={15} className="mt-0.5 shrink-0 text-primary-500" />
            <div className="min-w-0">
              <span className="block text-[11px] text-gray-500">
                {liveStatus?.currentEntries.length ? "正在上课" : "下一节课程"}
              </span>
              <strong className="block truncate text-sm font-semibold text-gray-900">
                {liveStatus?.currentEntries[0]?.courseName || liveStatus?.nextEntry?.courseName || "当前周暂无后续课程"}
              </strong>
              <small className="mt-0.5 block truncate text-xs text-gray-400">
                {liveStatus?.currentEntries.length
                  ? "当前时间段"
                  : liveStatus?.nextEntry
                    ? `${data.weekdays.find((day) => day.index === liveStatus.nextEntry.weekday)?.shortLabel ?? ""} · ${liveStatus.nextEntry.periodCode}`
                    : "请选择其他周次查看安排"}
              </small>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="inline-flex h-9 items-center gap-1.5 text-xs font-medium text-gray-500">
            <Filter size={14} className="text-gray-400" />
            课表筛选
          </div>
          {entity.view !== "courses" ? (
            <SelectField
              className="w-44"
              label="课程"
              value={entity.courseFilter || ""}
              onChange={(value) => onFilterChange("courseFilter", value)}
              options={[
                { value: "", label: "全部课程" },
                ...relatedCourses.map((item) => ({ value: item, label: item })),
              ]}
            />
          ) : null}
          {entity.view !== "teachers" ? (
            <SelectField
              className="w-44"
              label="教师"
              value={entity.teacherFilter || ""}
              onChange={(value) => onFilterChange("teacherFilter", value)}
              options={[
                { value: "", label: "全部教师" },
                ...relatedTeachers.map((item) => ({ value: item, label: item })),
              ]}
            />
          ) : null}
          {entity.view !== "classes" ? (
            <SelectField
              className="w-44"
              label="班级"
              value={entity.classFilter || ""}
              onChange={(value) => onFilterChange("classFilter", value)}
              options={[
                { value: "", label: "全部班级" },
                ...relatedClasses.map((item) => ({ value: item, label: item })),
              ]}
            />
          ) : null}
        </div>

        <p className="mb-1.5 text-right text-[10px] text-gray-300 sm:hidden">← 左右滑动查看整周课表 →</p>
        <div className="overflow-x-auto">
          <div className="min-w-[740px] overflow-hidden rounded-xl border border-gray-200">
            <div className={cn("grid bg-gray-50/80", SCHEDULE_GRID_COLS)}>
              <div className="px-2.5 py-2 text-left text-[11px] font-medium text-gray-400">节次</div>
              {data.weekdays.map((day) => (
                <div className="border-l border-gray-100 px-1 py-2 text-center text-xs font-medium text-gray-600" key={day.index}>
                  {day.shortLabel}
                </div>
              ))}
            </div>
            {data.timeSlots.map((slot) => (
              <div className={cn("grid border-t border-gray-100", SCHEDULE_GRID_COLS)} key={slot.code}>
                <div className="flex flex-col justify-center border-r border-gray-100 bg-gray-50/60 px-2 py-1.5">
                  <strong className="text-[11px] font-semibold text-gray-700">{slot.label}</strong>
                  <span className="text-[10px] tabular-nums text-gray-400">
                    {slot.start} - {slot.end}
                  </span>
                </div>
                {data.weekdays.map((day) => {
                  const entries = detailEntries.filter((entry) => entry.weekday === day.index && entry.periodCode === slot.code);
                  return (
                    <div
                      className={cn(
                        "min-h-[54px] border-r border-gray-100 p-1 last:border-r-0",
                        entries.length && "bg-primary-50/40",
                      )}
                      key={`${day.index}-${slot.code}`}
                    >
                      {entries.length ? (
                        <ExpandableScheduleEntries
                          entries={entries}
                          renderEntry={(entry, index) => (
                            <EntityScheduleCell
                              key={`${entry.courseName}-${entry.teacher}-${entry.classGroup}-${entry.roomName}-${index}`}
                              entry={entry}
                              view={entity.view}
                              room={roomByName.get(entry.roomName)}
                              onNavigate={onNavigate}
                              onOpenRoom={onOpenRoom}
                              onPreviewEntry={onPreviewEntry}
                            />
                          )}
                        />
                      ) : (
                        <span className="flex h-full min-h-[46px] items-center justify-center text-[11px] text-gray-300">无课</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
