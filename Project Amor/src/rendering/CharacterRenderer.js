export class CharacterRenderer {
  constructor(layer, manifestLoader, playbackClock = null) {
    this.layer = layer;
    this.manifestLoader = manifestLoader;
    this.playbackClock = playbackClock;
    this.sprites = new Map();
    this.exitingElements = new Map();
  }

  applyCharacterSettings(element, id) {
    const settings = this.manifestLoader.getCharacterSettings?.(id) ?? {};
    const scale = Number.isFinite(settings.scale) ? settings.scale : 100;
    const offsetX = Number.isFinite(settings.offsetX) ? settings.offsetX : 0;
    const offsetY = Number.isFinite(settings.offsetY) ? settings.offsetY : 0;
    element.style.setProperty("--character-scale", String(Math.max(1, scale) / 100));
    element.style.setProperty("--character-offset-x", `${offsetX}px`);
    element.style.setProperty("--character-offset-y", `${offsetY}px`);
  }

  show({ id, expression = "default", position = "center" }) {
    this.removeExiting(id);
    const source = this.manifestLoader.getCharacter(id, expression);
    let element = this.sprites.get(id);
    const shouldBeImage = Boolean(source);
    const isImage = element?.tagName === "IMG";

    if (!element || shouldBeImage !== isImage) {
      element?.remove();
      element = shouldBeImage ? document.createElement("img") : document.createElement("div");
      element.dataset.characterId = id;
      if (shouldBeImage) {
        element.alt = "";
        element.draggable = false;
      }
      this.sprites.set(id, element);
      this.layer.append(element);
    }

    element.className = `${shouldBeImage ? "character-sprite" : "character-placeholder"} position-${position}`;
    this.applyCharacterSettings(element, id);
    if (shouldBeImage) {
      element.onerror = () => this.showPlaceholder(id, position);
      element.src = source;
    } else {
      element.style.backgroundColor = this.manifestLoader.getCharacterPlaceholder(id);
    }
  }

  showPlaceholder(id, position = "center") {
    const current = this.sprites.get(id);
    if (!current || current.tagName !== "IMG") return;
    const placeholder = document.createElement("div");
    placeholder.dataset.characterId = id;
    placeholder.className = `character-placeholder position-${position}`;
    placeholder.style.backgroundColor = this.manifestLoader.getCharacterPlaceholder(id);
    this.applyCharacterSettings(placeholder, id);
    current.replaceWith(placeholder);
    this.sprites.set(id, placeholder);
  }

  removeExiting(id = null) {
    const entries = id === null
      ? [...this.exitingElements.entries()]
      : (this.exitingElements.has(id) ? [[id, this.exitingElements.get(id)]] : []);
    for (const [spriteId, elements] of entries) {
      for (const element of elements) element.remove();
      this.exitingElements.delete(spriteId);
    }
  }

  hide(id = null, { animate = true } = {}) {
    if (!animate) this.removeExiting(id);
    const targets = id === null
      ? [...this.sprites.entries()]
      : (this.sprites.has(id) ? [[id, this.sprites.get(id)]] : []);

    for (const [spriteId, element] of targets) {
      if (this.sprites.get(spriteId) === element) this.sprites.delete(spriteId);
      if (!animate || !element.isConnected || typeof element.animate !== "function") {
        element.remove();
        continue;
      }

      const currentOpacity = getComputedStyle(element).opacity;
      const exitAnimation = element.animate(
        [{ opacity: currentOpacity }, { opacity: 0 }],
        { duration: 180, easing: "ease", fill: "forwards" }
      );
      const exiting = this.exitingElements.get(spriteId) ?? new Set();
      exiting.add(element);
      this.exitingElements.set(spriteId, exiting);
      this.playbackClock?.applyAnimationRate(exitAnimation);
      const cleanup = () => {
        element.remove();
        exiting.delete(element);
        if (!exiting.size) this.exitingElements.delete(spriteId);
      };
      exitAnimation.finished.then(cleanup, cleanup);
    }
  }
}
