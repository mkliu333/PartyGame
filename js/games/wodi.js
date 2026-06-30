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

function rememberWodiHostShell() {
  if (!wodiOriginalMediaCardHtml) wodiOriginalMediaCardHtml = elements.mediaCard.innerHTML;
  const sideStack = $(".gameplay-side-stack");
  if (sideStack && !wodiOriginalSideStackHtml) wodiOriginalSideStackHtml = sideStack.innerHTML;
}

function restoreWodiHostShell() {
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
  if (!getAvailableWodiQuestions(state.wodiSelectedCategory).length) return "\u5f53\u524d\u5206\u7c7b\u6ca1\u6709\u53ef\u7528\u8bcd\u7ec4\uff0c\u8bf7\u91cd\u7f6e\u9898\u5e93\u6216\u9009\u62e9\u5176\u5b83\u5206\u7c7b\u3002";
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

  $(".round-main .section-title").textContent = "\u8bbe\u7f6e\u8c01\u662f\u5367\u5e95";
  $(".round-main .section-subtitle").textContent = "\u9009\u62e9\u9898\u5e93\u3001\u5367\u5e95\u548c\u767d\u677f\u6570\u91cf\u3002\u53ea\u6709\u53c2\u4e0e\u73a9\u5bb6\u4f1a\u8fdb\u5165\u672c\u5c40\u3002";
  $("#roundSizeOptions").innerHTML = "";
  $("#roundCategoryOptions").classList.remove("music-category-select-wrap");
  $("#roundCategoryOptions").innerHTML = categories.map((category) => `
    <button class="option-btn ${category.id === state.wodiSelectedCategory ? "selected" : ""}" type="button" data-wodi-category="${escapeHTML(category.id)}">${escapeHTML(category.label)}</button>
  `).join("");
  elements.roundExtraOptions.innerHTML = `
    <div class="wodi-setup">
      <section>
        <h2>\u5367\u5e95\u6570\u91cf</h2>
        <div class="wodi-option-grid">
          <button class="option-btn ${state.wodiUndercoverCount === 1 ? "selected" : ""}" type="button" data-wodi-undercover-count="1">1</button>
          <button class="option-btn ${state.wodiUndercoverCount === 2 ? "selected" : ""}" type="button" data-wodi-undercover-count="2" ${canTwoUndercover ? "" : "disabled"}>2</button>
        </div>
      </section>
      <section>
        <h2>\u662f\u5426\u52a0\u5165\u767d\u677f</h2>
        <div class="wodi-option-grid">
          <button class="option-btn ${!state.wodiUseBlank ? "selected" : ""}" type="button" data-wodi-use-blank="false">\u5426</button>
          <button class="option-btn ${state.wodiUseBlank ? "selected" : ""}" type="button" data-wodi-use-blank="true">\u662f</button>
        </div>
      </section>
      <section>
        <h2>\u767d\u677f\u6570\u91cf</h2>
        <div class="wodi-option-grid">
          <button class="option-btn ${state.wodiBlankCount === 1 ? "selected" : ""}" type="button" data-wodi-blank-count="1" ${state.wodiUseBlank ? "" : "disabled"}>1</button>
          <button class="option-btn ${state.wodiBlankCount === 2 ? "selected" : ""}" type="button" data-wodi-blank-count="2" ${state.wodiUseBlank && canTwoBlank ? "" : "disabled"}>2</button>
        </div>
      </section>
      <section>
        <h2>\u9635\u8425\u663e\u793a</h2>
        <div class="wodi-option-grid">
          <button class="option-btn ${!state.wodiRevealRole ? "selected" : ""}" type="button" data-wodi-reveal-role="false">\u9690\u85cf\u9635\u8425</button>
          <button class="option-btn ${state.wodiRevealRole ? "selected" : ""}" type="button" data-wodi-reveal-role="true">\u660e\u793a\u9635\u8425</button>
        </div>
      </section>
      ${renderWodiIdentityDistribution()}
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
  const [question] = shuffleArray(getAvailableWodiQuestions(state.wodiSelectedCategory));
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
  updateWodiCategoryStatsDisplay();
  switchScreen("play");
  return true;
}

function buildWodiIdentityPayload(assignment) {
  return {
    title: "\u8c01\u662f\u5367\u5e95",
    name: assignment.name,
    role: assignment.role,
    roleLabel: WODI_ROLE_LABELS[assignment.role],
    word: assignment.word,
    revealRole: Boolean(state.wodiRevealRole)
  };
}

function buildWodiIdentityHtml(assignment) {
  const payload = buildWodiIdentityPayload(assignment);
  const roleBlock = payload.revealRole
    ? `<div class="label">\u4f60\u7684\u8eab\u4efd</div><div class="value">${escapeHTML(payload.roleLabel)}</div>`
    : "";
  const wordBlock = payload.role === "blank"
    ? `<div class="value">\u4f60\u6ca1\u6709\u8bcd</div><p>\u8bf7\u6839\u636e\u5927\u5bb6\u7684\u63cf\u8ff0\u4e34\u573a\u53d1\u6325\u3002</p>`
    : `<div class="label">\u4f60\u7684\u8bcd</div><div class="value">${escapeHTML(payload.word)}</div><p>\u8bf7\u8bb0\u4f4f\u4f60\u7684\u8bcd\uff0c\u4e0d\u8981\u7ed9\u522b\u4eba\u770b\u3002</p>`;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${payload.title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#fff8ea,#f3fbff);font-family:system-ui,"Microsoft YaHei",sans-serif;color:#594253}.card{width:min(92vw,420px);padding:28px;border-radius:24px;background:#fffdf8;box-shadow:0 18px 46px rgba(80,55,70,.2);text-align:center}.kicker{font-weight:900;color:#ff719d}.name{margin:8px 0 22px;font-size:20px;font-weight:900}.label{margin-top:14px;color:#8d7684;font-weight:800}.value{margin:8px 0;font-size:42px;line-height:1.1;font-weight:900}p{font-weight:800;line-height:1.6;color:#8d7684}button{width:100%;margin-top:18px;padding:14px 18px;border:0;border-radius:999px;background:linear-gradient(135deg,#ff719d,#ffc09b,#ffe58d);font-weight:900;color:#594253}.hidden .secret{display:none}.done{display:none}.hidden .done{display:block;font-size:28px;font-weight:900}</style></head><body><main class="card" id="card"><div class="secret"><div class="kicker">\u8c01\u662f\u5367\u5e95</div><div class="name">\u73a9\u5bb6\uff1a${escapeHTML(payload.name)}</div>${roleBlock}${wordBlock}<button id="ok">\u6211\u5df2\u8bb0\u4f4f</button></div><div class="done">\u8bf7\u628a\u624b\u673a\u6536\u8d77\u6765\uff0c\u4e0d\u8981\u7ed9\u522b\u4eba\u770b\u3002</div></main><script>document.getElementById("ok").onclick=function(){document.getElementById("card").className="card hidden"};</script></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function renderWodiQRCode(container, assignment) {
  const link = buildWodiIdentityHtml(assignment);
  if (typeof QRCode === "function") {
    try {
      new QRCode(container, { text: link, width: 220, height: 220, correctLevel: QRCode.CorrectLevel?.M });
    } catch (error) {
      container.innerHTML = `<div class="error-message show">\u4e8c\u7ef4\u7801\u5e93\u672a\u52a0\u8f7d\uff0c\u8bf7\u68c0\u67e5 vendor/qrcode.min.js</div>`;
    }
  } else {
    container.innerHTML = `<div class="error-message show">\u4e8c\u7ef4\u7801\u5e93\u672a\u52a0\u8f7d\uff0c\u8bf7\u68c0\u67e5 vendor/qrcode.min.js</div>`;
  }
  const fallback = document.createElement("textarea");
  fallback.className = "wodi-fallback-link";
  fallback.readOnly = true;
  fallback.value = link;
  container.appendChild(fallback);
}

function renderWodiAssigning() {
  const round = state.wodiRound;
  const assignment = round.assignments[round.revealIndex];
  const avatar = getAvatar(assignment.avatarId);
  rememberWodiHostShell();
  elements.mediaCard.className = "media-card wodi-mode";
  elements.mediaCard.innerHTML = `
    <div class="wodi-identity-stage">
      <h1>\u8c01\u662f\u5367\u5e95\uff1a\u626b\u7801\u67e5\u770b\u8eab\u4efd</h1>
      <p>\u6b63\u5728\u53d1\u653e\uff1a\u7b2c ${round.revealIndex + 1} / ${round.assignments.length} \u4f4d</p>
      <div class="wodi-current-player"><span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span><strong>${escapeHTML(assignment.name)}</strong></div>
      <div class="wodi-qr-card" id="wodiQrCard"></div>
      <p>\u8bf7\u5f53\u524d\u73a9\u5bb6\u626b\u7801\u67e5\u770b\u81ea\u5df1\u7684\u8eab\u4efd\u8bcd\uff0c\u4e0d\u8981\u8ba9\u5176\u4ed6\u4eba\u770b\u5230\u624b\u673a\u3002</p>
      <div class="action-row">
        <button class="ghost-btn" type="button" data-wodi-prev-identity ${round.revealIndex === 0 ? "disabled" : ""}>\u4e0a\u4e00\u4f4d\u73a9\u5bb6</button>
        <button class="ghost-btn" type="button" data-wodi-next-identity ${round.revealIndex >= round.assignments.length - 1 ? "disabled" : ""}>\u4e0b\u4e00\u4f4d\u73a9\u5bb6</button>
        <button class="primary-btn" type="button" data-wodi-start-discussion>\u5f00\u59cb\u6e38\u620f</button>
      </div>
    </div>`;
  renderWodiQRCode($("#wodiQrCard"), assignment);
  renderWodiSidePanel();
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
    </div>`;
  const pending = round.assignments.find((item) => item.participantId === round.pendingEliminationId);
  $(".gameplay-side-stack").innerHTML = `
    <div class="side-panel">
      <h2>\u6295\u7968\u6dd8\u6c70</h2>
      <p class="wodi-side-copy">\u73b0\u573a\u8ba8\u8bba\u548c\u6295\u7968\u540e\uff0c\u4e3b\u6301\u4eba\u70b9\u51fb\u88ab\u7968\u51fa\u7684\u73a9\u5bb6\u3002</p>
      ${pending ? `<div class="wodi-confirm-box"><strong>\u786e\u8ba4\u6dd8\u6c70 ${escapeHTML(pending.name)} \u5417\uff1f</strong><div class="action-row"><button class="ghost-btn" type="button" data-wodi-cancel-elimination>\u53d6\u6d88</button><button class="primary-btn" type="button" data-wodi-confirm-elimination>\u786e\u8ba4\u6dd8\u6c70</button></div></div>` : ""}
    </div>`;
}

