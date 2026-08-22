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
    return <span className="schedule-class-group-summary">{summary}</span>;
  }

  return (
    <button className="schedule-entity-link" onClick={() => onNavigate("classes", classGroup)} type="button">
      {classGroup || "未标注班级"}
    </button>
  );
}

/* 创建一个课程安排单元格组件，显示课程的名称、教师或班级、教室等信息，并提供导航和打开教室的操作。根据当前视图类型（课程或教师）显示相应的信息。接受课程条目、视图类型、教室对象、导航回调函数和打开教室回调函数作为属性： */
function EntityScheduleCell({ entry, view, room, onNavigate, onOpenRoom, onPreviewEntry }) {
  const primary = view === "courses" ? entry.classGroup : entry.courseName;
  const secondary = view === "teachers" ? entry.classGroup : entry.teacher;

  return (
    <div className="schedule-course entity-schedule-course schedule-course-preview">
      <button
        className="schedule-course-preview-target"
        onClick={(event) => onPreviewEntry(entry, event.currentTarget)}
        type="button"
        aria-label={`预览${entry.courseName || "课程"}安排`}
      />
      {view === "courses" ? (
        <ScheduleClassGroup classGroup={primary} onNavigate={onNavigate} />
      ) : (
        <button className="schedule-entity-link" onClick={() => onNavigate("courses", entry.courseName)} type="button">
          {primary || "未命名课程"}
        </button>
      )}
      {view !== "teachers" ? (
        <button className="schedule-entity-link" onClick={() => onNavigate("teachers", entry.teacher)} type="button">
          {secondary || "未标注教师"}
        </button>
      ) : <ScheduleClassGroup classGroup={secondary} onNavigate={onNavigate} />}
      {room ? (
        <button className="schedule-entity-link schedule-room-link" onClick={() => onOpenRoom(room)} type="button">
          {entry.roomName}
        </button>
      ) : (
        <small>{entry.roomName || "未标注教室"}</small>
      )}
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
  const cardWidth = Math.min(320, window.innerWidth - 24);
  const left = clamp(anchorRect.left, 12, Math.max(12, window.innerWidth - cardWidth - 12));
  const showAbove = anchorRect.bottom > window.innerHeight * 0.58;
  function navigate(view, label) {
    onClose();
    onNavigate(view, label);
  }

  return createPortal(
    <aside
      ref={popoverRef}
      className={cn("schedule-preview-popover", showAbove && "is-above")}
      style={{ left, top: showAbove ? anchorRect.top - 10 : anchorRect.bottom + 10, width: cardWidth }}
      role="dialog"
      aria-label="课程安排预览"
    >
      <div className="schedule-preview-header">
        <span className="schedule-preview-label">课程</span>
        <button className="schedule-preview-course" onClick={() => navigate("courses", entry.courseName)} type="button">
          {entry.courseName || "未命名课程"}
        </button>
        <button className="icon-button schedule-preview-close" onClick={onClose} type="button" aria-label="关闭预览" title="关闭预览">
          <X size={15} />
        </button>
      </div>
      <div className="schedule-preview-line">
        <span className="schedule-preview-label">教师</span>
        <button className="schedule-preview-value" onClick={() => navigate("teachers", entry.teacher)} type="button">
          {entry.teacher || "未标注教师"}
        </button>
      </div>
      <div className="schedule-preview-line schedule-preview-class-line">
        <span className="schedule-preview-label">班级</span>
        <div className="schedule-preview-class-list">
          {classLabels.length ? (
            classLabels.map((classLabel) => (
              <button className="schedule-preview-value" key={classLabel} onClick={() => navigate("classes", classLabel)} type="button">
                {classLabel}
              </button>
            ))
          ) : (
            <span className="schedule-preview-empty">未标注班级</span>
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
      <div className="dialog-header">
        <div>
          <div className="dialog-eyebrow-row">
            <DetailBackButton canGoBack={canGoBack} depth={backDepth} onBack={onBack} />
            <div className="eyebrow">{getEntityDialogTitle(entity.view)}</div>
          </div>
          <h2>{entity.label}</h2>
          <p>
            <CalendarDays size={14} />
            第 {selectedWeek} 周完整安排
          </p>
          <SelectField
            className="entity-week-control"
            label="查看周次"
            value={String(selectedWeek)}
            onChange={(value) => onWeekChange(Number(value))}
            options={Array.from({ length: maxWeek }, (_, index) => ({
              value: String(index + 1),
              label: `第 ${index + 1} 周`,
            }))}
          />
        </div>
        <div className="dialog-header-actions">
          <button className="icon-button dialog-close" onClick={onClose} type="button" aria-label="关闭">
            <X size={19} />
          </button>
        </div>
      </div>

      <div className="dialog-summary">
        <div>
          <span>本周安排</span>
          <strong>{weekEntries.length} 项</strong>
        </div>
        <div>
          <span>关联信息</span>
          <strong>{relatedLabel}</strong>
        </div>
        <div>
          <span>涉及教室</span>
          <strong>{roomCount} 间</strong>
        </div>
      </div>

      <div className="entity-live-grid">
        <div className="entity-live-item">
          <Clock3 size={16} />
          <div>
            <span>当前定位</span>
            <strong>{selectedDay?.shortLabel} {selectedPeriodLabel}</strong>
            <small>{selectedEntriesForDisplay.length ? `${selectedEntriesForDisplay.length} 项安排` : "暂无安排"}</small>
          </div>
        </div>
        <div className="entity-live-item">
          <ArrowUpRight size={16} />
          <div>
            <span>{liveStatus?.currentEntries.length ? "正在上课" : "下一节课程"}</span>
            <strong>
              {liveStatus?.currentEntries[0]?.courseName || liveStatus?.nextEntry?.courseName || "当前周暂无后续课程"}
            </strong>
            <small>
              {liveStatus?.currentEntries.length
                ? "当前时间段"
                : liveStatus?.nextEntry
                  ? `${data.weekdays.find((day) => day.index === liveStatus.nextEntry.weekday)?.shortLabel ?? ""} · ${liveStatus.nextEntry.periodCode}`
                  : "请选择其他周次查看安排"}
            </small>
          </div>
        </div>
      </div>

      <div className="entity-filter-row">
        <div className="filter-title"><Filter size={15} /> 课表筛选</div>
        {entity.view !== "courses" ? (
          <SelectField
            className="entity-filter-field"
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
            className="entity-filter-field"
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
            className="entity-filter-field"
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

      <div className="schedule">
        <div className="schedule-head">
          <div className="schedule-corner">节次</div>
          {data.weekdays.map((day) => (
            <div className="schedule-day" key={day.index}>
              {day.shortLabel}
            </div>
          ))}
        </div>
        {data.timeSlots.map((slot) => (
          <div className="schedule-row" key={slot.code}>
            <div className="schedule-slot">
              <strong>{slot.label}</strong>
              <span>
                {slot.start} - {slot.end}
              </span>
            </div>
            {data.weekdays.map((day) => {
              const entries = detailEntries.filter((entry) => entry.weekday === day.index && entry.periodCode === slot.code);
              return (
                <div className={cn("schedule-cell", entries.length && "is-occupied")} key={`${day.index}-${slot.code}`}>
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
                    <span className="schedule-free">无课</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
