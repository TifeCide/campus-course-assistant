import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "../utils/misc";

/* 创建一个选择字段组件，接受标签、值、选项和图标作为属性，并在值变化时调用回调函数。渲染一个带有标签和下拉选择框的表单字段，如果提供了图标，则在选择框前显示图标： */
export function SelectField({ label, value, onChange, options, icon: Icon, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className={cn("field", "single-select-field", className)}>
      <span className="field-label">{label}</span>
      <div className="multi-select-root" ref={rootRef}>
        <button
          className={cn("multi-select-trigger", "single-select-trigger", open && "is-open")}
          onClick={() => setOpen((current) => !current)}
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {Icon ? <Icon size={16} strokeWidth={1.8} /> : null}
          <span title={selectedOption?.label}>{selectedOption?.label}</span>
          <ChevronDown className="select-chevron" size={15} />
        </button>
        {open ? (
          <div className="multi-select-menu single-select-menu" role="listbox">
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  className={cn("multi-select-option", selected && "is-selected")}
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                >
                  <span className="check-box">{selected ? <Check size={13} /> : null}</span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* 创建一个多选字段组件，接受标签、值、选项和图标作为属性，并在值变化时调用回调函数。渲染一个带有标签和下拉菜单的表单字段，允许用户选择多个选项，并在选择框中显示已选择的标签。如果提供了图标，则在选择框前显示图标： */
export function MultiSelectField({ label, values, onChange, options, icon: Icon, placeholder = "全部" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedSet = new Set(values);
  const selectedLabels = options
    .filter((option) => selectedSet.has(option.value))
    .map((option) => option.label);
  const displayText = selectedLabels.length ? selectedLabels.join("、") : placeholder;

  function toggleValue(value) {
    if (selectedSet.has(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  }

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="field multi-select-field">
      <span className="field-label">{label}</span>
      <div className="multi-select-root" ref={rootRef}>
        <button
          className={cn("multi-select-trigger", open && "is-open")}
          onClick={() => setOpen((value) => !value)}
          type="button"
          aria-expanded={open}
        >
          {Icon ? <Icon size={16} strokeWidth={1.8} /> : null}
          <span title={displayText}>{displayText}</span>
          <ChevronDown className="select-chevron" size={15} />
        </button>
        {open ? (
          <div className="multi-select-menu">
            <button className={cn("multi-select-option", values.length === 0 && "is-selected")} onClick={() => onChange([])} type="button">
              <span className="check-box">{values.length === 0 ? <Check size={13} /> : null}</span>
              <span>{placeholder}</span>
            </button>
            {options.map((option) => {
              const selected = selectedSet.has(option.value);
              return (
                <button className={cn("multi-select-option", selected && "is-selected")} key={option.value} onClick={() => toggleValue(option.value)} type="button">
                  <span className="check-box">{selected ? <Check size={13} /> : null}</span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* 创建一个切换开关组件，接受选中状态、变化回调和标签作为属性，并在点击时切换选中状态。渲染一个带有标签和按钮的切换开关，如果选中则显示为激活状态： */
export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle-control">
      <button
        className={cn("toggle-track", checked && "is-checked")}
        onClick={() => onChange(!checked)}
        type="button"
        aria-pressed={checked}
      >
        <span />
      </button>
      <span>{label}</span>
    </label>
  );
}

/* 创建一个统计卡片组件，显示图标、标签、数值和详细信息，并根据指定的色调渲染不同的样式。接受图标组件、标签文本、数值、详细信息和色调作为属性： */
export function StatCard({ icon: Icon, label, value, detail, tone = "blue" }) {
  return (
    <div className="stat-card">
      <div className={cn("stat-icon", `stat-icon-${tone}`)}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

export function DetailBackButton({ canGoBack, depth, onBack }) {
  if (!canGoBack) return null;

  return (
    <button className="icon-button detail-back-button" onClick={onBack} type="button" aria-label="返回上一层" title="返回上一层">
      <ArrowLeft size={18} />
      {depth > 1 ? <span className="detail-back-depth">{depth}</span> : null}
    </button>
  );
}

let modalScrollLockCount = 0;
let modalScrollLockState = null;

export function lockPageScroll() {
  const body = document.body;

  if (modalScrollLockCount === 0) {
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    modalScrollLockState = {
      scrollY,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  }

  modalScrollLockCount += 1;

  return () => {
    modalScrollLockCount = Math.max(0, modalScrollLockCount - 1);
    if (modalScrollLockCount !== 0 || !modalScrollLockState) return;

    const { scrollY, ...styles } = modalScrollLockState;
    Object.assign(body.style, styles);
    modalScrollLockState = null;
    window.scrollTo(0, scrollY);
  };
}

/* 创建一个模态对话框组件，接受打开状态、打开状态变化回调、类名和子元素作为属性，并在按下 Escape 键时关闭对话框。使用 createPortal 将对话框渲染到 document.body 中 */
export function Modal({ open, onOpenChange, className, children }) {
  const [visible, setVisible] = useState(open);
  const lastChildrenRef = useRef(children);

  if (open) {
    lastChildrenRef.current = children;
  }

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      return undefined;
    }

    const timeout = window.setTimeout(() => setVisible(false), 180);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!visible) return undefined;
    return lockPageScroll();
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <div className={cn("overlay", !open && "is-closing")} onMouseDown={() => onOpenChange(false)}>
      <div className={cn(className, !open && "is-closing")} onMouseDown={(event) => event.stopPropagation()}>
        {open ? children : lastChildrenRef.current}
      </div>
    </div>,
    document.body,
  );
}

/* 创建一个可展开的课程安排条目组件，显示课程安排的列表，并在超过指定数量时提供展开和收起的按钮。接受课程条目列表、折叠数量和渲染函数作为属性： */
export function ExpandableScheduleEntries({ entries, collapsedCount = 2, renderEntry }) {
  const [expanded, setExpanded] = useState(false);
  const visibleEntries = expanded ? entries : entries.slice(0, collapsedCount);
  const hiddenCount = Math.max(0, entries.length - collapsedCount);

  return (
    <div className="schedule-entry-list">
      {visibleEntries.map((entry, index) => renderEntry(entry, index))}
      {hiddenCount > 0 ? (
        <button
          className="schedule-more"
          onClick={() => setExpanded((value) => !value)}
          type="button"
          aria-expanded={expanded}
        >
          {expanded ? "收起安排" : `+${hiddenCount} 项安排`}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      ) : null}
    </div>
  );
}

/* 创建一个空状态组件，根据是否存在查询条件显示不同的提示信息，并提供清除筛选或搜索的按钮。接受 hasQuery 和 onReset 作为属性： */
export function EmptyState({ hasQuery, onReset }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        <DoorOpen size={28} strokeWidth={1.5} />
      </div>
      <h3>{hasQuery ? "没有符合条件的教室" : "当前时段暂无符合条件的教室"}</h3>
      <p>
        {hasQuery
          ? "试试减少筛选条件，或切换楼栋、楼层和区域。"
          : "可以点击“现在”重新定位到当前日期与节次。"}
      </p>
      {hasQuery ? (
        <button className="button button-outline" onClick={onReset} type="button">
          清除筛选
        </button>
      ) : null}
    </div>
  );
}

/* 创建一个目录空状态组件，根据当前视图类型和是否存在查询条件显示不同的提示信息，并提供清除搜索的按钮。接受 view、hasQuery 和 onReset 作为属性： */
export function DirectoryEmptyState({ view, hasQuery, onReset }) {
  const label = view === "courses" ? "课程" : view === "teachers" ? "教师" : "班级";
  return (
    <div className="empty-state">
      <div className="empty-mark">
        {view === "courses" ? <BookOpen size={28} strokeWidth={1.5} /> : view === "teachers" ? <UserRound size={28} strokeWidth={1.5} /> : <Users size={28} strokeWidth={1.5} />}
      </div>
      <h3>{hasQuery ? `没有符合条件的${label}` : `输入${label}名称开始查询`}</h3>
      <p>{hasQuery ? "试试减少关键词，或调整地点筛选。" : `支持搜索${label}姓名或名称。`}</p>
      {hasQuery ? (
        <button className="button button-outline" onClick={onReset} type="button">
          清除搜索
        </button>
      ) : null}
    </div>
  );
}
