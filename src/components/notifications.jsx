import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "../utils/misc";
import {
  dismissNotificationPersistently,
  getDismissedNotificationKeys,
} from "../utils/notifications";
import { Modal } from "./ui";

/* 创建一个通知图标组件，根据通知类型（错误、警告或信息）渲染不同的图标，并接受图标大小作为属性： */
export function NotificationIcon({ type, size = 18 }) {
  const Icon = type === "error" || type === "warning" ? TriangleAlert : Info;
  return <Icon size={size} />;
}

/* 创建一个通知表面组件，显示通知的标题、文本和剩余时间，并在一定时间后自动关闭。接受通知对象、是否为移动设备和关闭回调函数作为属性： */
export function NotificationSurface({ notification, isMobile, onDismiss }) {
  const [remaining, setRemaining] = useState(5);
  const [closing, setClosing] = useState(false);
  const dismissRef = useRef(onDismiss);
  const closingRef = useRef(false);

  dismissRef.current = onDismiss;

  useEffect(() => {
    closingRef.current = false;
    setClosing(false);
    setRemaining(7);
  }, [notification.notificationKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setClosing(true);
    }, 7000);
    const countdown = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(countdown);
    };
  }, [isMobile, notification.notificationKey]);

  useEffect(() => {
    if (!closing) return undefined;
    const timer = window.setTimeout(() => dismissRef.current(), 180);
    return () => window.clearTimeout(timer);
  }, [closing]);
  /* 请求关闭通知，如果已经在关闭过程中，则不执行任何操作。根据设备类型（移动设备或非移动设备）调用相应的关闭方法： */
  function requestDismiss() {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
  }

  /* 渲染通知内容，包括图标、标题、文本和剩余时间。如果是移动设备，则显示一个关闭按钮，否则显示一个图标按钮。根据通知类型和关闭状态应用不同的样式类名： */
  const content = (
    <article className={cn("notification-surface", `notification-${notification.notifyType}`, closing && "is-closing")} role="alert">
      <div className="notification-icon" aria-hidden="true">
        <NotificationIcon type={notification.notifyType} />
      </div>
      <div className="notification-copy">
        <strong>{notification.notifyTitle}</strong>
        <p>{notification.notifyText}</p>
        <small>{remaining > 0 ? `${remaining} 秒后自动关闭` : "正在关闭"}</small>
      </div>
      {isMobile ? (
        <div className="notification-actions">
          <button className="button button-outline notification-mobile-close" onClick={requestDismiss} type="button">
            关闭
          </button>
        </div>
      ) : (
        <button className="icon-button notification-close" onClick={requestDismiss} type="button" aria-label="关闭通知" title="关闭通知">
          <X size={16} />
        </button>
      )}
    </article>
  );
  /* 根据设备类型（移动设备或非移动设备）渲染通知内容。如果是移动设备，则使用模态对话框显示通知，否则将通知内容渲染到 document.body 中的一个固定位置： */
  if (isMobile) {
    return (
      <Modal open onOpenChange={requestDismiss} className="dialog notification-dialog">
        {content}
      </Modal>
    );
  }

  return createPortal(<div className="notification-toast-viewport">{content}</div>, document.body);
}

/* 创建一个通知中心对话框组件，显示所有通知的列表，并提供关闭按钮。接受打开状态、通知列表和关闭回调函数作为属性： */
export function NotificationCenterDialog({ open, notifications, onClose }) {
  return (
    <Modal open={open} onOpenChange={onClose} className="dialog notification-center-dialog">
      <div className="dialog-header notification-center-header">
        <div>
          <div className="eyebrow">
            <Bell size={14} /> 通知中心
          </div>
          <h2>全部通知</h2>
          <p>共 {notifications.length} 条通知</p>
        </div>
        <button className="icon-button dialog-close" onClick={onClose} type="button" aria-label="关闭通知中心" title="关闭通知中心">
          <X size={19} />
        </button>
      </div>

      {notifications.length ? (
        <div className="notification-center-list">
          {notifications.map((notification) => (
            <article className={cn("notification-center-item", `notification-${notification.notifyType}`)} key={notification.notificationKey}>
              <div className="notification-icon" aria-hidden="true">
                <NotificationIcon type={notification.notifyType} size={18} />
              </div>
              <div className="notification-copy">
                <strong>{notification.notifyTitle}</strong>
                <p>{notification.notifyText}</p>
                <small>
                  {notification.notifyStartDate} 至 {notification.notifyEndDate}
                </small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="notification-center-empty">
          <Bell size={24} />
          <span>暂无配置通知</span>
        </div>
      )}
    </Modal>
  );
}

/* 创建一个居民通知组件，显示所有居民通知的列表，并根据通知类型应用不同的样式。接受通知列表作为属性： */
function ResidentNotifications({ notifications }) {
  return (
    <div className={cn("resident-notifications", notifications.length > 0 && "has-notifications")} aria-live="polite">
      <div className="resident-notification-list">
        {notifications.map((notification) => (
          <article className={cn("resident-notification", `notification-${notification.notifyType}`)} key={notification.notificationKey} role="status">
            <div className="notification-icon" aria-hidden="true">
              <NotificationIcon type={notification.notifyType} size={17} />
            </div>
            <div className="notification-copy">
              <strong>{notification.notifyTitle}</strong>
              <p>{notification.notifyText}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* 创建一个通知中心组件，管理通知队列和当前显示的通知，并根据设备类型（移动设备或非移动设备）渲染通知表面和居民通知。接受通知列表作为属性： */
export function NotificationCenter({ notifications }) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches);
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [residentNotifications, setResidentNotifications] = useState([]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const handleChange = (event) => setIsMobile(event.matches);
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    const dismissed = getDismissedNotificationKeys();
    setQueue(notifications.filter((notification) => !dismissed.has(notification.notificationKey)));
    setCurrent(null);
    setResidentNotifications(
      notifications
        .filter((notification) => notification.notifyTwice && dismissed.has(notification.notificationKey))
        .sort((a, b) => a.notifyNo - b.notifyNo),
    );
  }, [notifications]);

  useEffect(() => {
    if (current || !queue.length) return;
    setCurrent(queue[0]);
  }, [current, queue]);
  /* 定义一个函数，用于持久化地关闭当前通知。首先检查是否存在当前通知，如果不存在则直接返回。然后调用 `dismissNotificationPersistently` 函数将当前通知的键添加到已关闭通知的集合中。如果当前通知设置了 `notifyTwice` 属性，则将其添加到居民通知列表中，并按 `notifyNo` 属性进行排序。最后，从队列中移除当前通知，并将 `current` 状态设置为 `null`： */
  function dismissCurrent() {
    if (!current) return;

    dismissNotificationPersistently(current.notificationKey);
    if (current.notifyTwice) {
      setResidentNotifications((items) => (
        items.some((item) => item.notificationKey === current.notificationKey)
          ? items
          : [...items, current].sort((a, b) => a.notifyNo - b.notifyNo)
      ));
    }
    setQueue((items) => items.slice(1));
    setCurrent(null);
  }

  return (
    <>
      {current ? <NotificationSurface notification={current} isMobile={isMobile} onDismiss={dismissCurrent} /> : null}
      <ResidentNotifications notifications={residentNotifications} />
    </>
  );
}
