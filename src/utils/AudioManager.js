function normalizeVolumeLevel(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10, Math.round(parsed))) : 10;
}

function loudnessLevelToGain(level) {
  const normalized = normalizeVolumeLevel(level);
  if (normalized === 0) return 0;
  const decibels = -30 + ((normalized - 1) / 9) * 30;
  return 10 ** (decibels / 20);
}

export class AudioManager {
  constructor(manifestLoader, getPlaybackSpeed = () => 1) {
    this.manifestLoader = manifestLoader;
    this.getPlaybackSpeed = getPlaybackSpeed;
    this.bgmVolumeLevel = 10;
    this.seVolumeLevel = 10;
    this.players = new Map();
    this.bgmPlayer = null;
    this.bgmKey = null;
    this.bgmFade = null;
  }

  getBgmGain() {
    return loudnessLevelToGain(this.bgmVolumeLevel);
  }

  getSeGain() {
    return loudnessLevelToGain(this.seVolumeLevel);
  }

  setBgmVolumeLevel(level) {
    this.bgmVolumeLevel = normalizeVolumeLevel(level);
    if (!this.bgmPlayer) return;

    if (this.bgmFade?.audio === this.bgmPlayer) {
      this.bgmFade.startVolume = this.getBgmGain();
      this.bgmPlayer.volume = this.bgmFade.startVolume * (1 - this.bgmFade.progress);
    } else {
      this.bgmPlayer.volume = this.getBgmGain();
    }
  }

  setSeVolumeLevel(level) {
    this.seVolumeLevel = normalizeVolumeLevel(level);
    const gain = this.getSeGain();
    for (const audio of this.players.values()) audio.volume = gain;
  }

  async playEffect(key) {
    const source = this.manifestLoader.getAudio(key);
    if (!source) {
      console.warn(`効果音「${key}」が manifest.json に登録されていません`);
      return;
    }

    let audio = this.players.get(key);
    if (!audio) {
      audio = new Audio(source);
      audio.volume = this.getSeGain();
      this.players.set(key, audio);
    }
    try {
      audio.volume = this.getSeGain();
      audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      console.warn(`効果音 ${key} を再生できませんでした`, error);
    }
  }

  play(key) {
    return this.playEffect(key);
  }

  async playBgm(key) {
    const bgmKey = String(key ?? "").trim();
    if (!bgmKey) {
      this.stopBgm();
      return;
    }

    const source = this.manifestLoader.getAudio(bgmKey);
    if (!source) {
      this.stopBgm();
      console.warn(`BGM「${bgmKey}」が manifest.json に登録されていません`);
      return;
    }

    if (this.bgmKey === bgmKey && this.bgmPlayer) {
      // Reissuing the current key resumes the same media element. If a fade is
      // still running, cancel it and restore the selected BGM level without
      // resetting currentTime.
      this.cancelBgmFade();
      this.bgmPlayer.volume = this.getBgmGain();
      if (this.bgmPlayer.paused) await this.startBgm();
      return;
    }

    this.stopBgm();
    const audio = new Audio(source);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = this.getBgmGain();
    this.bgmPlayer = audio;
    this.bgmKey = bgmKey;
    await this.startBgm();
  }

  async startBgm() {
    if (!this.bgmPlayer || !this.bgmPlayer.paused) return;
    this.bgmPlayer.volume = this.getBgmGain();
    try {
      await this.bgmPlayer.play();
    } catch (error) {
      console.warn(`BGM ${this.bgmKey} を再生できませんでした`, error);
    }
  }

  cancelBgmFade() {
    if (!this.bgmFade) return;
    const fade = this.bgmFade;
    this.bgmFade = null;
    window.cancelAnimationFrame(fade.frame);
    fade.resolve(false);
  }

  fadeOutBgm(durationMs = 1000) {
    const audio = this.bgmPlayer;
    if (!audio) return Promise.resolve(false);

    this.cancelBgmFade();
    const duration = Math.max(0, Number(durationMs) || 0);
    if (duration === 0 || audio.paused) {
      // A fade-out is a temporary silence, not a stop command. Keep the media
      // element, key and playback position so the same BGM command can resume
      // it after any number of wait/dialogue commands.
      audio.pause();
      audio.volume = this.getBgmGain();
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const fade = {
        frame: 0,
        resolve,
        audio,
        startVolume: audio.volume,
        progress: 0
      };
      let lastFrameAt = null;
      let elapsed = 0;
      const update = (now) => {
        if (this.bgmPlayer !== audio || this.bgmFade !== fade) {
          resolve(false);
          return;
        }

        if (lastFrameAt !== null) {
          const speed = Math.max(1, Number(this.getPlaybackSpeed()) || 1);
          elapsed += Math.max(0, now - lastFrameAt) * speed;
        }
        lastFrameAt = now;
        fade.progress = Math.min(1, Math.max(0, elapsed / duration));
        audio.volume = fade.startVolume * (1 - fade.progress);
        if (fade.progress >= 1) {
          this.bgmFade = null;
          // Keep the paused media element and its exact playback position.
          // Only an explicit stop or a different BGM key discards this state.
          audio.pause();
          audio.volume = this.getBgmGain();
          resolve(true);
          return;
        }
        fade.frame = window.requestAnimationFrame(update);
      };

      this.bgmFade = fade;
      fade.frame = window.requestAnimationFrame(update);
    });
  }

  stopBgm() {
    this.cancelBgmFade();
    if (this.bgmPlayer) {
      this.bgmPlayer.pause();
      this.bgmPlayer.currentTime = 0;
      this.bgmPlayer.volume = this.getBgmGain();
    }
    this.bgmPlayer = null;
    this.bgmKey = null;
  }
}
