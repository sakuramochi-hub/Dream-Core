const HEADER_FIELDS = new Set(["タイトル", "ID", "異変", "種類"]);
const COMMAND_FIELDS = new Set(["背景", "立ち絵", "立ち絵を隠す", "待機", "トランジション", "効果音再生", "BGM再生", "BGM停止", "BGMフェードアウト", "画面シェイク", "画面フラッシュ", "地の文"]);

export class ScenarioScriptError extends Error {
  constructor(message, line) {
    super(line ? `${line}行目: ${message}` : message);
    this.name = "ScenarioScriptError";
    this.line = line || 0;
  }
}

function splitField(line) {
  const match = line.match(/^([^：:]+)[：:](.*)$/);
  return match ? [match[1].trim(), match[2].trim()] : null;
}

function consumeBlock(lines, startIndex) {
  const body = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      body.push("");
      index += 1;
      continue;
    }
    if (!/^[ \t]/.test(line)) break;
    if (line.startsWith("  ")) body.push(line.slice(2));
    else if (line.startsWith("\t")) body.push(line.slice(1));
    else body.push(line.slice(1));
    index += 1;
  }
  while (body.length && body.at(-1) === "") body.pop();
  return { text: body.join("\n"), nextIndex: index };
}

function parseCharacter(value, lineNumber) {
  const match = value.match(/^([^\s（(]+)(?:[（(](.*)[）)])?$/);
  if (!match) throw new ScenarioScriptError("立ち絵の書き方が正しくありません。例：立ち絵：heroine（表情=smile、位置=中央）", lineNumber);
  const command = { type: "character", id: match[1], expression: "default", position: "center" };
  const options = match[2] || "";
  for (const item of options.split(/[、,]/).map((part) => part.trim()).filter(Boolean)) {
    const option = item.match(/^([^=：:]+)[=：:](.+)$/);
    if (!option) throw new ScenarioScriptError(`立ち絵の指定「${item}」を読み取れません。`, lineNumber);
    const key = option[1].trim();
    const optionValue = option[2].trim();
    if (key === "表情") command.expression = optionValue;
    else if (key === "位置") {
      command.position = ({ "中央": "center", "左": "left", "右": "right" })[optionValue] || optionValue;
    } else throw new ScenarioScriptError(`立ち絵の項目「${key}」には対応していません。`, lineNumber);
  }
  return command;
}

function parseDuration(value, lineNumber, label = "時間", maxMs = Number.POSITIVE_INFINITY) {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(ms|ミリ秒|秒)?$/i);
  if (!match) throw new ScenarioScriptError(`${label}は「500ms」または「0.5秒」の形式で指定してください。`, lineNumber);
  const amount = Number(match[1]);
  const ms = (match[2] === "秒") ? amount * 1000 : amount;
  if (!Number.isFinite(ms) || ms < 0 || ms > maxMs) {
    throw new ScenarioScriptError(`${label}は0～${maxMs}msの範囲で指定してください。`, lineNumber);
  }
  return { type: "wait", ms: Math.round(ms) };
}

function parseWait(value, lineNumber) {
  return parseDuration(value, lineNumber, "待機時間");
}

function parseScreenEffect(value, lineNumber, type) {
  const label = type === "screenShake" ? "画面シェイク" : "画面フラッシュ";
  const match = value.match(/^(\d+(?:\.\d+)?\s*(?:ms|ミリ秒|秒)?)(?:\s*[（(](.*)[）)])?$/i);
  if (!match) throw new ScenarioScriptError(`${label}は「300ms」または「0.3秒」の形式で指定してください。`, lineNumber);

  const duration = parseDuration(match[1], lineNumber, `${label}時間`, 10000).ms;
  const command = type === "screenShake"
    ? { type, ms: duration, strength: 7 }
    : { type, ms: duration, color: "#ffffff", opacity: 0.85 };
  const colors = { "白": "#ffffff", "黒": "#000000", "赤": "#ff3333", "青": "#3388ff", "黄": "#ffdd33", "緑": "#33cc88" };

  for (const item of (match[2] || "").split(/[、,]/).map((part) => part.trim()).filter(Boolean)) {
    const option = item.match(/^([^=：:]+)[=：:](.+)$/);
    if (!option) throw new ScenarioScriptError(`${label}の指定「${item}」を読み取れません。`, lineNumber);
    const key = option[1].trim();
    const optionValue = option[2].trim();
    if (type === "screenShake" && key === "強さ") {
      const amount = optionValue.match(/^(\d+(?:\.\d+)?)\s*(?:px)?$/i);
      const strength = amount ? Number(amount[1]) : Number.NaN;
      if (!Number.isFinite(strength) || strength < 0 || strength > 40) {
        throw new ScenarioScriptError("画面シェイクの強さは0～40pxで指定してください。", lineNumber);
      }
      command.strength = strength;
    } else if (type === "screenFlash" && key === "色") {
      const color = colors[optionValue] || optionValue;
      if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
        throw new ScenarioScriptError("画面フラッシュの色は白・黒・赤・青・黄・緑、または16進カラーコードで指定してください。", lineNumber);
      }
      command.color = color;
    } else if (type === "screenFlash" && key === "濃さ") {
      const opacity = Number(optionValue);
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
        throw new ScenarioScriptError("画面フラッシュの濃さは0～1で指定してください。", lineNumber);
      }
      command.opacity = opacity;
    } else {
      throw new ScenarioScriptError(`${label}の項目「${key}」には対応していません。`, lineNumber);
    }
  }
  return command;
}

