/* 异步函数，用于从指定的 URL 获取 JSON 数据，并在下载过程中提供进度回调。如果响应不包含内容长度或流式读取不可用，则直接解析 JSON；否则，使用流式读取并计算下载进度，最终返回解析后的 JSON 对象： */
async function fetchJsonWithProgress(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`加载失败：${url}`);

  if (!response.body || !response.headers.get("content-length")) {
    const value = await response.json();
    onProgress?.(1);
    return value;
  }

  const total = Number(response.headers.get("content-length"));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    text += decoder.decode(value, { stream: true });
    onProgress?.(Math.min(received / total, 0.98));
  }

  text += decoder.decode();
  const value = JSON.parse(text);
  onProgress?.(1);
  return value;
}

export async function fetchJsonFromUrls(urls, { onProgress, onFallback } = {}) {
  let lastError = null;
  let highestProgress = 0;

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    try {
      return await fetchJsonWithProgress(url, (progress) => {
        highestProgress = Math.max(highestProgress, progress);
        onProgress?.(highestProgress);
      });
    } catch (error) {
      lastError = error;
      if (index < urls.length - 1) {
        onFallback?.({
          sourceIndex: index,
          nextSourceIndex: index + 1,
          url,
          nextUrl: urls[index + 1],
          error,
        });
      }
    }
  }

  throw lastError ?? new Error("加载失败");
}
