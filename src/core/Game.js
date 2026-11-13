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
  dialoguePanelBorderEnabled: true,
  dialoguePanelBorderColor: "#ffffff",
  dialoguePanelBorderWidthPx: 1,
  primaryButtonBorderEnabled: true,
  primaryButtonBorderColor: "#ffffff",
  primaryButtonBorderWidthPx: 1,
  slapButtonBorderEnabled: true,
  slapButtonBorderColor: "#ffffff",
  slapButtonBorderWidthPx: 1,
  utilityButtonBorderEnabled: true,
  utilityButtonBorderColor: "#ffffff",
  utilityButtonBorderWidthPx: 1,
  optionButtonBorderEnabled: true,
  optionButtonBorderColor: "#ffffff",
  optionButtonBorderWidthPx: 1,
  optionsPanelBorderEnabled: true,
  optionsPanelBorderColor: "#ffffff",
  optionsPanelBorderWidthPx: 1,
  optionsOverlayBackgroundColor: "#05080e",
  optionsOverlayBackgroundOpacity: 88,
  optionsOverlayBlurPx: 8,
  optionsScreenPaddingPx: 48,
  optionsPanelBackgroundColor: "#121925",
  optionsPanelBackgroundOpacity: 96,
  optionsPanelWidthPx: 760,
  optionsPanelPaddingVerticalPx: 68,
  optionsPanelPaddingHorizontalPx: 74,
  optionsPanelBorderRadiusPx: 12,
  optionsHeadingGapPx: 54,
  optionsSettingsGapPx: 38,
  optionsAudioSettingRowGapPx: 16,
  optionsAudioSettingColumnGapPx: 24,
  optionsFontFamily: "inherit",
  optionsHeadingColor: "#f4f2f0",
  optionsLabelColor: "#f4f2f0",
  optionsValueColor: "#b9c7d8",
  optionsHeadingFontSize: 34,
  optionsLabelFontSize: 22,
  optionsValueFontSize: 17,
  optionsHeadingFontWeight: "600",
  optionsLabelFontWeight: "600",
  optionsValueFontWeight: "400",
  optionsSliderTrackColor: "#394454",
  optionsSliderFillColor: "#83b9e8",
  optionsSliderThumbColor: "#f4f2f0",
  optionsSliderThumbDecoration: "border",
  optionsSliderThumbDecorationColor: "#e8edf4",
  optionsSliderThumbBorderWidthPx: 1,
  optionsSliderTrackHeightPx: 6,
  optionsSliderTrackRadiusPx: 99,
  optionsSliderThumbSizePx: 18,
  optionsSliderThumbRadiusPx: 99,
  optionsBackButtonTextColor: "#f5f3f2",
  optionsBackHoverColor: "#83b9e8",
  optionsBackButtonFontSize: 19,
  optionsBackButtonFontWeight: "700",
  optionsBackLetterSpacingPx: 3,
  optionsBackButtonAlign: "center",
  optionsHeadingFontFamily: "inherit",
  optionsLabelFontFamily: "inherit",
  optionsValueFontFamily: "inherit",
  optionsBackFontFamily: "inherit",
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
  optionButtonBorderRadiusPx: 32,
  optionButtonSizePx: 56,
  titleFontSize: 64,
  primaryButtonFontSize: 16,
  slapButtonFontSize: 16,
  utilityButtonFontSize: 13,
  staffHeadingFontSize: 22,
  staffRoleFontSize: 15,
  staffNameFontSize: 25,
  endingTitleFontFamily: "inherit",
  endingTitleFontSize: 64,
  endingTitleFontWeight: "600",
  endingTitleColor: "#f4f2f0",
  endingTitleLetterSpacingPx: 5,
  endingBackFontFamily: "inherit",
  endingBackFontSize: 20,
  endingBackFontWeight: "700",
  endingBackColor: "#f5f3f2",
  endingBackHoverColor: "#83b9e8",
  endingBackLetterSpacingPx: 3,
  endingBackMarginTopPx: 24,
  debugFontSize: 13
});

