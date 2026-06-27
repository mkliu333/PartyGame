window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.EmojiAssets = window.PartyGame.EmojiAssets || {};
window.PartyGame.EmojiAssets.missingRuntimeFiles = window.PartyGame.EmojiAssets.missingRuntimeFiles || new Map();
window.PartyGame.EmojiAssets.loadedRuntimeFiles = window.PartyGame.EmojiAssets.loadedRuntimeFiles || new Map();
window.PartyGame.EmojiAssets.probedRuntimeFiles = window.PartyGame.EmojiAssets.probedRuntimeFiles || new Set();
window.PartyGame.EmojiAssets.missingMappings = window.PartyGame.EmojiAssets.missingMappings || new Map();

const EMOJI_GUESS_CATEGORIES = [
  { id: "\u731c\u540d\u4eba", label: "\u731c\u540d\u4eba" },
  { id: "\u731c\u6b4c\u540d", label: "\u731c\u6b4c\u540d" },
  { id: "\u731c\u6210\u8bed", label: "\u731c\u6210\u8bed" },
  { id: "\u731c\u54c1\u724c", label: "\u54c1\u724c\u540d\u79f0" }
];

// Every clues array item is one intact Unicode emoji token and maps to one
// answer character/unit. Never split clue strings or count emoji code units.

function normalizeEmojiGuessQuestionId(id) {
  return String(id ?? "").trim();
}

function normalizeEmojiGuessQuestion(rawQuestion) {
  const safe = rawQuestion && typeof rawQuestion === "object" ? rawQuestion : {};
  return {
    id: normalizeEmojiGuessQuestionId(safe.id),
    category: normalizeField(safe.category),
    sub_category: normalizeField(safe.sub_category),
    clues: Array.isArray(safe.clues) ? safe.clues.map(normalizeEmojiClue) : [],
    answer: normalizeField(safe.answer),
    hint: normalizeField(safe.hint),
    difficulty: normalizeField(safe.difficulty),
    note: normalizeField(safe.note)
  };
}

function normalizeEmojiClue(clue) {
  if (typeof clue === "string") return clue;
  if (!clue || typeof clue !== "object" || Array.isArray(clue)) return "";
  return {
    text: normalizeField(clue.text),
    code: normalizeField(clue.code).toLowerCase(),
    asset: normalizeField(clue.asset),
    label: normalizeField(clue.label)
  };
}

function getEmojiClueText(clue) {
  if (typeof clue === "string") return clue;
  if (!clue || typeof clue !== "object") return "";
  return normalizeField(clue.text);
}

function resolveEmojiClueAsset(clue, text) {
  const assetConfig = window.PARTY_EMOJI_ASSETS || {};
  const items = assetConfig.items && typeof assetConfig.items === "object" ? assetConfig.items : {};
  if (clue && typeof clue === "object" && !Array.isArray(clue)) {
    if (clue.asset) return clue.asset;
    if (clue.code) return `emoji_u${clue.code}.svg`;
  }
  return items[text] || "";
}

function syncEmojiImageState(image, token, text, asset) {
  if (!image.complete) return;
  if (image.naturalWidth > 0 && image.naturalHeight > 0) {
    recordLoadedEmojiAsset(text, asset, image.src);
    token.classList.remove("image-pending", "image-failed", "no-asset");
    token.classList.add("has-image");
    return;
  }
  token.classList.remove("image-pending", "has-image");
  token.classList.add("image-failed");
  recordMissingEmojiAsset(text, asset, image.src);
}

function getEmojiAssetBasePath() {
  const assetConfig = window.PARTY_EMOJI_ASSETS || {};
  return assetConfig.basePath || "assets/emoji/noto/svg/";
}

function getEmojiAssetQuestionsForCoverage() {
  if (typeof state !== "undefined" && Array.isArray(state.emojiGuessQuestions) && state.emojiGuessQuestions.length) {
    return state.emojiGuessQuestions;
  }
  return Array.isArray(window.PARTY_EMOJI_GUESS_QUESTIONS) ? window.PARTY_EMOJI_GUESS_QUESTIONS : [];
}

