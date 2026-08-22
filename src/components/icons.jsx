import { Sparkles } from "lucide-react";

export function BrandMarkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%" aria-hidden="true" focusable="false">
      <rect x="32" y="32" width="448" height="448" rx="100" fill="#1769e0" />
      <g fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round">
        <path d="M160 128V160" strokeWidth="28" />
        <path d="M352 128V160" strokeWidth="28" />
        <rect x="112" y="144" width="288" height="256" rx="32" strokeWidth="28" />
        <path d="M112 216H400" strokeWidth="24" opacity="0.9" />
        <circle cx="184" cy="272" r="14" fill="#FFFFFF" stroke="none" />
        <circle cx="256" cy="272" r="14" fill="#FFFFFF" stroke="none" opacity="0.4" />
        <circle cx="328" cy="272" r="14" fill="#FFFFFF" stroke="none" />
        <circle cx="184" cy="336" r="14" fill="#FFFFFF" stroke="none" opacity="0.4" />
        <circle cx="256" cy="336" r="16" fill="#7DD3FC" stroke="none" />
        <circle cx="328" cy="336" r="14" fill="#FFFFFF" stroke="none" opacity="0.4" />
      </g>
    </svg>
  );
}

/*定义了一个 ShieldIcon 组件，用于在结果遮罩中显示一个闪烁的图标： */
export function ShieldIcon() {
  return (
    <div className="results-mask-icon">
      <Sparkles size={18} />
    </div>
  );
}
