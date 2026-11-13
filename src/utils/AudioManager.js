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

function clampGain(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
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
    this.audioContext = null;
    this.audioContextUnavailable = false;
    this.audioOutputs = new WeakMap();
    this.fallbackAudioStates = new WeakMap();
    this.fallbackVolumeRamps = new WeakMap();
  }

  getBgmGain() {
    return loudnessLevelToGain(this.bgmVolumeLevel);
  }

  getSeGain() {
    return loudnessLevelToGain(this.seVolumeLevel);
  }

  getAudioContext() {
    if (this.audioContext || this.audioContextUnavailable) return this.audioContext;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      this.audioContextUnavailable = true;
      return null;
    }
    try {
      this.audioContext = new AudioContextClass();
    } catch {
      this.audioContextUnavailable = true;
    }
    return this.audioContext;
  }

  ensureAudioOutput(audio) {
    const existing = this.audioOutputs.get(audio);
    if (existing) return existing;

    const context = this.getAudioContext();
    if (!context) return null;

    try {
      const source = context.createMediaElementSource(audio);
      const volumeGain = context.createGain();
      const fadeGain = context.createGain();
      const now = context.currentTime;
      volumeGain.gain.setValueAtTime(1, now);
      fadeGain.gain.setValueAtTime(1, now);
      source.connect(volumeGain);
      volumeGain.connect(fadeGain);
      fadeGain.connect(context.destination);
      audio.volume = 1;
      const output = { context, source, volumeGain, fadeGain };
      this.audioOutputs.set(audio, output);
      return output;
    } catch (error) {
      console.warn("Web Audio の音量制御を初期化できませんでした。通常の音量制御に切り替えます", error);
      return null;
    }
  }

  async resumeAudioContext() {
    const context = this.audioContext;
    if (!context || context.state !== "suspended") return;
    try {
      await context.resume();
    } catch (error) {
      console.warn("AudioContext を再開できませんでした", error);
    }
  }

  rampAudioParam(param, context, target, durationSeconds = 0.035, immediate = false) {
    const value = clampGain(target);
    const now = context.currentTime;
    if (immediate) {
      param.cancelScheduledValues(now);
      param.setValueAtTime(value, now);
      return;
    }

    if (typeof param.cancelAndHoldAtTime === "function") {
      param.cancelAndHoldAtTime(now);
    } else {
      const current = clampGain(param.value);
      param.cancelScheduledValues(now);
      param.setValueAtTime(current, now);
    }
    param.linearRampToValueAtTime(value, now + Math.max(0.005, durationSeconds));
  }

  getFallbackAudioState(audio) {
    let state = this.fallbackAudioStates.get(audio);
    if (!state) {
      state = { volumeGain: audio.volume, fadeGain: 1 };
      this.fallbackAudioStates.set(audio, state);
    }
    return state;
  }

  applyFallbackGain(audio, state, immediate = false) {
    const target = clampGain(state.volumeGain * state.fadeGain);
    const previous = this.fallbackVolumeRamps.get(audio);
    if (previous) window.cancelAnimationFrame(previous.frame);

    if (immediate) {
      audio.volume = target;
      this.fallbackVolumeRamps.delete(audio);
      return;
    }

    const startValue = clampGain(audio.volume);
    const startedAt = performance.now();
    const durationMs = 40;
    const ramp = { frame: 0 };
    const update = (now) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / durationMs));
      audio.volume = startValue + (target - startValue) * progress;
      if (progress >= 1) {
        this.fallbackVolumeRamps.delete(audio);
        return;
      }
      ramp.frame = window.requestAnimationFrame(update);
    };
    this.fallbackVolumeRamps.set(audio, ramp);
    ramp.frame = window.requestAnimationFrame(update);
  }

  setPlayerVolume(audio, gain, immediate = false) {
    const output = this.ensureAudioOutput(audio);
    if (output) {
      this.rampAudioParam(output.volumeGain.gain, output.context, gain, 0.035, immediate);
      void this.resumeAudioContext();
      return;
    }

    const state = this.getFallbackAudioState(audio);
    state.volumeGain = clampGain(gain);
    this.applyFallbackGain(audio, state, immediate);
  }

  getBgmFadeGainAtTime(fade, time = fade?.output?.context?.currentTime ?? 0) {
    if (!fade || !fade.output || fade.startTime === null || fade.endTime === null) {
      return clampGain(fade?.startVolume ?? 1);
    }
    const duration = fade.endTime - fade.startTime;
    if (duration <= 0) return 0;
    const progress = Math.min(1, Math.max(0, (time - fade.startTime) / duration));
    return clampGain(fade.startVolume * (1 - progress));
  }

  getPlayerFadeGain(audio) {
    const fade = this.bgmFade;
    if (fade?.audio === audio && fade.output) {
      return this.getBgmFadeGainAtTime(fade);
    }
    const output = this.audioOutputs.get(audio);
    if (output) return clampGain(output.fadeGain.gain.value);
    return clampGain(this.getFallbackAudioState(audio).fadeGain);
  }

  setPlayerFadeGain(audio, gain, immediate = false) {
    const output = this.audioOutputs.get(audio);
    if (output) {
      this.rampAudioParam(output.fadeGain.gain, output.context, gain, 0.02, immediate);
      return;
    }

    const state = this.getFallbackAudioState(audio);
    state.fadeGain = clampGain(gain);
    this.applyFallbackGain(audio, state, immediate);
  }

  setBgmVolumeLevel(level) {
    this.bgmVolumeLevel = normalizeVolumeLevel(level);
    if (this.bgmPlayer) this.setPlayerVolume(this.bgmPlayer, this.getBgmGain());
  }

  setSeVolumeLevel(level) {
    this.seVolumeLevel = normalizeVolumeLevel(level);
    const gain = this.getSeGain();
    for (const audio of this.players.values()) this.setPlayerVolume(audio, gain);
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
      this.players.set(key, audio);
      this.setPlayerVolume(audio, this.getSeGain(), true);
      this.setPlayerFadeGain(audio, 1, true);
    }
    try {
      this.setPlayerVolume(audio, this.getSeGain());
      await this.resumeAudioContext();
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
      this.cancelBgmFade();
      this.setPlayerVolume(this.bgmPlayer, this.getBgmGain(), true);
      this.setPlayerFadeGain(this.bgmPlayer, 1, true);
      if (this.bgmPlayer.paused) await this.startBgm();
      return;
    }

    this.stopBgm();
    const audio = new Audio(source);
    audio.loop = true;
    audio.preload = "auto";
    this.bgmPlayer = audio;
    this.bgmKey = bgmKey;
    this.setPlayerVolume(audio, this.getBgmGain(), true);
    this.setPlayerFadeGain(audio, 1, true);
    await this.startBgm();
  }

  async startBgm() {
    if (!this.bgmPlayer || !this.bgmPlayer.paused) return;
    this.setPlayerVolume(this.bgmPlayer, this.getBgmGain(), true);
    this.setPlayerFadeGain(this.bgmPlayer, 1, true);
    await this.resumeAudioContext();
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
    if (fade.frame) window.cancelAnimationFrame(fade.frame);

    if (fade.output && fade.startTime !== null && fade.endTime !== null) {
      const context = fade.output.context;
      const now = context.currentTime;
      const heldGain = this.getBgmFadeGainAtTime(fade, now);
      const param = fade.output.fadeGain.gain;
      param.cancelScheduledValues(now);
      param.setValueAtTime(heldGain, now);
      fade.heldGain = heldGain;
    }
    fade.resolve(false);
  }

  fadeOutBgm(durationMs = 1000) {
    const audio = this.bgmPlayer;
    if (!audio) return Promise.resolve(false);

    const currentFadeGain = this.getPlayerFadeGain(audio);
    this.cancelBgmFade();

    const duration = Math.max(0, Number(durationMs) || 0);
    if (duration === 0 || audio.paused || currentFadeGain <= 0) {
      this.setPlayerFadeGain(audio, 0, true);
      audio.pause();
      return Promise.resolve(true);
    }

    const output = this.audioOutputs.get(audio);
    if (!output) return this.fadeOutBgmFallback(audio, currentFadeGain, duration);

    return new Promise((resolve) => {
      const fade = {
        frame: 0,
        resolve,
        audio,
        output,
        startVolume: currentFadeGain,
        startTime: null,
        endTime: null
      };
      this.bgmFade = fade;

      const beginFade = async () => {
        await this.resumeAudioContext();
        if (this.bgmPlayer !== audio || this.bgmFade !== fade) return;

        const context = output.context;
        const now = context.currentTime;
        const speed = Math.max(1, Number(this.getPlaybackSpeed()) || 1);
        const fadeSeconds = duration / 1000 / speed;
        const endTime = now + fadeSeconds;
        const param = output.fadeGain.gain;

        // Schedule one continuous audio-thread ramp instead of replacing a short ramp
        // on every animation frame. This avoids repeated automation cancellation at
        // the start of the title-to-opening fade, which can produce audible artifacts.
        param.cancelScheduledValues(now);
        param.setValueAtTime(currentFadeGain, now);
        param.linearRampToValueAtTime(0, endTime);
        fade.startTime = now;
        fade.endTime = endTime;

        const waitForFade = () => {
          if (this.bgmPlayer !== audio || this.bgmFade !== fade) return;
          if (context.currentTime >= endTime) {
            const finishedAt = context.currentTime;
            param.cancelScheduledValues(finishedAt);
            param.setValueAtTime(0, finishedAt);
            this.bgmFade = null;
            audio.pause();
            resolve(true);
            return;
          }
          fade.frame = window.requestAnimationFrame(waitForFade);
        };
        fade.frame = window.requestAnimationFrame(waitForFade);
      };

      beginFade().catch((error) => {
        if (this.bgmFade === fade) this.bgmFade = null;
        console.warn("BGM のフェードアウトを開始できませんでした", error);
        resolve(false);
      });
    });
  }

  fadeOutBgmFallback(audio, startGain, durationMs) {
    return new Promise((resolve) => {
      const fade = {
        frame: 0,
        resolve,
        audio,
        output: null,
        startVolume: startGain,
        startTime: null,
        endTime: null,
        progress: 0
      };
      let startedAt = null;
      this.bgmFade = fade;
      const update = (now) => {
        if (this.bgmPlayer !== audio || this.bgmFade !== fade) return;
        if (startedAt === null) startedAt = now;
        const speed = Math.max(1, Number(this.getPlaybackSpeed()) || 1);
        const elapsed = Math.max(0, now - startedAt) * speed;
        fade.progress = Math.min(1, elapsed / durationMs);
        this.setPlayerFadeGain(audio, startGain * (1 - fade.progress));
        if (fade.progress >= 1) {
          this.bgmFade = null;
          this.setPlayerFadeGain(audio, 0, true);
          audio.pause();
          resolve(true);
          return;
        }
        fade.frame = window.requestAnimationFrame(update);
      };
      fade.frame = window.requestAnimationFrame(update);
    });
  }

  stopBgm() {
    this.cancelBgmFade();
    if (this.bgmPlayer) {
      this.bgmPlayer.pause();
      this.bgmPlayer.currentTime = 0;
      this.setPlayerFadeGain(this.bgmPlayer, 1, true);
      this.setPlayerVolume(this.bgmPlayer, this.getBgmGain(), true);
    }
    this.bgmPlayer = null;
    this.bgmKey = null;
  }
}