function getEmojiAssetCoverageReport() {
  const unique = new Map();
  const expectedFileMap = new Map();
  const missingMapping = [];
  getEmojiAssetQuestionsForCoverage().forEach((question) => {
    if (!Array.isArray(question.clues)) return;
    question.clues.forEach((clue) => {
      const text = getEmojiClueText(clue);
      if (!text || unique.has(text)) return;
      const filename = resolveEmojiClueAsset(clue, text);
      unique.set(text, filename);
      if (filename) {
        const path = `${getEmojiAssetBasePath()}${filename}`;
        if (!expectedFileMap.has(filename)) {
          expectedFileMap.set(filename, { text, tokens: [text], filename, path });
        } else {
          expectedFileMap.get(filename).tokens.push(text);
        }
      } else {
        missingMapping.push(text);
      }
    });
  });
  const expectedFiles = [...expectedFileMap.values()];
  const diagnostics = window.PartyGame.EmojiAssets;
  diagnostics.missingMappings.clear();
  missingMapping.forEach((text) => diagnostics.missingMappings.set(text, { text }));
  const loadedRuntimeFiles = expectedFiles.filter((item) => window.PartyGame.EmojiAssets.loadedRuntimeFiles.has(item.filename));
  const missingRuntimeFiles = [...window.PartyGame.EmojiAssets.missingRuntimeFiles.values()];
  const runtimeCoveragePercent = expectedFiles.length
    ? Math.round((loadedRuntimeFiles.length / expectedFiles.length) * 100)
    : 100;
  return {
    totalUniqueClues: unique.size,
    mapped: unique.size - missingMapping.length,
    missingMapping,
    missingMappings: [...diagnostics.missingMappings.values()],
    expectedFiles,
    loadedRuntimeFiles,
    missingRuntimeFiles,
    runtimeCoveragePercent
  };
}

function recordLoadedEmojiAsset(text, filename, assetPath) {
  const diagnostics = window.PartyGame.EmojiAssets;
  diagnostics.missingRuntimeFiles.delete(filename);
  diagnostics.loadedRuntimeFiles.set(filename, { text, filename, path: assetPath });
  if (isEmojiGuessActive()) renderEmojiGuessQuestionBankInspector();
}

function recordMissingEmojiAsset(text, filename, assetPath) {
  const diagnostics = window.PartyGame.EmojiAssets;
  diagnostics.loadedRuntimeFiles.delete(filename);
  if (!diagnostics.missingRuntimeFiles.has(filename)) {
    const entry = { text, filename, path: assetPath };
    diagnostics.missingRuntimeFiles.set(filename, entry);
    console.warn(`Missing Noto SVG for ${text}: ${assetPath}. Noto-only mode will show a placeholder instead of system emoji.`);
    if (isEmojiGuessActive()) renderEmojiGuessQuestionBankInspector();
  }
}

window.PartyGame.EmojiAssets.checkEmojiAssetCoverage = getEmojiAssetCoverageReport;
window.PartyGame.EmojiAssets.printCoverage = function () {
  const coverage = window.PartyGame.EmojiAssets.checkEmojiAssetCoverage();
  console.table(coverage.expectedFiles);
  console.table(coverage.loadedRuntimeFiles);
  console.table(coverage.missingRuntimeFiles);
  console.table(coverage.missingMappings);
};

window.PartyGame.EmojiAssets.debugCurrentTiles = function () {
  return [...document.querySelectorAll(".emoji-clue-token")].map((token) => {
    const img = token.querySelector("img");
    const missing = token.querySelector(".emoji-clue-missing");
    const loading = token.querySelector(".emoji-clue-loading");
    return {
      className: token.className,
      title: token.title,
      imgSrc: img ? img.src : "",
      complete: img ? img.complete : null,
      naturalWidth: img ? img.naturalWidth : null,
      naturalHeight: img ? img.naturalHeight : null,
      imgDisplay: img ? getComputedStyle(img).display : null,
      imgVisibility: img ? getComputedStyle(img).visibility : null,
      loadingDisplay: loading ? getComputedStyle(loading).display : null,
      missingDisplay: missing ? getComputedStyle(missing).display : null,
      missingText: missing ? missing.textContent : ""
    };
  });
};