function parseTransition(value, lineNumber) {
  const match = value.match(/^([^（(]+)(?:[（(](.*)[）)])?$/);
  if (!match) throw new ScenarioScriptError("トランジションは「閉じる」「開く」または「切り替え」で指定してください。", lineNumber);
  const actionName = match[1].trim();
  const actions = { "閉じる": "cover", "開く": "reveal", "切り替え": "sequence" };
  const action = actions[actionName];
  if (!action) throw new ScenarioScriptError("トランジションの動作は「閉じる」「開く」「切り替え」です。", lineNumber);

  const command = {
    type: "transition",
    action,
    color: "#000000",
    direction: "right-to-left",
    duration: 600,
    closeDuration: 600,
    holdDuration: 0,
    openDuration: 600,
    easing: "linear"
  };
  const easingValues = new Set(["linear", "ease", "ease-in", "ease-out", "ease-in-out"]);
  const options = match[2] || "";
  for (const item of options.split(/[、,]/).map((part) => part.trim()).filter(Boolean)) {
    const option = item.match(/^([^=：:]+)[=：:](.+)$/);
    if (!option) throw new ScenarioScriptError(`トランジションの指定「${item}」を読み取れません。`, lineNumber);
    const key = option[1].trim();
    const optionValue = option[2].trim();
    if (key === "色") {
      if (optionValue !== "黒") throw new ScenarioScriptError("現在指定できるトランジションの色は「黒」です。", lineNumber);
    } else if (key === "方向") {
      const directions = { "右から左": "right-to-left", "左から右": "left-to-right" };
      if (!directions[optionValue]) throw new ScenarioScriptError("方向は「右から左」または「左から右」で指定してください。", lineNumber);
      command.direction = directions[optionValue];
    } else if (key === "時間") {
      const duration = parseDuration(optionValue, lineNumber, "トランジション時間", 60000).ms;
      if (action === "sequence") {
        command.closeDuration = duration;
        command.openDuration = duration;
      } else {
        command.duration = duration;
      }
    } else if (["閉じる時間", "待機", "開く時間"].includes(key)) {
      if (action !== "sequence") {
        throw new ScenarioScriptError(`「${key}」は「トランジション：切り替え」でのみ指定できます。`, lineNumber);
      }
      const duration = parseDuration(optionValue, lineNumber, key, 60000).ms;
      if (key === "閉じる時間") command.closeDuration = duration;
      else if (key === "待機") command.holdDuration = duration;
      else command.openDuration = duration;
    } else if (key === "イージング") {
      if (!easingValues.has(optionValue)) throw new ScenarioScriptError("イージングは linear / ease / ease-in / ease-out / ease-in-out のいずれかです。", lineNumber);
      command.easing = optionValue;
    } else {
      throw new ScenarioScriptError(`トランジションの項目「${key}」には対応していません。`, lineNumber);
    }
  }
  return command;
}

export function parseScenarioScript(source, options = {}) {
  if (typeof source !== "string") throw new ScenarioScriptError("シナリオ本文がテキストではありません。");
  const lines = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const result = { id: "", title: "", script: [] };
  if (options.includeSourceLocations) result.sourceLocations = [];
  const pushCommand = (command, startLine, endLine = startLine, synthetic = false) => {
    result.script.push(command);
    if (options.includeSourceLocations) result.sourceLocations.push({ startLine, endLine, synthetic });
  };
  let hasAnomaly = null;
  let sawCommand = false;
  let ended = false;
  let index = 0;

  while (index < lines.length) {
    const original = lines[index];
    const trimmed = original.trim();
    const lineNumber = index + 1;
    if (!trimmed || trimmed.startsWith("#")) { index += 1; continue; }
    if (/^[ \t]/.test(original)) {
      throw new ScenarioScriptError("本文以外の行は左端から書いてください。セリフや地の文の本文は2文字分字下げします。", lineNumber);
    }
    if (ended) throw new ScenarioScriptError("「終了」の後に内容があります。終了は最後に置いてください。", lineNumber);

    if (trimmed === "BGM停止") {
      pushCommand({ type: "stopBgm" }, lineNumber);
      sawCommand = true;
      index += 1;
      continue;
    }

    const field = splitField(trimmed);
    if (!field) {
      if (trimmed === "終了") {
        pushCommand({ type: "endScenario" }, lineNumber);
        ended = true;
        sawCommand = true;
        index += 1;
        continue;
      }
      throw new ScenarioScriptError("この行を読み取れません。『背景：』『地の文：』『話者名：』などで始めてください。", lineNumber);
    }

    const [name, value] = field;
    if (HEADER_FIELDS.has(name)) {
      if (sawCommand) throw new ScenarioScriptError("タイトル・ID・異変の設定はシナリオ本文より前にまとめてください。", lineNumber);
      if (name === "タイトル") result.title = value;
      else if (name === "ID") result.id = value;
      else if (name === "異変") {
        if (!["あり", "なし"].includes(value)) throw new ScenarioScriptError("異変は「あり」または「なし」で指定してください。", lineNumber);
        hasAnomaly = value === "あり";
      }
      index += 1;
      continue;
    }

    sawCommand = true;
    if (name === "背景") {
      if (!value) throw new ScenarioScriptError("背景キーが空です。", lineNumber);
      pushCommand({ type: "background", asset: value }, lineNumber);
      index += 1;
      continue;
    }
    if (name === "立ち絵") {
      pushCommand(parseCharacter(value, lineNumber), lineNumber);
      index += 1;
      continue;
    }
    if (name === "立ち絵を隠す") {
      pushCommand({ type: "hideCharacter", id: (!value || value === "全員") ? null : value }, lineNumber);
      index += 1;
      continue;
    }
    if (name === "待機") {
      pushCommand(parseWait(value, lineNumber), lineNumber);
      index += 1;
      continue;
    }
    if (name === "効果音再生" || name === "BGM再生") {
      if (!value) throw new ScenarioScriptError(`${name}の音声キーが空です。`, lineNumber);
      pushCommand({ type: name === "効果音再生" ? "soundEffect" : "bgm", key: value }, lineNumber);
      index += 1;
      continue;
    }
    if (name === "BGMフェードアウト") {
      const duration = parseDuration(value, lineNumber, "BGMフェードアウト時間");
      pushCommand({ type: "fadeOutBgm", ms: duration.ms }, lineNumber);
      index += 1;
      continue;
    }
    if (name === "BGM停止") {
      if (value) throw new ScenarioScriptError("BGM停止に値は指定できません。", lineNumber);
      pushCommand({ type: "stopBgm" }, lineNumber);
      index += 1;
      continue;
    }
    if (name === "画面シェイク" || name === "画面フラッシュ") {
      const type = name === "画面シェイク" ? "screenShake" : "screenFlash";
      pushCommand(parseScreenEffect(value, lineNumber, type), lineNumber);
      index += 1;
      continue;
    }
    if (name === "トランジション") {
      pushCommand(parseTransition(value, lineNumber), lineNumber);
      index += 1;
      continue;
    }

    const isNarration = name === "地の文";
    const block = consumeBlock(lines, index + 1);
    if (!block.text.trim()) throw new ScenarioScriptError("本文が空です。次の行から字下げして文章を入力してください。", lineNumber);
    const contentEnd = Math.max(lineNumber, block.nextIndex);
    pushCommand(isNarration
      ? { type: "narration", text: block.text }
      : { type: "dialogue", speaker: name, text: block.text }, lineNumber, contentEnd);
    index = block.nextIndex;
  }

  if (!result.id) throw new ScenarioScriptError("IDがありません。「ID：opening」のように指定してください。");
  if (!result.title) result.title = result.id;
  if (hasAnomaly !== null) result.hasAnomaly = hasAnomaly;
  if (!result.script.length) throw new ScenarioScriptError("シナリオ本文がありません。");
  if (!ended) pushCommand({ type: "endScenario" }, lines.length, lines.length, true);
  if (result.script.at(-1)?.type !== "endScenario") throw new ScenarioScriptError("シナリオは「終了」で終えてください。");
  if (result.script.filter((command) => command.type === "endScenario").length !== 1) {
    throw new ScenarioScriptError("「終了」は1回だけ指定してください。");
  }
  return result;
}

function blockText(label, text) {
  const body = String(text ?? "").split("\n").map((line) => `  ${line}`).join("\n");
  return `${label}：\n${body}`;
}

export function serializeScenarioScript(scenario) {
  const lines = [
    `タイトル：${scenario.title || scenario.id || "新しいシナリオ"}`,
    `ID：${scenario.id || "new_scenario"}`
  ];
  if (typeof scenario.hasAnomaly === "boolean") lines.push(`異変：${scenario.hasAnomaly ? "あり" : "なし"}`);
  lines.push("");
  for (const command of scenario.script || []) {
    switch (command.type) {
      case "background":
        lines.push(`背景：${command.asset || "clubroom"}`, "");
        break;
      case "character": {
        const position = ({ center: "中央", left: "左", right: "右" })[command.position] || command.position || "中央";
        lines.push(`立ち絵：${command.id || "heroine"}（表情=${command.expression || "default"}、位置=${position}）`, "");
        break;
      }
      case "hideCharacter":
        lines.push(`立ち絵を隠す：${command.id || "全員"}`, "");
        break;
      case "dialogue":
        lines.push(blockText(command.speaker || "話者", command.text), "");
        break;
      case "narration":
        lines.push(blockText("地の文", command.text), "");
        break;
      case "wait":
        lines.push(`待機：${Number(command.ms) || 0}ms`, "");
        break;
      case "soundEffect":
        lines.push(`効果音再生：${command.key || "effect_key"}`, "");
        break;
      case "bgm":
        lines.push(`BGM再生：${command.key || "bgm_key"}`, "");
        break;
      case "stopBgm":
        lines.push("BGM停止", "");
        break;
      case "fadeOutBgm": {
        const duration = Math.max(0, Number(command.ms) || 0);
        const formatted = duration % 1000 === 0 ? `${duration / 1000}秒` : `${duration}ms`;
        lines.push(`BGMフェードアウト：${formatted}`, "");
        break;
      }
      case "screenShake": {
        const duration = Math.max(0, Number(command.ms) || 0);
        const formatted = duration % 1000 === 0 ? `${duration / 1000}秒` : `${duration}ms`;
        const strength = Math.max(0, Math.min(40, Number(command.strength ?? 7)));
        lines.push(`画面シェイク：${formatted}（強さ=${strength}px）`, "");
        break;
      }
      case "screenFlash": {
        const duration = Math.max(0, Number(command.ms) || 0);
        const formatted = duration % 1000 === 0 ? `${duration / 1000}秒` : `${duration}ms`;
        const color = command.color || "#ffffff";
        const opacity = Math.max(0, Math.min(1, Number(command.opacity ?? 0.85)));
        lines.push(`画面フラッシュ：${formatted}（色=${color}、濃さ=${opacity}）`, "");
        break;
      }
      case "transition": {
        const direction = command.direction === "left-to-right" ? "左から右" : "右から左";
        const formatDuration = (value) => {
          const duration = Math.max(0, Number(value) || 0);
          return duration % 1000 === 0 ? `${duration / 1000}秒` : `${duration}ms`;
        };
        if (command.action === "sequence") {
          lines.push(
            `トランジション：切り替え（色=黒、方向=${direction}、閉じる時間=${formatDuration(command.closeDuration)}、待機=${formatDuration(command.holdDuration)}、開く時間=${formatDuration(command.openDuration)}、イージング=${command.easing || "linear"}）`,
            ""
          );
        } else {
          const action = command.action === "reveal" ? "開く" : "閉じる";
          lines.push(`トランジション：${action}（色=黒、方向=${direction}、時間=${formatDuration(command.duration)}、イージング=${command.easing || "linear"}）`, "");
        }
        break;
      }
      case "endScenario":
        lines.push("終了");
        break;
      default:
        throw new ScenarioScriptError(`未対応のコマンド「${command.type}」があります。`);
    }
  }
  return lines.join("\n").replace(/\n*$/, "\n");
}
