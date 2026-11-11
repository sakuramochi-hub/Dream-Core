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

  cancelElementAnimations(element) {
    for (const animation of element?.getAnimations?.() ?? []) animation.cancel();
  }

  show({ id, expression = "default", position = "center" }) {
    this.removeExiting(id);

    const source = this.manifestLoader.getCharacter(id, expression);
    // The preloader keeps a decoded Image alive, but that cache element is never
    // mounted in the scene. Scene elements have their own animation lifecycle.
    const isPreloaded = Boolean(this.manifestLoader.getPreloadedCharacterImage?.(id, expression));
    const previous = this.sprites.get(id);
    const shouldBeImage = Boolean(source);
    const previousIsImage = previous?.tagName === "IMG";
    const previousSource = previous?.dataset?.assetSource || null;
    const sameImageSource = shouldBeImage && previousIsImage && previousSource === source;
    const elementTypeChanged = Boolean(previous && shouldBeImage !== previousIsImage);
    const replaceElement = !previous || elementTypeChanged || (shouldBeImage && !sameImageSource);

    let element = previous;
    if (replaceElement) {
      if (previous) {
        previous.onerror = null;
        previous.onload = null;
        this.cancelElementAnimations(previous);
        previous.remove();
      }
      element = shouldBeImage ? document.createElement("img") : document.createElement("div");
      element.dataset.characterId = id;
      if (shouldBeImage) {
        element.alt = "";
        element.draggable = false;
        element.dataset.assetSource = source;
      }
      this.sprites.set(id, element);
    }

    element.className = `${shouldBeImage ? "character-sprite" : "character-placeholder"}${isPreloaded ? " is-preloaded" : ""} position-${position}`;
    this.applyCharacterSettings(element, id);

    if (shouldBeImage) {
      const requestSource = source;
      element.onerror = () => {
        if (this.sprites.get(id) !== element) return;
        if (element.dataset.assetSource !== requestSource) return;
        console.error(`[CharacterRenderer] 立ち絵を読み込めません: ${requestSource}`);
        this.showPlaceholder(id, position);
      };
      if (element.src !== source) element.src = source;
    } else {
      element.style.backgroundColor = this.manifestLoader.getCharacterPlaceholder(id);
    }

    if (element.parentElement !== this.layer) this.layer.append(element);
  }

  showPlaceholder(id, position = "center") {
    const current = this.sprites.get(id);
    if (!current || current.tagName !== "IMG") return;
    current.onerror = null;
    current.onload = null;
    this.cancelElementAnimations(current);
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
      for (const element of elements) {
        this.cancelElementAnimations(element);
        element.remove();
      }
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
        this.cancelElementAnimations(element);
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
        exitAnimation.cancel();
        element.remove();
        exiting.delete(element);
        if (!exiting.size) this.exitingElements.delete(spriteId);
      };
      exitAnimation.finished.then(cleanup, cleanup);
    }
  }
}