window.PartyGame.EmojiAssets.forceReloadCurrentTiles = function () {
  document.querySelectorAll(".emoji-clue-token img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src) return;
    img.removeAttribute("src");
    img.src = `${src}${src.includes("?") ? "&" : "?"}reload=${Date.now()}`;
  });
};

function probeEmojiAssetCoverage() {
  const diagnostics = window.PartyGame.EmojiAssets;
  const coverage = window.PartyGame.EmojiAssets.checkEmojiAssetCoverage();
  coverage.expectedFiles.forEach((item) => {
    if (diagnostics.probedRuntimeFiles.has(item.filename)) return;
    diagnostics.probedRuntimeFiles.add(item.filename);
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => recordLoadedEmojiAsset(item.text, item.filename, image.src));
    image.addEventListener("error", () => recordMissingEmojiAsset(item.text, item.filename, image.src));
    image.src = item.path;
  });
}

function validateEmojiGuessQuestion(question) {
  const errors = [];
  const warnings = [];
  const validCategories = EMOJI_GUESS_CATEGORIES.map((category) => category.id);
  if (!question.id) errors.push("缺少 ID");
  if (!question.category) errors.push("缺少分类");
  else if (!validCategories.includes(question.category)) errors.push("分类无效");
  if (!Array.isArray(question.clues)) errors.push("clues 必须是数组");
  else if (!question.clues.length) errors.push("clues 不能为空");
  if (!question.answer) errors.push("缺少答案");
  if (!question.hint) errors.push("缺少提示");
  if (question.answer && question.clues.length !== [...question.answer].length) {
    warnings.push(`线索数 ${question.clues.length} 与答案可见字符数 ${[...question.answer].length} 不一致，请人工确认`);
  }
  return { valid: errors.length === 0, errors, warnings };
}

function loadEmojiGuessQuestionBank() {
  const source = Array.isArray(window.PARTY_EMOJI_GUESS_QUESTIONS)
    ? window.PARTY_EMOJI_GUESS_QUESTIONS
    : [];
  const validQuestions = [];
  const issues = [];
  const warnings = [];
  const seenIds = new Set();
  const seenAnswers = new Set();
  let skipped = 0;

  source.forEach((rawQuestion, index) => {
    if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) {
      skipped += 1;
      issues.push(`第 ${index + 1} 行：题目格式不是对象`);
      return;
    }
    const question = normalizeEmojiGuessQuestion(rawQuestion);
    const duplicateErrors = [];
    if (question.id && seenIds.has(question.id)) duplicateErrors.push(`重复 ID：${question.id}`);
    if (question.answer && seenAnswers.has(question.answer)) duplicateErrors.push(`重复答案：${question.answer}`);
    const result = validateEmojiGuessQuestion(question);
    const errors = [...duplicateErrors, ...result.errors];
    if (errors.length) {
      skipped += 1;
      if (question.id) state.skippedEmojiGuessQuestionIds.add(question.id);
      errors.forEach((error) => issues.push(`${question.id || `第 ${index + 1} 行`}：${error}`));
      return;
    }
    seenIds.add(question.id);
    seenAnswers.add(question.answer);
    result.warnings.forEach((warning) => {
      const message = `${question.id}：${warning}`;
      warnings.push(message);
      issues.push(message);
    });
    validQuestions.push(question);
  });

  state.emojiGuessQuestions = validQuestions;
  state.emojiGuessPreflight = { loaded: validQuestions.length, skipped, warnings, issues };
  if (!source.length) console.warn("window.PARTY_EMOJI_GUESS_QUESTIONS not found or empty.");
  if (issues.length) console.warn("Emoji guess preflight:", issues);
  probeEmojiAssetCoverage();
  if (isEmojiGuessActive()) updateEmojiGuessCategoryStatsDisplay();
}

