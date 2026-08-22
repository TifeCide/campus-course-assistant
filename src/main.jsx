/*导入的模块包括 React、ReactDOM 的 createRoot 方法、App 组件和 AppErrorBoundary 组件，以及样式文件 styles.css。然后使用 createRoot 方法将应用程序渲染到 HTML 中 id 为 "root" 的元素中，并使用 StrictMode 包裹整个应用程序，以启用严格模式检查。AppErrorBoundary 用于捕获应用程序中的错误，并显示一个错误界面。 */
import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App, { AppErrorBoundary } from "./App";
import "./styles/tokens.css";

/*将应用程序渲染到 HTML 中 id 为 "root" 的元素中 */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
