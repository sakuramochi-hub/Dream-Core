import { GameState } from "./GameState.js";
import { ManifestLoader } from "./ManifestLoader.js";
import { ScenarioLoader } from "./ScenarioLoader.js";
import { ScenarioPlayer } from "./ScenarioPlayer.js";
import { EncounterSelector } from "../systems/EncounterSelector.js";
import { JudgmentSystem } from "../systems/JudgmentSystem.js";
import { ResetSystem } from "../systems/ResetSystem.js";
import { LoopSystem } from "../systems/LoopSystem.js";
import { SceneRenderer } from "../rendering/SceneRenderer.js";
import { DialogueBox } from "../ui/DialogueBox.js";
import { AudioManager } from "../utils/AudioManager.js";
import { PlaybackClock } from "../utils/PlaybackClock.js";
import { applyFontSettings } from "../utils/FontManager.js";
import { GamePreloader } from "../utils/GamePreloader.js";

const DEFAULT_UI_THEME = Object.freeze({
  dialogueBackgroundColor: "#0c1018",
  dialogueBackgroundOpacity: 88,
  dialogueTextColor: "#f4f2f0",
  speakerNameColor: "#f0c1d0",
  primaryButtonBackgroundColor: "#1c2230",
  primaryButtonBackgroundOpacity: 84,
  primaryButtonTextColor: "#f5f3f2",
  slapButtonBackgroundColor: "#171d2a",
  slapButtonBackgroundOpacity: 90,
  slapButtonTextColor: "#ffffff",
  utilityButtonBackgroundColor: "#ffffff",
  utilityButtonBackgroundOpacity: 8,
  utilityButtonTextColor: "#f5f3f2",
  optionButtonIconColor: "#f5f3f2",
  optionButtonBackgroundColor: "#2d75cd",
  optionButtonBackgroundOpacity: 100,
  optionButtonBorderColor: "#ffffff",
  dialogueFontSize: 20,
  speakerNameFontSize: 15,
  dialogueSpeakerColumnWidthPx: 180,
  dialogueTextLeftInsetPx: 0,
  dialogueTextRightInsetPx: 0,
  dialogueTextTopInsetPx: 0,
  dialogueTextBottomInsetPx: 0,
  dialoguePanelBorderRadiusPx: 4,
  dialoguePanelPaddingTopPx: 34,
  dialoguePanelPaddingRightPx: 38,
  dialoguePanelPaddingBottomPx: 12,
  dialoguePanelPaddingLeftPx: 38,
  primaryButtonBorderRadiusPx: 3,
  primaryButtonPaddingVerticalPx: 14,
  primaryButtonPaddingHorizontalPx: 30,
  slapButtonBorderRadiusPx: 3,
  slapButtonPaddingVerticalPx: 9,
  slapButtonPaddingHorizontalPx: 17,
  utilityButtonBorderRadiusPx: 3,
  utilityButtonPaddingVerticalPx: 7,
  utilityButtonPaddingHorizontalPx: 14,
  optionButtonBorderWidthPx: 1,
  optionButtonBorderRadiusPx: 32,
  optionButtonSizePx: 56,
  titleFontSize: 64,
  primaryButtonFontSize: 16,
  slapButtonFontSize: 16,
  utilityButtonFontSize: 13,
  staffHeadingFontSize: 22,
  staffRoleFontSize: 15,
  staffNameFontSize: 25,
  debugFontSize: 13
});

const DEFAULT_UI_TEXT = Object.freeze({
  startButton: "はじめる",
  slapButton: "頬を叩く",
  titleButton: "タイトルへ",
  speedNormal: "倍速 OFF",
  speedFast: "倍速 ON",
  staffHeading: "STAFF",
  defaultEndingTitle: "THE END",
  debugAnomaly: "DEBUG｜異変あり",
  debugNormal: "DEBUG｜異変なし",
  loadErrorTitle: "読み込みエラー",
  reloadStartButton: "再読み込みして開始"
});

export class Game {
  constructor() {
    this.state = new GameState();
    this.scenarioLoader = new ScenarioLoader();
    this.manifestLoader = new ManifestLoader();
    this.gamePreloader = new GamePreloader(this.manifestLoader, this.scenarioLoader);
    this.judgmentSystem = new JudgmentSystem();
    this.resetSystem = new ResetSystem();
    this.encounterSelector = null;
    this.loopSystem = null;
    this.sceneRenderer = null;
    this.dialogueBox = null;
    this.scenarioPlayer = null;
    this.audioManager = null;
    this.playbackClock = new PlaybackClock();
    this.config = null;
    this.opening = null;
    this.ending = null;
    this.scenarioIndex = null;
    this.debugMode = { enabled: false };
    this.dom = {};
    this.inputLocked = false;
    this.scriptRunId = 0;
    this.encounterLoadId = 0;
    this.loopIntroToken = 0;
  }