function getEmojiGuessRoundConfig() {
  return {
    title: "设置 Emoji猜猜猜",
    subtitle: "选择本轮题量和题库范围。每个 emoji 线索都是一个独立提示单位。",
    stockTitle: "Emoji 题库库存",
    sizes: [10, 20, 30],
    categories: [{ id: "all", label: "\u5927\u5408\u96c6" }, ...EMOJI_GUESS_CATEGORIES]
  };
}

function getEmojiGuessCategoryLabel(category) {
  if (category === "all") return "\u5927\u5408\u96c6";
  return EMOJI_GUESS_CATEGORIES.find((item) => item.id === category)?.label || "Emoji 题库";
}

function getAvailableEmojiGuessQuestions(category = "all") {
  return state.emojiGuessQuestions.filter((question) => (
    (category === "all" || question.category === category)
    && !state.consumedEmojiGuessQuestionIds.has(question.id)
    && !state.skippedEmojiGuessQuestionIds.has(question.id)
  ));
}

function renderEmojiGuessQuestionBankInspector() {
  const preflight = state.emojiGuessPreflight || { loaded: 0, skipped: 0, issues: [] };
  const assetCoverage = window.PartyGame.EmojiAssets.checkEmojiAssetCoverage();
  const loadedCount = assetCoverage.loadedRuntimeFiles.length;
  const expectedCount = assetCoverage.expectedFiles.length;
  const missingRuntimeFiles = assetCoverage.missingRuntimeFiles || [];
  const missingMappings = assetCoverage.missingMappings || [];
  const isComplete = expectedCount > 0 && loadedCount === expectedCount && !missingRuntimeFiles.length && !missingMappings.length;
  const missingFlags = missingRuntimeFiles.filter((item) => item.filename === "emoji_u1f1ec_1f1e7.svg" || item.filename === "emoji_u1f1e9_1f1ea.svg");
  const displayedIssues = (preflight.issues || []).slice(0, 10);
  const moreCount = Math.max(0, (preflight.issues || []).length - displayedIssues.length);
  const issueHtml = displayedIssues.length
    ? displayedIssues.map((issue) => `<span class="inspect-issue">${escapeHTML(issue)}</span>`).join("")
      + (moreCount ? `<span class="inspect-issue">还有 ${moreCount} 条，请打开 console 查看完整结果。</span>` : "")
    : '<span class="inspect-issue">Emoji 题库检查暂未发现明显问题。</span>';
  const assetStatusHtml = `<div class="inspect-panel-title">Noto Emoji 素材状态：</div>
      <span class="inspect-issue">${isComplete ? "已加载本地 SVG：全部完成。" : `已加载本地 SVG：${loadedCount} / ${expectedCount}`}</span>
      <span class="inspect-issue">${isComplete ? "当前题眼为 Noto-only 图片渲染。" : "当前缺少部分 Noto SVG。Noto-only 模式下，缺失题眼会显示“缺图”，不会显示系统 emoji。"}</span>
      ${isComplete ? "" : '<span class="inspect-issue">请运行：node tools/import_noto_emoji_assets.js --source tools/_tmp_noto_emoji</span><span class="inspect-issue">然后运行：node tools/check_emoji_assets.js</span>'}
      ${missingFlags.length ? `<div class="inspect-panel-title">国旗素材缺失：</div>${missingFlags.map((item) => `<span class="inspect-issue">${escapeHTML(item.text)} 需要 ${escapeHTML(item.filename)}</span>`).join("")}` : ""}`;
  elements.questionBankInspectPanel.innerHTML = `
    <div class="inspect-panel-section">
      <div class="inspect-panel-row"><span>题库来源</span><span>emoji_guess/emoji_guess_questions_v2.js</span></div>
      <div class="inspect-panel-row"><span>可用题目</span><span>${preflight.loaded}</span></div>
      <div class="inspect-panel-row"><span>跳过题目</span><span>${preflight.skipped}</span></div>
      <div class="inspect-panel-row"><span>Noto 覆盖率</span><span>${assetCoverage.runtimeCoveragePercent}%</span></div>
      <div class="inspect-panel-title">题库检查</div>
      ${issueHtml}
      ${assetStatusHtml}
    </div>`;
}

