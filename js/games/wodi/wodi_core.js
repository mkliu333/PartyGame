window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.WodiInternal = window.PartyGame.Games.WodiInternal || {};

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
  wodiRuntime.inventoryModalOpen = false;
  updateWodiCategoryStatsDisplay();
  if (note) showToast(note);
  switchScreen("play");
  window.PartyGame.Core.BackgroundAudio?.sync();
  window.PartyGame.Core.HostAnswers?.showForCurrentRound?.({
    continueLabel: "已扫码，继续发身份"
  });
  return true;
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

Object.assign(window.PartyGame.Games.WodiInternal, {
  generateRoundQuestions: startWodiRound,
  startWodiRound,
  renderGameplay: renderWodiGameplay,
  renderWodiGameplay
});
