export class ResetSystem {
  reset(state) {
    state.resetAfterFailure();
    return {
      progress: state.progress,
      attemptCount: state.attemptCount
    };
  }
}