function updateEmojiGuessCategoryStatsDisplay() {
  renderEmojiGuessQuestionBankInspector();
  elements.categoryStats.innerHTML = EMOJI_GUESS_CATEGORIES.map((category) => {
    const total = state.emojiGuessQuestions.filter((question) => question.category === category.id).length;
    const remaining = getAvailableEmojiGuessQuestions(category.id).length;
    return `<div class="stats-row"><span>${escapeHTML(category.label)}</span><span>共 ${total} 道，剩余 ${remaining} 道</span></div>`;
  }).join("");
}

function generateEmojiGuessRoundQuestions() {
  const requestedCount = Number(state.roundSize) || 10;
  const available = getAvailableEmojiGuessQuestions(state.selectedCategory);
  const questions = shuffleArray(available).slice(0, requestedCount);
  state.currentRoundQuestions = questions;
  state.currentQuestionIndex = 0;
  resetQuestionFlowState();
  if (!questions.length) {
    showRoundError("当前 Emoji 题库没有可用题目啦，请重置题库后再试");
    return false;
  }
  questions.forEach((question) => state.consumedEmojiGuessQuestionIds.add(question.id));
  if (questions.length < requestedCount) {
    showRoundInfo(`${getEmojiGuessCategoryLabel(state.selectedCategory)}题库剩余题目不足，已抽取全部 ${questions.length} 道可用题目`);
  }
  updateEmojiGuessCategoryStatsDisplay();
  state.hasStartedAnyRound = true;
  return true;
}

function ensureEmojiCluePanel() {
  $(".triple-music-panel", elements.mediaCard)?.remove();
  let panel = $(".emoji-clue-panel", elements.mediaCard);
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "emoji-guess-panel emoji-clue-panel";
    elements.mediaCard.insertBefore(panel, $(".media-footer", elements.mediaCard));
  }
  return panel;
}

function renderEmojiClues(question) {
  const panel = ensureEmojiCluePanel();
  panel.replaceChildren();
  const clueRow = document.createElement("div");
  clueRow.className = "emoji-clue-row";
  const basePath = getEmojiAssetBasePath();
  question.clues.forEach((clue) => {
    const token = document.createElement("span");
    token.className = "emoji-clue-token image-pending";
    const text = getEmojiClueText(clue);
    const asset = resolveEmojiClueAsset(clue, text);
    const missing = document.createElement("span");
    missing.className = "emoji-clue-missing";
    missing.textContent = "\u7f3a\u56fe";
    missing.title = asset ? `Missing Noto SVG: ${asset}` : `Missing emoji asset mapping: ${text}`;
    token.title = asset ? `${text} -> ${asset}` : `${text} -> missing mapping`;
    if (asset) {
      const image = document.createElement("img");
      image.className = "emoji-clue-img";
      image.alt = text;
      image.decoding = "async";
      image.loading = "eager";
      image.addEventListener("load", () => {
        syncEmojiImageState(image, token, text, asset);
      });
      image.addEventListener("error", () => {
        token.classList.remove("image-pending");
        token.classList.remove("has-image");
        token.classList.add("image-failed");
        recordMissingEmojiAsset(text, asset, image.src);
      });
      image.src = `${basePath}${asset}`;
      token.appendChild(image);
      syncEmojiImageState(image, token, text, asset);
      requestAnimationFrame(() => syncEmojiImageState(image, token, text, asset));
      window.setTimeout(() => syncEmojiImageState(image, token, text, asset), 120);
    } else {
      token.classList.remove("image-pending");
      token.classList.add("no-asset");
      window.PartyGame.EmojiAssets.missingMappings.set(text, { text });
    }
    token.appendChild(missing);
    clueRow.appendChild(token);
  });
  panel.appendChild(clueRow);
  if (state.emojiHintVisible && state.phase === "prompt") {
    const hint = document.createElement("p");
    hint.className = "emoji-hint";
    hint.textContent = `\u63d0\u793a\uff1a${question.hint}`;
    panel.appendChild(hint);
  }
}

