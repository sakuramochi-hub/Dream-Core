/** Shared G8S command executor used by both the game and the editor preview. */
export class ScenarioPlayer {
  constructor({ sceneRenderer, dialogueBox, audioManager = null, playbackClock }) {
    this.sceneRenderer = sceneRenderer;
    this.dialogueBox = dialogueBox;
    this.audioManager = audioManager;
    this.playbackClock = playbackClock;
  }

  async execute(command, tag, { preview = false, beforeTransitionReveal = null } = {}) {
    // Dialogue, narration, audio and screen-effect commands can run without
    // interrupting the current text window. Scene-changing commands close it.
    const keepsDialogueWindow = ["dialogue", "narration", "soundEffect", "bgm", "stopBgm", "fadeOutBgm", "screenShake", "screenFlash"].includes(command.type);
    if (!keepsDialogueWindow) this.dialogueBox.hide();

    switch (command.type) {
      case "background": {
        const covered = !preview && this.sceneRenderer.isTransitionCovered?.();
        const update = this.sceneRenderer.setBackground(command.asset, { waitForReady: Boolean(covered) });
        if (covered) await update;
        break;
      }
      case "character":
        this.sceneRenderer.setCharacter(command);
        break;
      case "hideCharacter":
        this.sceneRenderer.hideCharacter(command.id ?? null, { animate: !preview });
        break;
      case "dialogue": {
        const line = { speaker: command.speaker ?? "", text: command.text ?? "", tag };
        if (preview) this.dialogueBox.showPreviewLine(line);
        else await this.dialogueBox.showLine(line);
        break;
      }
      case "narration": {
        const line = { speaker: "", text: command.text ?? "", tag };
        if (preview) this.dialogueBox.showPreviewLine(line);
        else await this.dialogueBox.showLine(line);
        break;
      }
      case "wait":
        if (!preview) await this.playbackClock.wait(command.ms);
        break;
      case "soundEffect":
        if (!preview) await this.audioManager?.playEffect(command.key);
        break;
      case "bgm":
        if (!preview) await this.audioManager?.playBgm(command.key);
        break;
      case "stopBgm":
        if (!preview) this.audioManager?.stopBgm();
        break;
      case "fadeOutBgm":
        if (!preview) {
          const duration = Math.max(0, Number(command.ms) || 0);
          await this.audioManager?.fadeOutBgm(duration);
        }
        break;
      case "screenShake":
        if (!preview) {
          const duration = Math.max(0, Number(command.ms) || 0);
          this.sceneRenderer.playShake(duration, command.strength);
        }
        break;
      case "screenFlash":
        if (!preview) {
          const duration = Math.max(0, Number(command.ms) || 0);
          this.sceneRenderer.playFlash(duration, command.color, command.opacity);
        }
        break;
      case "transition":
        if (preview) {
          this.sceneRenderer.setTransitionState(command);
          break;
        }
        if (command.action === "sequence") {
          await this.sceneRenderer.playTransitionSequence(command, beforeTransitionReveal);
        } else {
          await this.sceneRenderer.playTransition(command);
        }
        break;
      case "endScenario":
        return true;
      default:
        console.warn(`未対応のシナリオコマンド: ${command.type}`);
    }
    return false;
  }

  async play(script, tag, isCurrent = () => true) {
    for (let index = 0; index < script.length; index += 1) {
      const command = script[index];
      if (!isCurrent()) return false;
      if (command.type === "endScenario") {
        this.dialogueBox.hide();
        return true;
      }

      // A background command immediately following a combined transition is
      // part of that transition: apply it while the curtain is fully closed,
      // then reveal the new scene. Consume consecutive background commands
      // together so none of them can run after the curtain has opened.
      if (command.type === "transition" && command.action === "sequence") {
        const backgrounds = [];
        let nextIndex = index + 1;
        while (nextIndex < script.length && script[nextIndex].type === "background") {
          backgrounds.push(script[nextIndex]);
          nextIndex += 1;
        }

        const beforeTransitionReveal = backgrounds.length
          ? async () => {
              for (const backgroundCommand of backgrounds) {
                if (!isCurrent()) return;
                await this.execute(backgroundCommand, tag);
              }
            }
          : null;

        await this.execute(command, tag, { beforeTransitionReveal });
        index += backgrounds.length;
      } else {
        await this.execute(command, tag);
      }
      if (!isCurrent()) return false;
    }
    return isCurrent();
  }

  renderPreview(script, targetPageIndex, tag = "PREVIEW") {
    this.sceneRenderer.clearScene();
    this.sceneRenderer.scene.classList.remove("shake");
    this.sceneRenderer.slapFlash?.classList.remove("play");
    this.dialogueBox.hide();

    // A page is a visible text block. Background, character, hide, wait,
    // transition and end commands update scene state but never consume a page.
    const commands = (script ?? []).filter((command) => command.type !== "endScenario");
    const pageCommands = commands.filter((command) => command.type === "dialogue" || command.type === "narration");
    if (!pageCommands.length) return { pageCount: 0, currentPage: 0 };

    const lastPage = Math.min(Math.max(0, Math.trunc(Number(targetPageIndex) || 0)), pageCommands.length - 1);
    let page = -1;
    for (const command of commands) {
      if (command.type === "dialogue" || command.type === "narration") {
        page += 1;
        if (page > lastPage) break;
        this.execute(command, tag, { preview: true });
        if (page === lastPage) break;
        continue;
      }
      // Apply scene-state commands encountered before the selected text page.
      this.execute(command, tag, { preview: true });
    }
    return { pageCount: pageCommands.length, currentPage: lastPage };
  }
}
