export class ManifestLoader {
  constructor(url = "manifest.json") {
    this.url = new URL(url, document.baseURI).href;
    this.assetBase = new URL(".", this.url);
    this.manifest = null;
    this.preloadedAssets = new Map();
    this.preloadedImages = new Map();
  }

  resolveAsset(value) {
    if (!value) return null;
    try {
      const resolved = new URL(value, this.assetBase).href;
      return this.preloadedAssets.get(resolved) || resolved;
    } catch {
      return value;
    }
  }

  hasPreloadedAsset(source) {
    try {
      const resolved = new URL(source, this.assetBase).href;
      return this.preloadedAssets.has(resolved);
    } catch {
      return false;
    }
  }

  registerPreloadedAsset(source, objectUrl, decodedImage = null) {
    const resolved = new URL(source, this.assetBase).href;
    const previous = this.preloadedAssets.get(resolved);
    if (previous && previous !== objectUrl && previous.startsWith('blob:')) {
      URL.revokeObjectURL(previous);
    }
    this.preloadedAssets.set(resolved, objectUrl);
    if (decodedImage && decodedImage.tagName === "IMG") this.preloadedImages.set(resolved, decodedImage);
  }

  getPreloadedCharacterImage(id, expression = "default") {
    const character = this.manifest?.assets?.characters?.[id];
    const assetPath = character?.[expression] ?? character?.default ?? null;
    if (!assetPath) return null;
    try {
      const resolved = new URL(assetPath, this.assetBase).href;
      return this.preloadedImages.get(resolved) ?? null;
    } catch {
      return null;
    }
  }

  async load() {
    const response = await fetch(this.url, { cache: "no-store" });
    if (!response.ok) throw new Error(`manifest.json を読み込めませんでした (${response.status})`);
    this.manifest = await response.json();
    return this.manifest;
  }

  getBackground(key) {
    return this.resolveAsset(this.manifest?.assets?.backgrounds?.[key] ?? null);
  }

  getBackgroundPlaceholder(key) {
    return this.manifest?.placeholders?.backgrounds?.[key] ?? "#4c596b";
  }

  getCharacter(id, expression = "default") {
    const character = this.manifest?.assets?.characters?.[id];
    if (!character) return null;
    return this.resolveAsset(character[expression] ?? character.default ?? null);
  }

  getCharacterPlaceholder(id) {
    return this.manifest?.placeholders?.characters?.[id] ?? "#b7a4ad";
  }

  getCharacterSettings(id) {
    const settings = this.manifest?.characterSettings?.[id] ?? {};
    return {
      scale: Number.isFinite(settings.scale) ? settings.scale : 100,
      offsetX: Number.isFinite(settings.offsetX) ? settings.offsetX : 0,
      offsetY: Number.isFinite(settings.offsetY) ? settings.offsetY : 0
    };
  }

  getAudio(key) {
    return this.resolveAsset(this.manifest?.assets?.audio?.[key] ?? null);
  }
}
