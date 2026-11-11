import { Game } from "./core/Game.js";
import { GameViewport } from "./utils/GameViewport.js";

const viewport = new GameViewport();
const game = new Game();

game.initialize().then(() => {
  viewport.initialize();
  document.documentElement.classList.remove("startup-loading");
}).catch((error) => {
  console.error(error);
  const loadingScreen = document.getElementById("loading-screen");
  const loadingLabel = document.getElementById("loading-label");
  const retryButton = document.getElementById("loading-retry-button");
  const titleScreen = document.getElementById("title-screen");
  if (titleScreen) titleScreen.hidden = true;
  if (loadingScreen) loadingScreen.hidden = false;
  if (loadingLabel) loadingLabel.textContent = "読み込みに失敗しました";
  if (retryButton) {
    retryButton.textContent = "再試行";
    retryButton.hidden = false;
  }
});
