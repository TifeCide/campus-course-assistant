export function normalizeDirectoryQuery(value, view) {
  const normalized = String(value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  if (view === "teachers") return normalized.replace(/(?:老师|教授)$/u, "");
  if (view === "classes") return normalized.replace(/班$/u, "");
  return normalized;
}

function tokenizeClassDirectoryQuery(value) {
  return value.match(/[\u3400-\u9fff]|\d+|[a-z]/gu) ?? [];
}

function intersectSortedIds(left, right) {
  const result = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      result.push(left[leftIndex]);
      leftIndex += 1;
      rightIndex += 1;
    } else if (left[leftIndex] < right[rightIndex]) {
      leftIndex += 1;
    } else {
      rightIndex += 1;
    }
  }
  return result;
}

export function getDirectoryEntityIds(directoryData, common, view, query) {
  const key = view === "courses" ? "courses" : view === "teachers" ? "teachers" : "classes";
  const index = directoryData?.[key];
  const labels = common?.[key] ?? [];
  const normalizedQuery = normalizeDirectoryQuery(query, key);
  if (!index || !normalizedQuery) return [];

  const terms = key === "classes"
    ? tokenizeClassDirectoryQuery(normalizedQuery)
    : normalizedQuery.length > 1
    ? Array.from({ length: normalizedQuery.length - 1 }, (_, position) => normalizedQuery.slice(position, position + 2))
    : [normalizedQuery];
  if (!terms.length) return [];

  const termLists = terms.map((term) => index.terms?.[term]);
  if (key === "classes" && termLists.some((ids) => !Array.isArray(ids))) return [];

  const candidateLists = termLists
    .filter((ids) => Array.isArray(ids))
    .sort((left, right) => left.length - right.length);
  if (!candidateLists.length) return [];

  const candidates = candidateLists.reduce(intersectSortedIds);
  if (key === "classes") {
    return candidates.sort((left, right) => {
      const leftLabel = normalizeDirectoryQuery(labels[left], key);
      const rightLabel = normalizeDirectoryQuery(labels[right], key);
      const leftExact = leftLabel.includes(normalizedQuery) ? 1 : 0;
      const rightExact = rightLabel.includes(normalizedQuery) ? 1 : 0;
      return rightExact - leftExact || labels[left].localeCompare(labels[right], "zh-Hans-u-co-pinyin");
    });
  }

  return candidates.filter((id) => normalizeDirectoryQuery(labels[id], key).includes(normalizedQuery));
}
