function waitForDecodedImage(image, source) {
  image.decoding = "async";
  image.src = source;

  if (typeof image.decode === "function") {
    return image.decode().then(() => {
      if (image.naturalWidth <= 0) throw new Error(`立ち絵をデコードできません: ${source}`);
      return image;
    });
  }

  return new Promise((resolve, reject) => {
    if (image.complete) {
      if (image.naturalWidth > 0) resolve(image);
      else reject(new Error(`立ち絵を読み込めません: ${source}`));
      return;
    }
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error(`立ち絵を読み込めません: ${source}`)), { once: true });
  });
}

export class CharacterRenderer {
  constructor(layer, manifestLoader, playbackClock = null) {
    this.layer = layer;
    this.manifestLoader = manifestLoader;
    this.playbackClock = playbackClock;
    this.sprites = new Map();
    this.pendingImages = new Map();
    this.requestTokens = new Map();
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

  nextRequestToken(id) {
    const token = (this.requestTokens.get(id) ?? 0) + 1;
    this.requestTokens.set(id, token);
    return token;
  }

  cancelPendingImage(id) {
    const pending = this.pendingImages.get(id);
    if (!pending) return;
    pending.image.onload = null;
    pending.image.onerror = null;
    this.pendingImages.delete(id);
  }

  updatePresentation(element, id, position, type = "image") {
    if (!element) return;
    const swapClass = type === "image" && element.classList.contains("is-expression-swap")
      ? " is-expression-swap"
      : "";
    const nextClassName = `${type === "image" ? "character-sprite" : "character-placeholder"}${swapClass} position-${position}`;
    if (element.className !== nextClassName) element.className = nextClassName;
    this.applyCharacterSettings(element, id);
  }

  show({ id, expression = "default", position = "center" }) {
    const token = this.nextRequestToken(id);
    this.cancelPendingImage(id);
    this.removeExiting(id);

    const source = this.manifestLoader.getCharacter(id, expression);
    const current = this.sprites.get(id) ?? null;
    const currentSource = current?.tagName === "IMG" ? current.dataset.assetSource : null;

    if (!source) {
      this.showPlaceholder(id, position, current);
      return;
    }

    if (currentSource === source) {
      this.updatePresentation(current, id, position);
      return;
    }

    // Keep the currently visible sprite and its current position in place
    // while the next expression is fetched and decoded in an unattached buffer.
    const image = new Image();
    image.alt = "";
    image.draggable = false;
    image.dataset.characterId = id;
    image.dataset.assetSource = source;

    const pending = { token, source, image, position };
    this.pendingImages.set(id, pending);

    waitForDecodedImage(image, source).then(() => {
      if (this.pendingImages.get(id) !== pending) return;
      if (this.requestTokens.get(id) !== token) return;
      this.pendingImages.delete(id);
      this.commitBufferedImage(id, image, source, position);
    }).catch((error) => {
      if (this.pendingImages.get(id) !== pending) return;
      if (this.requestTokens.get(id) !== token) return;
      this.pendingImages.delete(id);
      console.error(`[CharacterRenderer] 立ち絵を読み込めません: ${source}`, error);
      // Do not blank a sprite that is already on screen because a replacement
      // failed. A placeholder is only needed when this is the first display.
      if (!this.sprites.has(id)) this.showPlaceholder(id, position);
    });
  }

  commitBufferedImage(id, image, source, position) {
    const previous = this.sprites.get(id) ?? null;
    image.dataset.characterId = id;
    image.dataset.assetSource = source;
    this.updatePresentation(image, id, position);

    const isSwap = Boolean(previous?.isConnected);
    if (isSwap) {
      image.classList.add("is-expression-swap");
      image.style.opacity = "0";
    }

    this.sprites.set(id, image);
    this.layer.append(image);

    if (isSwap) this.crossFade(id, previous, image);
  }

  crossFade(id, previous, next) {
    const inEditorPreview = Boolean(this.layer.closest?.(".editor-preview-mode"));
    if (inEditorPreview || typeof previous.animate !== "function" || typeof next.animate !== "function") {
      previous.remove();
      next.style.opacity = "1";
      return;
    }

    const previousOpacity = getComputedStyle(previous).opacity || "1";
    this.cancelElementAnimations(previous);
    previous.style.opacity = previousOpacity;

    const duration = 120;
    const fadeIn = next.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration, easing: "ease-out", fill: "forwards" }
    );
    const fadeOut = previous.animate(
      [{ opacity: previousOpacity }, { opacity: 0 }],
      { duration, easing: "ease-out", fill: "forwards" }
    );

    const exiting = this.exitingElements.get(id) ?? new Set();
    exiting.add(previous);
    this.exitingElements.set(id, exiting);
    this.playbackClock?.applyAnimationRate(fadeIn);
    this.playbackClock?.applyAnimationRate(fadeOut);

    fadeIn.finished.then(() => {
      if (this.sprites.get(id) !== next) return;
      next.style.opacity = "1";
      fadeIn.cancel();
    }, () => {});

    const cleanup = () => {
      fadeOut.cancel();
      previous.remove();
      exiting.delete(previous);
      if (!exiting.size) this.exitingElements.delete(id);
    };
    fadeOut.finished.then(cleanup, cleanup);
  }

  showPlaceholder(id, position = "center", previous = this.sprites.get(id) ?? null) {
    if (previous?.tagName !== "IMG") {
      if (previous) {
        this.updatePresentation(previous, id, position, "placeholder");
        previous.style.backgroundColor = this.manifestLoader.getCharacterPlaceholder(id);
        return;
      }
    }
    if (previous) {
      previous.onerror = null;
      previous.onload = null;
      this.cancelElementAnimations(previous);
      previous.remove();
    }
    const placeholder = document.createElement("div");
    placeholder.dataset.characterId = id;
    this.updatePresentation(placeholder, id, position, "placeholder");
    placeholder.style.backgroundColor = this.manifestLoader.getCharacterPlaceholder(id);
    this.sprites.set(id, placeholder);
    this.layer.append(placeholder);
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
    const targetIds = id === null
      ? [...new Set([...this.sprites.keys(), ...this.pendingImages.keys()])]
      : [id];

    for (const spriteId of targetIds) {
      this.nextRequestToken(spriteId);
      this.cancelPendingImage(spriteId);
    }

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

      const currentOpacity = getComputedStyle(element).opacity || "1";
      this.cancelElementAnimations(element);
      element.style.opacity = currentOpacity;
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
