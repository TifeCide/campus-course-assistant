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
export function SelectField({ label, value, onChange, options, icon: Icon, className = "", minWidth = 176 }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportWidth = window.innerWidth;
      const width = Math.min(viewportWidth - 24, Math.max(rect.width, minWidth));
      let offset = 0;
      if (rect.left + width > viewportWidth - 12) {
        offset = viewportWidth - 12 - width - rect.left;
      }
      offset = Math.max(offset, 12 - rect.left);

      setMenuStyle({
        width: width !== rect.width ? width : undefined,
        left: offset ? offset : undefined,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, minWidth]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className={cn("relative min-w-0", className)}>
      {label ? <span className="mb-1.5 block text-xs font-medium text-gray-500">{label}</span> : null}
      <div ref={rootRef} className="relative">
        <button
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-lg border bg-white px-3 text-sm shadow-xs transition-colors duration-150",
            open ? "border-primary-400 ring-4 ring-primary-500/10" : "border-gray-200 hover:border-gray-300",
          )}
          onClick={() => setOpen((current) => !current)}
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {Icon ? <Icon size={15} strokeWidth={1.8} className="shrink-0 text-gray-400" /> : null}
          <span className="min-w-0 flex-1 truncate text-left text-gray-700" title={selectedOption?.label}>
            {selectedOption?.label}
          </span>
          <ChevronDown
            size={15}
            className={cn("shrink-0 text-gray-400 transition-transform duration-150", open && "rotate-180")}
          />
        </button>
        {open ? (
          <div
            className="absolute z-20 mt-1.5 max-h-72 animate-dialog-in overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
            role="listbox"
            style={menuStyle ?? undefined}
          >
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-100",
                    selected ? "bg-primary-50 font-medium text-primary-700" : "text-gray-700 hover:bg-gray-50",
                  )}
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {selected ? <Check size={14} className="shrink-0 text-primary-600" /> : null}
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
export function MultiSelectField({ label, values, onChange, options, icon: Icon, placeholder = "全部", minWidth = 168 }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
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
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportWidth = window.innerWidth;
      const width = Math.min(viewportWidth - 24, Math.max(rect.width, minWidth));
      let offset = 0;
      if (rect.left + width > viewportWidth - 12) {
        offset = viewportWidth - 12 - width - rect.left;
      }
      offset = Math.max(offset, 12 - rect.left);

      setMenuStyle({
        width: width !== rect.width ? width : undefined,
        left: offset ? offset : undefined,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, minWidth]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="relative min-w-0">
      {label ? <span className="mb-1.5 block text-xs font-medium text-gray-500">{label}</span> : null}
      <div ref={rootRef} className="relative">
        <button
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-lg border bg-white px-3 text-sm shadow-xs transition-colors duration-150",
            open ? "border-primary-400 ring-4 ring-primary-500/10" : "border-gray-200 hover:border-gray-300",
          )}
          onClick={() => setOpen((value) => !value)}
          type="button"
          aria-expanded={open}
        >
          {Icon ? <Icon size={15} strokeWidth={1.8} className="shrink-0 text-gray-400" /> : null}
          <span className="min-w-0 flex-1 truncate text-left text-gray-700" title={displayText}>
            {displayText}
          </span>
          <ChevronDown
            size={15}
            className={cn("shrink-0 text-gray-400 transition-transform duration-150", open && "rotate-180")}
          />
        </button>
        {open ? (
          <div
            className="absolute z-20 mt-1.5 max-h-72 animate-dialog-in overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
            style={menuStyle ?? undefined}
          >
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-100",
                values.length === 0 ? "bg-primary-50 font-medium text-primary-700" : "text-gray-700 hover:bg-gray-50",
              )}
              onClick={() => onChange([])}
              type="button"
            >
              <span className="min-w-0 flex-1 truncate">{placeholder}</span>
              {values.length === 0 ? <Check size={14} className="shrink-0 text-primary-600" /> : null}
            </button>
            {options.map((option) => {
              const selected = selectedSet.has(option.value);
              return (
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 transition-colors duration-100 hover:bg-gray-50"
                  key={option.value}
                  onClick={() => toggleValue(option.value)}
                  type="button"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      selected ? "border-primary-600 bg-primary-600 text-white" : "border-gray-300",
                    )}
                  >
                    {selected ? <Check size={11} strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
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
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-gray-600">
      <button
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-2",
          checked ? "bg-primary-600" : "bg-gray-200 hover:bg-gray-300",
        )}
        onClick={() => onChange(!checked)}
        type="button"
        aria-pressed={checked}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150",
            checked && "translate-x-4",
          )}
        />
      </button>
      <span>{label}</span>
    </label>
  );
}