function renderEmojiGuessGameplay() {
  const question = getCurrentQuestion();
  if (!question) {
    $(".emoji-clue-panel", elements.mediaCard)?.remove();
    setEmptyGameplayState();
    return;
  }
  elements.mediaCard.classList.remove("empty", "image-mode", "audio-mode");
  elements.mediaCard.classList.add("emoji-mode");
  elements.clip.pause();
  elements.clip.removeAttribute("src");
  elements.questionImage.removeAttribute("src");
  renderEmojiClues(question);
  elements.questionTitle.textContent = `第 ${state.currentQuestionIndex + 1} / ${state.currentRoundQuestions.length} 题`;
  elements.questionMeta.textContent = getEmojiGuessCategoryLabel(question.category);
  elements.answerState.textContent = state.phase === "revealed" ? "答案已揭晓" : "答案未揭晓";
  elements.answerText.classList.remove("triple-music-answer-list");
  elements.answerText.textContent = state.phase === "revealed" ? `正确答案：${question.answer}` : "观察 emoji 线索后抢答；主持人可独立显示提示或直接揭晓答案。";
  elements.toggleAnswerText.classList.remove("show");
  elements.playPrompt.textContent = state.emojiHintVisible ? "提示已显示" : "显示提示";
  elements.revealAnswer.textContent = "揭晓答案";
  elements.playPrompt.disabled = state.phase !== "prompt" || state.emojiHintVisible;
  elements.revealAnswer.disabled = state.phase !== "prompt";
  elements.playPrompt.className = state.phase === "prompt" && !state.emojiHintVisible ? "primary-btn stage-current" : "ghost-btn stage-disabled";
  elements.revealAnswer.className = state.phase === "revealed" ? "primary-btn stage-current" : "ghost-btn";
  renderScoreboard();
}

function showEmojiGuessHint() {
  if (!getCurrentQuestion() || state.phase !== "prompt" || state.emojiHintVisible) return;
  state.emojiHintVisible = true;
  renderEmojiGuessGameplay();
}

function revealEmojiGuessAnswer() {
  if (!getCurrentQuestion() || state.phase !== "prompt") return;
  state.phase = "revealed";
  renderEmojiGuessGameplay();
}

function resetEmojiGuessQuestionPool() {
  state.consumedEmojiGuessQuestionIds.clear();
  state.skippedEmojiGuessQuestionIds.clear();
  updateEmojiGuessCategoryStatsDisplay();
  showToast("Emoji 题库已重置，所有题目可以重新抽取啦");
}

window.PartyGame.Games.emojiGuess = {
  id: "emoji_guess",
  categories: EMOJI_GUESS_CATEGORIES,
  normalizeQuestion: normalizeEmojiGuessQuestion,
  validateQuestion: validateEmojiGuessQuestion,
  loadQuestionBank: loadEmojiGuessQuestionBank,
  getRoundConfig: getEmojiGuessRoundConfig,
  getCategoryLabel: getEmojiGuessCategoryLabel,
  getAvailableQuestions: getAvailableEmojiGuessQuestions,
  updateCategoryStatsDisplay: updateEmojiGuessCategoryStatsDisplay,
  renderQuestionBankInspector: renderEmojiGuessQuestionBankInspector,
  generateRoundQuestions: generateEmojiGuessRoundQuestions,
  resetQuestionPool: resetEmojiGuessQuestionPool,
  renderGameplay: renderEmojiGuessGameplay,
  showHint: showEmojiGuessHint,
  revealAnswer: revealEmojiGuessAnswer,
  toggleAnswerText() {}
};
