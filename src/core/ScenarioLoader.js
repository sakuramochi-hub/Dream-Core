import { parseScenarioScript } from "./ScenarioScript.js";

export class ScenarioLoader {
  constructor() {
    this.scenarioCache = new Map();
    this.scenarioLoads = new Map();
  }

  async loadJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} を読み込めませんでした (${response.status})`);
    return response.json();
  }

  async loadScenarioFile(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} を読み込めませんでした (${response.status})`);
    if (url.toLowerCase().endsWith(".g8s")) {
      const source = await response.text();
      try {
        return parseScenarioScript(source, { source: url });
      } catch (error) {
        throw new Error(`${url}: ${error.message}`);
      }
    }
    return response.json();
  }

  async loadGameConfig() {
    return this.loadJson("data/game.json");
  }

  async loadDebugMode() {
    const mode = await this.loadJson("debug_mode.json");
    if (typeof mode.enabled !== "boolean") {
      throw new Error("debug_mode.json: enabled は true または false で指定してください");
    }
    return mode;
  }

  async loadOpening(path) {
    return this.loadScenarioFile(path);
  }

  async loadEnding(path) {
    return this.loadScenarioFile(path);
  }

  async loadScenarioIndex(path) {
    return this.loadJson(path);
  }

  async loadScenario(path) {
    const cacheKey = String(path ?? "").trim();
    if (!cacheKey) throw new Error("シナリオのパスが指定されていません");

    if (this.scenarioCache.has(cacheKey)) return this.scenarioCache.get(cacheKey);
    if (this.scenarioLoads.has(cacheKey)) return this.scenarioLoads.get(cacheKey);

    const loading = (async () => {
      const scenario = await this.loadScenarioFile(cacheKey);
      if (typeof scenario.hasAnomaly !== "boolean") {
        throw new Error(`${cacheKey}: 「異変：あり」または「異変：なし」を指定してください`);
      }
      if (!Array.isArray(scenario.script) || scenario.script.length === 0) {
        throw new Error(`${cacheKey}: シナリオ本文が空です`);
      }
      const endMarkers = scenario.script.filter((command) => command.type === "endScenario");
      const finalMarker = scenario.script.at(-1)?.type;
      if (endMarkers.length !== 1 || finalMarker !== "endScenario") {
        throw new Error(`${cacheKey}: シナリオの最後に「終了」が必要です`);
      }
      if (scenario.script.some((command) => command.type === "waitForJudgment")) {
        throw new Error(`${cacheKey}: waitForJudgment は使用できません`);
      }

      this.scenarioCache.set(cacheKey, scenario);
      return scenario;
    })();

    this.scenarioLoads.set(cacheKey, loading);
    try {
      return await loading;
    } finally {
      this.scenarioLoads.delete(cacheKey);
    }
  }
}
