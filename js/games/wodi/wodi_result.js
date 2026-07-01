window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.WodiInternal = window.PartyGame.Games.WodiInternal || {};

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

Object.assign(window.PartyGame.Games.WodiInternal, {
  renderResult: renderWodiResult,
  renderWodiResult,
  newRound: newWodiRound,
  newWodiRound,
  returnHome: returnWodiHome,
  returnWodiHome,
  getDebugInfo: getWodiDebugInfo,
  getWodiDebugInfo
});
