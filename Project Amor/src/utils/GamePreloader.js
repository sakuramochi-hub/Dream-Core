function collectAssetPaths(value, paths = new Set()) {
  if (typeof value === "string") {
    const path = value.trim();
    if (path) paths.add(path);
    return paths;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAssetPaths(item, paths);
    return paths;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectAssetPaths(item, paths);
  }
  return paths;
}

function isImagePath(path, mimeType = "") {
  return mimeType.startsWith("image/") || /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(path);
}

async function decodeImage(source) {
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  if (typeof image.decode === "function") {
    await image.decode();
    return;
  }
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error(`画像をデコードできません: ${source}`));
  });
}

async function readResponseBlob(response, onProgress) {
  const contentLength = Number(response.headers.get("content-length"));
  if (!response.body?.getReader) {
    const blob = await response.blob();
    onProgress(0.88);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  onProgress(contentLength > 0 ? 0.02 : 0.1);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    if (contentLength > 0) onProgress(Math.min(0.88, (loaded / contentLength) * 0.88));
  }

  if (contentLength <= 0) onProgress(0.88);
  return new Blob(chunks, { type: response.headers.get("content-type") || "application/octet-stream" });
}

export class GamePreloader {
  constructor(manifestLoader, scenarioLoader) {
    this.manifestLoader = manifestLoader;
    this.scenarioLoader = scenarioLoader;
    this.completed = false;
  }

  getScenarioPaths(scenarioIndex) {
    return [...new Set([
      scenarioIndex?.normal,
      ...(Array.isArray(scenarioIndex?.anomalies) ? scenarioIndex.anomalies : [])
    ].filter((path) => typeof path === "string" && path.trim()))];
  }

  async preload({ scenarioIndex, onProgress = () => {} }) {
    if (this.completed) {
      onProgress(100);
      return;
    }

    const scenarioPaths = this.getScenarioPaths(scenarioIndex);
    const assetPaths = [...collectAssetPaths(this.manifestLoader.manifest?.assets)]
      .map((path) => new URL(path, this.manifestLoader.assetBase).href)
      .filter((path) => !this.manifestLoader.hasPreloadedAsset(path));
    const tasks = [
      ...scenarioPaths.map((path) => ({ type: "scenario", path })),
      ...assetPaths.map((path) => ({ type: "asset", path }))
    ];
    const progress = new Array(tasks.length).fill(0);
    const report = (index, value) => {
      progress[index] = Math.max(progress[index], Math.min(1, Math.max(0, Number(value) || 0)));
      const percent = tasks.length
        ? Math.floor(progress.reduce((sum, item) => sum + item, 0) / tasks.length * 100)
        : 100;
      onProgress(percent);
    };

    const failures = [];
    await Promise.all(tasks.map(async (task, index) => {
      try {
        if (task.type === "scenario") {
          await this.scenarioLoader.loadScenario(task.path);
          report(index, 1);
          return;
        }

        const response = await fetch(task.path, { cache: "force-cache" });
        if (!response.ok) throw new Error(`${task.path} (${response.status})`);
        const blob = await readResponseBlob(response, (value) => report(index, value));
        const objectUrl = URL.createObjectURL(blob);
        try {
          if (isImagePath(task.path, blob.type)) await decodeImage(objectUrl);
          this.manifestLoader.registerPreloadedAsset(task.path, objectUrl);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          throw error;
        }
        report(index, 1);
      } catch (error) {
        failures.push(error);
        report(index, 1);
      }
    }));

    if (failures.length) {
      const details = failures.map((error) => error?.message || String(error)).join("\n");
      throw new Error(`リソースを読み込めませんでした:\n${details}`);
    }

    this.completed = true;
    onProgress(100);
  }
}
