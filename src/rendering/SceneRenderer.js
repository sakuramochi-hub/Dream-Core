import { CharacterRenderer } from "./CharacterRenderer.js";

function transitionOffscreenTransform(direction, action) {
  const sign = action === "cover"
    ? (direction === "right-to-left" ? 1 : -1)
    : (direction === "right-to-left" ? -1 : 1);
  return `translate3d(${sign * 100}%, 0, 0)`;
}

export class SceneRenderer {
  constructor({ scene, backgroundLayer, characterLayer, slapFlash, transitionOverlay, status, manifestLoader, playbackClock }) {
    this.scene = scene;
    this.backgroundLayer = backgroundLayer;
    this.characterRenderer = new CharacterRenderer(characterLayer, manifestLoader, playbackClock);
    this.slapFlash = slapFlash;
    this.transitionOverlay = transitionOverlay;
    this.status = status;
    this.manifestLoader = manifestLoader;
    this.playbackClock = playbackClock;
    this.statusWait = null;
    this.statusToken = 0;
    this.transitionToken = 0;
    this.transitionWait = null;
    this.sequenceWait = null;
    this.transitionResolve = null;
    this.transitionSequenceToken = 0;
    this.transitionCovered = false;
    this.backgroundRequestToken = 0;
    this.currentBackgroundSource = null;
    this.shakeToken = 0;
    this.flashToken = 0;
    this.shakeWait = null;
    this.flashWait = null;
  }

  setPlaybackSpeed(speed) {
    this.playbackClock?.setRate(speed);
  }

  async preloadBackground(assetKey) {
    const source = this.manifestLoader.getBackground(assetKey);
    if (!source || source === this.currentBackgroundSource) return Boolean(source);
    return this.waitForBackgroundReady(source);
  }

  async setBackground(assetKey, { waitForReady = false } = {}) {
    const source = this.manifestLoader.getBackground(assetKey);
    const placeholder = this.manifestLoader.getBackgroundPlaceholder(assetKey);
    const requestToken = ++this.backgroundRequestToken;

    if (!source) {
      this.currentBackgroundSource = null;
      this.backgroundLayer.style.backgroundImage = "none";
      this.backgroundLayer.style.backgroundColor = placeholder;
      return true;
    }

    if (waitForReady && source !== this.currentBackgroundSource) {
      await this.preloadBackground(assetKey);
    }
    if (requestToken !== this.backgroundRequestToken) return false;

    this.backgroundLayer.style.backgroundImage = `url("${source}")`;
    this.backgroundLayer.style.backgroundColor = placeholder;
    this.currentBackgroundSource = source;
    return true;
  }

  waitForBackgroundReady(source) {
    return new Promise((resolve) => {
      const image = new Image();
      let settled = false;
      let timeout = null;
      const finish = (loaded) => {
        if (settled) return;
        settled = true;
        if (timeout !== null) window.clearTimeout(timeout);
        resolve(loaded);
      };

      timeout = window.setTimeout(() => finish(false), 5000);
      const decodeAndFinish = () => {
        if (typeof image.decode === "function") {
          image.decode().then(() => finish(true), () => finish(image.naturalWidth > 0));
        } else {
          finish(true);
        }
      };
      image.onload = decodeAndFinish;
      image.onerror = () => finish(false);
      image.src = source;
      if (image.complete) {
        queueMicrotask(() => image.naturalWidth > 0 ? decodeAndFinish() : finish(false));
      }
    });
  }

  isTransitionCovered() {
    return this.transitionCovered;
  }

  setCharacter(command) {
    this.characterRenderer.show(command);
  }

  hideCharacter(id = null, options = {}) {
    this.characterRenderer.hide(id, options);
  }

  setTransitionState(command) {
    this.cancelTransition();
    if (!this.transitionOverlay) return;
    this.transitionOverlay.style.transition = "none";
    this.transitionOverlay.style.backgroundColor = command.color || "#000000";
    if (command.action === "cover") {
      this.transitionOverlay.style.transform = "translate3d(0, 0, 0)";
      this.transitionOverlay.classList.add("active");
      this.transitionCovered = true;
    } else {
      this.transitionOverlay.style.transform = transitionOffscreenTransform(command.direction || "right-to-left", "reveal");
      this.transitionOverlay.classList.remove("active");
      this.transitionCovered = false;
    }
  }

