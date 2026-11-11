/**
 * Shared time scale for automatic game timing and visual animations.
 * Player input and media playback are intentionally not scaled.
 */
export class PlaybackClock {
  constructor(root = document) {
    this.root = root;
    this.rate = 1;
    this.waiters = new Set();

    this.handleAnimationStart = (event) => this.applyRateToTarget(event.target);
    this.handleTransitionRun = (event) => this.applyRateToTarget(event.target);
    this.root?.addEventListener?.("animationstart", this.handleAnimationStart, true);
    this.root?.addEventListener?.("transitionrun", this.handleTransitionRun, true);
  }

  getRate() {
    return this.rate;
  }

  setRate(value) {
    const nextRate = Math.max(1, Number(value) || 1);
    if (nextRate === this.rate) return;

    const now = performance.now();
    this.rate = nextRate;

    for (const waiter of this.waiters) {
      this.updateRemaining(waiter, now);
      window.clearTimeout(waiter.timer);
      waiter.rate = nextRate;
      waiter.startedAt = now;
      this.schedule(waiter);
    }

    this.applyRateToRunningAnimations();
  }

  wait(durationMs) {
    const duration = Math.max(0, Number(durationMs) || 0);
    if (duration === 0) {
      const completed = Promise.resolve();
      completed.cancel = () => {};
      return completed;
    }

    let waiter;
    const promise = new Promise((resolve) => {
      waiter = {
        remaining: duration,
        rate: this.rate,
        startedAt: performance.now(),
        timer: null,
        resolve,
        settled: false
      };
      this.waiters.add(waiter);
      this.schedule(waiter);
    });

    promise.cancel = () => this.finish(waiter);
    return promise;
  }

  schedule(waiter) {
    if (waiter.settled) return;
    waiter.timer = window.setTimeout(() => {
      this.updateRemaining(waiter, performance.now());
      if (waiter.remaining <= 1) {
        this.finish(waiter);
      } else {
        this.schedule(waiter);
      }
    }, Math.max(1, waiter.remaining / waiter.rate));
  }

  updateRemaining(waiter, now) {
    const elapsed = Math.max(0, now - waiter.startedAt);
    waiter.remaining = Math.max(0, waiter.remaining - elapsed * waiter.rate);
    waiter.startedAt = now;
  }

  finish(waiter) {
    if (!waiter || waiter.settled) return;
    waiter.settled = true;
    window.clearTimeout(waiter.timer);
    this.waiters.delete(waiter);
    waiter.resolve();
  }

  applyAnimationRate(animation) {
    if (!animation || animation.playState === "finished") return;
    try {
      animation.playbackRate = this.rate;
    } catch (error) {
      // Some browser-managed animations may not expose a writable playbackRate.
    }
  }

  applyRateToTarget(target) {
    if (!target?.getAnimations) return;
    for (const animation of target.getAnimations()) {
      this.applyAnimationRate(animation);
    }
  }

  applyRateToRunningAnimations() {
    if (!this.root?.getAnimations) return;
    for (const animation of this.root.getAnimations({ subtree: true })) {
      this.applyAnimationRate(animation);
    }
  }
}
