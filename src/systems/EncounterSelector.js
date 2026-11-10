const STORAGE_KEY = "galgame8-found-anomalies-v1";

export class EncounterSelector {
  constructor({
    anomalyChance = 0.6,
    maxConsecutiveNormal = 3,
    rememberFoundAnomalies = true,
    repeatAfterAllFound = true
  } = {}) {
    this.anomalyChance = Math.max(0, Math.min(1, Number(anomalyChance) || 0));
    this.maxConsecutiveNormal = Math.max(1, Math.floor(Number(maxConsecutiveNormal) || 3));
    this.rememberFoundAnomalies = rememberFoundAnomalies !== false;
    this.repeatAfterAllFound = repeatAfterAllFound !== false;
    this.consecutiveNormal = 0;
    this.normalPath = null;
    this.allAnomalyPaths = new Set();
    this.foundAnomalyPaths = this.loadFoundAnomalies();
  }

  configure(scenarioIndex) {
    this.normalPath = scenarioIndex?.normal ?? null;
    this.allAnomalyPaths = new Set(scenarioIndex?.anomalies ?? []);
    for (const path of [...this.foundAnomalyPaths]) {
      if (!this.allAnomalyPaths.has(path)) this.foundAnomalyPaths.delete(path);
    }
    this.resetFoundPoolIfComplete();
    this.saveFoundAnomalies();
  }

  pick() {
    if (!this.normalPath) {
      throw new Error("scenario-index.json に共通の通常シナリオが登録されていません");
    }

    const allAnomalies = [...this.allAnomalyPaths];
    const undiscovered = allAnomalies.filter((path) => !this.foundAnomalyPaths.has(path));
    const anomalyCandidates = undiscovered.length > 0 ? undiscovered : allAnomalies;
    const forcedAnomaly = this.consecutiveNormal >= this.maxConsecutiveNormal;
    const chooseAnomaly = anomalyCandidates.length > 0 && (forcedAnomaly || Math.random() < this.anomalyChance);

    if (chooseAnomaly) {
      this.consecutiveNormal = 0;
      return anomalyCandidates[Math.floor(Math.random() * anomalyCandidates.length)];
    }

    this.consecutiveNormal += 1;
    return this.normalPath;
  }

  markAnomalyFound(scenarioPath) {
    if (!scenarioPath || !this.allAnomalyPaths.has(scenarioPath)) return;
    this.foundAnomalyPaths.add(scenarioPath);
    this.resetFoundPoolIfComplete();
    this.saveFoundAnomalies();
  }

  resetFoundPoolIfComplete() {
    if (
      this.repeatAfterAllFound &&
      this.allAnomalyPaths.size > 0 &&
      this.foundAnomalyPaths.size >= this.allAnomalyPaths.size
    ) {
      this.foundAnomalyPaths.clear();
    }
  }

  loadFoundAnomalies() {
    if (!this.rememberFoundAnomalies) return new Set();
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      return new Set(Array.isArray(stored) ? stored.filter((value) => typeof value === "string") : []);
    } catch {
      return new Set();
    }
  }

  saveFoundAnomalies() {
    if (!this.rememberFoundAnomalies) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.foundAnomalyPaths]));
    } catch {
      // Storage may be unavailable in private or restricted browsing contexts.
    }
  }
}
