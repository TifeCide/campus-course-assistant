import { LoaderCircle } from "lucide-react";
import { BrandMarkIcon } from "./icons";

/* 创建一个加载屏幕组件，显示加载进度和当前阶段信息。接受加载进度和当前阶段作为属性： */
export function LoadingScreen({ progress, stage, notice }) {
  const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));

  return (
    <main className="grid min-h-dvh place-items-center bg-gray-50 px-4">
      <div className="w-full max-w-md animate-slide-up rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0">
            <BrandMarkIcon />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block text-sm font-semibold text-gray-900">校园课程助手</strong>
            <span className="block text-xs text-gray-500">正在准备数据 · 可能需要较长时间</span>
          </div>
          <LoaderCircle className="loader shrink-0 animate-spin text-primary-600" size={17} />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 flex-1 truncate text-gray-500">{stage}</span>
            <span className="shrink-0 font-semibold tabular-nums text-gray-800">{percent}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <span
              className="block h-full rounded-full bg-primary-600 transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {notice ? (
          <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-xs leading-relaxed text-warning-700" role="status">
            {notice}
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <span className="skeleton h-16 rounded-xl" />
          <span className="skeleton h-16 rounded-xl" />
          <span className="skeleton h-16 rounded-xl" />
          <span className="skeleton h-16 rounded-xl" />
        </div>
        <div className="mt-2.5 space-y-2.5">
          <span className="skeleton block h-10 rounded-xl" />
          <span className="skeleton block h-10 rounded-xl" />
          <span className="skeleton block h-10 rounded-xl" />
        </div>
      </div>
    </main>
  );
}
