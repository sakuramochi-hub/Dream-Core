export class LoopSystem {
  constructor({ state, scenarioLoader, encounterSelector }) {
    this.state = state;
    this.scenarioLoader = scenarioLoader;
    this.encounterSelector = encounterSelector;
  }

  async loadNextEncounter() {
    const scenarioPath = this.encounterSelector.pick();
    const scenario = await this.scenarioLoader.loadScenario(scenarioPath);
    scenario.sourcePath = scenarioPath;
    this.state.setScenario(scenario);
    return scenario;
  }

  isComplete() {
    return this.state.progress >= this.state.totalLoops;
  }
}
