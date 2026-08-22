import { LoaderCircle } from "lucide-react";
import { BrandMarkIcon } from "./icons";

/* 创建一个加载屏幕组件，显示加载进度和当前阶段信息。接受加载进度和当前阶段作为属性： */
export function LoadingScreen({ progress, stage, notice }) {
  return (
    <main className="load-state">
      <div className="loading-card">
        <div className="loading-card-head">
          <div className="brand-mark">
            <BrandMarkIcon />
          </div>
          <div>
            <strong>校园课程助手</strong>
            <span>正在准备数据 · 可能需要较长时间</span>
          </div>
          <LoaderCircle className="loader" size={18} />
        </div>
        <div className="loading-progress">
          <div className="loading-progress-track">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <strong>{Math.round(progress * 100)}%</strong>
        </div>
        <p className="loading-stage">{stage}</p>
        {notice ? (
          <p className="loading-notice" role="status">
            {notice}
          </p>
        ) : null}
        <div className="loading-skeleton-grid">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="loading-skeleton-list">
          <span />
          <span />
          <span />
        </div>
      </div>
    </main>
  );
}
