function splitCharacters(value) {
  const text = String(value ?? "");
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (item) => item.segment);
  }
  return Array.from(text);
}

function createEndIndicator() {
  const indicator = document.createElement("span");
  indicator.className = "dialogue-end-indicator";
  indicator.setAttribute("aria-hidden", "true");
  indicator.hidden = true;

  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 14 16");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("d", "M3 2.5 L11 8 L3 13.5 Z");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.4");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  indicator.append(svg);
  return indicator;
}

export class DialogueBox {
  constructor({
    panel,
    clickSurface = panel,
    speaker,
    text,
    sceneTag,
    judgmentPanel,
    getCharacterInterval = () => 40,
    playbackClock
  }) {
    this.panel = panel;
    this.clickSurface = clickSurface || panel;
    this.judgmentPanel = judgmentPanel || null;
    this.judgmentEnabled = false;
    this.speaker = speaker;
    this.text = text;
    this.sceneTag = sceneTag;
    this.getCharacterInterval = getCharacterInterval;
    this.playbackClock = playbackClock;
    this.pendingResolve = null;
    this.nextLineGate = null;
    this.textStartWait = null;
    this.lineReady = false;
    this.typing = false;
    this.typingWait = null;
    this.typingToken = 0;
    this.characters = [];
    this.characterIndex = 0;
    this.textNode = document.createTextNode("");
    this.endIndicator = createEndIndicator();

    this.clickSurface.addEventListener("click", (event) => {
      const interactiveTarget = event.target?.closest?.(
        "button, input, select, textarea, a, [role='button'], [contenteditable='true']"
      );
      if (interactiveTarget) return;
      this.advance();
    });
  }

  stopTyping() {
    this.typingToken += 1;
    this.typingWait?.cancel?.();
    this.typingWait = null;
    this.typing = false;
    this.characters = [];
    this.characterIndex = 0;
  }

  scrollTextToEnd() {
    this.text.scrollTop = this.text.scrollHeight;
  }

  setLine({ speaker = "", text = "", tag = "STORY" }, { instant = false, deferVisibility = false } = {}) {
    this.stopTyping();
    this.textStartWait?.cancel?.();
    this.textStartWait = null;
    this.lineReady = Boolean(instant);
    this.panel.style.removeProperty("opacity");
    this.speaker.textContent = speaker;
    this.textNode = document.createTextNode(instant ? String(text ?? "") : "");
    this.endIndicator.hidden = !instant;
    this.text.replaceChildren(this.textNode, this.endIndicator);
    this.sceneTag.textContent = tag;
    this.text.scrollTop = 0;
    this.panel.hidden = Boolean(deferVisibility);
    this.syncJudgmentVisibility();
  }

  holdNextLine({ textDelayMs = 0 } = {}) {
    const delay = Number.isFinite(Number(textDelayMs))
      ? Math.max(0, Math.min(10000, Math.round(Number(textDelayMs))))
      : 0;
    this.nextLineGate = { released: false, textDelayMs: delay, start: null };
  }

  releaseHeldLine() {
    const gate = this.nextLineGate;
    if (!gate) return;
    gate.released = true;
    if (!gate.start) return;
    const start = gate.start;
    gate.start = null;
    this.nextLineGate = null;
    start();
  }

  clearNextLineGate() {
    this.nextLineGate = null;
  }


  startTyping(value) {
    this.characters = splitCharacters(value);
    this.characterIndex = 0;
    if (!this.characters.length) {
      this.finishTyping();
      return;
    }

    this.typing = true;
    const token = ++this.typingToken;
    this.revealNextCharacter(token);
  }

  revealNextCharacter(token) {
    if (!this.typing || token !== this.typingToken) return;

    this.textNode.appendData(this.characters[this.characterIndex]);
    this.characterIndex += 1;
    this.scrollTextToEnd();

    if (this.characterIndex >= this.characters.length) {
      this.finishTyping();
      return;
    }

    const configuredInterval = Number(this.getCharacterInterval());
    const interval = Number.isFinite(configuredInterval)
      ? Math.max(5, Math.min(500, configuredInterval))
      : 40;
    const delay = this.playbackClock.wait(interval);
    this.typingWait = delay;
    delay.then(() => {
      if (this.typingWait === delay) this.typingWait = null;
      this.revealNextCharacter(token);
    });
  }

  finishTyping() {
    this.typingWait?.cancel?.();
    this.typingWait = null;
    if (this.typing && this.characterIndex < this.characters.length) {
      this.textNode.appendData(this.characters.slice(this.characterIndex).join(""));
    }
    this.typing = false;
    this.characters = [];
    this.characterIndex = 0;
    this.endIndicator.hidden = false;
    this.scrollTextToEnd();
  }

  setJudgmentEnabled(enabled) {
    this.judgmentEnabled = Boolean(enabled);
    this.syncJudgmentVisibility();
  }

  syncJudgmentVisibility() {
    if (this.judgmentPanel) {
      this.judgmentPanel.hidden = !this.judgmentEnabled || this.panel.hidden;
    }
  }

  showPreviewLine(line) {
    this.cancelPendingLine();
    this.setLine(line, { instant: true });
  }

  showLine(line) {
    const gate = this.nextLineGate;
    const deferred = Boolean(gate && !gate.released);
    this.setLine(line, { deferVisibility: deferred });

    let resolveLine;
    const promise = new Promise((resolve) => {
      resolveLine = resolve;
      this.pendingResolve = resolve;
    });
    const beginLine = () => {
      if (this.pendingResolve !== resolveLine) return;
      this.panel.hidden = false;
      this.syncJudgmentVisibility();
      const textDelay = gate?.textDelayMs ?? 0;
      if (textDelay > 0) {
        const wait = this.playbackClock.wait(textDelay);
        this.textStartWait = wait;
        wait.then(() => {
          if (this.textStartWait !== wait || this.pendingResolve !== resolveLine) return;
          this.textStartWait = null;
          this.beginLineText(line);
        });
      } else {
        this.beginLineText(line);
      }
    };

    if (deferred) {
      gate.start = beginLine;
    } else {
      if (gate) this.nextLineGate = null;
      beginLine();
    }
    return promise;
  }

  beginLineText(line) {
    if (!this.pendingResolve) return;
    this.lineReady = true;
    this.startTyping(line?.text ?? "");
  }

  advance() {
    if (!this.pendingResolve || !this.lineReady) return;
    if (this.typing) {
      this.finishTyping();
      return;
    }

    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    resolve();
  }

  cancelPendingLine() {
    this.stopTyping();
    this.textStartWait?.cancel?.();
    this.textStartWait = null;
    this.lineReady = false;
    if (this.nextLineGate) this.nextLineGate.start = null;
    if (!this.pendingResolve) return;
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    resolve();
  }

  hide() {
    this.stopTyping();
    this.textStartWait?.cancel?.();
    this.textStartWait = null;
    this.lineReady = false;
    this.panel.style.removeProperty("opacity");
    this.panel.hidden = true;
    this.syncJudgmentVisibility();
    this.pendingResolve = null;
    this.speaker.textContent = "";
    this.textNode = document.createTextNode("");
    this.endIndicator.hidden = true;
    this.text.replaceChildren(this.textNode, this.endIndicator);
    this.sceneTag.textContent = "";
  }
}