  playTransition(command) {
    // Keep a completed cover in place while the next G8S commands update the
    // scene. In particular, a reveal must not briefly remove the curtain.
    const canRevealCoveredScene = command.action === "reveal" && this.transitionCovered;
    if (!canRevealCoveredScene) this.cancelTransition();
    return this.animateTransition(command);
  }

  async playTransitionSequence(command, beforeReveal = null) {
    this.cancelTransition();
    const sequenceToken = this.transitionSequenceToken;
    const common = {
      color: command.color || "#000000",
      direction: command.direction || "right-to-left",
      easing: command.easing || "linear"
    };

    await this.animateTransition({ ...common, action: "cover", duration: command.closeDuration });
    if (sequenceToken !== this.transitionSequenceToken) return;

    // The next consecutive background command is applied behind the closed
    // curtain. Wait for its image to be ready before starting the hold/reveal.
    if (typeof beforeReveal === "function") await beforeReveal();
    if (sequenceToken !== this.transitionSequenceToken) return;

    const holdDuration = Math.max(0, Number(command.holdDuration) || 0);
    if (holdDuration > 0) {
      this.sequenceWait = this.playbackClock.wait(holdDuration);
      await this.sequenceWait;
      this.sequenceWait = null;
    }
    if (sequenceToken !== this.transitionSequenceToken) return;

    await this.animateTransition({ ...common, action: "reveal", duration: command.openDuration });
  }

