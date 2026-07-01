window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};

const WODI_ALL_CATEGORY = "all";
const WODI_ROLE_LABELS = {
  civilian: "\u5e73\u6c11",
  undercover: "\u5367\u5e95",
  blank: "\u767d\u677f"
};
let wodiOriginalMediaCardHtml = "";
let wodiOriginalSideStackHtml = "";
let wodiIdentityBaseUrl = "";
let wodiInventoryModalOpen = false;

function rememberWodiHostShell() {
  if (!wodiOriginalMediaCardHtml) wodiOriginalMediaCardHtml = elements.mediaCard.innerHTML;
  const sideStack = $(".gameplay-side-stack");
  if (sideStack && !wodiOriginalSideStackHtml) wodiOriginalSideStackHtml = sideStack.innerHTML;
}

function restoreWodiHostShell() {
  $(".gameplay-grid")?.classList.remove("wodi-fullscreen");
  if (wodiOriginalMediaCardHtml) {
    elements.mediaCard.innerHTML = wodiOriginalMediaCardHtml;
    elements.clip = $("#clip");
    elements.questionImage = $("#questionImage");
    elements.questionTitle = $("#questionTitle");
    elements.questionMeta = $("#questionMeta");
    elements.toggleAnswerText = $("#toggleAnswerText");
    elements.clip.addEventListener("error", handleMediaLoadError);
    elements.questionImage.addEventListener("error", handleMediaLoadError);
    elements.toggleAnswerText.addEventListener("click", toggleAnswerText);
  }
  const sideStack = $(".gameplay-side-stack");
  if (sideStack && wodiOriginalSideStackHtml) {
    sideStack.hidden = false;
    sideStack.innerHTML = wodiOriginalSideStackHtml;
    elements.playPrompt = $("#playPrompt");
    elements.revealAnswer = $("#revealAnswer");
    elements.answerState = $("#answerState");
    elements.answerText = $("#answerText");
    elements.confirmScore = $("#confirmScore");
    elements.scoreboard = $("#scoreboard");
    elements.playPrompt.addEventListener("click", () => {
      if (isEmojiGuessActive()) {
        window.PartyGame.Games.emojiGuess.showHint();
        return;
      }
      const musicGame = isMusicGameActive() ? getActiveMusicGame() : null;
      if (musicGame) (musicGame.playMixedAudio || musicGame.playAudio)();
    });
    elements.revealAnswer.addEventListener("click", revealAnswer);
    elements.confirmScore.addEventListener("click", confirmScore);
  }
}

function normalizeWodiQuestion(rawQuestion) {
  const safe = rawQuestion && typeof rawQuestion === "object" ? rawQuestion : {};
  return {
    id: normalizeCodeField(safe.id),
    category: normalizeField(safe.category).trim(),
    word_for_good_man: normalizeField(safe.word_for_good_man).trim(),
    word_for_wodi: normalizeField(safe.word_for_wodi).trim()
  };
}

function validateWodiQuestion(question) {
  const errors = [];
  if (!question.id) errors.push("\u7f3a\u5c11 ID");
  if (!question.category) errors.push("\u7f3a\u5c11 category");
  if (!question.word_for_good_man) errors.push("\u7f3a\u5c11 word_for_good_man");
  if (!question.word_for_wodi) errors.push("\u7f3a\u5c11 word_for_wodi");
  if (question.word_for_good_man && question.word_for_good_man === question.word_for_wodi) errors.push("\u5e73\u6c11\u8bcd\u548c\u5367\u5e95\u8bcd\u4e0d\u80fd\u76f8\u540c");
  return { valid: errors.length === 0, errors };
}

