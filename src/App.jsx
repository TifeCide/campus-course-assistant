import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Bell,
  BookOpen,
  Building2,
  Check,
  CircleHelp,
  Clock3,
  Database,
  DoorOpen,
  Eye,
  EyeOff,
  Filter,
  Github,
  Heart,
  History,
  LayoutGrid,
  PanelTop,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  BUILD_TIME,
  GITHUB_USER,
  LOAD_RESOURCE_LABELS,
  RESOURCE_SOURCE_LABELS,
  SETTINGS_URLS,
  V2_MANIFEST_URLS,
  getOverallLoadProgress,
  getV2ResourceUrls,
} from "./config";
import {
  DEFAULT_MASK_MESSAGE,
  DEFAULT_PERIOD,
  DEFAULT_SETTINGS,
  DEFAULT_WEEK,
  DEFAULT_WEEKDAY,
} from "./constants";
import { clamp, cn, formatDateTime, getUniqueSorted, pad2 } from "./utils/misc";
import { fetchJsonFromUrls } from "./utils/fetch";
import { isNotificationTriggered, normalizeNotification } from "./utils/notifications";
import {
  getAutoTemporalState,
  getDateRange,
  getRoomDateValue,
  getShanghaiParts,
  getTemporalFromDate,
} from "./utils/datetime";
import { createInitialDataFromV2, createScheduleDataFromV2, hydrateRoomsWithSchedule } from "./utils/v2data";
import { getDirectoryEntityIds } from "./utils/directory";
import {
  areSameDetails,
  createQuerySnapshot,
  getQuerySnapshotFromUrl,
  getQueryUrl,
  getRecentQueryLabel,
  getViewLabel,
  getViewSearchLabel,
  normalizeDetailStack,
  normalizeView,
} from "./utils/query";
import { getRoomEntries, groupRoomsByBuildingAndFloor } from "./utils/rooms";
import { useClock } from "./hooks/useClock";
import { useFavorites } from "./hooks/useFavorites";
import { useRecentQueries } from "./hooks/useRecentQueries";

import { BrandMarkIcon, ShieldIcon } from "./components/icons";
import { LoadingScreen } from "./components/loading-screen";
import { CommandDialog } from "./components/command-dialog";
import {
  EntityScheduleDialog,
  SchedulePreviewPopover,
  getScheduleEntityValue,
  getScheduleSourceEntries,
} from "./components/entity-schedule";
import { NotificationCenter, NotificationCenterDialog } from "./components/notifications";
import { RoomDialog } from "./components/room-dialog";
import { PeriodPicker, TemporalPicker } from "./components/pickers";
import { EntityResultCard, RoomCard } from "./components/cards";
import {
  DirectoryEmptyState,
  EmptyState,
  Modal,
  MultiSelectField,
  StatCard,
  Toggle,
} from "./components/ui";