  animateTransition(command) {
    if (!this.transitionOverlay) return Promise.resolve();

    const overlay = this.transitionOverlay;
    const token = this.transitionToken;
    const duration = Math.max(0, Number(command.duration) || 0);
    const direction = command.direction || "right-to-left";
    const action = command.action || "cover";
    const offscreenTransform = transitionOffscreenTransform(direction, action);
    const startTransform = action === "cover" ? offscreenTransform : "translate3d(0, 0, 0)";
    const endTransform = action === "cover" ? "translate3d(0, 0, 0)" : offscreenTransform;

    overlay.style.transition = "none";
    overlay.style.backgroundColor = command.color || "#000000";
    overlay.style.transform = startTransform;
    overlay.classList.add("active");
    void overlay.offsetWidth;

    return new Promise((resolve) => {
      let settled = false;
      let fallbackWait = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        fallbackWait?.cancel?.();
        if (this.transitionWait === fallbackWait) this.transitionWait = null;
        overlay.removeEventListener("transitionend", onTransitionEnd);
        if (token === this.transitionToken) {
          overlay.style.transition = "none";
          overlay.style.transform = endTransform;
          if (action === "reveal") overlay.classList.remove("active");
          this.transitionCovered = action === "cover";
          this.transitionResolve = null;
        }
        resolve();
      };
      const onTransitionEnd = (event) => {
        if (event.target === overlay && event.propertyName === "transform") finish();
      };

      this.transitionResolve = finish;
      overlay.addEventListener("transitionend", onTransitionEnd);
      if (duration === 0) {
        overlay.style.transform = endTransform;
        finish();
        return;
      }
      overlay.style.transition = `transform ${duration}ms ${command.easing || "linear"}`;
      fallbackWait = this.playbackClock.wait(duration + 100);
      this.transitionWait = fallbackWait;
      fallbackWait.then(finish);
      requestAnimationFrame(() => {
        if (token === this.transitionToken) overlay.style.transform = endTransform;
      });
    });
  }

  cancelTransition() {
    this.transitionSequenceToken += 1;
    this.transitionToken += 1;
    this.transitionWait?.cancel?.();
    this.transitionWait = null;
    this.sequenceWait?.cancel?.();
    this.sequenceWait = null;
    const resolve = this.transitionResolve;
    this.transitionResolve = null;
    if (this.transitionOverlay) {
      this.transitionOverlay.style.transition = "none";
      this.transitionOverlay.style.transform = "translate3d(100%, 0, 0)";
      this.transitionOverlay.classList.remove("active");
    }
    this.transitionCovered = false;
    resolve?.();
  }

  playShake(duration = 240, strength = 7) {
    const durationMs = Math.max(0, Number(duration) || 0);
    const strengthPx = Math.max(0, Math.min(40, Number(strength ?? 7) || 0));
    const token = ++this.shakeToken;
    this.shakeWait?.cancel?.();
    this.shakeWait = null;
    this.scene.classList.remove("shake");
    this.scene.style.setProperty("--shake-duration", `${durationMs}ms`);
    this.scene.style.setProperty("--shake-strength", `${strengthPx}px`);
    void this.scene.offsetWidth;
    this.scene.classList.add("shake");
    this.shakeWait = this.playbackClock.wait(durationMs + 30);
    this.shakeWait.then(() => {
      if (token !== this.shakeToken) return;
      this.scene.classList.remove("shake");
      this.scene.style.removeProperty("--shake-duration");
      this.scene.style.removeProperty("--shake-strength");
      this.shakeWait = null;
    });
  }

  playFlash(duration = 240, color = "#ffffff", opacity = 0.85) {
    if (!this.slapFlash) return;
    const durationMs = Math.max(0, Number(duration) || 0);
    const flashOpacity = Math.max(0, Math.min(1, Number(opacity ?? 0.85) || 0));
    const token = ++this.flashToken;
    this.flashWait?.cancel?.();
    this.flashWait = null;
    this.slapFlash.classList.remove("play");
    this.slapFlash.style.backgroundColor = color || "#ffffff";
    this.slapFlash.style.setProperty("--flash-duration", `${durationMs}ms`);
    this.slapFlash.style.setProperty("--flash-opacity", String(flashOpacity));
    void this.slapFlash.offsetWidth;
    this.slapFlash.classList.add("play");
    this.flashWait = this.playbackClock.wait(durationMs + 30);
    this.flashWait.then(() => {
      if (token !== this.flashToken) return;
      this.slapFlash.classList.remove("play");
      this.slapFlash.style.removeProperty("background-color");
      this.slapFlash.style.removeProperty("--flash-duration");
      this.slapFlash.style.removeProperty("--flash-opacity");
      this.flashWait = null;
    });
  }

  clearScreenEffects() {
    this.shakeToken += 1;
    this.flashToken += 1;
    this.shakeWait?.cancel?.();
    this.flashWait?.cancel?.();
    this.shakeWait = null;
    this.flashWait = null;
    this.scene.classList.remove("shake");
    this.scene.style.removeProperty("--shake-duration");
    this.scene.style.removeProperty("--shake-strength");
    this.slapFlash?.classList.remove("play");
    this.slapFlash?.style.removeProperty("background-color");
    this.slapFlash?.style.removeProperty("--flash-duration");
    this.slapFlash?.style.removeProperty("--flash-opacity");
  }

  playSlap(duration = 240) {
    this.playShake(duration, 7);
    this.playFlash(duration, "#ffffff", 0.85);
  }

  showStatus(message, type = "success", duration = 900) {
    if (!this.status) return;
    const token = ++this.statusToken;
    this.statusWait?.cancel?.();
    this.status.textContent = message;
    this.status.className = `scene-status show ${type}`;
    this.statusWait = this.playbackClock.wait(duration);
    this.statusWait.then(() => {
      if (token !== this.statusToken) return;
      this.status.className = "scene-status";
      this.statusWait = null;
    });
  }

  clearStatus() {
    this.statusToken += 1;
    this.statusWait?.cancel?.();
    this.statusWait = null;
    if (this.status) {
      this.status.className = "scene-status";
      this.status.textContent = "";
    }
  }

  clearScene() {
    this.cancelTransition();
    this.clearScreenEffects();
    this.backgroundRequestToken += 1;
    this.currentBackgroundSource = null;
    this.backgroundLayer.style.backgroundImage = "none";
    this.backgroundLayer.style.backgroundColor = "#4c596b";
    this.hideCharacter(null, { animate: false });
    this.clearStatus();
  }
}