/* 创建一个统计卡片组件，显示图标、标签、数值和详细信息，并根据指定的色调渲染不同的样式。接受图标组件、标签文本、数值、详细信息和色调作为属性： */
const STAT_TONE_CLASSES = {
  blue: "bg-primary-50 text-primary-600",
  green: "bg-success-50 text-success-600",
  orange: "bg-warning-50 text-warning-600",
  slate: "bg-gray-100 text-gray-500",
};

export function StatCard({ icon: Icon, label, value, detail, tone = "blue" }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", STAT_TONE_CLASSES[tone])}>
        <Icon size={17} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <span className="block text-xs font-medium text-gray-500">{label}</span>
        <strong className="block truncate text-base font-semibold tracking-tight text-gray-900">{value}</strong>
        <small className="block truncate text-xs text-gray-400">{detail}</small>
      </div>
    </div>
  );
}

export function DetailBackButton({ canGoBack, depth, onBack }) {
  if (!canGoBack) return null;

  return (
    <button
      className="icon-btn relative"
      onClick={onBack}
      type="button"
      aria-label="返回上一层"
      title="返回上一层"
    >
      <ArrowLeft size={17} />
      {depth > 1 ? (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white">
          {depth}
        </span>
      ) : null}
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

/* 创建一个模态对话框组件，接受打开状态、打开状态变化回调、类名和子元素作为属性，并在按下 Escape 键时关闭对话框。使用 createPortal 将对话框渲染到 document.body 中。移动端默认全屏展示以充分利用屏幕空间： */
export function Modal({ open, onOpenChange, className, children, mobileFullscreen = true }) {
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

    const timeout = window.setTimeout(() => setVisible(false), 170);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!visible) return undefined;
    return lockPageScroll();
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-40 grid touch-auto place-items-center overflow-y-auto bg-gray-950/45 backdrop-blur-[3px]",
        mobileFullscreen ? "p-0 sm:p-6" : "p-4 sm:p-6",
        open ? "animate-fade-in" : "pointer-events-none animate-fade-out",
      )}
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        className={cn(
          "overflow-y-auto bg-white shadow-xl",
          mobileFullscreen
            ? "h-dvh max-h-none w-full rounded-none border-0 sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl sm:border sm:border-gray-200/80"
            : "max-h-[92dvh] w-full rounded-2xl border border-gray-200/80",
          open ? "animate-dialog-in" : "animate-dialog-out",
          className,
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
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
    <div className="w-full space-y-1">
      {visibleEntries.map((entry, index) => renderEntry(entry, index))}
      {hiddenCount > 0 ? (
        <button
          className="-ml-0.5 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-medium text-primary-600 transition-colors hover:bg-primary-50"
          onClick={() => setExpanded((value) => !value)}
          type="button"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              收起安排
              <ChevronUp size={12} />
            </>
          ) : (
            <>
              +{hiddenCount} 项安排
              <ChevronDown size={12} />
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

/* 创建一个空状态组件，根据是否存在查询条件显示不同的提示信息，并提供清除筛选或搜索的按钮。接受 hasQuery 和 onReset 作为属性： */
export function EmptyState({ hasQuery, onReset }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
        <DoorOpen size={22} strokeWidth={1.6} />
      </div>
      <h3 className="text-base font-semibold text-gray-900">
        {hasQuery ? "没有符合条件的教室" : "当前时段暂无符合条件的教室"}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500">
        {hasQuery
          ? "试试减少筛选条件，或切换楼栋、楼层和区域。"
          : "可以点击“现在”重新定位到当前日期与节次。"}
      </p>
      {hasQuery ? (
        <button className="btn-outline mt-5" onClick={onReset} type="button">
          清除筛选
        </button>
      ) : null}
    </div>
  );
}

/* 创建一个目录空状态组件，根据当前视图类型和是否存在查询条件显示不同的提示信息，并提供清除搜索的按钮。接受 view、hasQuery 和 onReset 作为属性： */
export function DirectoryEmptyState({ view, hasQuery, onReset }) {
  const label = view === "courses" ? "课程" : view === "teachers" ? "教师" : "班级";
  const Icon = view === "courses" ? BookOpen : view === "teachers" ? UserRound : Users;

  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
        <Icon size={22} strokeWidth={1.6} />
      </div>
      <h3 className="text-base font-semibold text-gray-900">
        {hasQuery ? `没有符合条件的${label}` : `输入${label}名称开始查询`}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500">
        {hasQuery ? "试试减少关键词，或调整地点筛选。" : `支持搜索${label}姓名或名称。`}
      </p>
      {hasQuery ? (
        <button className="btn-outline mt-5" onClick={onReset} type="button">
          清除搜索
        </button>
      ) : null}
    </div>
  );
}