  async initialize() {
    this.cacheDom();
    this.dom.game.classList.add("at-title");

    const editorPreview = new URLSearchParams(window.location.search).get("editorPreview") === "1";
    this.dom.titleScreen.hidden = true;
    this.dom.loadingScreen.hidden = editorPreview;
    this.dom.loadingRetryButton.hidden = true;
    this.dom.loadingLabel.textContent = "LOADING";
    this.updateLoadingProgress(0);
    this.bindEvents();

    const [config, , debugMode] = await Promise.all([
      this.scenarioLoader.loadGameConfig(),
      this.manifestLoader.load(),
      this.scenarioLoader.loadDebugMode()
    ]);
    this.config = config;
    this.debugMode = debugMode;
    this.updateLoadingProgress(8);

    await applyFontSettings(config.fontSettings);
    if (!editorPreview) await this.waitForFonts();
    this.updateLoadingProgress(14);

    [this.opening, this.ending, this.scenarioIndex] = await Promise.all([
      this.scenarioLoader.loadOpening(config.opening),
      this.scenarioLoader.loadEnding(config.ending),
      this.scenarioLoader.loadScenarioIndex(config.scenarioIndex)
    ]);

    if (!this.scenarioIndex.normal || !Array.isArray(this.scenarioIndex.anomalies) || this.scenarioIndex.anomalies.length === 0) {
      throw new Error("scenario-index.json に通常シナリオ1本と異変シナリオ一覧を登録してください");
    }
    this.updateLoadingProgress(20);

    this.encounterSelector = new EncounterSelector(this.scenarioIndex.selection);
    this.encounterSelector.configure(this.scenarioIndex);
    this.loopSystem = new LoopSystem({
      state: this.state,
      scenarioLoader: this.scenarioLoader,
      encounterSelector: this.encounterSelector
    });
    this.sceneRenderer = new SceneRenderer({
      scene: this.dom.scene,
      backgroundLayer: this.dom.backgroundLayer,
      characterLayer: this.dom.characterLayer,
      slapFlash: this.dom.slapFlash,
      transitionOverlay: this.dom.sceneTransition,
      status: this.dom.sceneStatus,
      manifestLoader: this.manifestLoader,
      playbackClock: this.playbackClock
    });
    this.dialogueBox = new DialogueBox({
      panel: this.dom.dialoguePanel,
      clickSurface: this.dom.gameCanvas,
      speaker: this.dom.speakerName,
      text: this.dom.dialogueText,
      sceneTag: this.dom.sceneTag,
      judgmentPanel: this.dom.judgmentPanel,
      getCharacterInterval: () => this.config?.dialogueTextIntervalMs ?? 40,
      playbackClock: this.playbackClock
    });
    this.audioManager = new AudioManager(this.manifestLoader, () => this.playbackClock.getRate());
    this.loadAudioPreferences();
    this.scenarioPlayer = new ScenarioPlayer({
      sceneRenderer: this.sceneRenderer,
      dialogueBox: this.dialogueBox,
      audioManager: this.audioManager,
      playbackClock: this.playbackClock
    });

    this.applyUiText();
    this.applyUiTheme();
    this.dom.gameTitle.textContent = config.title;
    document.title = config.title;
    this.dom.titleScreenTitle.textContent = config.titleScreenTitle || config.title;
    this.dom.dialoguePanel.hidden = true;
    this.dom.loopIntroScreen.hidden = true;
    this.dom.debugIndicator.hidden = true;
    this.dom.judgmentPanel.hidden = true;
    this.dialogueBox.setJudgmentEnabled(false);
    this.dom.slapButton.disabled = false;

    if (editorPreview) {
      this.dom.loadingScreen.hidden = true;
      this.initializeEditorPreview();
      return;
    }

    await this.gamePreloader.preload({
      scenarioIndex: this.scenarioIndex,
      onProgress: (percent) => this.updateLoadingProgress(20 + percent * 0.79)
    });

    this.applyTitleScreenBackground();
    this.updateLoadingProgress(100);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    this.dom.loadingScreen.hidden = true;
    this.dom.titleScreen.hidden = false;
    this.setScreenBgm(config.titleScreenBgm);
  }

