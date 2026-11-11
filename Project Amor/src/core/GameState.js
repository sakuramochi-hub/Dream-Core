export class GameState {
  constructor() {
    this.phase = "title";
    this.progress = 0;
    this.totalLoops = 8;
    this.attemptCount = 0;
    this.activeScenario = null;
  }

  beginNewGame(totalLoops) {
    this.phase = "opening";
    this.progress = 0;
    this.totalLoops = totalLoops;
    this.attemptCount = 1;
    this.activeScenario = null;
  }

  beginLoop() {
    this.phase = "loop";
    this.progress = 0;
    this.activeScenario = null;
  }

  setScenario(scenario) {
    this.activeScenario = scenario;
  }

  advance() {
    this.progress += 1;
  }

  resetAfterFailure() {
    this.progress = 0;
    this.activeScenario = null;
    this.attemptCount += 1;
    this.phase = "loop";
  }

  beginEnding() {
    this.phase = "ending";
    this.activeScenario = null;
  }

  finish() {
    this.phase = "clear";
  }

  returnToTitle() {
    this.phase = "title";
    this.progress = 0;
    this.attemptCount = 0;
    this.activeScenario = null;
  }
}
