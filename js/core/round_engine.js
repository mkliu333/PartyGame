window.PartyGame = window.PartyGame || {};
window.PartyGame.Core = window.PartyGame.Core || {};

    function getCategoryLabel(category) {
      if (isEmojiGuessActive()) return window.PartyGame.Games.emojiGuess.getCategoryLabel(category);
      const musicGame = isMusicGameActive() ? getActiveMusicGame() : null;
      if (musicGame) {
        return musicGame.getCategoryLabel(category);
      }
      return CATEGORY_CONFIG.find((item) => item.id === category)?.label || "题库";
    }

    function getQuestionsByCategory(category) {
      return state.questionBank.filter((question) => question.category === category);
    }

    function getAvailableQuestions(category) {
      return getQuestionsByCategory(category).filter((question) => (
        !state.consumedQuestionIds.has(question.id) && !state.skippedQuestionIds.has(question.id)
      ));
    }

    function getCategoryStats() {
      return CATEGORY_CONFIG.map((category) => {
        const total = getQuestionsByCategory(category.id).length;
        const remaining = getAvailableQuestions(category.id).length;
        return { ...category, total, remaining };
      });
    }

    function updateCategoryStatsDisplay() {
      if (isEmojiGuessActive()) {
        window.PartyGame.Games.emojiGuess.updateCategoryStatsDisplay();
        return;
      }
      const musicGame = isMusicGameActive() ? getActiveMusicGame() : null;
      if (musicGame) {
        musicGame.updateCategoryStatsDisplay();
        return;
      }
      renderQuestionBankInspector();
      elements.categoryStats.innerHTML = getCategoryStats().map((stat) => `
        <div class="stats-row">
          <span>${escapeHTML(stat.label)}</span>
          <span>共 ${stat.total} 道，剩余 ${stat.remaining} 道</span>
        </div>
      `).join("");
    }

    function renderQuestionBankInspector() {
      if (!elements.questionBankInspectPanel) return;
      if (isEmojiGuessActive()) {
        window.PartyGame.Games.emojiGuess.renderQuestionBankInspector();
        return;
      }
      if (isMusicGameActive()) {
        const preflight = state.tripleMusicPreflight || { loaded: 0, skipped: 0, issues: [] };
        const issues = preflight.issues || [];
        const firstIssues = issues.slice(0, 10);
        const moreCount = Math.max(0, issues.length - firstIssues.length);
        const issueHtml = firstIssues.length
          ? firstIssues.map((issue) => `<span class="inspect-issue">${escapeHTML(issue)}</span>`).join("") + (moreCount ? `<span class="inspect-issue">还有 ${moreCount} 条，请打开 console 查看完整结果。</span>` : "")
          : `<span class="inspect-issue">音频题库检查暂未发现明显问题。</span>`;

        elements.questionBankInspectPanel.innerHTML = `
          <div class="inspect-panel-section">
            <div class="inspect-panel-row"><span>题库来源：</span><span>${escapeHTML(state.tripleMusicSource)}</span></div>
            <div class="inspect-panel-row"><span>可用音频段</span><span>${preflight.loaded}</span></div>
            <div class="inspect-panel-row"><span>跳过音频段</span><span>${preflight.skipped}</span></div>
            <div class="inspect-panel-title">检查问题</div>
            ${issueHtml}
          </div>
        `;
        return;
      }
      const fallbackHint = state.questionBankSource === "内置备用"
        ? `<span class="inspect-issue">⚠ 当前正在使用内置备用题库。正式游戏前请确认 data/script_guess/questions_v3.js 已正确加载。</span>`
        : "";
      const issues = state.preflight.issues || [];
      const firstIssues = issues.slice(0, 10);
      const moreCount = Math.max(0, issues.length - firstIssues.length);
      const issueHtml = firstIssues.length
        ? firstIssues.map((issue) => `<span class="inspect-issue">${escapeHTML(issue)}</span>`).join("") + (moreCount ? `<span class="inspect-issue">还有 ${moreCount} 条，请打开 console 查看完整结果。</span>` : "")
        : `<span class="inspect-issue">题库检查暂未发现明显问题。</span>`;

      elements.questionBankInspectPanel.innerHTML = `
        <div class="inspect-panel-section">
          <div class="inspect-panel-row"><span>题库来源</span><span>${escapeHTML(state.questionBankSource)}</span></div>
          <div class="inspect-panel-row"><span>可用题目</span><span>${state.preflight.loaded}</span></div>
          <div class="inspect-panel-row"><span>跳过题目</span><span>${state.preflight.skipped}</span></div>
          <div class="inspect-panel-row"><span>缺少文字答案</span><span>${state.preflightSummary.missingAnswer}</span></div>
          <div class="inspect-panel-row"><span>缺少答案片段</span><span>${state.preflightSummary.missingAnswerClip}</span></div>
          ${fallbackHint}
          <div class="inspect-panel-title">题库检查</div>
          ${issueHtml}
        </div>
      `;
    }

    function shuffleArray(array) {
      const copy = [...array];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
      }
      return copy;
    }

    function drawRandomQuestions(pool, count) {
      return shuffleArray(pool).slice(0, Math.max(0, count));
    }

    function shuffleRoundQuestions(questions) {
      return shuffleArray(questions);
    }

    function drawSpecificCategoryRound(category, roundSize) {
      const available = getAvailableQuestions(category);
      return drawRandomQuestions(available, Math.min(roundSize, available.length));
    }

    function getAllAvailableQuestionsForSelection() {
      if (state.selectedCategory === "all") {
        return CATEGORY_CONFIG.flatMap((category) => getAvailableQuestions(category.id));
      }
      return getAvailableQuestions(state.selectedCategory);
    }

    function resolveRoundSize(availableCount) {
      return state.roundSize === "ALL" ? availableCount : state.roundSize;
    }

    function takeFromCategory(category, count, excludeIds = new Set()) {
      const pool = getAvailableQuestions(category).filter((question) => !excludeIds.has(question.id));
      return drawRandomQuestions(pool, Math.min(count, pool.length));
    }

    function getRemainingCountAfterSelection(category, selectedIds) {
      return getAvailableQuestions(category).filter((question) => !selectedIds.has(question.id)).length;
    }

    function drawMixedRound(roundSize) {
      const categories = CATEGORY_CONFIG.map((category) => category.id);
      const divisibleSize = Math.floor(roundSize / categories.length) * categories.length;
      const baseCount = divisibleSize / categories.length;
      const selected = [];
      const selectedIds = new Set();

      categories.forEach((category) => {
        const drawn = takeFromCategory(category, baseCount, selectedIds);
        drawn.forEach((question) => selectedIds.add(question.id));
        selected.push(...drawn);
      });

      while (selected.length < roundSize) {
        const rankedCategories = categories
          .map((category) => ({ category, remaining: getRemainingCountAfterSelection(category, selectedIds) }))
          .sort((a, b) => b.remaining - a.remaining || a.category.localeCompare(b.category));

        const nextCategory = rankedCategories.find((item) => item.remaining > 0);
        if (!nextCategory) break;

        const [question] = takeFromCategory(nextCategory.category, 1, selectedIds);
        if (!question) break;

        selectedIds.add(question.id);
        selected.push(question);
      }

      return shuffleArray(selected);
    }

    function markQuestionsConsumed(questions) {
      questions.forEach((question) => state.consumedQuestionIds.add(question.id));
      updateCategoryStatsDisplay();
    }

    function generateRoundQuestions() {
      if (isEmojiGuessActive()) return window.PartyGame.Games.emojiGuess.generateRoundQuestions();
      const musicGame = isMusicGameActive() ? getActiveMusicGame() : null;
      if (musicGame) {
        return musicGame.generateRoundQuestions();
      }
      const allAvailable = getAllAvailableQuestionsForSelection();
      const resolvedRoundSize = resolveRoundSize(allAvailable.length);
      const questions = state.roundSize === "ALL"
        ? allAvailable
        : state.selectedCategory === "all"
          ? drawMixedRound(resolvedRoundSize)
          : drawSpecificCategoryRound(state.selectedCategory, resolvedRoundSize);

      state.currentRoundQuestions = shuffleRoundQuestions(questions);
      state.currentQuestionIndex = 0;
      resetQuestionFlowState();

      if (!state.currentRoundQuestions.length) {
        showRoundError("当前题库没有可用题目啦，请重置题库后再试");
        return false;
      }

      if (state.roundSize !== "ALL" && state.currentRoundQuestions.length < resolvedRoundSize) {
        const label = state.selectedCategory === "all" ? "大合集" : getCategoryLabel(state.selectedCategory);
        showRoundInfo(`${label}题库剩余题目不足，已抽取全部可用题目`);
      }

      markQuestionsConsumed(state.currentRoundQuestions);
      state.hasStartedAnyRound = true;
      return true;
    }

    function resetQuestionPool() {
      if (isEmojiGuessActive()) {
        window.PartyGame.Games.emojiGuess.resetQuestionPool();
        return;
      }
      const musicGame = isMusicGameActive() ? getActiveMusicGame() : null;
      if (musicGame) {
        musicGame.resetQuestionPool();
        return;
      }
      state.consumedQuestionIds.clear();
      state.skippedQuestionIds.clear();
      updateCategoryStatsDisplay();
      showToast("题库已重置，所有题目可以重新抽取啦");
    }

    function beginActiveRoundSnapshot() {
      state.activeRoundScoreSnapshot = getCurrentModeParticipants().map((participant) => ({
        id: participant.id,
        score: participant.score || 0,
        totalScore: participant.totalScore || 0
      }));
      state.activeRoundInventorySnapshot = {
        questionIds: new Set(state.consumedQuestionIds),
        musicTrackIds: new Set(state.consumedMusicTrackIds),
        emojiQuestionIds: new Set(state.consumedEmojiGuessQuestionIds)
      };
    }

    function discardActiveRoundSnapshot() {
      state.activeRoundScoreSnapshot = null;
      state.activeRoundInventorySnapshot = null;
    }

    function completeActiveRoundSnapshot() {
      discardActiveRoundSnapshot();
    }

    function isActiveRoundUnfinished() {
      return Array.isArray(state.activeRoundScoreSnapshot) && Boolean(state.activeRoundInventorySnapshot);
    }

    function restoreSetFromSnapshot(target, snapshot) {
      target.clear();
      snapshot.forEach((id) => target.add(id));
    }

    function rollbackActiveRound() {
      if (!isActiveRoundUnfinished()) return false;
      restoreSetFromSnapshot(state.consumedQuestionIds, state.activeRoundInventorySnapshot.questionIds);
      restoreSetFromSnapshot(state.consumedMusicTrackIds, state.activeRoundInventorySnapshot.musicTrackIds);
      restoreSetFromSnapshot(state.consumedEmojiGuessQuestionIds, state.activeRoundInventorySnapshot.emojiQuestionIds || new Set());
      state.activeRoundScoreSnapshot.forEach((saved) => {
        const participant = findParticipantById(saved.id);
        if (!participant) return;
        participant.score = saved.score;
        participant.totalScore = saved.totalScore;
      });
      discardActiveRoundSnapshot();
      state.currentRoundQuestions = [];
      state.currentQuestionIndex = 0;
      state.currentRoundResult = null;
      state.hasStartedAnyRound = state.completedRoundCount > 0;
      resetQuestionFlowState();
      return true;
    }

    function resetAllGameInventories() {
      state.consumedQuestionIds.clear();
      state.skippedQuestionIds.clear();
      state.consumedMusicTrackIds.clear();
      state.skippedMusicTrackIds.clear();
      state.consumedEmojiGuessQuestionIds.clear();
      state.skippedEmojiGuessQuestionIds.clear();
      if (state.screen === "round") updateCategoryStatsDisplay();
      showToast("所有游戏题库库存已重置");
    }

Object.assign(window.PartyGame.Core, { getCategoryLabel, getQuestionsByCategory, getAvailableQuestions, getCategoryStats, updateCategoryStatsDisplay, renderQuestionBankInspector, shuffleArray, drawRandomQuestions, shuffleRoundQuestions, drawSpecificCategoryRound, getAllAvailableQuestionsForSelection, resolveRoundSize, takeFromCategory, getRemainingCountAfterSelection, drawMixedRound, markQuestionsConsumed, beginActiveRoundSnapshot, discardActiveRoundSnapshot, completeActiveRoundSnapshot, isActiveRoundUnfinished, rollbackActiveRound, generateRoundQuestions, resetQuestionPool, resetAllGameInventories });

