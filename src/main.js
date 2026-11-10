import { Game } from "./core/Game.js";
import { GameViewport } from "./utils/GameViewport.js";

new GameViewport().initialize();

const game = new Game();
game.initialize().catch(async (error) => {
  console.error(error);
  let config = {};
  try {
    const response = await fetch("data/game.json", { cache: "no-store" });
    if (response.ok) config = await response.json();
  } catch {}
  const uiText = config.uiText || {};
  const title = document.getElementById("title-screen-title");
  const startButton = document.getElementById("start-button");
  const gameTitle = document.getElementById("game-title");
  const screen = document.getElementById("title-screen");
  if (title) title.textContent = uiText.loadErrorTitle ?? "読み込みエラー";
  if (startButton) startButton.textContent = uiText.reloadStartButton ?? "再読み込みして開始";
  if (gameTitle && config.title) gameTitle.textContent = config.title;
  if (config.title) document.title = config.title;
  if (screen) screen.hidden = false;
});
