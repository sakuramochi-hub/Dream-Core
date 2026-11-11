import { parseScenarioScript } from "./ScenarioScript.js";

export class ScenarioLoader {
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
    const scenario = await this.loadScenarioFile(path);
    if (typeof scenario.hasAnomaly !== "boolean") {
      throw new Error(`${path}: 「異変：あり」または「異変：なし」を指定してください`);
    }
    if (!Array.isArray(scenario.script) || scenario.script.length === 0) {
      throw new Error(`${path}: シナリオ本文が空です`);
    }
    const endMarkers = scenario.script.filter((command) => command.type === "endScenario");
    const finalMarker = scenario.script.at(-1)?.type;
    if (endMarkers.length !== 1 || finalMarker !== "endScenario") {
      throw new Error(`${path}: シナリオの最後に「終了」が必要です`);
    }
    if (scenario.script.some((command) => command.type === "waitForJudgment")) {
      throw new Error(`${path}: waitForJudgment は使用できません`);
    }
    return scenario;
  }
}
