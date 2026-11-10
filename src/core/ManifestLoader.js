export class ManifestLoader {
  constructor(url = "manifest.json") {
    this.url = new URL(url, document.baseURI).href;
    this.assetBase = new URL(".", this.url);
    this.manifest = null;
  }

  resolveAsset(value) {
    if (!value) return null;
    try {
      return new URL(value, this.assetBase).href;
    } catch {
      return value;
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