/*这个是应用程序的主组件. */
function App() {
  /*这一系列的状态变量用于管理应用程序的各种状态，包括数据、设置、加载进度、视图类型、筛选条件、命令面板等。它们使用 React 的 useState 钩子来创建和更新状态： */
  const isMac = typeof window !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const [data, setData] = useState(null);
  const [scheduleData, setScheduleData] = useState(null);
  const [directoryData, setDirectoryData] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [lazyLoadError, setLazyLoadError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStage, setLoadStage] = useState("正在准备数据...");
  const [loadNotice, setLoadNotice] = useState("");
  const [activeView, setActiveView] = useState("available");
  const [temporalMode, setTemporalMode] = useState("week");
  const [selectedWeek, setSelectedWeek] = useState(DEFAULT_WEEK);
  const [selectedWeekday, setSelectedWeekday] = useState(DEFAULT_WEEKDAY);
  const [selectedPeriods, setSelectedPeriods] = useState([DEFAULT_PERIOD]);
  const [periodSelectionMode, setPeriodSelectionMode] = useState("single");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [selectedFloors, setSelectedFloors] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [query, setQuery] = useState("");
  const [detailStack, setDetailStack] = useState([]);
  const [schedulePreview, setSchedulePreview] = useState(null);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [favorites, setFavorites] = useFavorites();
  const [recentQueries, saveRecentQuery] = useRecentQueries();
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [urlInitialized, setUrlInitialized] = useState(false);
  const autoInitialized = useRef(false);
  const currentNow = useClock();
  const dataRef = useRef(null);
  const manifestRef = useRef(null);
  const directoryRef = useRef(null);
  const scheduleRef = useRef(null);
  const detailStackRef = useRef([]);
  const directoryPromiseRef = useRef(null);
  const schedulePromiseRef = useRef(null);
  const currentDetail = detailStack[detailStack.length - 1] ?? null;
  const selectedRoom = currentDetail?.type === "room" ? { name: currentDetail.name } : null;
  const selectedEntity = currentDetail?.type === "entity" ? currentDetail : null;
  const canNavigateDetailBack = detailStack.length > 1;

/* 首屏只加载 v2 公共数据、教室和占用索引；目录和完整课表由后续交互按需读取。 */
  useEffect(() => {
    let cancelled = false;

    async function loadResources() {
      const sourceLabel = (index) => RESOURCE_SOURCE_LABELS[index] ?? `备用源 ${index + 1}`;
      const resourceProgresses = {
        manifest: 0,
        common: 0,
        rooms: 0,
        availability: 0,
        settings: 0,
      };
      let failed = false;

      const updateResourceProgress = (resourceKey, progress) => {
        resourceProgresses[resourceKey] = clamp(Number(progress) || 0, 0, 1);
        if (cancelled || failed) return;

        setLoadProgress(getOverallLoadProgress(resourceProgresses));
        const pendingStages = Object.entries(resourceProgresses)
          .filter(([, resourceProgress]) => resourceProgress < 1)
          .map(
            ([key, resourceProgress]) =>
              `${LOAD_RESOURCE_LABELS[key]} ${Math.round(resourceProgress * 100)}%`,
          );
        setLoadStage(
          pendingStages.length ? `正在加载：${pendingStages.join("、")}` : "正在处理数据...",
        );
      };

      const loadResource = (resourceKey, urls) =>
        fetchJsonFromUrls(urls, {
          onProgress: (progress) => updateResourceProgress(resourceKey, progress),
          onFallback: ({ sourceIndex, nextSourceIndex }) => {
            if (!cancelled && !failed) {
              setLoadNotice(
                `${LOAD_RESOURCE_LABELS[resourceKey]}：${sourceLabel(sourceIndex)} 加载失败，正在重试 ${sourceLabel(nextSourceIndex)}。`,
              );
            }
          },
        });

      try {
        setLoadNotice("");
        setLoadProgress(0);
        setLoadStage("正在加载：数据版本 0%、公共字典 0%、教室信息 0%、占用索引 0%、设置 0%");

        const manifestValue = await loadResource("manifest", V2_MANIFEST_URLS);
        const getManifestUrls = (key) => {
          const filePath = manifestValue?.files?.[key]?.path;
          if (!filePath) throw new Error(`v2 数据版本缺少 ${key} 文件`);
          return getV2ResourceUrls(filePath);
        };
        const [commonValue, roomsValue, availabilityValue, settingsValue] = await Promise.all([
          loadResource("common", getManifestUrls("common")),
          loadResource("rooms", getManifestUrls("rooms")),
          loadResource("availability", getManifestUrls("availability")),
          loadResource("settings", SETTINGS_URLS),
        ]);

        if (cancelled) return;
        const initialData = createInitialDataFromV2(commonValue, roomsValue, availabilityValue);
        manifestRef.current = manifestValue;
        dataRef.current = initialData;
        setData(initialData);
        setLoadNotice("");
        setLoadStage("正在初始化...");

        const rawMaskMessage = settingsValue?.maskMessage ?? {};
        const title =
          typeof rawMaskMessage.title === "string"
            ? rawMaskMessage.title
            : typeof rawMaskMessage.tittle === "string"
              ? rawMaskMessage.tittle
              : DEFAULT_MASK_MESSAGE.title;
        const text = typeof rawMaskMessage.text === "string" ? rawMaskMessage.text : DEFAULT_MASK_MESSAGE.text;

        setSettings({
          ...DEFAULT_SETTINGS,
          ...settingsValue,
          semesterStartDate:
            typeof settingsValue?.semesterStartDate === "string" ? settingsValue.semesterStartDate : "",
          semesterEndDate:
            typeof settingsValue?.semesterEndDate === "string" ? settingsValue.semesterEndDate : "",
          infoDisplay: Number(settingsValue?.infoDisplay ?? DEFAULT_SETTINGS.infoDisplay),
          defaultView: settingsValue?.defaultView === "courses" ? "courses" : "available",
          defaultOnlyAvailable: settingsValue?.defaultOnlyAvailable !== false,
          defaultPeriodMode: settingsValue?.defaultPeriodMode === "multiple" ? "multiple" : "single",
          searchResultLimit: Math.max(
            1,
            Number(settingsValue?.searchResultLimit) || DEFAULT_SETTINGS.searchResultLimit,
          ),
          enableCommandPalette: settingsValue?.enableCommandPalette !== false,
          enableBackToTop: settingsValue?.enableBackToTop !== false,
          stickyFilters: settingsValue?.stickyFilters !== false,
          notify: Array.isArray(settingsValue?.notify) ? settingsValue.notify : [],
          maskMessage: {
            title: title || DEFAULT_MASK_MESSAGE.title,
            text: text || DEFAULT_MASK_MESSAGE.text,
          },
        });
        setSettingsLoaded(true);
        setLoadProgress(1);
        setLoadStage("数据加载完成");
      } catch (error) {
        failed = true;
        if (cancelled) return;
        setLoadError(error.message);
        setSettingsError(error.message);
        setSettings(DEFAULT_SETTINGS);
        setSettingsLoaded(true);
      }
    }

    loadResources();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadV2Resource = useCallback(async (key) => {
    const filePath = manifestRef.current?.files?.[key]?.path;
    if (!filePath) throw new Error(`v2 数据版本缺少 ${key} 文件`);
    return fetchJsonFromUrls(getV2ResourceUrls(filePath), {
      onFallback: ({ sourceIndex, nextSourceIndex }) => {
        const sourceLabel = (index) => RESOURCE_SOURCE_LABELS[index] ?? `备用源 ${index + 1}`;
        setLoadNotice(`${key}：${sourceLabel(sourceIndex)} 加载失败，正在重试 ${sourceLabel(nextSourceIndex)}。`);
      },
    });
  }, []);

  const ensureDirectory = useCallback(async () => {
    if (directoryRef.current) return directoryRef.current;
    if (directoryPromiseRef.current) return directoryPromiseRef.current;

    directoryPromiseRef.current = loadV2Resource("directory")
      .then((value) => {
        directoryRef.current = value;
        setDirectoryData(value);
        return value;
      })
      .catch((error) => {
        setLazyLoadError(error.message);
        return null;
      })
      .finally(() => {
        directoryPromiseRef.current = null;
      });
    return directoryPromiseRef.current;
  }, [loadV2Resource]);

  const ensureSchedule = useCallback(async () => {
    if (scheduleRef.current) return scheduleRef.current;
    if (schedulePromiseRef.current) return schedulePromiseRef.current;

    setScheduleLoading(true);
    schedulePromiseRef.current = loadV2Resource("schedule")
      .then((value) => {
        const currentData = dataRef.current;
        if (!currentData) throw new Error("教室基础数据尚未准备完成");
        const nextScheduleData = createScheduleDataFromV2(value, currentData);
        const hydratedData = hydrateRoomsWithSchedule(currentData, nextScheduleData);
        scheduleRef.current = nextScheduleData;
        dataRef.current = hydratedData;
        setScheduleData(nextScheduleData);
        setData(hydratedData);
        return nextScheduleData;
      })
      .catch((error) => {
        setLazyLoadError(error.message);
        return null;
      })
      .finally(() => {
        setScheduleLoading(false);
        schedulePromiseRef.current = null;
      });
    return schedulePromiseRef.current;
  }, [loadV2Resource]);

  useEffect(() => {
    if (activeView !== "available") void ensureDirectory();
  }, [activeView, ensureDirectory]);

  useEffect(() => {
    if (selectedRoom || selectedEntity || commandOpen) {
      void ensureSchedule();
    }
    if (selectedEntity || commandOpen) {
      void ensureDirectory();
    }
  }, [commandOpen, ensureDirectory, ensureSchedule, selectedEntity, selectedRoom]);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [showResultsJump, setShowResultsJump] = useState(false);
  const queryPanelRef = useRef(null);
  const resultsSectionRef = useRef(null);

  /* 使用 useEffect 钩子在组件挂载时添加滚动事件监听器，计算滚动进度并更新状态变量 scrollProgress 和 showResultsJump。当组件卸载时，移除滚动事件监听器： */
  useEffect(() => {
    const handlePopState = (event) => {
      commitDetailStack(event.state?.detailStack ?? []);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const autoTemporal = useMemo(() => (data ? getAutoTemporalState(data, settings) : null), [data, settings]);
  const currentTime = useMemo(() => getShanghaiParts(currentNow), [currentNow]);
  const currentTemporal = useMemo(
    () => (data ? getAutoTemporalState(data, settings, currentNow) : null),
    [currentNow, data, settings],
  );
  const currentDateLabel = currentTime.dateLabel;
  const allNotifications = useMemo(
    () => (settings.notify ?? [])
      .map(normalizeNotification)
      .filter(Boolean)
      .sort((a, b) => a.notifyNo - b.notifyNo),
    [settings.notify],
  );
  const notifications = useMemo(
    () => allNotifications
      .filter((notification) => isNotificationTriggered(notification, currentNow))
      .sort((a, b) => a.notifyNo - b.notifyNo),
    [allNotifications, currentDateLabel],
  );
  const currentPhaseLabel = currentTemporal?.phase === "teaching"
    ? `第${currentTemporal.week}周`
    : currentTemporal?.phaseLabel || "";
  const currentDay = data?.weekdays.find((day) => day.index === currentTemporal?.weekday);

  const buildings = useMemo(() => getUniqueSorted(data?.rooms.map((room) => room.building) ?? []), [data]);
  const zones = useMemo(() => getUniqueSorted(data?.rooms.map((room) => room.zone) ?? []), [data]);

  /* 使用 useEffect 钩子在组件挂载时检查 URL 查询参数，并根据参数设置应用程序的状态。如果 URL 中包含共享状态，则使用共享状态更新视图、周次、星期几、节次、筛选条件等。如果 URL 中没有共享状态，则使用默认设置和自动计算的时间状态。设置 autoInitialized 和 urlInitialized 标志，以防止重复初始化： */
  useEffect(() => {
    if (!data || !settingsLoaded || urlInitialized) return;

    const params = new URLSearchParams(window.location.search);
    const hasSharedState = ["view", "mode", "week", "weekday", "date", "periods", "periodMode", "available", "buildings", "floors", "zones", "q", "entity"]
      .some((key) => params.has(key));
    const shared = getQuerySnapshotFromUrl(window.location.search);
    const validPeriods = shared.selectedPeriods.filter((code) => data.timeSlots.some((slot) => slot.code === code));
    const nextPeriods = validPeriods.length ? validPeriods : [DEFAULT_PERIOD];

    if (hasSharedState) {
      const validWeek = clamp(shared.selectedWeek, 1, data.summary.maxWeek);
      const validWeekday = clamp(shared.selectedWeekday, 1, data.weekdays.length);
      setActiveView(normalizeView(shared.activeView));
      setPeriodSelectionMode(shared.periodSelectionMode);
      setSelectedPeriods(shared.periodSelectionMode === "single" ? [nextPeriods[0]] : nextPeriods);
      setOnlyAvailable(shared.onlyAvailable);
      setSelectedBuildings(shared.selectedBuildings.filter((building) => buildings.includes(building)));
      setSelectedZones(shared.selectedZones.filter((zone) => zones.includes(zone)));

      const sharedTemporal = getTemporalFromDate(shared.selectedDate, settings.semesterStartDate, data.summary.maxWeek);
      if (shared.temporalMode === "date" && sharedTemporal) {
        setSelectedWeek(sharedTemporal.week);
        setSelectedWeekday(sharedTemporal.weekday);
        setTemporalMode("date");
      } else {
        setSelectedWeek(validWeek);
        setSelectedWeekday(validWeekday);
        setTemporalMode("week");
      }

      setQuery(shared.query);
      setSelectedFloors(shared.selectedFloors);
      if (shared.entityLabel) {
        const nextStack = normalizeDetailStack([{ type: "entity", view: shared.activeView, label: shared.entityLabel }]);
        detailStackRef.current = nextStack;
        setDetailStack(nextStack);
      }
    } else {
      const defaultMode = settings.defaultPeriodMode === "multiple" ? "multiple" : "single";
      setActiveView(settings.defaultView === "courses" ? "courses" : "available");
      setOnlyAvailable(settings.defaultOnlyAvailable !== false);
      setPeriodSelectionMode(defaultMode);
      setSelectedPeriods([autoTemporal.period]);
      setSelectedWeek(autoTemporal.week);
      setSelectedWeekday(autoTemporal.weekday);
    }

    autoInitialized.current = true;
    setUrlInitialized(true);
  }, [autoTemporal, data, settings, settingsLoaded, urlInitialized, buildings, zones]);

  const floors = useMemo(() => {
    const scope =
      selectedBuildings.length === 0
        ? data?.rooms ?? []
        : (data?.rooms ?? []).filter((room) => selectedBuildings.includes(room.building));
    return getUniqueSorted(scope.map((room) => room.floor));
  }, [data, selectedBuildings]);

  /* 使用 useEffect 钩子在 selectedFloors 或 floors 发生变化时，检查 selectedFloors 中的楼层是否仍然有效。如果 selectedFloors 中的某些楼层不再存在于 floors 中，则将其从 selectedFloors 中移除： */
  useEffect(() => {
    const nextFloors = selectedFloors.filter((floor) => floors.includes(floor));
    if (nextFloors.length !== selectedFloors.length) {
      setSelectedFloors(nextFloors);
    }
  }, [floors, selectedFloors]);

  useEffect(() => {
    if (!settings.enableCommandPalette) return undefined;

    const handleShortcut = (event) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [settings.enableCommandPalette]);

  /* 使用 useEffect 钩子在组件挂载时添加滚动和调整大小事件监听器，以便在用户滚动页面或调整窗口大小时更新滚动进度和“跳转到结果”按钮的显示状态。当组件卸载时，移除事件监听器： */
  useEffect(() => {
    const updateScrollProgress = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      setScrollProgress(Number.isFinite(progress) ? clamp(progress, 0, 1) : 0);

      const queryPanel = queryPanelRef.current;
      const resultsSection = resultsSectionRef.current;
      if (window.innerWidth <= 720 && queryPanel && resultsSection) {
        const queryRect = queryPanel.getBoundingClientRect();
        const resultsRect = resultsSection.getBoundingClientRect();
        setShowResultsJump(
          filtersVisible
          && queryRect.top <= window.innerHeight - 72
          && queryRect.bottom >= 72
          && resultsRect.top > window.innerHeight - 40,
        );
      } else {
        setShowResultsJump(false);
      }
    };

    updateScrollProgress();
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("resize", updateScrollProgress);
    return () => {
      window.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, [filtersVisible]);

  const filteredRooms = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();

    return data.rooms.filter((room) => {
      const matchesBuilding = selectedBuildings.length === 0 || selectedBuildings.includes(room.building);
      const matchesFloor = selectedFloors.length === 0 || selectedFloors.includes(room.floor);
      const matchesZone = selectedZones.length === 0 || selectedZones.includes(room.zone);
      const searchText = [room.name, room.building, room.zone, room.floor].join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || searchText.includes(normalizedQuery);
      return matchesBuilding && matchesFloor && matchesZone && matchesQuery;
    });
  }, [data, query, selectedBuildings, selectedFloors, selectedZones]);

  const availableRooms = useMemo(
    () =>
      filteredRooms.filter(
        (room) =>
          selectedPeriods.every(
            (periodCode) => getRoomEntries(room, selectedWeekday, periodCode, selectedWeek).length === 0,
          ),
      ),
    [filteredRooms, selectedPeriods, selectedWeek, selectedWeekday],
  );

  const roomByName = useMemo(() => new Map((data?.rooms ?? []).map((room) => [room.name, room])), [data]);
  const courseResults = useMemo(() => {
    if (!data || !scheduleData) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return (scheduleData.courseEntries ?? []).filter((entry) => {
      const room = roomByName.get(entry.roomName);
      if (!entry.courseName?.toLowerCase().includes(normalizedQuery)) return false;
      if (selectedBuildings.length && (!room || !selectedBuildings.includes(room.building))) return false;
      if (selectedFloors.length && (!room || !selectedFloors.includes(room.floor))) return false;
      if (selectedZones.length && (!room || !selectedZones.includes(room.zone))) return false;
      return true;
    }).map((entry) => ({ entry, room: roomByName.get(entry.roomName) }));
  }, [data, query, roomByName, scheduleData, selectedBuildings, selectedFloors, selectedZones]);

  const courseCards = useMemo(() => {
    const grouped = new Map();
    courseResults.forEach(({ entry }) => {
      if (!grouped.has(entry.courseName)) grouped.set(entry.courseName, []);
      grouped.get(entry.courseName).push(entry);
    });
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "zh-Hans-u-co-pinyin"))
      .map(([label, entries]) => ({ label, entries }));
  }, [courseResults]);

  const directoryResults = useMemo(() => {
    if (!scheduleData || !["courses", "teachers", "classes"].includes(activeView)) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    const sourceEntries = getScheduleSourceEntries(scheduleData, activeView);

    const grouped = new Map();
    sourceEntries.forEach((entry) => {
      const target = getScheduleEntityValue(entry, activeView);
      if (!target?.toLowerCase().includes(normalizedQuery)) return;

      const room = roomByName.get(entry.roomName);
      if (selectedBuildings.length && (!room || !selectedBuildings.includes(room.building))) return false;
      if (selectedFloors.length && (!room || !selectedFloors.includes(room.floor))) return false;
      if (selectedZones.length && (!room || !selectedZones.includes(room.zone))) return false;
      if (!grouped.has(target)) grouped.set(target, []);
      grouped.get(target).push(entry);
    });

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "zh-Hans-u-co-pinyin"))
      .map(([label, entries]) => ({ label, entries }));
  }, [activeView, query, roomByName, scheduleData, selectedBuildings, selectedFloors, selectedZones]);

  const hasLocationFilters = Boolean(selectedBuildings.length || selectedFloors.length || selectedZones.length);
  const lazyDirectoryResults = useMemo(() => {
    if (!data || !directoryData || scheduleData || hasLocationFilters) return [];
    if (!["courses", "teachers", "classes"].includes(activeView) || !query.trim()) return [];

    const key = activeView === "courses" ? "courses" : activeView === "teachers" ? "teachers" : "classes";
    const labels = data.v2Common?.[key] ?? [];
    const entityEvents = new Map((directoryData[key]?.entities ?? []).map(([id, eventIds]) => [id, eventIds]));
    return getDirectoryEntityIds(directoryData, data.v2Common, activeView, query)
      .map((id) => ({
        label: labels[id],
        entries: [],
        eventCount: entityEvents.get(id)?.length ?? 0,
      }))
      .filter((item) => Boolean(item.label));
  }, [activeView, data, directoryData, hasLocationFilters, query, scheduleData]);

  useEffect(() => {
    if (activeView !== "available" && hasLocationFilters) {
      void ensureSchedule();
    }
  }, [activeView, ensureSchedule, hasLocationFilters]);

  const visibleEntityCards = scheduleData
    ? activeView === "courses" ? courseCards : directoryResults
    : lazyDirectoryResults;
  const displayRooms = onlyAvailable ? availableRooms : filteredRooms;
  const roomGroups = useMemo(() => groupRoomsByBuildingAndFloor(displayRooms), [displayRooms]);
  const occupiedCount = filteredRooms.length - availableRooms.length;
  const activeDay = data?.weekdays.find((day) => day.index === Number(selectedWeekday));
  const activeSlots = data?.timeSlots.filter((slot) => selectedPeriods.includes(slot.code)) ?? [];
  const activePeriodLabel = activeSlots.map((slot) => slot.label).join("、");
  const selectedDate = data
    ? getRoomDateValue(selectedWeek, selectedWeekday, settings.semesterStartDate, getShanghaiParts().year)
    : "";
  const dateRange = useMemo(
    () => getDateRange(settings.semesterStartDate, data?.summary?.maxWeek ?? 18, getShanghaiParts().year),
    [data, settings.semesterStartDate],
  );
  const hasFilters = Boolean(query || selectedBuildings.length || selectedFloors.length || selectedZones.length);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const favoriteRooms = useMemo(
    () => (data?.rooms ?? []).filter((room) => favoriteSet.has(room.name)),
    [data, favoriteSet],
  );
  const querySnapshot = useMemo(
    () =>
      /* 创建一个查询快照对象，包含当前的视图、时间模式、选中的周次、星期几、日期、节次、节次选择模式、是否仅显示可用教室、选中的楼栋、楼层、区域和查询字符串，以及选中的实体标签： */
      createQuerySnapshot({
        activeView,
        temporalMode,
        selectedWeek,
        selectedWeekday,
        selectedDate,
        selectedPeriods,
        periodSelectionMode,
        onlyAvailable,
        selectedBuildings,
        selectedFloors,
        selectedZones,
        query,
        entityLabel: "",
      }),
    [
      activeView,
      temporalMode,
      selectedWeek,
      selectedWeekday,
      selectedDate,
      selectedPeriods,
      periodSelectionMode,
      onlyAvailable,
      selectedBuildings,
      selectedFloors,
      selectedZones,
      query,
    ],
  );

  useEffect(() => {
    if (!urlInitialized || !data) return;
    const currentState = window.history.state ?? {};
    window.history.replaceState(
      {
        ...currentState,
        detailDepth: detailStackRef.current.length,
        detailStack: detailStackRef.current,
      },
      "",
      getQueryUrl(querySnapshot),
    );
  }, [data, querySnapshot, urlInitialized]);

  useEffect(() => {
    if (!urlInitialized) return undefined;

    if (activeView !== "available") return undefined;

    const timer = window.setTimeout(() => {
      saveRecentQuery(querySnapshot);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [activeView, querySnapshot, saveRecentQuery, urlInitialized]);
  /*定义了几个函数来处理筛选器的重置、使用今天的日期、处理日期变化、处理节次模式变化、切换收藏教室、应用最近查询、保存最近查询、打开教室、切换视图、导航到实体、打开实体卡片和从实体打开教室等操作： */
  function resetFilters() {
    setQuery("");
    setSelectedBuildings([]);
    setSelectedFloors([]);
    setSelectedZones([]);
  }
  /*用于重置所有筛选器和状态，包括视图、时间模式、周次、星期几、节次、节次选择模式、是否仅显示可用教室、选中的实体和教室等。根据设置中的默认值和自动计算的时间状态来恢复初始状态： */
  function resetAllFilters() {
    const defaultMode = settings.defaultPeriodMode === "multiple" ? "multiple" : "single";
    const defaultTemporal = autoTemporal ?? {
      week: DEFAULT_WEEK,
      weekday: DEFAULT_WEEKDAY,
      period: DEFAULT_PERIOD,
    };

    setActiveView(settings.defaultView === "courses" ? "courses" : "available");
    setTemporalMode("week");
    setSelectedWeek(defaultTemporal.week);
    setSelectedWeekday(defaultTemporal.weekday);
    setSelectedPeriods([defaultTemporal.period]);
    setPeriodSelectionMode(defaultMode);
    setOnlyAvailable(settings.defaultOnlyAvailable !== false);
    clearDetails();
    resetFilters();
  }
  /*使用此函数可以将应用程序的状态设置为当前日期和时间对应的周次、星期几和节次。它会调用 getAutoTemporalState 函数来获取当前时间的自动计算状态，并更新相关的状态变量： */
  function useToday() {
    if (!data) return;
    const today = getAutoTemporalState(data, settings);
    setSelectedWeek(today.week);
    setSelectedWeekday(today.weekday);
    setSelectedPeriods([today.period]);
    setTemporalMode("date");
    setActiveView("available");
    clearDetails();
  }
  /*处理日期变化的函数 */
  function handleDateChange(value) {
    const temporal = getTemporalFromDate(value, settings.semesterStartDate, data.summary.maxWeek);
    if (!temporal) return;
    setSelectedWeek(temporal.week);
    setSelectedWeekday(temporal.weekday);
    setTemporalMode("date");
  }
  /*处理节次模式变化的函数 */
  function handlePeriodModeChange(mode) {
    setPeriodSelectionMode(mode);
    if (mode === "single" && selectedPeriods.length > 1) {
      setSelectedPeriods([selectedPeriods[0]]);
    }
  }
  /*切换收藏教室的函数 */
  function toggleFavorite(roomName) {
    setFavorites((current) =>
      current.includes(roomName)
        ? current.filter((name) => name !== roomName)
        : [...current, roomName],
    );
  }
  /*应用最近查询的函数 */
  function applyRecentQuery(snapshot) {
    if (!snapshot) return;
    setActiveView(normalizeView(snapshot.activeView));
    clearDetails();
    setTemporalMode(snapshot.temporalMode === "date" ? "date" : "week");
    setSelectedWeek(clamp(Number(snapshot.selectedWeek) || DEFAULT_WEEK, 1, data.summary.maxWeek));
    setSelectedWeekday(clamp(Number(snapshot.selectedWeekday) || DEFAULT_WEEKDAY, 1, data.weekdays.length));
    setSelectedPeriods(snapshot.selectedPeriods?.length ? snapshot.selectedPeriods : [DEFAULT_PERIOD]);
    setPeriodSelectionMode(snapshot.periodSelectionMode === "multiple" ? "multiple" : "single");
    setOnlyAvailable(snapshot.onlyAvailable !== false);
    setSelectedBuildings(snapshot.selectedBuildings ?? []);
    setSelectedFloors(snapshot.selectedFloors ?? []);
    setSelectedZones(snapshot.selectedZones ?? []);
    setQuery(snapshot.query ?? "");

    const dateTemporal = getTemporalFromDate(snapshot.selectedDate, settings.semesterStartDate, data.summary.maxWeek);
    if (snapshot.temporalMode === "date" && dateTemporal) {
      setSelectedWeek(dateTemporal.week);
      setSelectedWeekday(dateTemporal.weekday);
    }
    if (snapshot.entityLabel) {
      pushDetail({ type: "entity", view: normalizeView(snapshot.activeView), label: snapshot.entityLabel });
    }
  }

  function replaceDetailHistoryState(nextStack = detailStackRef.current) {
    const currentState = window.history.state ?? {};
    window.history.replaceState(
      {
        ...currentState,
        detailDepth: nextStack.length,
        detailStack: nextStack,
      },
      "",
      window.location.href,
    );
  }

  function commitDetailStack(nextStack) {
    const normalized = normalizeDetailStack(nextStack);
    detailStackRef.current = normalized;
    setDetailStack(normalized);
    return normalized;
  }

  function pushDetail(detail) {
    const [normalizedDetail] = normalizeDetailStack([detail]);
    if (!normalizedDetail) return;
    const currentStack = detailStackRef.current;
    const previousDetail = currentStack[currentStack.length - 1];
    if (areSameDetails(previousDetail, normalizedDetail)) return;

    const nextStack = commitDetailStack([...currentStack, normalizedDetail]);
    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        detailDepth: nextStack.length,
        detailStack: nextStack,
      },
      "",
      window.location.href,
    );
  }

  function goBackDetail() {
    if (detailStackRef.current.length <= 1) return;
    closeSchedulePreview();
    window.history.back();
  }

  function clearDetails() {
    if (!detailStackRef.current.length) return;
    closeSchedulePreview();
    const nextStack = commitDetailStack([]);
    replaceDetailHistoryState(nextStack);
  }

  function closeSchedulePreview() {
    setSchedulePreview(null);
  }

  function previewScheduleEntry(entry, anchorElement) {
    if (!entry || !anchorElement) return;
    setSchedulePreview({
      entry,
      anchorRect: anchorElement.getBoundingClientRect(),
    });
  }

  /* 打开教室的函数 */
  function openRoom(room) {
    if (!room?.name) return;
    closeSchedulePreview();
    pushDetail({ type: "room", name: room.name });
    setCommandOpen(false);
    void ensureSchedule();
  }
  /* 切换视图的函数 */
  function changeView(view) {
    setActiveView(normalizeView(view));
    setQuery("");
    clearDetails();
  }
  /* 导航到实体的函数 */
  function navigateToEntity(view, label) {
    if (!label) return;
    closeSchedulePreview();
    const nextView = normalizeView(view);
    pushDetail({ type: "entity", view: nextView, label });
    setCommandOpen(false);
    void ensureDirectory();
    void ensureSchedule();
  }
  /* 打开实体卡片的函数 */
  function openEntityCard(view, label) {
    if (!label) return;
    void ensureSchedule();
    const nextView = normalizeView(view);
    saveRecentQuery({
      ...querySnapshot,
      activeView: nextView,
      query: label,
      entityLabel: label,
    });
    pushDetail({ type: "entity", view: nextView, label });
  }
  /* 从实体打开教室的函数 */
  function openRoomFromEntity(room) {
    openRoom(room);
  }

  function handleBrandClick(event) {
    event.preventDefault();
    closeSchedulePreview();
    resetAllFilters();
    setFiltersVisible(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  /*如果加载数据时发生错误，则显示一个加载失败的界面，提示用户数据加载失败，并提供重新加载按钮和联系开发者的链接： */
  if (loadError) {
    return (
      <main className="load-state">
        <div className="load-card">
          <CircleHelp size={30} />
          <h1>数据加载失败</h1>
          <p>{loadError}.<br />如多次出现此问题，请<a href={`https://github.com/${GITHUB_USER}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>联系开发者</a>。
          </p>
          <button className="button button-primary" onClick={() => window.location.reload()} type="button">
            重新加载
          </button>
        </div>
      </main>
    );
  }
  /*如果数据尚未加载完成或设置尚未加载完成，则显示一个加载屏幕组件，显示当前的加载进度和阶段信息： */
  if (!data || !settingsLoaded) {
    return <LoadingScreen progress={loadProgress} stage={loadStage} notice={loadNotice} />;
  }
  /*如果数据和设置都已加载完成，则渲染应用程序的主界面，包括顶部栏、主内容区域、通知中心、筛选栏等。根据当前的状态变量，显示不同的视图和组件： */
  return (
    <div className="app-shell">
      <header className="topbar">
            <button className="brand" onClick={handleBrandClick} type="button" aria-label="返回首页并重置筛选">
          <div className="brand-mark">
            <BrandMarkIcon />
          </div>
          <div>
            <strong>校园课程助手</strong>
            <span>ZSC</span>
          </div>
        </button>
        <div className="topbar-actions">
          {settings.enableCommandPalette ? (
            <button className="button button-outline topbar-command" onClick={() => setCommandOpen(true)} type="button">
              <Search size={15} />
              <span>搜索</span>
              <kbd>{isMac ? "⌘ K" : "Ctrl + K"}</kbd>
            </button>
          ) : null}
          <button
            className="icon-button notification-center-button"
            onClick={() => setNotificationCenterOpen(true)}
            type="button"
            aria-label="打开通知中心"
            title="通知中心"
          >
            <Bell size={18} />
          </button>
        </div>
      </header>

      <main className="page-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={14} /> 校园课程助手
            </div>
            <h1>
              查课程
              <br />
              <em>看课表</em>，找教室
            </h1>
            <p>课程、教师、班级与教室，一站式查询。</p>
            <div className="hero-meta" aria-label="更新时间">
              <div className="hero-meta-item">
                <Clock3 size={15} />
                <span>助手更新时间</span>
                <time dateTime={BUILD_TIME}>{formatDateTime(BUILD_TIME)}</time>
              </div>
              <div className="hero-meta-item">
                <Database size={15} />
                <span>数据更新时间</span>
                <time dateTime={data.generatedAt}>{formatDateTime(data.generatedAt)}</time>
              </div>
            </div>
          </div>
          <div className="hero-note">
            <span>现在是</span>
            <strong>
              {currentPhaseLabel} {currentDay?.shortLabel ?? ""}
            </strong>
            <span>
              {currentTime
                ? `${pad2(currentTime.month)}月${pad2(currentTime.day)}日 ${pad2(currentTime.hour)}:${pad2(currentTime.minute)}`
                : ""}
            </span>
          </div>
        </section>

        <NotificationCenter notifications={notifications} />

        {filtersVisible ? (
          <section ref={queryPanelRef} className={cn("query-panel", settings.stickyFilters && "is-sticky")}>
          <div className="panel-topline">
            <div className="view-tabs">
              <button
                className={cn("view-tab", activeView === "available" && "is-active")}
                onClick={() => changeView("available")}
                type="button"
              >
                <LayoutGrid size={16} />
                教室
              </button>
              <button
                className={cn("view-tab", activeView === "courses" && "is-active")}
                onClick={() => changeView("courses")}
                type="button"
              >
                <BookOpen size={16} />
                课程
              </button>
              <button
                className={cn("view-tab", activeView === "teachers" && "is-active")}
                onClick={() => changeView("teachers")}
                type="button"
              >
                <UserRound size={16} />
                教师
              </button>
              <button
                className={cn("view-tab", activeView === "classes" && "is-active")}
                onClick={() => changeView("classes")}
                type="button"
              >
                <Users size={16} />
                班级
              </button>
            </div>
            <div className="panel-actions">
              <button
                className="button button-outline filter-visibility-button"
                onClick={() => setFiltersVisible(false)}
                type="button"
                aria-label="隐藏筛选栏"
                title="隐藏筛选栏"
              >
                <EyeOff size={16} />
                隐藏筛选
              </button>
            </div>
          </div>

          <div className={cn("query-fields", activeView !== "available" && "is-directory-query") }>
            {activeView === "available" ? (
              <>
                <TemporalPicker
                  onToday={useToday}
                  mode={temporalMode}
                  onModeChange={setTemporalMode}
                  selectedWeek={selectedWeek}
                  selectedWeekday={selectedWeekday}
                  selectedDate={selectedDate}
                  onWeekChange={(value) => {
                    setSelectedWeek(value);
                    setTemporalMode("week");
                  }}
                  onWeekdayChange={(value) => {
                    setSelectedWeekday(value);
                    setTemporalMode("week");
                  }}
                  onDateChange={handleDateChange}
                  weekdays={data.weekdays}
                  maxWeek={data.summary.maxWeek}
                  dateRange={dateRange}
                />
                <PeriodPicker
                  timeSlots={data.timeSlots}
                  selectedPeriods={selectedPeriods}
                  selectionMode={periodSelectionMode}
                  onModeChange={handlePeriodModeChange}
                  onChange={setSelectedPeriods}
                />
              </>
            ) : null}
            <label className="search-field">
              <span className="field-label">{getViewSearchLabel(activeView)}</span>
              <span className="search-input-wrap">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    activeView === "available"
                      ? "输入教室号或楼栋..."
                      : activeView === "courses"
                        ? "例如：高等数学、张老师、计算机..."
                        : activeView === "teachers"
                          ? "例如：张老师、王教授..."
                          : "例如：电科23A、26计科AB...(可能需要尝试不同的关键词)"
                  }
                />
                {query ? (
                  <button className="clear-search" onClick={() => setQuery("")} type="button" aria-label="清空搜索">
                    <X size={15} />
                  </button>
                ) : null}
              </span>
            </label>
          </div>

          <div className="filter-row">
            <div className="filter-title">
              <SlidersHorizontal size={15} /> 地点筛选
            </div>
            <MultiSelectField
              label="楼栋"
              values={selectedBuildings}
              onChange={setSelectedBuildings}
              icon={Building2}
              placeholder="全部楼栋"
              options={buildings.map((building) => ({ value: building, label: building }))}
            />
            <MultiSelectField
              label="楼层"
              values={selectedFloors}
              onChange={setSelectedFloors}
              placeholder="全部楼层"
              options={floors.map((floor) => ({ value: floor, label: `${floor} 层` }))}
            />
            <MultiSelectField
              label="区域"
              values={selectedZones}
              onChange={setSelectedZones}
              placeholder="全部区域"
              options={zones.map((zone) => ({ value: zone, label: zone.replace("普通教学区", "教学区") }))}
            />
            {activeView === "available" ? (
              <Toggle checked={onlyAvailable} onChange={setOnlyAvailable} label="仅显示空闲" />
            ) : null}
            {hasFilters ? (
              <button className="button button-outline reset-button" onClick={resetFilters} type="button">
                重置筛选
              </button>
            ) : null}
          </div>
          <div className="query-panel-footer">
            <button className="button button-outline reset-all-button" onClick={resetAllFilters} type="button">
              重置全部筛选规则
            </button>
          </div>
          </section>
        ) : (
          <div ref={queryPanelRef} className={cn("filter-collapsed-bar", settings.stickyFilters && "is-sticky")}>
            <span>
              <PanelTop size={15} />
              筛选栏已隐藏
            </span>
            <button className="button button-outline" onClick={() => setFiltersVisible(true)} type="button">
              <Eye size={14} />
              显示筛选
            </button>
          </div>
        )}

        {favoriteRooms.length ? (
          <section className="favorite-strip" aria-label="收藏教室">
            <div className="favorite-strip-title">
              <Heart size={15} fill="currentColor" />
              收藏教室
            </div>
            <div className="favorite-room-list">
              {favoriteRooms.map((room) => (
                <button className="favorite-room-chip" key={room.name} onClick={() => openRoom(room)} type="button">
                  <span>{room.name}</span>
                  <small>{room.building} · {room.floor}层</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {recentQueries.length ? (
          <section className="recent-query-strip" aria-label="最近查看">
            <div className="recent-query-title">
              <History size={15} />
              最近查看
            </div>
            <div className="recent-query-list">
              {recentQueries.map((snapshot, index) => (
                <button
                  className="recent-query-chip"
                  key={`${JSON.stringify(snapshot)}-${index}`}
                  onClick={() => applyRecentQuery(snapshot)}
                  type="button"
                  title={getRecentQueryLabel(snapshot, data)}
                >
                  {getRecentQueryLabel(snapshot, data)}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section ref={resultsSectionRef} className={cn("results-section", settings.infoDisplay === 0 && "is-masked")}>
          <div className="results-content">
            <div className="results-heading">
            <div>
              <div className="section-kicker">
                <span className="live-pulse" />
                {activeView === "available" ? `实时${onlyAvailable ? "可用" : ""}情况` : `${getViewLabel(activeView)}结果`}
              </div>
              <h2>
                {activeView === "available"
                  ? `${activeDay?.shortLabel} ${activePeriodLabel} 的${onlyAvailable ? "空闲" : "全部"}教室`
                  : query
                    ? `“${query}”的检索结果`
                    : "输入关键词开始检索"}
              </h2>
              <p>
                {activeView === "available"
                  ? `第 ${selectedWeek} 周 · ${activeSlots.length ? `${activeSlots[0].start} - ${activeSlots[activeSlots.length - 1].end}` : ""}`
                  : query
                    ? activeView === "courses"
                      ? "已忽略周次、星期和节次，点击课程卡片查看完整周课表"
                      : activeView === "teachers"
                        ? "已忽略周次、星期和节次，点击教师卡片查看完整周课表"
                        : "已忽略周次、星期和节次，点击班级卡片查看完整周课表"
                    : activeView === "courses"
                      ? "搜索课程名称"
                      : `搜索${activeView === "teachers" ? "教师姓名" : "行政班名称"}`}
              </p>
            </div>
            {activeView === "available" ? (
              <div className="results-count">
                <strong>{displayRooms.length}</strong>
                <span>/ {filteredRooms.length} 间{onlyAvailable ? "空闲" : ""}</span>
              </div>
            ) : null}
            </div>

            {activeView === "available" ? (
              <>
                <div className="stats-grid">
                  <StatCard icon={DoorOpen} label={onlyAvailable ? "空闲教室" : "匹配教室"} value={displayRooms.length} detail="当前筛选范围内" tone="green" />
                  <StatCard icon={Building2} label="涉及楼栋" value={new Set(displayRooms.map((room) => room.building)).size} detail={`共 ${buildings.length} 栋`} tone="blue" />
                  <StatCard icon={Clock3} label="当前时段" value={activePeriodLabel} detail={selectedPeriods.length > 1 ? "多节次筛选" : `${activeSlots[0]?.start ?? ""} - ${activeSlots[0]?.end ?? ""}`} tone="orange" />
                  <StatCard icon={Filter} label="已占用" value={occupiedCount} detail="当前筛选范围内" tone="slate" />
                </div>

                {roomGroups.length ? (
                  <div className="building-groups">
                    {roomGroups.map((buildingGroup) => (
                      <section className="building-group" key={buildingGroup.building}>
                        <div className="group-heading">
                          <div className="group-title">
                            <span className="building-icon">
                              <Building2 size={16} />
                            </span>
                            <strong>{buildingGroup.building}</strong>
                            <span>{buildingGroup.total} 间{onlyAvailable ? "空闲" : "匹配"}</span>
                          </div>
                          <span className="group-line" />
                        </div>

                        {buildingGroup.floors.map((floorGroup) => (
                          <div className="floor-group" key={`${buildingGroup.building}-${floorGroup.floor}`}>
                            <div className="floor-heading">
                              <span className="floor-chip">{floorGroup.floor} 层</span>
                              <span>{floorGroup.rooms.length} 间</span>
                            </div>
                            <div className="room-grid">
                              {floorGroup.rooms.map((room) => (
                                <RoomCard
                                  key={room.name}
                                  room={room}
                                  onOpen={openRoom}
                                  selectedWeek={selectedWeek}
                                  selectedWeekday={selectedWeekday}
                                  selectedPeriods={selectedPeriods}
                                  isFavorite={favoriteSet.has(room.name)}
                                  onToggleFavorite={toggleFavorite}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                ) : (
                  <EmptyState hasQuery={hasFilters} onReset={resetFilters} />
                )}
              </>
            ) : (
              <div className="course-results">
                {visibleEntityCards.length ? (
                  visibleEntityCards.slice(0, settings.searchResultLimit).map(({ label, entries, eventCount }) => (
                    <EntityResultCard
                      key={label}
                      view={activeView}
                      label={label}
                      entries={entries}
                      eventCount={eventCount}
                      onOpen={openEntityCard}
                    />
                  ))
                ) : (
                  <DirectoryEmptyState view={activeView} hasQuery={Boolean(query)} onReset={() => setQuery("")} />
                )}
                {visibleEntityCards.length > settings.searchResultLimit ? (
                  <p className="result-limit">
                    结果较多，仅展示前 {settings.searchResultLimit} 条，请继续缩小搜索范围。
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {settings.infoDisplay === 0 ? (
            <div className="results-mask" aria-hidden="true">
              <div className="results-mask-card">
                <ShieldIcon />
                <strong>{settings.maskMessage?.title || DEFAULT_MASK_MESSAGE.title}</strong>
                <span>{settings.maskMessage?.text || DEFAULT_MASK_MESSAGE.text}</span>
              </div>
            </div>
          ) : null}
        </section>
      </main>


      <footer className="footer">
        <div className="footer-row">
          <span>数据更新于 {formatDateTime(data.generatedAt)}</span>
        </div>

        <div className="footer-row">
          <a
          href="https://github.com/TifeCide" target="_blank" rel="noopener noreferrer" className="footer-link"><
          Github size={16} />
          <span>TifeCide</span>
          </a>
        </div>

        <div className="footer-row footer-powered">
          <p>Powered by Cloudflare Pages 51LA</p>
        </div>
      </footer>

      <Modal open={Boolean(selectedRoom || (selectedEntity && scheduleData))} onOpenChange={clearDetails} className="dialog dialog-room">
        {selectedRoom ? (
          <RoomDialog
            room={roomByName.get(selectedRoom.name) ?? selectedRoom}
            data={data}
            selectedWeek={selectedWeek}
            selectedWeekday={selectedWeekday}
            selectedPeriods={selectedPeriods}
            onClose={clearDetails}
            onBack={goBackDetail}
            canGoBack={canNavigateDetailBack}
            backDepth={Math.max(0, detailStack.length - 1)}
            isFavorite={favoriteSet.has(selectedRoom.name)}
            onToggleFavorite={toggleFavorite}
            onNavigate={navigateToEntity}
            onPreviewEntry={previewScheduleEntry}
            scheduleReady={Boolean(scheduleData)}
            scheduleError={lazyLoadError}
          />
        ) : null}
        {selectedEntity ? (
          <EntityScheduleDialog
            entity={selectedEntity}
            scheduleData={scheduleData}
            data={data}
            selectedWeek={selectedWeek}
            selectedWeekday={selectedWeekday}
            selectedPeriods={selectedPeriods}
            currentNow={currentNow}
            currentTemporal={currentTemporal}
            maxWeek={data.summary.maxWeek}
            roomByName={roomByName}
            onClose={clearDetails}
            onBack={goBackDetail}
            canGoBack={canNavigateDetailBack}
            backDepth={Math.max(0, detailStack.length - 1)}
            onWeekChange={(week) => {
              setSelectedWeek(clamp(week, 1, data.summary.maxWeek));
              setTemporalMode("week");
            }}
            onFilterChange={(key, value) => {
              commitDetailStack(
                detailStackRef.current.map((item, index) =>
                  index === detailStackRef.current.length - 1 && item.type === "entity"
                    ? { ...item, [key]: value }
                    : item,
                ),
              );
              replaceDetailHistoryState();
            }}
            onNavigate={navigateToEntity}
            onOpenRoom={openRoomFromEntity}
            onPreviewEntry={previewScheduleEntry}
          />
        ) : null}
      </Modal>

      <SchedulePreviewPopover
        preview={schedulePreview}
        onClose={closeSchedulePreview}
        onNavigate={navigateToEntity}
      />

      <NotificationCenterDialog
        open={notificationCenterOpen}
        notifications={allNotifications}
        onClose={() => setNotificationCenterOpen(false)}
      />

      {settings.enableCommandPalette ? (
        <CommandDialog
          open={commandOpen}
          onOpenChange={setCommandOpen}
          data={data}
          commandQuery={commandQuery}
          setCommandQuery={setCommandQuery}
          onPickRoom={openRoom}
          availableRooms={availableRooms}
          courseResults={courseResults}
        />
      ) : null}

      {settings.enableBackToTop ? (
        <button
          className={cn("back-to-top", scrollProgress > 0.08 && "is-visible")}
          type="button"
          aria-label="回到顶部"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ "--scroll-progress": `${Math.round(scrollProgress * 100)}%` }}
        >
          <span className="back-to-top-ring" aria-hidden="true">
            <span className="back-to-top-core">
              <ArrowUp size={16} className="back-to-top-arrow" />
            </span>
          </span>
        </button>
      ) : null}

      <button
        className={cn("back-to-top results-jump", showResultsJump && "is-visible")}
        type="button"
        aria-label="查看查询结果"
        title="查看查询结果"
        onClick={() => resultsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
      >
        <span className="back-to-top-ring" aria-hidden="true">
          <span className="back-to-top-core">
            <Check size={16} className="results-check" />
          </span>
        </span>
      </button>
    </div>
  );
}

/*定义了一个 AppErrorBoundary 组件，用于捕获应用程序中的错误，并显示一个错误界面： */
export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="load-state">
          <div className="load-card">
            <CircleHelp size={30} />
            <h1>页面运行异常</h1>
            <p>{this.state.error.message}</p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

/*定义了一个 App 组件，它是应用程序的根组件，负责加载数据和设置，并渲染 AppContent 组件： */
export default App;
