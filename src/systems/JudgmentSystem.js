export class JudgmentSystem {
  judge(hasAnomaly, action) {
    const spottedAnomaly = action === "slap";
    return spottedAnomaly === hasAnomaly;
  }
}