function loadWodiQuestionBank() {
  const source = Array.isArray(window.PARTY_WODI_QUESTIONS) ? window.PARTY_WODI_QUESTIONS : [];
  const validQuestions = [];
  const issues = [];
  const seenIds = new Set();
  let skipped = 0;

  source.forEach((rawQuestion, index) => {
    const question = normalizeWodiQuestion(rawQuestion);
    const result = validateWodiQuestion(question);
    if (question.id && seenIds.has(question.id)) result.errors.push(`\u91cd\u590d ID\uff1a${question.id}`);
    if (result.errors.length) {
      skipped += 1;
      if (question.id) state.wodiSkippedQuestionIds.add(question.id);
      result.errors.forEach((error) => issues.push(`${question.id || `#${index + 1}`}\uff1a${error}`));
      return;
    }
    seenIds.add(question.id);
    validQuestions.push(question);
  });

  state.wodiQuestions = validQuestions;
  state.wodiPreflight = { loaded: validQuestions.length, skipped, issues };
  if (!source.length) console.warn("window.PARTY_WODI_QUESTIONS not found or empty.");
  if (issues.length) console.warn("Wodi preflight:", issues);
}

function isWodiActive() {
  return state.activeGameId === "wodi";
}

function getWodiCategories() {
  return [...new Set(state.wodiQuestions.map((question) => question.category).filter(Boolean))]
    .map((category) => ({ id: category, label: category }));
}

function getWodiCategoryLabel(category) {
  if (category === WODI_ALL_CATEGORY) return "\u5927\u5408\u96c6";
  return getWodiCategories().find((item) => item.id === category)?.label || "\u8c01\u662f\u5367\u5e95\u9898\u5e93";
}

function getAvailableWodiQuestions(category = WODI_ALL_CATEGORY) {
  return state.wodiQuestions.filter((question) => (
    (category === WODI_ALL_CATEGORY || question.category === category)
    && !state.wodiConsumedQuestionIds.has(question.id)
    && !state.wodiSkippedQuestionIds.has(question.id)
  ));
}

function encodeBase64Url(value) {
  const json = JSON.stringify(value);
  const utf8 = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) => (
    String.fromCharCode(parseInt(p1, 16))
  ));
  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getDefaultWodiIdentityBaseUrl() {
  const path = `${location.protocol}//${location.host}/wodi_identity.html`;
  return path;
}

function getWodiIdentityBaseUrl() {
  if (!wodiIdentityBaseUrl) wodiIdentityBaseUrl = getDefaultWodiIdentityBaseUrl();
  return wodiIdentityBaseUrl;
}

function setWodiIdentityBaseUrl(value) {
  wodiIdentityBaseUrl = String(value || "").trim() || getDefaultWodiIdentityBaseUrl();
  if (state.wodiRound?.status === "assigning") renderWodiGameplay();
}

function updateWodiIdentityBaseUrl(value) {
  wodiIdentityBaseUrl = String(value || "").trim() || getDefaultWodiIdentityBaseUrl();
  const round = state.wodiRound;
  const assignment = round?.assignments?.[round.revealIndex];
  const container = $("#wodiQrCard");
  if (assignment && container) renderWodiQRCode(container, assignment);
  const warning = $("#wodiMobileUrlWarning");
  if (warning) warning.hidden = !isWodiIdentityBaseUrlLocalhost();
}

function isWodiIdentityBaseUrlLocalhost() {
  try {
    const parsed = new URL(getWodiIdentityBaseUrl(), location.href);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch (error) {
    return false;
  }
}

function getWodiRemainingCount(category = state.wodiSelectedCategory) {
  return getAvailableWodiQuestions(category).length;
}

function getWodiInventoryWarning() {
  const remaining = getWodiRemainingCount(state.wodiSelectedCategory);
  return remaining === 0
    ? "\u5f53\u524d\u5206\u7c7b\u5df2\u6ca1\u6709\u65b0\u9898\uff0c\u8bf7\u9009\u62e9\u5176\u5b83\u5206\u7c7b\u6216\u8005\u91cd\u7f6e\u9898\u5e93\u3002"
    : "";
}

function resolveWodiQuestionForRound() {
  const pool = getAvailableWodiQuestions(state.wodiSelectedCategory);
  return {
    question: shuffleArray(pool)[0] || null,
    note: pool.length === 1 ? "\u8fd9\u662f\u5f53\u524d\u5206\u7c7b\u6700\u540e\u4e00\u9053\u65b0\u9898\u3002" : ""
  };
}

function getWodiRoundConfig() {
  return {
    title: "\u8bbe\u7f6e\u8c01\u662f\u5367\u5e95",
    subtitle: "\u9009\u62e9\u9898\u5e93\u5206\u7c7b\u548c\u8eab\u4efd\u5206\u5e03\uff0c\u4e3b\u6301\u4eba\u901a\u8fc7\u4e8c\u7ef4\u7801\u9010\u4e2a\u53d1\u8bcd\u3002",
    stockTitle: "\u8c01\u662f\u5367\u5e95\u9898\u5e93\u5e93\u5b58",
    sizes: [],
    categories: [{ id: WODI_ALL_CATEGORY, label: "\u5927\u5408\u96c6" }, ...getWodiCategories()]
  };
}

function renderWodiQuestionBankInspector() {
  if (!elements.questionBankInspectPanel) return;
  const preflight = state.wodiPreflight || { loaded: 0, skipped: 0, issues: [] };
  const issues = (preflight.issues || []).slice(0, 10);
  elements.questionBankInspectPanel.innerHTML = `
    <div class="inspect-panel-section">
      <div class="inspect-panel-row"><span>\u9898\u5e93\u6765\u6e90</span><span>wodi/wodi_questions_v1.js</span></div>
      <div class="inspect-panel-row"><span>\u53ef\u7528\u8bcd\u7ec4</span><span>${preflight.loaded}</span></div>
      <div class="inspect-panel-row"><span>\u8df3\u8fc7\u8bcd\u7ec4</span><span>${preflight.skipped}</span></div>
      <div class="inspect-panel-title">\u9898\u5e93\u68c0\u67e5</div>
      ${issues.length ? issues.map((issue) => `<span class="inspect-issue">${escapeHTML(issue)}</span>`).join("") : '<span class="inspect-issue">\u9898\u5e93\u68c0\u67e5\u6682\u672a\u53d1\u73b0\u660e\u663e\u95ee\u9898\u3002</span>'}
    </div>`;
}

function updateWodiCategoryStatsDisplay() {
  renderWodiQuestionBankInspector();
  const categories = getWodiCategories();
  const rows = categories.map((category) => {
    const total = state.wodiQuestions.filter((question) => question.category === category.id).length;
    const remaining = getAvailableWodiQuestions(category.id).length;
    return `<div class="stats-row"><span>${escapeHTML(category.label)}</span><span>\u5171 ${total} \u7ec4\uff0c\u5269\u4f59 ${remaining} \u7ec4</span></div>`;
  });
  const total = state.wodiQuestions.length;
  const remaining = getAvailableWodiQuestions(WODI_ALL_CATEGORY).length;
  elements.categoryStats.innerHTML = `<div class="stats-row"><span>\u5927\u5408\u96c6</span><span>\u5171 ${total} \u7ec4\uff0c\u5269\u4f59 ${remaining} \u7ec4</span></div>${rows.join("")}`;
}

function getWodiActivePlayers() {
  return state.players.filter((player) => player.isActive !== false);
}

function validateWodiConfig() {
  const total = getWodiActivePlayers().length;
  const undercoverCount = Number(state.wodiUndercoverCount) || 1;
  const blankCount = state.wodiUseBlank ? Number(state.wodiBlankCount) || 1 : 0;
  const civilianCount = total - undercoverCount - blankCount;
  if (total < 4) return "\u8c01\u662f\u5367\u5e95\u81f3\u5c11\u9700\u8981 4 \u4f4d\u53c2\u4e0e\u73a9\u5bb6\u3002";
  if (total < 6 && undercoverCount > 1) return "\u5c11\u4e8e 6 \u4eba\u65f6\u53ea\u80fd\u8bbe\u7f6e 1 \u4e2a\u5367\u5e95\u3002";
  if (total < 6 && blankCount > 1) return "\u5c11\u4e8e 6 \u4eba\u65f6\u767d\u677f\u6700\u591a 1 \u4e2a\u3002";
  if (total < 8 && blankCount > 1) return "8 \u4eba\u53ca\u4ee5\u4e0a\u624d\u53ef\u4ee5\u8bbe\u7f6e 2 \u4e2a\u767d\u677f\u3002";
  if (civilianCount < 2) return "\u5e73\u6c11\u4eba\u6570\u5fc5\u987b\u81f3\u5c11 2 \u4eba\u3002";
  if (undercoverCount < 1) return "\u5367\u5e95\u4eba\u6570\u5fc5\u987b\u81f3\u5c11 1 \u4eba\u3002";
  if (undercoverCount + blankCount >= total) return "\u5367\u5e95 + \u767d\u677f\u5fc5\u987b\u5c11\u4e8e\u603b\u53c2\u4e0e\u4eba\u6570\u3002";
  if (!state.wodiQuestions.length) return "\u8c01\u662f\u5367\u5e95\u9898\u5e93\u672a\u52a0\u8f7d\uff0c\u8bf7\u68c0\u67e5 data/wodi/wodi_questions_v1.js\u3002";
  return "";
}

function renderWodiSetupOptions() {
  const total = getWodiActivePlayers().length;
  if (total < 6 && state.wodiUndercoverCount > 1) state.wodiUndercoverCount = 1;
  if (total < 8 && state.wodiBlankCount > 1) state.wodiBlankCount = 1;
  if (!state.wodiUseBlank) state.wodiBlankCount = 0;
  const categories = [{ id: WODI_ALL_CATEGORY, label: "\u5927\u5408\u96c6" }, ...getWodiCategories()];
  const canTwoUndercover = total >= 6;
  const canTwoBlank = total >= 8;
  const inventoryWarning = getWodiInventoryWarning();

  $(".round-main").classList.add("wodi-round-main");
  $(".round-main .section-title").textContent = "\u8bbe\u7f6e\u8c01\u662f\u5367\u5e95";
  $(".round-main .section-subtitle").textContent = "\u9009\u62e9\u9898\u5e93\u3001\u5367\u5e95\u548c\u767d\u677f\u6570\u91cf\u3002\u53ea\u6709\u53c2\u4e0e\u73a9\u5bb6\u4f1a\u8fdb\u5165\u672c\u5c40\u3002";
  $("#roundSizeOptions").innerHTML = "";
  $("#roundCategoryOptions").classList.remove("music-category-select-wrap");
  $("#roundCategoryOptions").innerHTML = "";
  elements.roundExtraOptions.innerHTML = `
    <div class="wodi-setup">
      <label class="wodi-field">
        <span>\u9898\u5e93\u5206\u7c7b</span>
        <select data-wodi-category-select>
          ${categories.map((category) => `<option value="${escapeHTML(category.id)}" ${category.id === state.wodiSelectedCategory ? "selected" : ""}>${escapeHTML(category.label)}</option>`).join("")}
        </select>
      </label>
      <label class="wodi-field">
        <span>\u5367\u5e95\u6570\u91cf</span>
        <select data-wodi-undercover-select>
          <option value="1" ${state.wodiUndercoverCount === 1 ? "selected" : ""}>1</option>
          <option value="2" ${state.wodiUndercoverCount === 2 ? "selected" : ""} ${canTwoUndercover ? "" : "disabled"}>2</option>
        </select>
      </label>
      <label class="wodi-switch">
        <input type="checkbox" data-wodi-use-blank-checkbox ${state.wodiUseBlank ? "checked" : ""}>
        <span class="wodi-switch-track" aria-hidden="true"></span>
        <span>\u52a0\u5165\u767d\u677f</span>
      </label>
      <label class="wodi-field">
        <span>\u767d\u677f\u6570\u91cf</span>
        <select data-wodi-blank-select ${state.wodiUseBlank ? "" : "disabled"}>
          <option value="0" ${state.wodiBlankCount === 0 ? "selected" : ""}>0</option>
          <option value="1" ${state.wodiBlankCount === 1 ? "selected" : ""}>1</option>
          <option value="2" ${state.wodiBlankCount === 2 ? "selected" : ""} ${canTwoBlank ? "" : "disabled"}>2</option>
        </select>
      </label>
      <label class="wodi-field">
        <span>\u9635\u8425\u663e\u793a</span>
        <select data-wodi-reveal-role-select>
          <option value="false" ${!state.wodiRevealRole ? "selected" : ""}>\u9690\u85cf\u9635\u8425\uff0c\u53ea\u663e\u793a\u8bcd</option>
          <option value="true" ${state.wodiRevealRole ? "selected" : ""}>\u660e\u793a\u9635\u8425\uff0c\u663e\u793a\u8eab\u4efd + \u8bcd</option>
        </select>
      </label>
      ${inventoryWarning ? `<div class="wodi-warning">${inventoryWarning}</div>` : ""}
      ${renderWodiIdentityDistribution()}
      ${renderWodiInventoryModal()}
    </div>`;
  $(".round-stock h2").textContent = "\u8c01\u662f\u5367\u5e95\u9898\u5e93\u5e93\u5b58";
  elements.totalScoreTitle.textContent = "\u672c\u5c40\u53c2\u4e0e\u73a9\u5bb6";
  elements.totalScoreList.innerHTML = getWodiActivePlayers().map((player) => {
    const avatar = getAvatar(player.avatarId);
    return `<div class="total-score-row"><span class="participant-info"><span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span><span class="mini-name">${escapeHTML(player.name)}</span></span><span>\u53c2\u4e0e</span></div>`;
  }).join("") || '<div class="stats-row"><span>\u7b49\u5f85\u73a9\u5bb6</span><span>0</span></div>';
  elements.startRound.textContent = "\u5f00\u59cb\u672c\u8f6e";
  elements.roundSecondaryAction.textContent = "\u8fd4\u56de\u73a9\u5bb6";
  updateWodiCategoryStatsDisplay();
}

function renderWodiInventoryModal() {
  if (!wodiInventoryModalOpen) return "";
  return `
    <div class="wodi-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="wodiInventoryTitle">
      <div class="wodi-modal-card">
        <div class="result-kicker">\u9898\u5e93\u5e93\u5b58</div>
        <h2 id="wodiInventoryTitle">\u9898\u5e93\u5df2\u7528\u5b8c</h2>
        <p>\u5f53\u524d\u5206\u7c7b\u5df2\u6ca1\u6709\u65b0\u9898\uff0c\u8bf7\u9009\u62e9\u5176\u5b83\u5206\u7c7b\u6216\u8005\u91cd\u7f6e\u9898\u5e93\u3002</p>
        <div class="modal-actions">
          <button class="primary-btn" type="button" data-wodi-close-inventory-modal>\u77e5\u9053\u4e86</button>
        </div>
      </div>
    </div>`;
}

function showWodiInventoryModal() {
  wodiInventoryModalOpen = true;
  renderWodiSetupOptions();
}

function closeWodiInventoryModal() {
  wodiInventoryModalOpen = false;
  renderWodiSetupOptions();
}

function renderWodiIdentityDistribution() {
  const total = getWodiActivePlayers().length;
  const undercover = Number(state.wodiUndercoverCount) || 1;
  const blank = state.wodiUseBlank ? Number(state.wodiBlankCount) || 1 : 0;
  const civilian = Math.max(0, total - undercover - blank);
  return `<div class="wodi-distribution">\u672c\u5c40\uff1a\u5e73\u6c11 ${civilian} \u4eba\uff0c\u5367\u5e95 ${undercover} \u4eba${blank ? `\uff0c\u767d\u677f ${blank} \u4eba` : ""}\u3002</div>`;
}

function startWodiRound() {
  const error = validateWodiConfig();
  if (error) {
    showRoundError(error);
    return false;
  }
  const players = getWodiActivePlayers();
  const { question, note } = resolveWodiQuestionForRound();
  if (!question) {
    showWodiInventoryModal();
    return false;
  }
  const roles = [
    ...Array(Number(state.wodiUndercoverCount) || 1).fill("undercover"),
    ...Array(state.wodiUseBlank ? Number(state.wodiBlankCount) || 1 : 0).fill("blank")
  ];
  while (roles.length < players.length) roles.push("civilian");
  const shuffledRoles = shuffleArray(roles);
  state.wodiConsumedQuestionIds.add(question.id);
  state.wodiRound = {
    question,
    goodWord: question.word_for_good_man,
    undercoverWord: question.word_for_wodi,
    assignments: players.map((player, index) => {
      const role = shuffledRoles[index];
      return {
        participantId: player.id,
        name: player.name,
        avatarId: player.avatarId,
        role,
        word: role === "blank" ? "" : role === "undercover" ? question.word_for_wodi : question.word_for_good_man,
        eliminated: false,
        eliminatedRound: null,
        revealed: false
      };
    }),
    revealIndex: 0,
    voteRound: 1,
    status: "assigning",
    winner: null,
    eliminatedHistory: [],
    pendingEliminationId: null
  };
  state.hasStartedAnyRound = true;
  wodiInventoryModalOpen = false;
  updateWodiCategoryStatsDisplay();
  if (note) showToast(note);
  switchScreen("play");
  return true;
}

function buildWodiIdentityPayload(assignment) {
  return {
    playerName: assignment.name,
    role: assignment.role,
    word: assignment.word,
    revealRole: Boolean(state.wodiRevealRole),
    roundTitle: "\u8c01\u662f\u5367\u5e95"
  };
}

function buildWodiIdentityUrl(assignment) {
  const payload = buildWodiIdentityPayload(assignment);
  const baseUrl = getWodiIdentityBaseUrl();
  const separator = baseUrl.includes("#") ? "&" : "#";
  return `${baseUrl}${separator}payload=${encodeBase64Url(payload)}`;
}

function renderWodiQRFallback(container, link) {
  const fallback = document.createElement("textarea");
  fallback.className = "wodi-fallback-link show";
  fallback.readOnly = true;
  fallback.value = link;
  container.appendChild(fallback);
}

function renderWodiQRCode(container, assignment) {
  const link = buildWodiIdentityUrl(assignment);
  container.replaceChildren();
  if (typeof QRCode !== "function") {
    console.error("[Wodi] QRCode global is missing. Check vendor/qrcode.min.js load order.");
    container.innerHTML = `<div class="error-message show">\u4e8c\u7ef4\u7801\u5e93\u672a\u52a0\u8f7d\uff0c\u8bf7\u68c0\u67e5 vendor/qrcode.min.js</div>`;
    renderWodiQRFallback(container, link);
    return;
  }

  try {
    // QR strategy: encode only a short static-page URL plus base64url JSON hash.
    // This is much easier for iPhone Camera and common scanner apps to read than
    // a dense QR containing a full data:text/html document.
    new QRCode(container, {
      text: link,
      width: 240,
      height: 240,
      colorDark: "#111111",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel?.L ?? 1
    });
  } catch (error) {
    console.error("[Wodi] QR render failed:", error, { payloadLength: link.length });
    container.innerHTML = `<div class="error-message show">\u4e8c\u7ef4\u7801\u751f\u6210\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u624b\u673a\u8bbf\u95ee\u5730\u5740\u3002</div>`;
    renderWodiQRFallback(container, link);
  }
}

function renderWodiAssigning() {
  const round = state.wodiRound;
  const assignment = round.assignments[round.revealIndex];
  const avatar = getAvatar(assignment.avatarId);
  rememberWodiHostShell();
  $(".gameplay-grid")?.classList.add("wodi-fullscreen");
  const sideStack = $(".gameplay-side-stack");
  if (sideStack) sideStack.hidden = true;
  elements.mediaCard.className = "media-card wodi-mode";
  elements.mediaCard.innerHTML = `
    <div class="wodi-identity-stage">
      <h1>\u8c01\u662f\u5367\u5e95\uff1a\u626b\u7801\u67e5\u770b\u8eab\u4efd</h1>
      <p>\u6b63\u5728\u53d1\u653e\uff1a\u7b2c ${round.revealIndex + 1} / ${round.assignments.length} \u4f4d</p>
      <div class="wodi-current-player"><span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span><strong>${escapeHTML(assignment.name)}</strong></div>
      <div class="wodi-qr-card" id="wodiQrCard"></div>
      <label class="wodi-mobile-url-field">
        <span>\u624b\u673a\u8bbf\u95ee\u5730\u5740</span>
        <input value="${escapeHTML(getWodiIdentityBaseUrl())}" data-wodi-mobile-base-url>
      </label>
      <p class="wodi-mobile-url-note">\u624b\u673a\u626b\u7801\u9700\u8981\u548c\u7535\u8111\u5728\u540c\u4e00\u4e2a Wi-Fi \u4e0b\u3002\u8bf7\u786e\u8ba4\u4e0a\u9762\u5730\u5740\u662f\u624b\u673a\u53ef\u4ee5\u8bbf\u95ee\u7684\u7535\u8111\u5730\u5740\u3002</p>
      <p class="wodi-warning" id="wodiMobileUrlWarning" ${isWodiIdentityBaseUrlLocalhost() ? "" : "hidden"}>\u5f53\u524d\u4f7f\u7528\u7684\u662f localhost\uff0c\u624b\u673a\u901a\u5e38\u65e0\u6cd5\u8bbf\u95ee\u3002\u8bf7\u628a localhost \u6539\u6210\u7535\u8111\u5c40\u57df\u7f51 IP\uff0c\u4f8b\u5982 http://192.168.x.x:8000/wodi_identity.html</p>
      <p>\u8bf7\u5f53\u524d\u73a9\u5bb6\u626b\u7801\u67e5\u770b\u81ea\u5df1\u7684\u8eab\u4efd\u8bcd\uff0c\u4e0d\u8981\u8ba9\u5176\u4ed6\u4eba\u770b\u5230\u624b\u673a\u3002</p>
      <div class="action-row">
        <button class="ghost-btn" type="button" data-wodi-prev-identity ${round.revealIndex === 0 ? "disabled" : ""}>\u4e0a\u4e00\u4f4d\u73a9\u5bb6</button>
        <button class="ghost-btn" type="button" data-wodi-next-identity ${round.revealIndex >= round.assignments.length - 1 ? "disabled" : ""}>\u4e0b\u4e00\u4f4d\u73a9\u5bb6</button>
        <button class="primary-btn" type="button" data-wodi-start-discussion>\u5f00\u59cb\u6e38\u620f</button>
      </div>
    </div>`;
  renderWodiQRCode($("#wodiQrCard"), assignment);
}

function renderWodiSidePanel() {
  $(".gameplay-side-stack").innerHTML = `
    <div class="side-panel">
      <h2>\u8c01\u662f\u5367\u5e95</h2>
      <p class="wodi-side-copy">\u672c\u6e38\u620f\u4e0d\u8fdb\u5165\u539f\u8ba1\u5206\u677f\u3002\u4e3b\u6301\u4eba\u53ea\u9700\u63a7\u5236\u53d1\u8bcd\u3001\u8ba8\u8bba\u548c\u6dd8\u6c70\u3002</p>
    </div>`;
}

function showPreviousWodiIdentity() {
  if (!state.wodiRound) return;
  state.wodiRound.revealIndex = Math.max(0, state.wodiRound.revealIndex - 1);
  renderWodiGameplay();
}

function showNextWodiIdentity() {
  if (!state.wodiRound) return;
  state.wodiRound.revealIndex = Math.min(state.wodiRound.assignments.length - 1, state.wodiRound.revealIndex + 1);
  renderWodiGameplay();
}

function startWodiDiscussion() {
  if (!state.wodiRound) return;
  state.wodiRound.status = "voting";
  renderWodiGameplay();
  window.PartyGame.Core.BackgroundAudio?.sync();
}

function eliminateWodiPlayer(id) {
  if (!state.wodiRound) return;
  state.wodiRound.pendingEliminationId = id;
  renderWodiGameplay();
}

function cancelWodiElimination() {
  if (!state.wodiRound) return;
  state.wodiRound.pendingEliminationId = null;
  renderWodiGameplay();
}

function confirmWodiElimination() {
  const round = state.wodiRound;
  if (!round?.pendingEliminationId) return;
  const assignment = round.assignments.find((item) => item.participantId === round.pendingEliminationId);
  if (!assignment || assignment.eliminated) return;
  assignment.eliminated = true;
  assignment.eliminatedRound = round.voteRound;
  assignment.revealed = true;
  round.eliminatedHistory.push({ participantId: assignment.participantId, round: round.voteRound, role: assignment.role });
  round.pendingEliminationId = null;
  const winner = checkWodiWinCondition();
  if (winner) {
    round.winner = winner;
    round.status = "finished";
  } else {
    round.voteRound += 1;
  }
  renderWodiGameplay();
}

function checkWodiWinCondition() {
  const alive = state.wodiRound.assignments.filter((item) => !item.eliminated);
  const aliveCivilian = alive.filter((item) => item.role === "civilian").length;
  const aliveUndercover = alive.filter((item) => item.role === "undercover").length;
  const aliveBlank = alive.filter((item) => item.role === "blank").length;
  if (aliveBlank > 0 && alive.length === aliveBlank + 1) return "blank";
  if (aliveUndercover === 0) return "civilian";
  if (aliveUndercover >= aliveCivilian) return "undercover";
  return null;
}

function renderWodiVoteStage() {
  const round = state.wodiRound;
  rememberWodiHostShell();
  $(".gameplay-grid")?.classList.add("wodi-fullscreen");
  const sideStack = $(".gameplay-side-stack");
  if (sideStack) sideStack.hidden = true;
  elements.mediaCard.className = "media-card wodi-mode";
  elements.mediaCard.innerHTML = `
    <div class="wodi-vote-stage">
      <h1>\u7b2c ${round.voteRound} \u8f6e\uff1a\u8bf7\u6295\u7968\u51b3\u5b9a\u672c\u8f6e\u7968\u51fa\u67d0\u4f4d\u73a9\u5bb6</h1>
      <div class="wodi-vote-grid">
        ${round.assignments.map((assignment) => {
          const avatar = getAvatar(assignment.avatarId);
          return `<button class="wodi-player-tile ${assignment.eliminated ? "eliminated" : ""}" type="button" data-wodi-eliminate-id="${escapeHTML(assignment.participantId)}" ${assignment.eliminated ? "disabled" : ""}>
            <span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span>
            <strong>${escapeHTML(assignment.name)}</strong>
            <span>${assignment.eliminated ? `\u7b2c ${assignment.eliminatedRound} \u8f6e\u6dd8\u6c70` : "\u672a\u6dd8\u6c70"}</span>
            ${assignment.revealed ? `<span class="wodi-role-badge">${WODI_ROLE_LABELS[assignment.role]}</span>` : ""}
          </button>`;
        }).join("")}
      </div>
      ${renderWodiEliminationModal()}
    </div>`;
}

function renderWodiEliminationModal() {
  const pending = state.wodiRound.assignments.find((item) => item.participantId === state.wodiRound.pendingEliminationId);
  if (!pending) return "";
  return `
    <div class="wodi-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="wodiEliminateTitle">
      <div class="wodi-modal-card">
        <div class="result-kicker">\u6295\u7968\u6dd8\u6c70</div>
        <h2 id="wodiEliminateTitle">\u786e\u8ba4\u6dd8\u6c70</h2>
        <p>\u786e\u8ba4\u6dd8\u6c70 ${escapeHTML(pending.name)} \u5417\uff1f</p>
        <div class="modal-actions">
          <button class="ghost-btn" type="button" data-wodi-cancel-elimination>\u53d6\u6d88</button>
          <button class="primary-btn" type="button" data-wodi-confirm-elimination>\u786e\u8ba4\u6dd8\u6c70</button>
        </div>
      </div>
    </div>`;
}

function renderWodiResult() {
  const round = state.wodiRound;
  if (!round.victoryAudioPlayed) {
    round.victoryAudioPlayed = true;
    window.PartyGame.Core.BackgroundAudio?.playVictoryRound();
  }
  const winnerLabel = `${WODI_ROLE_LABELS[round.winner]}\u80dc\u5229`;
  const winners = round.assignments.filter((item) => item.role === round.winner && (round.winner !== "blank" || !item.eliminated));
  const grouped = (role) => round.assignments.filter((item) => item.role === role).map((item) => item.name).join("\u3001") || "\u65e0";
  const playerChip = (assignment) => {
    const avatar = getAvatar(assignment.avatarId);
    return `<span class="wodi-winner-chip"><span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span>${escapeHTML(assignment.name)}</span>`;
  };
  rememberWodiHostShell();
  $(".gameplay-grid")?.classList.add("wodi-fullscreen");
  const sideStack = $(".gameplay-side-stack");
  if (sideStack) sideStack.hidden = true;
  elements.mediaCard.className = "media-card wodi-mode";
  elements.mediaCard.innerHTML = `
    <div class="wodi-result-card">
      <div class="wodi-celebrate" aria-hidden="true">\u2726</div>
      <div class="result-kicker">\u6e38\u620f\u7ed3\u675f</div>
      <h1>${winnerLabel}</h1>
      <div class="wodi-winner-panel">
        <div class="wodi-role-badge">${winnerLabel}</div>
        <h2>\u83b7\u80dc\u73a9\u5bb6</h2>
        <div class="wodi-winner-row">${winners.length ? winners.map(playerChip).join("") : "\u65e0"}</div>
      </div>
      <div class="wodi-result-grid">
        <div class="wodi-result-item"><span>\u5e73\u6c11\u8bcd</span><strong>${escapeHTML(round.goodWord)}</strong></div>
        <div class="wodi-result-item"><span>\u5367\u5e95\u8bcd</span><strong>${escapeHTML(round.undercoverWord)}</strong></div>
        <div class="wodi-result-item"><span>\u5e73\u6c11\u73a9\u5bb6</span><strong>${escapeHTML(grouped("civilian"))}</strong></div>
        <div class="wodi-result-item"><span>\u5367\u5e95\u73a9\u5bb6</span><strong>${escapeHTML(grouped("undercover"))}</strong></div>
        <div class="wodi-result-item"><span>\u767d\u677f\u73a9\u5bb6</span><strong>${escapeHTML(grouped("blank"))}</strong></div>
        <div class="wodi-result-item"><span>\u672c\u5c40\u9898\u5e93\u5206\u7c7b</span><strong>${escapeHTML(round.question.category)}</strong></div>
      </div>
      <div class="action-row">
        <button class="primary-btn" type="button" data-wodi-new-round>\u518d\u6765\u4e00\u5c40</button>
        <button class="ghost-btn" type="button" data-wodi-return-home>\u56de\u5230\u9996\u9875</button>
      </div>
    </div>`;
}

function renderWodiGameplay() {
  const round = state.wodiRound;
  if (!round) {
    renderWodiSetupOptions();
    return;
  }
  if (round.status === "assigning") renderWodiAssigning();
  else if (round.status === "voting") renderWodiVoteStage();
  else renderWodiResult();
}

function resetWodiQuestionPool() {
  state.wodiConsumedQuestionIds.clear();
  state.wodiSkippedQuestionIds.clear();
  wodiInventoryModalOpen = false;
  updateWodiCategoryStatsDisplay();
  renderWodiSetupOptions();
  showToast("\u8c01\u662f\u5367\u5e95\u9898\u5e93\u5df2\u91cd\u7f6e\uff0c\u6240\u6709\u8bcd\u7ec4\u53ef\u4ee5\u91cd\u65b0\u62bd\u53d6\u3002");
}

function newWodiRound() {
  state.wodiRound = null;
  switchScreen("round");
  window.PartyGame.Core.BackgroundAudio?.sync();
}

function returnWodiHome() {
  state.wodiRound = null;
  switchScreen("home");
  window.PartyGame.Core.BackgroundAudio?.sync();
}

function getWodiDebugInfo() {
  return {
    questions: state.wodiQuestions.length,
    consumed: state.wodiConsumedQuestionIds.size,
    skipped: state.wodiSkippedQuestionIds.size,
    round: state.wodiRound
  };
}

window.PartyGame.Games.wodi = {
  id: "wodi",
  isActive: isWodiActive,
  loadQuestionBank: loadWodiQuestionBank,
  getRoundConfig: getWodiRoundConfig,
  getCategoryLabel: getWodiCategoryLabel,
  updateCategoryStatsDisplay: updateWodiCategoryStatsDisplay,
  renderQuestionBankInspector: renderWodiQuestionBankInspector,
  renderSetupOptions: renderWodiSetupOptions,
  renderIdentityDistribution: renderWodiIdentityDistribution,
  generateRoundQuestions: startWodiRound,
  startWodiRound,
  resetQuestionPool: resetWodiQuestionPool,
  renderGameplay: renderWodiGameplay,
  renderVoteStage: renderWodiVoteStage,
  renderResult: renderWodiResult,
  eliminatePlayer: eliminateWodiPlayer,
  confirmElimination: confirmWodiElimination,
  checkWinCondition: checkWodiWinCondition,
  buildIdentityPayload: buildWodiIdentityPayload,
  buildIdentityHtml: buildWodiIdentityUrl,
  buildIdentityUrl: buildWodiIdentityUrl,
  renderQRCode: renderWodiQRCode,
  setIdentityBaseUrl: setWodiIdentityBaseUrl,
  updateIdentityBaseUrl: updateWodiIdentityBaseUrl,
  showPreviousIdentity: showPreviousWodiIdentity,
  showNextIdentity: showNextWodiIdentity,
  startDiscussion: startWodiDiscussion,
  cancelElimination: cancelWodiElimination,
  closeInventoryModal: closeWodiInventoryModal,
  newRound: newWodiRound,
  returnHome: returnWodiHome,
  getDebugInfo: getWodiDebugInfo,
  restoreHost: restoreWodiHostShell
};