function renderWodiResult() {
  const round = state.wodiRound;
  const winnerLabel = `${WODI_ROLE_LABELS[round.winner]}\u80dc\u5229`;
  const winners = round.assignments.filter((item) => item.role === round.winner && (round.winner !== "blank" || !item.eliminated));
  const grouped = (role) => round.assignments.filter((item) => item.role === role).map((item) => item.name).join("\u3001") || "\u65e0";
  rememberWodiHostShell();
  elements.mediaCard.className = "media-card wodi-mode";
  elements.mediaCard.innerHTML = `
    <div class="wodi-result-card">
      <div class="result-kicker">\u6e38\u620f\u7ed3\u675f</div>
      <h1>${winnerLabel}</h1>
      <p>\u83b7\u80dc\u73a9\u5bb6\uff1a${escapeHTML(winners.map((item) => item.name).join("\u3001") || "\u65e0")}</p>
      <div class="wodi-result-grid">
        <div>\u5e73\u6c11\u8bcd\uff1a<strong>${escapeHTML(round.goodWord)}</strong></div>
        <div>\u5367\u5e95\u8bcd\uff1a<strong>${escapeHTML(round.undercoverWord)}</strong></div>
        <div>\u5e73\u6c11\u73a9\u5bb6\uff1a${escapeHTML(grouped("civilian"))}</div>
        <div>\u5367\u5e95\u73a9\u5bb6\uff1a${escapeHTML(grouped("undercover"))}</div>
        <div>\u767d\u677f\u73a9\u5bb6\uff1a${escapeHTML(grouped("blank"))}</div>
        <div>\u672c\u5c40\u9898\u5e93\u5206\u7c7b\uff1a${escapeHTML(round.question.category)}</div>
      </div>
      <div class="action-row">
        <button class="primary-btn" type="button" data-wodi-new-round>\u518d\u6765\u4e00\u5c40</button>
        <button class="ghost-btn" type="button" data-wodi-return-home>\u56de\u5230\u9996\u9875</button>
      </div>
    </div>`;
  renderWodiSidePanel();
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
  updateWodiCategoryStatsDisplay();
  showToast("\u8c01\u662f\u5367\u5e95\u9898\u5e93\u5df2\u91cd\u7f6e");
}

function newWodiRound() {
  state.wodiRound = null;
  switchScreen("round");
}

function returnWodiHome() {
  state.wodiRound = null;
  switchScreen("home");
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
  buildIdentityHtml: buildWodiIdentityHtml,
  renderQRCode: renderWodiQRCode,
  showPreviousIdentity: showPreviousWodiIdentity,
  showNextIdentity: showNextWodiIdentity,
  startDiscussion: startWodiDiscussion,
  cancelElimination: cancelWodiElimination,
  newRound: newWodiRound,
  returnHome: returnWodiHome,
  getDebugInfo: getWodiDebugInfo,
  restoreHost: restoreWodiHostShell
};
