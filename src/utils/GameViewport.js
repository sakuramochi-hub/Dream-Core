const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

export class GameViewport {
  constructor(shell = document.getElementById("game"), canvas = document.getElementById("game-canvas")) {
    this.shell = shell;
    this.canvas = canvas;
    this.resizeObserver = null;
    this.update = this.update.bind(this);
  }

  initialize() {
    if (!this.shell || !this.canvas) {
      throw new Error("ゲーム画面の表示領域を初期化できません");
    }

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.update);
      this.resizeObserver.observe(this.shell);
    } else {
      window.addEventListener("resize", this.update, { passive: true });
    }

    this.update();
  }

  update() {
    const width = this.shell.clientWidth || document.documentElement.clientWidth;
    const height = this.shell.clientHeight || document.documentElement.clientHeight;
    if (!width || !height) return;

    const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    this.canvas.style.setProperty("--game-scale", String(scale));
    this.canvas.classList.add("viewport-ready");
  }
}