  async waitForFonts() {
    const stylesheet = document.getElementById("game-google-font-stylesheet");
    if (stylesheet && stylesheet.dataset.loadState === "loading" && !stylesheet.sheet) {
      await Promise.race([
        new Promise((resolve) => {
          stylesheet.addEventListener("load", resolve, { once: true });
          stylesheet.addEventListener("error", resolve, { once: true });
          if (stylesheet.dataset.loadState !== "loading" || stylesheet.sheet) resolve();
        }),
        new Promise((resolve) => window.setTimeout(resolve, 3500))
      ]);
    }
    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => window.setTimeout(resolve, 1500))
      ]);
    }
  }

  setScreenBgm(key) {
    const bgmKey = String(key ?? "").trim();
    if (!bgmKey) {
      this.audioManager?.stopBgm();
      return Promise.resolve();
    }
    return this.audioManager?.playBgm(bgmKey) ?? Promise.resolve();
  }

  initializeEditorPreview() {
    this.dom.loadingScreen.hidden = true;
    this.dom.game.classList.remove("at-title");
    this.dom.game.classList.add("editor-preview-mode");
    this.dom.titleScreen.hidden = true;
    this.dom.endingScreen.hidden = true;
    this.dom.staffRollScreen.hidden = true;
    this.dom.screenTransitionCover.hidden = true;
    this.dom.screenTransitionCover.style.removeProperty("opacity");
    this.dom.dialoguePanel.hidden = true;
    this.dom.loopIntroScreen.hidden = true;
    this.dom.debugIndicator.hidden = true;
    this.dom.judgmentPanel.hidden = true;
    this.dom.optionsButton.hidden = true;
    this.dom.optionsScreen.hidden = true;
    this.dom.speedButton.hidden = true;

    window.addEventListener("message", (event) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (event.data?.type === "G8_EDITOR_PREVIEW") {
        this.renderEditorPreview(event.data);
      } else if (event.data?.type === "G8_EDITOR_SCENARIO_PLAY") {
        this.playEditorScenario(event.data);
      }
    });

    if (window.parent !== window) {
      window.parent.postMessage({ type: "G8_EDITOR_PREVIEW_READY" }, window.location.origin);
    }
  }

  async playEditorScenario(payload) {
    const scenario = payload?.scenario;
    const requestId = payload?.requestId;
    if (!scenario || !Array.isArray(scenario.script)) return;

    this.cancelScript();
    this.encounterLoadId += 1;
    this.loopIntroToken += 1;
    const runId = ++this.scriptRunId;

    this.audioManager?.stopBgm();
    this.dom.game.classList.remove("at-title", "at-ending", "at-staff-roll");
    this.dom.titleScreen.hidden = true;
    this.dom.endingScreen.hidden = true;
    this.dom.staffRollScreen.hidden = true;
    this.dom.loopIntroScreen.hidden = true;
    this.dom.screenTransitionCover.hidden = true;
    this.dom.screenTransitionCover.style.removeProperty("opacity");
    this.dom.dialoguePanel.hidden = true;
    this.dom.judgmentPanel.hidden = true;
    this.dom.debugIndicator.hidden = true;
    this.dom.optionsButton.hidden = true;
    this.dom.optionsScreen.hidden = true;
    this.dom.speedButton.hidden = true;
    this.dom.slapButton.disabled = true;
    this.dialogueBox.setJudgmentEnabled(false);
    this.dialogueBox.hide();
    this.sceneRenderer.clearScene();

    try {
      const completed = await this.scenarioPlayer.play(
        scenario.script,
        "TEST",
        () => runId === this.scriptRunId
      );
      if (!completed || runId !== this.scriptRunId) return;
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "G8_EDITOR_SCENARIO_FINISHED",
          requestId,
          status: "completed"
        }, window.location.origin);
      }
    } catch (error) {
      if (runId !== this.scriptRunId) return;
      console.error(error);
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "G8_EDITOR_SCENARIO_FINISHED",
          requestId,
          status: "error",
          message: error?.message || String(error)
        }, window.location.origin);
      }
    }
  }

  renderEditorPreview(payload) {
    const acknowledgeRender = () => {
      if (window.parent === window || !Number.isFinite(Number(payload.requestId))) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.parent.postMessage({ type: "G8_EDITOR_PREVIEW_RENDERED", requestId: payload.requestId }, window.location.origin);
      }));
    };
    this.dom.game.classList.remove("at-title");
    this.dom.titleScreen.hidden = true;
    this.dom.endingScreen.hidden = true;
    this.dom.loopIntroScreen.hidden = true;
    this.dom.optionsButton.hidden = true;
    this.dom.optionsScreen.hidden = true;
    this.dom.speedButton.hidden = true;
    this.dom.debugIndicator.hidden = true;

    const scenario = payload.scenario;
    if (!scenario || !Array.isArray(scenario.script)) {
      this.dom.judgmentPanel.hidden = true;
      this.dom.slapButton.disabled = true;
      this.sceneRenderer.clearScene();
      this.dialogueBox.hide();
      this.dialogueBox.showPreviewLine({
        speaker: "",
        text: payload.error || "プレビューできません。",
        tag: "PREVIEW"
      });
      acknowledgeRender();
      return;
    }

    const isLoopScenario = payload.kind === "normal" || payload.kind === "anomaly";
    this.dialogueBox.setJudgmentEnabled(false);
    this.dom.judgmentPanel.hidden = !isLoopScenario;
    this.dom.slapButton.disabled = true;
    const tag = isLoopScenario ? "LOOP" : String(payload.kind || "PREVIEW").toUpperCase();
    this.scenarioPlayer.renderPreview(scenario.script, payload.targetPageIndex ?? 0, tag);
    this.dom.judgmentPanel.hidden = !isLoopScenario || this.dom.dialoguePanel.hidden;
    acknowledgeRender();
  }

  cacheDom() {
    const ids = [
      "game", "game-canvas", "scene", "background-layer", "character-layer", "slap-flash", "scene-transition", "scene-status",
      "dialogue-panel", "speaker-name", "dialogue-text", "scene-tag",
      "title-screen", "title-screen-background", "title-screen-title", "start-button", "staff-roll-screen", "staff-roll-background", "staff-roll",
      "ending-screen", "ending-screen-background", "ending-screen-title", "title-button", "screen-transition-cover",
      "loop-intro-screen", "loop-intro-text", "debug-indicator", "judgment-panel", "slap-button", "slap-button-label",
      "options-button", "options-screen", "options-close-button", "bgm-volume-input", "se-volume-input", "bgm-volume-value", "se-volume-value", "speed-button", "game-title",
      "loading-screen", "loading-label", "loading-progress-track", "loading-progress-bar", "loading-progress-percent", "loading-retry-button"
    ];
    for (const id of ids) this.dom[this.toCamelCase(id)] = document.getElementById(id);
  }

  toCamelCase(value) {
    return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  getUiText(key) {
    const value = this.config?.uiText?.[key];
    return value == null ? (DEFAULT_UI_TEXT[key] ?? "") : String(value);
  }

  applyUiText() {
    this.dom.startButton.textContent = this.getUiText("startButton");
    this.dom.slapButtonLabel.textContent = this.getUiText("slapButton");
    this.dom.titleButton.textContent = this.getUiText("titleButton");
    this.updatePlaybackSpeedButtonLabel();
  }


  applyUiTheme() {
    const theme = { ...DEFAULT_UI_THEME, ...(this.config?.uiTheme || {}) };
    const normalizeHex = (value, fallback) => {
      const candidate = String(value ?? "").trim();
      if (/^#[0-9a-f]{6}$/i.test(candidate)) return candidate;
      if (/^#[0-9a-f]{3}$/i.test(candidate)) return `#${candidate[1]}${candidate[1]}${candidate[2]}${candidate[2]}${candidate[3]}${candidate[3]}`;
      return fallback;
    };
    const rgba = (color, opacity) => {
      const hex = normalizeHex(color, "#000000").slice(1);
      const alpha = Math.max(0, Math.min(100, Number(opacity) || 0)) / 100;
      const channels = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
    };
    const root = document.documentElement;
    const fontSize = (key) => {
      const fallback = DEFAULT_UI_THEME[key];
      let configured = this.config?.uiTheme?.[key];
      if (configured == null) {
        const legacyScale = Number(this.config?.uiTheme?.[key.replace("FontSize", "FontScale")]);
        if (Number.isFinite(legacyScale)) configured = fallback * legacyScale / 100;
      }
      const value = Number(configured ?? fallback);
      const pixels = Number.isFinite(value) ? Math.round(value) : fallback;
      return `${Math.max(8, Math.min(120, pixels))}px`;
    };
    const areaPx = (key, min, max) => {
      const configured = Number(theme[key]);
      const fallback = DEFAULT_UI_THEME[key];
      const value = Number.isFinite(configured) ? Math.round(configured) : fallback;
      return `${Math.max(min, Math.min(max, value))}px`;
    };
    root.style.setProperty("--dialogue-font-size", fontSize("dialogueFontSize"));
    root.style.setProperty("--speaker-name-font-size", fontSize("speakerNameFontSize"));
    root.style.setProperty("--dialogue-speaker-column-width", areaPx("dialogueSpeakerColumnWidthPx", 80, 600));
    root.style.setProperty("--dialogue-text-left-inset", areaPx("dialogueTextLeftInsetPx", 0, 800));
    root.style.setProperty("--dialogue-text-right-inset", areaPx("dialogueTextRightInsetPx", 0, 800));
    root.style.setProperty("--dialogue-text-top-inset", areaPx("dialogueTextTopInsetPx", 0, 300));
    root.style.setProperty("--dialogue-text-bottom-inset", areaPx("dialogueTextBottomInsetPx", 0, 300));
    root.style.setProperty("--dialogue-panel-border-radius", areaPx("dialoguePanelBorderRadiusPx", 0, 120));
    root.style.setProperty("--dialogue-panel-padding-top", areaPx("dialoguePanelPaddingTopPx", 0, 240));
    root.style.setProperty("--dialogue-panel-padding-right", areaPx("dialoguePanelPaddingRightPx", 0, 240));
    root.style.setProperty("--dialogue-panel-padding-bottom", areaPx("dialoguePanelPaddingBottomPx", 0, 240));
    root.style.setProperty("--dialogue-panel-padding-left", areaPx("dialoguePanelPaddingLeftPx", 0, 240));
    root.style.setProperty("--primary-button-border-radius", areaPx("primaryButtonBorderRadiusPx", 0, 120));
    root.style.setProperty("--primary-button-padding-vertical", areaPx("primaryButtonPaddingVerticalPx", 0, 240));
    root.style.setProperty("--primary-button-padding-horizontal", areaPx("primaryButtonPaddingHorizontalPx", 0, 240));
    root.style.setProperty("--slap-button-border-radius", areaPx("slapButtonBorderRadiusPx", 0, 120));
    root.style.setProperty("--slap-button-padding-vertical", areaPx("slapButtonPaddingVerticalPx", 0, 240));
    root.style.setProperty("--slap-button-padding-horizontal", areaPx("slapButtonPaddingHorizontalPx", 0, 240));
    root.style.setProperty("--utility-button-border-radius", areaPx("utilityButtonBorderRadiusPx", 0, 120));
    root.style.setProperty("--utility-button-padding-vertical", areaPx("utilityButtonPaddingVerticalPx", 0, 240));
    root.style.setProperty("--utility-button-padding-horizontal", areaPx("utilityButtonPaddingHorizontalPx", 0, 240));
    root.style.setProperty("--title-font-size", fontSize("titleFontSize"));
    root.style.setProperty("--primary-button-font-size", fontSize("primaryButtonFontSize"));
    root.style.setProperty("--slap-button-font-size", fontSize("slapButtonFontSize"));
    root.style.setProperty("--utility-button-font-size", fontSize("utilityButtonFontSize"));
    root.style.setProperty("--staff-heading-font-size", fontSize("staffHeadingFontSize"));
    root.style.setProperty("--staff-role-font-size", fontSize("staffRoleFontSize"));
    root.style.setProperty("--staff-name-font-size", fontSize("staffNameFontSize"));
    root.style.setProperty("--debug-font-size", fontSize("debugFontSize"));
    root.style.setProperty("--dialogue-panel-background", rgba(theme.dialogueBackgroundColor, theme.dialogueBackgroundOpacity));
    root.style.setProperty("--dialogue-text-color", normalizeHex(theme.dialogueTextColor, DEFAULT_UI_THEME.dialogueTextColor));
    root.style.setProperty("--speaker-name-color", normalizeHex(theme.speakerNameColor, DEFAULT_UI_THEME.speakerNameColor));
    root.style.setProperty("--primary-button-background", rgba(theme.primaryButtonBackgroundColor, theme.primaryButtonBackgroundOpacity));
    root.style.setProperty("--primary-button-text", normalizeHex(theme.primaryButtonTextColor, DEFAULT_UI_THEME.primaryButtonTextColor));
    root.style.setProperty("--slap-button-background", rgba(theme.slapButtonBackgroundColor, theme.slapButtonBackgroundOpacity));
    root.style.setProperty("--slap-button-text", normalizeHex(theme.slapButtonTextColor, DEFAULT_UI_THEME.slapButtonTextColor));
    root.style.setProperty("--utility-button-background", rgba(theme.utilityButtonBackgroundColor, theme.utilityButtonBackgroundOpacity));
    root.style.setProperty("--utility-button-text", normalizeHex(theme.utilityButtonTextColor, DEFAULT_UI_THEME.utilityButtonTextColor));
    root.style.setProperty("--option-button-icon-color", normalizeHex(theme.optionButtonIconColor, DEFAULT_UI_THEME.optionButtonIconColor));
    root.style.setProperty("--option-button-background", rgba(theme.optionButtonBackgroundColor, theme.optionButtonBackgroundOpacity));
    root.style.setProperty("--option-button-border-color", normalizeHex(theme.optionButtonBorderColor, DEFAULT_UI_THEME.optionButtonBorderColor));
    root.style.setProperty("--option-button-border-width", areaPx("optionButtonBorderWidthPx", 0, 20));
    root.style.setProperty("--option-button-border-radius", areaPx("optionButtonBorderRadiusPx", 0, 120));
    root.style.setProperty("--option-button-size", areaPx("optionButtonSizePx", 32, 120));
  }

  applyTitleScreenBackground() {
    const layer = this.dom.titleScreenBackground;
    if (!layer) return;
    const key = String(this.config?.titleScreenBackground || "");
    const source = key ? this.manifestLoader.getBackground(key) : null;
    layer.classList.toggle("has-image", Boolean(source));
    layer.style.backgroundImage = source ? `url("${source}")` : "none";
    layer.style.backgroundColor = source
      ? this.manifestLoader.getBackgroundPlaceholder(key)
      : "rgba(13,18,30,0.35)";
  }

  getAudioPreferenceKey() {
    const projectPath = window.location.pathname.replace(/\/index\.html?$/i, "").replace(/\/$/, "");
    return `novel-maker-audio:${projectPath || this.config?.title || "game"}`;
  }

  loadAudioPreferences() {
    const defaults = { bgm: 10, se: 10 };
    let preferences = defaults;
    this.audioPreferenceKey = this.getAudioPreferenceKey();
    try {
      const saved = JSON.parse(window.localStorage.getItem(this.audioPreferenceKey) || "null");
      if (saved && typeof saved === "object") preferences = { ...defaults, ...saved };
    } catch {}
    this.audioManager?.setBgmVolumeLevel(preferences.bgm);
    this.audioManager?.setSeVolumeLevel(preferences.se);
    this.updateAudioVolumeControls();
  }

  saveAudioPreferences() {
    const preferences = {
      bgm: this.audioManager?.bgmVolumeLevel ?? 10,
      se: this.audioManager?.seVolumeLevel ?? 10
    };
    try {
      window.localStorage.setItem(this.audioPreferenceKey || this.getAudioPreferenceKey(), JSON.stringify(preferences));
    } catch {}
  }

  updateAudioVolumeControls() {
    if (!this.audioManager || !this.dom.bgmVolumeInput || !this.dom.seVolumeInput) return;
    const bgm = this.audioManager.bgmVolumeLevel;
    const se = this.audioManager.seVolumeLevel;
    this.dom.bgmVolumeInput.value = String(bgm);
    this.dom.seVolumeInput.value = String(se);
    this.dom.bgmVolumeValue.textContent = bgm === 0 ? "OFF" : `${bgm} / 10`;
    this.dom.seVolumeValue.textContent = se === 0 ? "OFF" : `${se} / 10`;
  }

  setAudioVolume(kind, value) {
    const level = Math.max(0, Math.min(10, Math.round(Number(value) || 0)));
    if (kind === "bgm") this.audioManager?.setBgmVolumeLevel(level);
    else this.audioManager?.setSeVolumeLevel(level);
    this.updateAudioVolumeControls();
    this.saveAudioPreferences();
  }

  openOptions() {
    if (this.dom.optionsButton.hidden) return;
    this.updateAudioVolumeControls();
    this.dom.optionsScreen.hidden = false;
    this.dom.optionsButton.setAttribute("aria-expanded", "true");
  }

  closeOptions() {
    this.dom.optionsScreen.hidden = true;
    this.dom.optionsButton.setAttribute("aria-expanded", "false");
    this.dom.optionsButton.focus();
  }

  updatePlaybackSpeedButtonLabel() {
    const fast = this.playbackClock.getRate() > 1;
    this.dom.speedButton.textContent = this.getUiText(fast ? "speedFast" : "speedNormal");
    this.dom.speedButton.setAttribute("aria-pressed", String(fast));
  }

  waitScaled(ms) {
    return this.playbackClock.wait(ms);
  }

  bindEvents() {
    this.dom.startButton.addEventListener("click", () => this.startNewGame());
    this.dom.loadingRetryButton.addEventListener("click", () => window.location.reload());
    this.dom.titleButton.addEventListener("click", () => this.returnToTitle());
    this.dom.slapButton.addEventListener("click", () => this.submitChoice("slap"));
    this.dom.optionsButton.addEventListener("click", () => this.openOptions());
    this.dom.optionsCloseButton.addEventListener("click", () => this.closeOptions());
    this.dom.optionsScreen.addEventListener("click", (event) => event.stopPropagation());
    this.dom.bgmVolumeInput.addEventListener("input", (event) => this.setAudioVolume("bgm", event.currentTarget.value));
    this.dom.seVolumeInput.addEventListener("input", (event) => this.setAudioVolume("se", event.currentTarget.value));
    this.dom.speedButton.addEventListener("click", () => {
      const nextRate = this.playbackClock.getRate() > 1 ? 1 : 2;
      this.playbackClock.setRate(nextRate);
      this.updatePlaybackSpeedButtonLabel();
    });
  }

  returnToTitle() {
    if (this.state.phase !== "clear") return;

    this.encounterLoadId += 1;
    this.loopIntroToken += 1;
    this.dom.loopIntroScreen.hidden = true;
    this.cancelScript();
    this.state.returnToTitle();
    this.inputLocked = false;

    this.dom.game.classList.remove("at-ending");
    this.dom.game.classList.add("at-title");
    this.dom.titleScreenTitle.textContent = this.config.titleScreenTitle || this.config.title;
    this.dom.startButton.textContent = this.getUiText("startButton");
    this.dom.titleScreen.hidden = false;
    this.dom.optionsScreen.hidden = true;
    this.dom.optionsButton.setAttribute("aria-expanded", "false");
    this.dom.endingScreen.hidden = true;
    this.dom.staffRollScreen.hidden = true;
    this.setScreenBgm(this.config.titleScreenBgm);
    this.dom.screenTransitionCover.hidden = true;
    this.dom.screenTransitionCover.style.removeProperty("opacity");
    this.dom.debugIndicator.hidden = true;
    this.dom.judgmentPanel.hidden = true;
    this.dialogueBox.setJudgmentEnabled(false);
    this.dom.slapButton.disabled = false;
    this.dialogueBox.hide();
    this.sceneRenderer.clearScene();
  }

  updateLoadingProgress(percent) {
    const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    this.dom.loadingProgressBar.style.width = `${value}%`;
    this.dom.loadingProgressTrack.setAttribute("aria-valuenow", String(value));
    this.dom.loadingProgressPercent.textContent = `${value}%`;
  }

  async startNewGame() {
    if (this.inputLocked) return;
    this.inputLocked = true;
    this.audioManager?.stopBgm();

    this.dom.titleScreen.hidden = true;
    this.encounterLoadId += 1;
    this.loopIntroToken += 1;
    this.dom.loopIntroScreen.hidden = true;
    this.cancelScript();
    this.dom.game.classList.remove("at-title", "at-ending");
    this.state.beginNewGame(this.config.totalLoops);
    this.dom.titleScreen.hidden = true;
    this.dom.optionsScreen.hidden = true;
    this.dom.optionsButton.setAttribute("aria-expanded", "false");
    this.dom.endingScreen.hidden = true;
    this.dom.staffRollScreen.hidden = true;
    this.dom.screenTransitionCover.hidden = true;
    this.dom.screenTransitionCover.style.removeProperty("opacity");
    this.dom.debugIndicator.hidden = true;
    this.dom.judgmentPanel.hidden = true;
    this.dialogueBox.setJudgmentEnabled(false);
    this.dom.slapButton.disabled = false;
    this.sceneRenderer.clearScene();
    this.dialogueBox.hide();

    try {
      await this.playScript(this.opening.script, "OPENING");
      this.state.beginLoop();
      this.dom.loopIntroScreen.hidden = true;
      this.dom.judgmentPanel.hidden = true;
      this.inputLocked = false;
      this.loadAndPlayEncounter().catch((error) => this.showFatalError(error));
    } catch (error) {
      this.showFatalError(error);
    } finally {
      this.inputLocked = false;
    }
  }

  async loadAndPlayEncounter() {
    const loadId = ++this.encounterLoadId;
    this.dom.judgmentPanel.hidden = true;
    this.dom.slapButton.disabled = true;
    this.dialogueBox.setJudgmentEnabled(false);
    this.dialogueBox.hide();
    this.sceneRenderer.clearStatus();

    const scenario = await this.loopSystem.loadNextEncounter();
    if (loadId !== this.encounterLoadId) return;

    // Stop only at the scenario handoff, before the next scenario's intro.
    this.audioManager?.stopBgm();
    await this.playLoopIntro(scenario);
    if (loadId !== this.encounterLoadId) return;

    this.updateDebugIndicator(scenario);
    this.dialogueBox.setJudgmentEnabled(true);
    this.dom.slapButton.disabled = false;
    const completed = await this.playScript(scenario.script, "LOOP");
    if (loadId !== this.encounterLoadId) return;

    // Slap is an immediate decision. If the player never slaps, keep playing
    // the entire scenario and judge only after its end marker.
    if (completed && this.state.phase === "loop" && this.state.activeScenario === scenario) {
      await this.submitChoice("continue");
    }
  }

  async playLoopIntro(scenario = null) {
    const settings = this.config?.settings || {};
    if (settings.loopIntroEnabled === false) return;

    const current = Math.min(this.state.progress + 1, this.state.totalLoops);
    const total = Math.max(1, Number(this.state.totalLoops) || 1);
    const format = String(settings.loopIntroTextFormat ?? "{current}番夢界");
    const message = format
      .replaceAll("{current}", String(current))
      .replaceAll("{total}", String(total));
    if (!message.trim()) return;

    const clampDuration = (value, fallback) => {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(0, Math.min(10000, Math.round(number))) : fallback;
    };
    const fadeInMs = clampDuration(settings.loopIntroFadeInMs, 500);
    const holdMs = clampDuration(settings.loopIntroHoldMs, 800);
    const fadeOutMs = clampDuration(settings.loopIntroFadeOutMs, 500);
    const fontSizeValue = Number(settings.loopIntroFontSize);
    const fontSize = Number.isFinite(fontSizeValue) ? Math.max(8, Math.min(160, Math.round(fontSizeValue))) : 56;
    const normalizeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value ?? "").trim())
      ? String(value).trim()
      : fallback;

    const screen = this.dom.loopIntroScreen;
    const text = this.dom.loopIntroText;
    const token = ++this.loopIntroToken;
    screen.style.backgroundColor = normalizeColor(settings.loopIntroBackgroundColor, "#000000");
    text.style.color = normalizeColor(settings.loopIntroTextColor, "#ffffff");
    text.style.fontSize = `${fontSize}px`;
    text.textContent = message;
    screen.style.opacity = "0";
    screen.hidden = false;

    // Warm the next scene's first background while the black intro card is
    // visible. It is applied only after the card has become fully opaque, so
    // the previous loop's background can never peek through during the swap.
    const nextBackground = scenario?.script?.find((command) => command.type === "background");
    const backgroundPreload = nextBackground
      ? this.sceneRenderer?.preloadBackground?.(nextBackground.asset) ?? Promise.resolve(false)
      : Promise.resolve(false);

    const animateOpacity = async (from, to, duration, easing) => {
      if (duration <= 0) {
        screen.style.opacity = String(to);
        return;
      }
      const animation = screen.animate(
        [{ opacity: from }, { opacity: to }],
        { duration, easing, fill: "forwards" }
      );
      this.playbackClock.applyAnimationRate(animation);
      try {
        await animation.finished;
      } catch (error) {
        // A canceled intro animation must not block the next scenario.
      } finally {
        animation.cancel();
      }
      if (token === this.loopIntroToken) screen.style.opacity = String(to);
    };

    let entrance = null;
    if (fadeInMs > 0) {
      entrance = text.animate(
        [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: fadeInMs, easing: "ease-out", fill: "forwards" }
      );
      this.playbackClock.applyAnimationRate(entrance);
    } else {
      text.style.opacity = "1";
      text.style.transform = "translateY(0)";
    }

    await animateOpacity(0, 1, fadeInMs, "ease-out");
    if (entrance) {
      try { await entrance.finished; } catch (error) { /* The text may already have been reset. */ }
      entrance.cancel();
    }
    if (token !== this.loopIntroToken) return;

    if (nextBackground) {
      await backgroundPreload;
      if (token !== this.loopIntroToken) return;
      await this.sceneRenderer?.setBackground(nextBackground.asset);
      if (token !== this.loopIntroToken) return;
    }

    if (holdMs > 0) await this.waitScaled(holdMs);
    if (token !== this.loopIntroToken) return;

    await animateOpacity(1, 0, fadeOutMs, "ease-in");
    if (token !== this.loopIntroToken) return;

    screen.hidden = true;
    screen.style.removeProperty("opacity");
    screen.style.removeProperty("background-color");
    text.style.removeProperty("color");
    text.style.removeProperty("font-size");
    text.style.removeProperty("opacity");
    text.style.removeProperty("transform");
  }

  async playScript(script, tag) {
    const runId = ++this.scriptRunId;
    this.dialogueBox.setJudgmentEnabled(tag === "LOOP");
    return this.scenarioPlayer.play(script, tag, () => runId === this.scriptRunId);
  }

  cancelScript() {
    this.scriptRunId += 1;
    this.dialogueBox?.cancelPendingLine();
    this.sceneRenderer?.cancelTransition();
  }

  async submitChoice(choice) {
    if (this.inputLocked || this.state.phase !== "loop" || !this.state.activeScenario) return;
    this.inputLocked = true;
    this.dom.slapButton.disabled = true;
    this.dom.judgmentPanel.hidden = true;
    this.dialogueBox.setJudgmentEnabled(false);
    this.dom.debugIndicator.hidden = true;

    try {
      const isSlap = choice === "slap";
      if (isSlap) {
        // Pressing the button interrupts the current scenario immediately.
        this.cancelScript();
        this.sceneRenderer.playSlap(this.config.settings?.slapFlashDuration ?? 260);
        const soundEffectKey = this.config.settings?.slapSoundEffect ?? "harisen";
        if (soundEffectKey) this.audioManager.play(soundEffectKey);
      }

      // "continue" is called only after endScenario, never when a line is skipped.
      const scenario = this.state.activeScenario;
      const correct = this.judgmentSystem.judge(scenario.hasAnomaly, isSlap ? "slap" : "continue");
      this.dialogueBox.hide();

      if (correct) {
        if (isSlap && scenario.hasAnomaly) {
          this.encounterSelector.markAnomalyFound(scenario.sourcePath);
        }
        this.state.advance();
        if (this.loopSystem.isComplete()) {
          await this.waitScaled(280);
          await this.playEnding();
          return;
        }
        await this.waitScaled(choice === "slap" ? 300 : 120);
      } else {
        this.resetSystem.reset(this.state);
        await this.waitScaled(this.config.settings?.failurePause ?? 500);
      }

      this.inputLocked = false;
      this.loadAndPlayEncounter().catch((error) => this.showFatalError(error));
    } catch (error) {
      this.showFatalError(error);
    } finally {
      this.inputLocked = false;
    }
  }

  async playEnding() {
    // The ending script is a new scenario, so it starts without carrying over
    // the BGM from the final anomaly/normal scenario.
    this.audioManager?.stopBgm();
    this.state.beginEnding();
    this.dom.loopIntroScreen.hidden = true;
    this.dom.debugIndicator.hidden = true;
    this.dom.judgmentPanel.hidden = true;
    this.dialogueBox.setJudgmentEnabled(false);
    this.dom.slapButton.disabled = false;
    this.dialogueBox.hide();
    await this.playScript(this.ending.script, "ENDING");
    this.dialogueBox.hide();

    this.dom.endingScreenTitle.textContent = this.config.endingScreenTitle || this.ending.title || this.getUiText("defaultEndingTitle");
    this.setEndingScreenBackground();

    if (this.renderStaffRoll()) {
      this.setStaffRollBackground();
      await this.setScreenBgm(this.config.staffRollBgm);
      await this.playStaffRoll();
      await this.transitionStaffRollToEnding();
    } else {
      this.dom.staffRollScreen.hidden = true;
      await this.setScreenBgm(this.config.endingScreenBgm);
      this.dom.game.classList.add("at-ending");
      this.dom.endingScreen.hidden = false;
    }
    this.state.finish();
  }

  renderStaffRoll() {
    const credits = Array.isArray(this.config.credits) ? this.config.credits : [];
    const groups = [];
    for (const credit of credits) {
      if (!credit) continue;
      const names = String(credit.name || "")
        .split(/[、,，]/)
        .map((name) => name.trim())
        .filter(Boolean);
      if (!names.length) continue;

      const role = String(credit.role || "").trim();
      let group = groups.at(-1);
      if (role && (!group || group.role !== role)) {
        group = { role, names: [] };
        groups.push(group);
      } else if (!group) {
        group = { role: "", names: [] };
        groups.push(group);
      }
      group.names.push(...names);
    }

    const node = this.dom.staffRoll;
    node.replaceChildren();
    if (!groups.length) return false;

    const content = document.createElement("div");
    content.className = "staff-roll-content";
    const heading = document.createElement("h2");
    heading.className = "staff-roll-heading";
    heading.textContent = this.getUiText("staffHeading");
    const list = document.createElement("div");
    list.className = "staff-roll-list";
    for (const group of groups) {
      const row = document.createElement("div");
      row.className = "staff-roll-entry";
      if (group.role) {
        const role = document.createElement("span");
        role.className = "staff-roll-role";
        role.textContent = group.role;
        row.append(role);
      }

      const names = document.createElement("div");
      names.className = "staff-roll-names";
      for (const value of group.names) {
        const name = document.createElement("strong");
        name.className = "staff-roll-name";
        name.textContent = value;
        names.append(name);
      }
      row.append(names);
      list.append(row);
    }
    content.append(heading, list);

    node.append(content);
    return true;
  }

  setStaffRollBackground() {
    const key = String(this.config.staffRollBackground || "").trim();
    const image = key ? this.manifestLoader.getBackground(key) : null;
    const fallback = key ? this.manifestLoader.getBackgroundPlaceholder(key) : "#080a10";
    this.dom.staffRollBackground.style.backgroundImage = image ? `url("${image.replace(/["\\]/g, "\\$&")}")` : "none";
    this.dom.staffRollBackground.style.backgroundColor = fallback || "#080a10";
  }

  setEndingScreenBackground() {
    const key = String(this.config.endingScreenBackground || "").trim();
    const image = key ? this.manifestLoader.getBackground(key) : null;
    const fallback = key ? this.manifestLoader.getBackgroundPlaceholder(key) : "#0d1220";
    this.dom.endingScreenBackground.style.backgroundImage = image ? `url("${image.replace(/["\\]/g, "\\$&")}")` : "none";
    this.dom.endingScreenBackground.style.backgroundColor = fallback || "#0d1220";
  }

  async playStaffRoll() {
    const content = this.dom.staffRoll.querySelector(".staff-roll-content");
    if (!content) return;

    this.dom.game.classList.add("at-staff-roll");
    this.dom.staffRollScreen.hidden = false;

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const viewportHeight = this.dom.staffRollScreen.clientHeight || 1080;
    const contentHeight = content.offsetHeight;
    const travelDistance = viewportHeight + contentHeight;
    const durationMs = Math.max(12000, (travelDistance / 55) * 1000);

    // Web Animations API avoids CSS animation overrides and reduced-motion
    // styles that previously left short credits parked at the top.
    content.style.animation = "none";
    const animation = content.animate(
      [
        { transform: `translate(-50%, ${viewportHeight}px)` },
        { transform: `translate(-50%, ${-contentHeight}px)` }
      ],
      {
        duration: durationMs,
        easing: "linear",
        fill: "forwards"
      }
    );
    this.playbackClock.applyAnimationRate(animation);

    try {
      await animation.finished;
    } catch (error) {
      // A canceled animation should not trap the game on the staff-roll screen.
    }

  }

  async transitionStaffRollToEnding() {
    const staffRoll = this.dom.staffRollScreen;
    const ending = this.dom.endingScreen;
    const cover = this.dom.screenTransitionCover;
    const fadeOutDuration = 420;
    const fadeInDuration = 560;

    // Fade the entire stage to black first. This opaque layer stays above the
    // live scene while the staff-roll and ending screens are exchanged.
    cover.hidden = false;
    cover.style.opacity = "0";
    void cover.offsetWidth;

    const fadeToBlack = cover.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: fadeOutDuration, easing: "ease-in", fill: "forwards" }
    );
    this.playbackClock.applyAnimationRate(fadeToBlack);
    try {
      await fadeToBlack.finished;
    } catch (error) {
      // Continue the screen swap even if the animation is interrupted.
    }
    cover.style.opacity = "1";
    fadeToBlack.cancel();

    // Swap the screens only while the opaque cover guarantees that no frame
    // of the previous gameplay scene can become visible.
    await this.setScreenBgm(this.config.endingScreenBgm);
    staffRoll.hidden = true;
    staffRoll.style.removeProperty("opacity");
    this.dom.game.classList.remove("at-staff-roll");
    this.dom.game.classList.add("at-ending");
    ending.style.opacity = "1";
    ending.hidden = false;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const fadeFromBlack = cover.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: fadeInDuration, easing: "ease-out", fill: "forwards" }
    );
    this.playbackClock.applyAnimationRate(fadeFromBlack);
    try {
      await fadeFromBlack.finished;
    } catch (error) {
      // The ending screen remains the final screen if the fade is interrupted.
    } finally {
      cover.style.opacity = "0";
      fadeFromBlack.cancel();
      cover.hidden = true;
      cover.style.removeProperty("opacity");
      ending.style.removeProperty("opacity");
    }
  }

  updateDebugIndicator(scenario) {
    if (!this.dom.debugIndicator) return;
    const enabled = this.debugMode?.enabled === true;
    this.dom.debugIndicator.hidden = !enabled || this.state.phase !== "loop";
    if (!enabled) return;
    this.dom.debugIndicator.textContent = scenario.hasAnomaly
      ? this.getUiText("debugAnomaly")
      : this.getUiText("debugNormal");
    this.dom.debugIndicator.dataset.anomaly = String(scenario.hasAnomaly);
  }

  showFatalError(error) {
    console.error(error);
    if (this.dom.loopIntroScreen) this.dom.loopIntroScreen.hidden = true;
    this.loopIntroToken += 1;
    this.dialogueBox?.setJudgmentEnabled(false);
    this.dialogueBox?.hide();
    this.dom.titleScreen.hidden = false;
    this.dom.titleScreenTitle.textContent = this.getUiText("loadErrorTitle");
    this.dom.startButton.textContent = this.getUiText("reloadStartButton");
    this.dom.judgmentPanel.hidden = true;
    if (this.dom.debugIndicator) this.dom.debugIndicator.hidden = true;
    this.inputLocked = false;
  }
}
