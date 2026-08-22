import { clamp } from "./utils/misc";

/*使用不同的资源源可以提高访问速度和稳定性，尤其是在不同地区的用户访问时： */
const GITHUB_USER = 'TifeCide';
const GITHUB_REPO = 'campus-course-assistant';
const RESOURCE_SOURCES = {
  /* Cloudflare Pages */
  CF: import.meta.env.BASE_URL,

  /*JsDelivr CDN */
  JSD:
    `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@main/public/`,

  /* GitHub Pages */
  GHP:
    `https://tifecide.github.io/${GITHUB_REPO}/`,
};
const RESOURCE_SOURCE_LABELS = ["Cloudflare Pages", "JsDelivr CDN", "GitHub Pages"];

const SETTINGS_URLS = [
  `${RESOURCE_SOURCES.CF}data/setting.json`,
  `${RESOURCE_SOURCES.JSD}data/setting.json`,
  `${RESOURCE_SOURCES.GHP}data/setting.json`,
];

function getV2ResourceUrls(filePath) {
  return [
    `${RESOURCE_SOURCES.CF}${filePath}`,
    `${RESOURCE_SOURCES.JSD}${filePath}`,
    `${RESOURCE_SOURCES.GHP}${filePath}`,
  ];
}

const V2_MANIFEST_URLS = getV2ResourceUrls("data/v2/manifest.json");

/* 按 v2 首屏资源大小估算整体加载进度。课程目录和完整课表会在需要时再加载。 */
const LOAD_RESOURCE_SIZE_ESTIMATES = {
  manifest: 1_000,
  common: 50_000,
  rooms: 23_000,
  availability: 127_000,
  settings: 1_295,
};
const LOAD_TOTAL_SIZE = Object.values(LOAD_RESOURCE_SIZE_ESTIMATES).reduce((sum, size) => sum + size, 0);
const LOAD_RESOURCE_LABELS = {
  manifest: "数据版本",
  common: "公共字典",
  rooms: "教室信息",
  availability: "占用索引",
  settings: "设置",
};

function getOverallLoadProgress(resourceProgresses) {
  const loadedSize = Object.entries(LOAD_RESOURCE_SIZE_ESTIMATES).reduce(
    (total, [resourceKey, resourceSize]) =>
      total + resourceSize * clamp(Number(resourceProgresses[resourceKey]) || 0, 0, 1),
    0,
  );
  return clamp(loadedSize / LOAD_TOTAL_SIZE, 0, 1);
}

const BUILD_TIME = __BUILD_TIME__;

export {
  GITHUB_USER,
  RESOURCE_SOURCE_LABELS,
  SETTINGS_URLS,
  getV2ResourceUrls,
  V2_MANIFEST_URLS,
  LOAD_RESOURCE_LABELS,
  getOverallLoadProgress,
  BUILD_TIME,
};
