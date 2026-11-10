const DEFAULT_GOOGLE_FONT_URL = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap";
const DEFAULT_GOOGLE_FONT_FAMILY = '"Noto Sans JP", "Yu Gothic UI", "Meiryo", sans-serif';
const SYSTEM_FONT_FAMILY = '"Yu Gothic UI", "Meiryo", sans-serif';
const LOCAL_FONT_FAMILY = '"GameLocalFont", "Yu Gothic UI", "Meiryo", sans-serif';

function validGoogleStylesheetUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "https:"
      && url.hostname === "fonts.googleapis.com"
      && (url.pathname === "/css2" || url.pathname === "/css")
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function validLocalFontPath(value) {
  const path = String(value ?? "").trim().replace(/\\/g, "/");
  return /^assets\/fonts\/[A-Za-z0-9._-]+\.(?:woff2?|ttf|otf)$/i.test(path) ? path : "";
}

function validFontFamilyStack(value) {
  const family = String(value ?? "").trim();
  if (!family || family.length > 240 || !/^[\p{L}\p{M}\p{N}\s"'(),._-]+$/u.test(family)) {
    return DEFAULT_GOOGLE_FONT_FAMILY;
  }
  return family;
}

function ensureGooglePreconnects() {
  for (const [href, crossOrigin] of [
    ["https://fonts.googleapis.com", false],
    ["https://fonts.gstatic.com", true]
  ]) {
    const selector = `link[rel="preconnect"][href="${href}"]`;
    if (document.head.querySelector(selector)) continue;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    if (crossOrigin) link.crossOrigin = "anonymous";
    document.head.append(link);
  }
}

function removeFontElement(id) {
  document.getElementById(id)?.remove();
}

export async function applyFontSettings(settings = {}) {
  const root = document.documentElement;
  const source = settings?.source === "local" ? "local" : "google";
  removeFontElement("game-google-font-stylesheet");

  if (source === "google") {
    removeFontElement("game-local-font-style");
    const stylesheetUrl = validGoogleStylesheetUrl(settings.googleUrl || DEFAULT_GOOGLE_FONT_URL);
    const family = validFontFamilyStack(settings.googleFamily || DEFAULT_GOOGLE_FONT_FAMILY);
    root.style.setProperty("--game-font-family", family);
    if (!stylesheetUrl) {
      console.warn("Google Fonts URL is invalid; using the configured system fallback.");
      return false;
    }

    ensureGooglePreconnects();
    const link = document.createElement("link");
    link.id = "game-google-font-stylesheet";
    link.rel = "stylesheet";
    link.href = stylesheetUrl;
    document.head.append(link);
    return true;
  }

  const localPath = validLocalFontPath(settings.localFile);
  if (!localPath) {
    root.style.setProperty("--game-font-family", SYSTEM_FONT_FAMILY);
    return false;
  }

  try {
    const encodedPath = localPath.split("/").map((part) => encodeURIComponent(part)).join("/");
    const fontUrl = new URL(encodedPath, document.baseURI).href;
    const face = new FontFace("GameLocalFont", `url("${fontUrl}")`, { display: "swap" });
    await face.load();
    document.fonts.add(face);
    root.style.setProperty("--game-font-family", LOCAL_FONT_FAMILY);
    return true;
  } catch (error) {
    console.warn("Local font could not be loaded; using the system fallback.", error);
    root.style.setProperty("--game-font-family", SYSTEM_FONT_FAMILY);
    return false;
  }
}