const DEFAULT_UI_TEXT = Object.freeze({
  startButton: "はじめる",
  newGameButton: "NEW GAME",
  configButton: "CONFIG",
  slapButton: "頬を叩く",
  titleButton: "BACK",
  speedNormal: "倍速 OFF",
  speedFast: "倍速 ON",
  staffHeading: "STAFF",
  defaultEndingTitle: "THE END",
  debugAnomaly: "DEBUG｜異変あり",
  debugNormal: "DEBUG｜異変なし",
  loadErrorTitle: "読み込みエラー",
  reloadStartButton: "再読み込みして開始",
  optionsHeading: "オプション",
  optionsButtonLabel: "オプション",
  optionsBgmLabel: "BGM",
  optionsSeLabel: "SE",
  optionsVolumeValueFormat: "{value} / {max}",
  optionsVolumeOffText: "OFF",
  optionsBack: "BACK"
});

const DEFAULT_TITLE_SCREEN_STYLE = Object.freeze({
  mainTitleX: 75, mainTitleY: 12, mainTitleWidth: 55, mainTitleAlign: "center",
  mainTitleFontSize: 96, mainTitleFontFamily: "", mainTitleColor: "#20252a",
  subtitleX: 75, subtitleY: 22, subtitleWidth: 46, subtitleAlign: "center",
  subtitleFontSize: 40, subtitleFontFamily: "", subtitleColor: "#33434a",
  menuX: 75, menuY: 32, menuWidth: 36, menuAlign: "center",
  menuFontSize: 52, menuFontFamily: "", menuGapPx: 24, menuItemHeightPx: 72,
  menuTextColor: "#20282e", menuHoverTextColor: "#ffffff", menuHoverBandColor: "#69b8cf",
  backgroundGradientOpacity: 68, backgroundGradientWidth: 62
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
    this.optionsReturnFocusTarget = null;
    this.editorEndingPreviewToken = 0;
    this.staffRollAnimation = null;
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
    this.updateTitleScreenContent();
    this.applyTitleScreenStyle();
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
      } else if (event.data?.type === "G8_EDITOR_ENDING_PREVIEW") {
        this.playEditorEndingPreview(event.data);
      }
    });

    if (window.parent !== window) {
      window.parent.postMessage({ type: "G8_EDITOR_PREVIEW_READY" }, window.location.origin);
    }
  }

  async playEditorEndingPreview(payload) {
    const requestId = payload?.requestId;
    const segment = payload?.segment === "ending-screen" ? "ending-screen" : "staff-to-ending";
    const presentation = payload?.presentation;
    if (!presentation || typeof presentation !== "object") return;

    this.staffRollAnimation?.cancel();
    this.staffRollAnimation = null;
    const previewToken = ++this.editorEndingPreviewToken;
    this.cancelScript();
    this.encounterLoadId += 1;
    this.loopIntroToken += 1;
    this.audioManager?.stopBgm();

    this.config = {
      ...this.config,
      ...presentation,
      uiText: { ...this.config?.uiText, ...presentation.uiText },
      uiTheme: { ...this.config?.uiTheme, ...presentation.uiTheme },
      settings: { ...this.config?.settings, ...presentation.settings }
    };
    await applyFontSettings(this.config.fontSettings);
    if (previewToken !== this.editorEndingPreviewToken) return;
    this.applyUiText();
    this.applyUiTheme();

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

    this.dom.endingScreenTitle.textContent = this.config.endingScreenTitle || this.ending?.title || this.getUiText("defaultEndingTitle");
    this.setEndingScreenBackground();

    try {
      if (segment === "staff-to-ending" && this.renderStaffRoll()) {
        this.setStaffRollBackground();
        await this.setScreenBgm(this.config.staffRollBgm);
        if (previewToken !== this.editorEndingPreviewToken) return;
        const completed = await this.playStaffRoll(() => previewToken === this.editorEndingPreviewToken);
        if (!completed || previewToken !== this.editorEndingPreviewToken) return;
        await this.transitionStaffRollToEnding(() => previewToken === this.editorEndingPreviewToken);
      } else {
        this.dom.staffRollScreen.hidden = true;
        await this.setScreenBgm(this.config.endingScreenBgm);
        if (previewToken !== this.editorEndingPreviewToken) return;
        this.dom.game.classList.add("at-ending");
        this.dom.endingScreen.hidden = false;
      }
      if (previewToken !== this.editorEndingPreviewToken) return;
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "G8_EDITOR_ENDING_PREVIEW_FINISHED",
          requestId,
          segment,
          status: "completed"
        }, window.location.origin);
      }
    } catch (error) {
      if (previewToken !== this.editorEndingPreviewToken) return;
      console.error(error);
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "G8_EDITOR_ENDING_PREVIEW_FINISHED",
          requestId,
          segment,
          status: "error",
          message: error?.message || String(error)
        }, window.location.origin);
      }
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
      "title-screen", "title-screen-background", "title-screen-title", "title-screen-main-title", "title-screen-subtitle", "title-screen-menu", "start-button", "title-config-button", "staff-roll-screen", "staff-roll-background", "staff-roll",
      "ending-screen", "ending-screen-background", "ending-screen-title", "title-button", "screen-transition-cover",
      "loop-intro-screen", "loop-intro-text", "debug-indicator", "judgment-panel", "slap-button", "slap-button-label",
      "options-button", "options-screen", "options-heading", "options-back-link", "bgm-volume-label", "se-volume-label", "bgm-volume-input", "se-volume-input", "bgm-volume-value", "se-volume-value", "speed-button", "game-title",
      "loading-screen", "loading-label", "loading-progress-track", "loading-progress-bar", "loading-progress-percent", "loading-retry-button"
    ];
    for (const id of ids) this.dom[this.toCamelCase(id)] = document.getElementById(id);
  }

  toCamelCase(value) {
    return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  getUiText(key) {
    const value = this.config?.uiText?.[key];
    if (key === "titleButton" && value === "タイトルへ") return DEFAULT_UI_TEXT.titleButton;
    return value == null ? (DEFAULT_UI_TEXT[key] ?? "") : String(value);
  }

  applyUiText() {
    this.dom.startButton.textContent = this.getUiText("newGameButton");
    this.dom.titleConfigButton.textContent = this.getUiText("configButton");
    this.dom.slapButtonLabel.textContent = this.getUiText("slapButton");
    this.dom.titleButton.textContent = this.getUiText("titleButton");
    this.dom.optionsHeading.textContent = this.getUiText("optionsHeading");
    const optionsButtonLabel = this.getUiText("optionsButtonLabel");
    this.dom.optionsButton.setAttribute("aria-label", optionsButtonLabel);
    this.dom.optionsButton.title = optionsButtonLabel;
    this.dom.bgmVolumeLabel.textContent = this.getUiText("optionsBgmLabel");
    this.dom.seVolumeLabel.textContent = this.getUiText("optionsSeLabel");
    this.dom.optionsBackLink.textContent = this.getUiText("optionsBack");
    this.updatePlaybackSpeedButtonLabel();
  }

  updateTitleScreenContent() {
    const mainTitle = String(this.config?.titleScreenTitle || this.config?.title || "");
    const subtitle = String(this.config?.titleScreenSubtitle || "").trim();
    this.dom.titleScreenMainTitle.textContent = mainTitle;
    this.dom.titleScreenSubtitle.textContent = subtitle;
    this.dom.titleScreenSubtitle.hidden = !subtitle;
    this.dom.titleConfigButton.hidden = false;
    this.dom.startButton.textContent = this.getUiText("newGameButton");
    this.dom.titleConfigButton.textContent = this.getUiText("configButton");
  }

  applyUiTheme() {
    const configuredTheme = this.config?.uiTheme || {};
    const theme = { ...DEFAULT_UI_THEME, ...configuredTheme };
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
      if (configured == null && key === "endingTitleFontSize") configured = this.config?.uiTheme?.titleFontSize;
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

    const normalizeOptionsFontFamily = (value, fallback) => {
      const candidate = String(value ?? "inherit").trim();
      if (!candidate || candidate.toLowerCase() === "inherit") return fallback;
      return candidate.length <= 240 && /^[\p{L}\p{M}\p{N}\s"'(),._-]+$/u.test(candidate)
        ? candidate : fallback;
    };
    const safeOptionsFontFamily = normalizeOptionsFontFamily(
      theme.optionsFontFamily, "var(--game-font-family, sans-serif)"
    );
    const optionsHeadingFontFamily = normalizeOptionsFontFamily(theme.optionsHeadingFontFamily, safeOptionsFontFamily);
    const optionsLabelFontFamily = normalizeOptionsFontFamily(theme.optionsLabelFontFamily, safeOptionsFontFamily);
    const optionsValueFontFamily = normalizeOptionsFontFamily(theme.optionsValueFontFamily, safeOptionsFontFamily);
    const optionsBackFontFamily = normalizeOptionsFontFamily(theme.optionsBackFontFamily, safeOptionsFontFamily);
    const endingTitleFontFamily = normalizeOptionsFontFamily(theme.endingTitleFontFamily, "var(--game-font-family, sans-serif)");
    const endingBackFontFamily = normalizeOptionsFontFamily(theme.endingBackFontFamily, "var(--game-font-family, sans-serif)");
    const safeFontWeight = (key, fallback) => {
      const value = String(theme[key] ?? fallback);
      return ["300", "400", "500", "600", "700", "800", "900"].includes(value) ? value : fallback;
    };
    const safeBackButtonAlign = ["start", "center", "end"].includes(theme.optionsBackButtonAlign)
      ? theme.optionsBackButtonAlign : "center";
    // Old projects may only define a shared border or the primary-button theme.
    const legacyBorder = {
      enabled: configuredTheme.uiBorderEnabled !== false && configuredTheme.uiBorderEnabled !== "false",
      color: configuredTheme.uiBorderColor ?? "#ffffff",
      width: configuredTheme.uiBorderWidthPx ?? 1
    };
    root.style.setProperty("--options-overlay-background", rgba(theme.optionsOverlayBackgroundColor, theme.optionsOverlayBackgroundOpacity));
    root.style.setProperty("--options-overlay-blur", areaPx("optionsOverlayBlurPx", 0, 40));
    root.style.setProperty("--options-screen-padding", areaPx("optionsScreenPaddingPx", 0, 160));
    root.style.setProperty("--options-panel-background", rgba(theme.optionsPanelBackgroundColor, theme.optionsPanelBackgroundOpacity));
    root.style.setProperty("--options-panel-width", areaPx("optionsPanelWidthPx", 360, 1600));
    root.style.setProperty("--options-panel-padding-vertical", areaPx("optionsPanelPaddingVerticalPx", 0, 240));
    root.style.setProperty("--options-panel-padding-horizontal", areaPx("optionsPanelPaddingHorizontalPx", 0, 240));
    root.style.setProperty("--options-panel-radius", areaPx("optionsPanelBorderRadiusPx", 0, 120));
    root.style.setProperty("--options-heading-gap", areaPx("optionsHeadingGapPx", 0, 200));
    root.style.setProperty("--options-settings-gap", areaPx("optionsSettingsGapPx", 0, 200));
    root.style.setProperty("--options-audio-row-gap", areaPx("optionsAudioSettingRowGapPx", 0, 120));
    root.style.setProperty("--options-audio-column-gap", areaPx("optionsAudioSettingColumnGapPx", 0, 120));
    root.style.setProperty("--options-font-family", safeOptionsFontFamily);
    root.style.setProperty("--options-heading-font-family", optionsHeadingFontFamily);
    root.style.setProperty("--options-label-font-family", optionsLabelFontFamily);
    root.style.setProperty("--options-value-font-family", optionsValueFontFamily);
    root.style.setProperty("--options-heading-color", normalizeHex(theme.optionsHeadingColor, DEFAULT_UI_THEME.optionsHeadingColor));
    root.style.setProperty("--options-label-color", normalizeHex(theme.optionsLabelColor, DEFAULT_UI_THEME.optionsLabelColor));
    root.style.setProperty("--options-value-color", normalizeHex(theme.optionsValueColor, DEFAULT_UI_THEME.optionsValueColor));
    root.style.setProperty("--options-heading-font-size", fontSize("optionsHeadingFontSize"));
    root.style.setProperty("--options-label-font-size", fontSize("optionsLabelFontSize"));
    root.style.setProperty("--options-value-font-size", fontSize("optionsValueFontSize"));
    root.style.setProperty("--options-heading-font-weight", safeFontWeight("optionsHeadingFontWeight", "600"));
    root.style.setProperty("--options-label-font-weight", safeFontWeight("optionsLabelFontWeight", "600"));
    root.style.setProperty("--options-value-font-weight", safeFontWeight("optionsValueFontWeight", "400"));
    root.style.setProperty("--options-slider-track-color", normalizeHex(theme.optionsSliderTrackColor, DEFAULT_UI_THEME.optionsSliderTrackColor));
    root.style.setProperty("--options-slider-fill-color", normalizeHex(theme.optionsSliderFillColor, DEFAULT_UI_THEME.optionsSliderFillColor));
    root.style.setProperty("--options-slider-thumb-color", normalizeHex(theme.optionsSliderThumbColor, DEFAULT_UI_THEME.optionsSliderThumbColor));
    const sliderThumbDecoration = theme.optionsSliderThumbDecoration === "shadow" ? "shadow" : "border";
    const sliderThumbDecorationColor = normalizeHex(
      theme.optionsSliderThumbDecorationColor,
      DEFAULT_UI_THEME.optionsSliderThumbDecorationColor
    );
    root.style.setProperty(
      "--options-slider-thumb-border",
      sliderThumbDecoration === "border"
        ? `${areaPx("optionsSliderThumbBorderWidthPx", 0, 8)} solid ${sliderThumbDecorationColor}`
        : "0 solid transparent"
    );
    root.style.setProperty(
      "--options-slider-thumb-shadow",
      sliderThumbDecoration === "shadow" ? `0 1px 5px ${rgba(sliderThumbDecorationColor, 35)}` : "none"
    );
    root.style.setProperty("--options-slider-track-height", areaPx("optionsSliderTrackHeightPx", 1, 32));
    root.style.setProperty("--options-slider-track-radius", areaPx("optionsSliderTrackRadiusPx", 0, 120));
    root.style.setProperty("--options-slider-thumb-size", areaPx("optionsSliderThumbSizePx", 8, 64));
    root.style.setProperty("--options-slider-thumb-radius", areaPx("optionsSliderThumbRadiusPx", 0, 120));
    root.style.setProperty("--options-back-link-text", normalizeHex(
      configuredTheme.optionsBackButtonTextColor ?? theme.primaryButtonTextColor,
      DEFAULT_UI_THEME.primaryButtonTextColor
    ));
    root.style.setProperty("--options-back-link-hover", normalizeHex(
      theme.optionsBackHoverColor, DEFAULT_UI_THEME.optionsBackHoverColor
    ));
    root.style.setProperty("--options-back-link-font-family", optionsBackFontFamily);
    root.style.setProperty("--options-back-link-font-size", fontSize("optionsBackButtonFontSize"));
    root.style.setProperty("--options-back-link-font-weight", safeFontWeight("optionsBackButtonFontWeight", "700"));
    root.style.setProperty("--options-back-link-letter-spacing", areaPx("optionsBackLetterSpacingPx", 0, 20));
    root.style.setProperty("--options-back-link-align", safeBackButtonAlign);
    root.style.setProperty("--ending-title-font-family", endingTitleFontFamily);
    root.style.setProperty("--ending-title-font-size", fontSize("endingTitleFontSize"));
    root.style.setProperty("--ending-title-font-weight", safeFontWeight("endingTitleFontWeight", "600"));
    root.style.setProperty("--ending-title-letter-spacing", areaPx("endingTitleLetterSpacingPx", 0, 30));
    root.style.setProperty("--ending-title-color", normalizeHex(theme.endingTitleColor, DEFAULT_UI_THEME.endingTitleColor));
    root.style.setProperty("--ending-back-font-family", endingBackFontFamily);
    root.style.setProperty("--ending-back-font-size", fontSize("endingBackFontSize"));
    root.style.setProperty("--ending-back-font-weight", safeFontWeight("endingBackFontWeight", "700"));
    root.style.setProperty("--ending-back-color", normalizeHex(theme.endingBackColor, DEFAULT_UI_THEME.endingBackColor));
    root.style.setProperty("--ending-back-hover-color", normalizeHex(theme.endingBackHoverColor, DEFAULT_UI_THEME.endingBackHoverColor));
    root.style.setProperty("--ending-back-letter-spacing", areaPx("endingBackLetterSpacingPx", 0, 30));
    root.style.setProperty("--ending-back-margin-top", areaPx("endingBackMarginTopPx", 0, 200));

    // Old projects only have one shared border setting. Use it as the initial
    // value for each component until an individual setting is saved.
    const borderGroups = [
      ["dialoguePanel", "dialogue-panel"],
      ["primaryButton", "primary-button"],
      ["slapButton", "slap-button"],
      ["utilityButton", "utility-button"],
      ["optionButton", "option-button"],
      ["optionsPanel", "options-panel"]
    ];
    for (const [key, cssName] of borderGroups) {
      const enabledValue = configuredTheme[`${key}BorderEnabled`];
      const colorValue = configuredTheme[`${key}BorderColor`];
      const widthValue = configuredTheme[`${key}BorderWidthPx`];
      const enabled = enabledValue == null
        ? legacyBorder.enabled
        : enabledValue !== false && enabledValue !== "false";
      const borderColor = normalizeHex(colorValue ?? legacyBorder.color, "#ffffff");
      const parsedWidth = Number(widthValue ?? legacyBorder.width);
      const borderWidth = `${Math.max(0, Math.min(20, Number.isFinite(parsedWidth) ? Math.round(parsedWidth) : 1))}px`;
      root.style.setProperty(`--${cssName}-border-color`, borderColor);
      root.style.setProperty(`--${cssName}-border-width`, enabled ? borderWidth : "0px");
    }
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

  applyTitleScreenStyle() {
    const configured = this.config?.titleScreenStyle || {};
    const style = { ...DEFAULT_TITLE_SCREEN_STYLE, ...configured };
    const root = document.documentElement;
    const bounded = (key, min, max, fallback) => {
      const value = Number(style[key]);
      return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
    };
    const align = (key) => ["left", "center", "right"].includes(style[key]) ? style[key] : "center";
    const color = (key, fallback) => {
      const value = String(style[key] ?? "").trim();
      if (/^#[0-9a-f]{6}$/i.test(value)) return value;
      if (/^#[0-9a-f]{3}$/i.test(value)) return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
      return fallback;
    };
    const family = (key) => {
      const value = String(style[key] ?? "").trim();
      if (!value) return "var(--game-font-family, sans-serif)";
      return value.length <= 240 && /^[\p{L}\p{M}\p{N}\s"'(),._-]+$/u.test(value)
        ? value
        : "var(--game-font-family, sans-serif)";
    };
    const percentVars = [
      ["mainTitleX", "--title-main-x", 0, 100], ["mainTitleY", "--title-main-y", 0, 100],
      ["mainTitleWidth", "--title-main-width", 8, 100],
      ["subtitleX", "--title-subtitle-x", 0, 100], ["subtitleY", "--title-subtitle-y", 0, 100],
      ["subtitleWidth", "--title-subtitle-width", 8, 100],
      ["menuX", "--title-menu-x", 0, 100], ["menuY", "--title-menu-y", 0, 100],
      ["menuWidth", "--title-menu-width", 8, 100]
    ];
    for (const [key, variable, min, max] of percentVars) {
      const fallback = DEFAULT_TITLE_SCREEN_STYLE[key];
      root.style.setProperty(variable, `${bounded(key, min, max, fallback)}%`);
    }
    root.style.setProperty("--title-bg-gradient-opacity", String(bounded("backgroundGradientOpacity", 0, 100, 68) / 100));
    root.style.setProperty("--title-bg-gradient-width", `${bounded("backgroundGradientWidth", 0, 100, 62)}%`);
    for (const [key, variable, min, max] of [
      ["mainTitleFontSize", "--title-main-font-size", 8, 180],
      ["subtitleFontSize", "--title-subtitle-font-size", 8, 120],
      ["menuFontSize", "--title-menu-font-size", 8, 100],
      ["menuGapPx", "--title-menu-gap", 0, 160],
      ["menuItemHeightPx", "--title-menu-item-height", 24, 180]
    ]) {
      root.style.setProperty(variable, `${bounded(key, min, max, DEFAULT_TITLE_SCREEN_STYLE[key])}px`);
    }
    for (const [key, variable] of [
      ["mainTitleAlign", "--title-main-align"], ["subtitleAlign", "--title-subtitle-align"], ["menuAlign", "--title-menu-align"]
    ]) root.style.setProperty(variable, align(key));
    for (const [key, variable] of [
      ["mainTitleFontFamily", "--title-main-font-family"],
      ["subtitleFontFamily", "--title-subtitle-font-family"],
      ["menuFontFamily", "--title-menu-font-family"]
    ]) root.style.setProperty(variable, family(key));
    for (const [key, variable, fallback] of [
      ["mainTitleColor", "--title-main-color", "#20252a"],
      ["subtitleColor", "--title-subtitle-color", "#33434a"],
      ["menuTextColor", "--title-menu-text-color", "#20282e"],
      ["menuHoverTextColor", "--title-menu-hover-text", "#ffffff"],
      ["menuHoverBandColor", "--title-menu-hover-band", "#69b8cf"]
    ]) root.style.setProperty(variable, color(key, fallback));
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
    const format = this.getUiText("optionsVolumeValueFormat");
    const offText = this.getUiText("optionsVolumeOffText");
    const formatValue = (value) => value === 0 ? offText
      : format.replaceAll("{value}", String(value)).replaceAll("{max}", "10");
    this.dom.bgmVolumeValue.textContent = formatValue(bgm);
    this.dom.seVolumeValue.textContent = formatValue(se);
    this.dom.bgmVolumeInput.style.setProperty("--range-progress", `${bgm * 10}%`);
    this.dom.seVolumeInput.style.setProperty("--range-progress", `${se * 10}%`);
  }

  setAudioVolume(kind, value) {
    const level = Math.max(0, Math.min(10, Math.round(Number(value) || 0)));
    if (kind === "bgm") this.audioManager?.setBgmVolumeLevel(level);
    else this.audioManager?.setSeVolumeLevel(level);
    this.updateAudioVolumeControls();
    this.saveAudioPreferences();
  }

  openOptions(returnFocusTarget = this.dom.optionsButton) {
    if (!this.dom.optionsScreen) return;
    if (returnFocusTarget === this.dom.optionsButton && this.dom.optionsButton.hidden) return;
    this.optionsReturnFocusTarget = returnFocusTarget;
    this.updateAudioVolumeControls();
    this.dom.optionsScreen.hidden = false;
    this.dom.optionsButton.setAttribute("aria-expanded", "true");
    this.dom.titleConfigButton.setAttribute("aria-expanded", "true");
  }

  closeOptions() {
    this.dom.optionsScreen.hidden = true;
    this.dom.optionsButton.setAttribute("aria-expanded", "false");
    this.dom.titleConfigButton.setAttribute("aria-expanded", "false");
    const target = this.optionsReturnFocusTarget;
    this.optionsReturnFocusTarget = null;
    if (target && !target.hidden && target.getClientRects().length > 0) target.focus();
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
    this.dom.titleConfigButton.addEventListener("click", () => {
      this.playUiSound("titleConfigSoundEffect");
      this.openOptions(this.dom.titleConfigButton);
    });
    this.dom.loadingRetryButton.addEventListener("click", () => window.location.reload());
    this.dom.titleButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (this.dom.game.classList.contains("editor-preview-mode")) return;
      this.returnToTitle();
    });
    this.dom.slapButton.addEventListener("click", () => this.submitChoice("slap"));
    this.dom.optionsButton.addEventListener("click", () => this.openOptions());
    this.dom.optionsBackLink.addEventListener("click", (event) => {
      event.preventDefault();
      this.playUiSound("optionsBackSoundEffect");
      this.closeOptions();
    });
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
    this.updateTitleScreenContent();
    this.dom.titleScreen.hidden = false;
    this.dom.optionsScreen.hidden = true;
    this.dom.optionsButton.setAttribute("aria-expanded", "false");
    this.dom.titleConfigButton.setAttribute("aria-expanded", "false");
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

  playUiSound(settingKey) {
    const soundKey = String(this.config?.settings?.[settingKey] ?? "").trim();
    if (soundKey) void this.audioManager?.playEffect(soundKey);
  }

  async animateScreenTransitionCover(fromOpacity, toOpacity, durationMs, easing = "ease-in-out") {
    const cover = this.dom.screenTransitionCover;
    if (!cover) return;
    const duration = Math.max(0, Math.min(10000, Math.round(Number(durationMs) || 0)));
    cover.hidden = false;
    cover.style.opacity = String(fromOpacity);
    if (duration === 0) {
      cover.style.opacity = String(toOpacity);
      return;
    }
    void cover.offsetWidth;
    const animation = cover.animate(
      [{ opacity: fromOpacity }, { opacity: toOpacity }],
      { duration, easing, fill: "forwards" }
    );
    this.playbackClock.applyAnimationRate(animation);
    try {
      await animation.finished;
    } catch (error) {
      // Keep the transition state deterministic if an animation is interrupted.
    } finally {
      cover.style.opacity = String(toOpacity);
      animation.cancel();
    }
  }

  async startNewGame() {
    if (this.inputLocked) return;
    this.inputLocked = true;
    this.playUiSound("titleNewGameSoundEffect");

    const settings = this.config?.settings || {};
    const fadeToBlackMs = settings.titleOpeningFadeToBlackMs ?? 1200;
    const bgmFadeOutMs = settings.titleOpeningBgmFadeOutMs ?? 1400;
    const revealFromBlackMs = settings.titleOpeningRevealMs ?? 500;
    const dialogueDelayMs = settings.titleOpeningDialogueDelayMs ?? 350;
    const dialogueTextDelayMs = settings.titleOpeningDialogueTextDelayMs ?? 300;
    const fadeToBlack = this.animateScreenTransitionCover(0, 1, fadeToBlackMs, "ease-in");
    const fadeOutBgm = this.audioManager?.fadeOutBgm(bgmFadeOutMs) ?? Promise.resolve(false);
    await Promise.all([fadeToBlack, fadeOutBgm]);
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
    this.dom.debugIndicator.hidden = true;
    this.dom.judgmentPanel.hidden = true;
    this.dialogueBox.setJudgmentEnabled(false);
    this.dom.slapButton.disabled = false;
    this.sceneRenderer.clearScene();
    this.dialogueBox.hide();

    try {
      this.dialogueBox.holdNextLine({ textDelayMs: dialogueTextDelayMs });
      const openingOutcome = this.playScript(this.opening.script, "OPENING").then(
        (completed) => ({ completed }),
        (error) => ({ error })
      );
      await this.animateScreenTransitionCover(1, 0, revealFromBlackMs, "ease-out");
      this.dom.screenTransitionCover.hidden = true;
      this.dom.screenTransitionCover.style.removeProperty("opacity");
      if (dialogueDelayMs > 0) await this.playbackClock.wait(dialogueDelayMs);
      this.dialogueBox.releaseHeldLine();
      const openingResult = await openingOutcome;
      this.dialogueBox.clearNextLineGate();
      if (openingResult.error) throw openingResult.error;
      this.state.beginLoop();
      this.dom.loopIntroScreen.hidden = true;
      this.dom.judgmentPanel.hidden = true;
      this.inputLocked = false;
      this.loadAndPlayEncounter().catch((error) => this.showFatalError(error));
    } catch (error) {
      this.dialogueBox.releaseHeldLine();
      this.dialogueBox.clearNextLineGate();
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

  async playStaffRoll(shouldContinue = () => true) {
    const content = this.dom.staffRoll.querySelector(".staff-roll-content");
    if (!content) return false;

    this.dom.game.classList.add("at-staff-roll");
    this.dom.staffRollScreen.hidden = false;

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const viewportHeight = this.dom.staffRollScreen.clientHeight || 1080;
    const contentHeight = content.offsetHeight;
    const travelDistance = viewportHeight + contentHeight;
    const staffRollScrollSpeedPxPerSecond = 55;
    const minimumStaffRollDurationMs = 12000;
    const durationMs = Math.max(
      minimumStaffRollDurationMs,
      (travelDistance / staffRollScrollSpeedPxPerSecond) * 1000
    );

    // Web Animations API avoids CSS animation overrides and reduced-motion
    // styles that previously left short credits parked at the top. The credits
    // scroll is deliberately independent from the gameplay fast-forward rate:
    // editor preview and the actual ending must have the same pacing even when
    // the player reached the ending while 2x playback was enabled.
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
    this.staffRollAnimation = animation;
    animation.playbackRate = 1;

    try {
      await animation.finished;
    } catch (error) {
      // A canceled animation should not trap the game on the staff-roll screen.
    } finally {
      if (this.staffRollAnimation === animation) this.staffRollAnimation = null;
    }
    return shouldContinue();
  }

  async transitionStaffRollToEnding(shouldContinue = () => true) {
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
    if (!shouldContinue()) {
      fadeToBlack.cancel();
      return false;
    }
    cover.style.opacity = "1";
    fadeToBlack.cancel();

    // Swap the screens only while the opaque cover guarantees that no frame
    // of the previous gameplay scene can become visible. Keep the staff-roll
    // track running when explicitly requested and an actual staff-roll BGM is set.
    const continueStaffRollBgm = (
      this.config.settings?.continueStaffRollBgmToEnding === true
      || this.config.settings?.continueStaffRollBgmToEnding === "true"
    ) && Boolean(String(this.config.staffRollBgm ?? "").trim());
    if (!continueStaffRollBgm) {
      await this.setScreenBgm(this.config.endingScreenBgm);
    }
    staffRoll.hidden = true;
    staffRoll.style.removeProperty("opacity");
    this.dom.game.classList.remove("at-staff-roll");
    this.dom.game.classList.add("at-ending");
    ending.style.opacity = "1";
    ending.hidden = false;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (!shouldContinue()) return false;

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
      if (!shouldContinue()) {
        fadeFromBlack.cancel();
        return false;
      }
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
    this.dom.titleScreenMainTitle.textContent = this.getUiText("loadErrorTitle");
    this.dom.titleScreenSubtitle.textContent = "";
    this.dom.titleScreenSubtitle.hidden = true;
    this.dom.titleConfigButton.hidden = true;
    this.dom.startButton.textContent = this.getUiText("reloadStartButton");
    this.dom.judgmentPanel.hidden = true;
    if (this.dom.debugIndicator) this.dom.debugIndicator.hidden = true;
    this.inputLocked = false;
  }
}
