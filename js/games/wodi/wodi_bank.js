window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.WodiInternal = window.PartyGame.Games.WodiInternal || {};

function normalizeWodiQuestion(rawQuestion) {
  const safe = rawQuestion && typeof rawQuestion === "object" ? rawQuestion : {};
  return {
    id: normalizeCodeField(safe.id),
    word_for_good_man: normalizeField(safe.word_for_good_man).trim(),
    word_for_wodi: normalizeField(safe.word_for_wodi).trim()
  };
}

function validateWodiQuestion(question) {
  const errors = [];
  if (!question.id) errors.push("\u7f3a\u5c11 ID");
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

function getWodiCategories() {
  return [];
}

function getWodiCategoryLabel(category) {
  return "\u8c01\u662f\u5367\u5e95\u9898\u5e93";
}

function getAvailableWodiQuestions() {
  return state.wodiQuestions.filter((question) => (
    !state.wodiConsumedQuestionIds.has(question.id)
    && !state.wodiSkippedQuestionIds.has(question.id)
  ));
}

function getWodiRemainingCount() {
  return getAvailableWodiQuestions().length;
}

function getWodiInventoryWarning() {
  return getWodiRemainingCount() === 0
    ? "\u8c01\u662f\u5367\u5e95\u9898\u5e93\u5df2\u6ca1\u6709\u65b0\u9898\uff0c\u8bf7\u91cd\u7f6e\u9898\u5e93\u540e\u518d\u5f00\u59cb\u3002"
    : "";
}

function resolveWodiQuestionForRound() {
  const pool = getAvailableWodiQuestions();
  return {
    question: shuffleArray(pool)[0] || null,
    note: pool.length === 1 ? "\u8fd9\u662f\u6700\u540e\u4e00\u9053\u65b0\u9898\u3002" : ""
  };
}

function getWodiRoundConfig() {
  return {
    title: "\u8bbe\u7f6e\u8c01\u662f\u5367\u5e95",
    subtitle: "\u9009\u62e9\u8eab\u4efd\u5206\u5e03\uff0c\u4e3b\u6301\u4eba\u901a\u8fc7\u4e8c\u7ef4\u7801\u9010\u4e2a\u53d1\u8bcd\u3002\u6bcf\u5c40\u4f1a\u4ece\u5168\u9898\u5e93\u968f\u673a\u62bd\u53d6 1 \u7ec4\u8bcd\u3002",
    stockTitle: "\u8c01\u662f\u5367\u5e95\u9898\u5e93\u5e93\u5b58",
    sizes: [],
    categories: []
  };
}

function renderWodiQuestionBankInspector() {
  if (!elements.questionBankInspectPanel) return;
  const preflight = state.wodiPreflight || { loaded: 0, skipped: 0, issues: [] };
  const issues = (preflight.issues || []).slice(0, 10);
  elements.questionBankInspectPanel.innerHTML = `
    <div class="inspect-panel-section">
      <div class="inspect-panel-row"><span>\u9898\u5e93\u6765\u6e90</span><span>wodi/wodi_questions_v2.js</span></div>
      <div class="inspect-panel-row"><span>\u53ef\u7528\u8bcd\u7ec4</span><span>${preflight.loaded}</span></div>
      <div class="inspect-panel-row"><span>\u8df3\u8fc7\u8bcd\u7ec4</span><span>${preflight.skipped}</span></div>
      <div class="inspect-panel-title">\u9898\u5e93\u68c0\u67e5</div>
      ${issues.length ? issues.map((issue) => `<span class="inspect-issue">${escapeHTML(issue)}</span>`).join("") : '<span class="inspect-issue">\u9898\u5e93\u68c0\u67e5\u6682\u672a\u53d1\u73b0\u660e\u663e\u95ee\u9898\u3002</span>'}
    </div>`;
}

function updateWodiCategoryStatsDisplay() {
  renderWodiQuestionBankInspector();
  const total = state.wodiQuestions.length;
  const remaining = getAvailableWodiQuestions().length;
  elements.categoryStats.innerHTML = `
    <div class="stats-row"><span>\u603b\u9898\u6570</span><span>${total} \u7ec4</span></div>
    <div class="stats-row"><span>\u5269\u4f59\u9898\u6570</span><span>${remaining} \u7ec4</span></div>
  `;
}

function resetWodiQuestionPool() {
  state.wodiConsumedQuestionIds.clear();
  state.wodiSkippedQuestionIds.clear();
  wodiRuntime.inventoryModalOpen = false;
  updateWodiCategoryStatsDisplay();
  renderWodiSetupOptions();
  showToast("\u8c01\u662f\u5367\u5e95\u9898\u5e93\u5df2\u91cd\u7f6e\uff0c\u6240\u6709\u8bcd\u7ec4\u53ef\u4ee5\u91cd\u65b0\u62bd\u53d6\u3002");
}

Object.assign(window.PartyGame.Games.WodiInternal, {
  normalizeWodiQuestion,
  validateWodiQuestion,
  loadQuestionBank: loadWodiQuestionBank,
  loadWodiQuestionBank,
  getWodiCategories,
  getCategoryLabel: getWodiCategoryLabel,
  getWodiCategoryLabel,
  getAvailableWodiQuestions,
  getWodiRemainingCount,
  getWodiInventoryWarning,
  resolveWodiQuestionForRound,
  getRoundConfig: getWodiRoundConfig,
  getWodiRoundConfig,
  renderQuestionBankInspector: renderWodiQuestionBankInspector,
  renderWodiQuestionBankInspector,
  updateCategoryStatsDisplay: updateWodiCategoryStatsDisplay,
  updateWodiCategoryStatsDisplay,
  resetQuestionPool: resetWodiQuestionPool,
  resetWodiQuestionPool
});
