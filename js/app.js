window.PartyGame = window.PartyGame || {};
window.PartyGame.App = window.PartyGame.App || {};

function handleThemeClick(event) {
  const themeTarget = event.target.closest("[data-ui-theme]");
  if (!themeTarget) return false;
  applyUITheme(themeTarget.dataset.uiTheme);
  return true;
}

function handleSingleMusicPlaybackClick(event) {
  const target = event.target.closest("[data-single-music-playback]");
  if (!target || !window.PartyGame.Games.singleMusic) return false;
  window.PartyGame.Games.singleMusic.setPlaybackMode(target.dataset.singleMusicPlayback);
  return true;
}

function handleGameCardClick(event) {
  const gameTarget = event.target.closest("[data-game-id]");
  if (!gameTarget) return false;
  const game = getGameById(gameTarget.dataset.gameId);
  if (game && game.status !== "available") {
    showToast("这个游戏还在准备中，敬请期待");
    return true;
  }
  if (game && !selectGame(game.id)) return true;

  if (gameTarget.dataset.nav) {
    if (gameTarget.dataset.nav === "home") requestReturnHome();
    else switchScreen(gameTarget.dataset.nav);
  }

  return true;
}

function handleNavigationClick(event) {
  const navTarget = event.target.closest("[data-nav]");
  if (!navTarget) return false;
  if (navTarget.dataset.nav === "home") requestReturnHome();
  else switchScreen(navTarget.dataset.nav);
  return true;
}

function handleModeClick(event) {
  const modeTarget = event.target.closest("[data-mode]");
  if (!modeTarget) return false;
  updateSelectedMode(modeTarget.dataset.mode);
  return true;
}

function handleParticipantClick(event) {
  const avatarTarget = event.target.closest("[data-avatar-id]");
  if (avatarTarget) {
    state.selectedAvatarId = avatarTarget.dataset.avatarId;
    renderAvatars();
    return true;
  }

  const removeTarget = event.target.closest("[data-remove-id]");
  if (removeTarget) {
    removeParticipant(removeTarget.dataset.removeId);
    return true;
  }

  const editTarget = event.target.closest("[data-edit-id]");
  if (editTarget) {
    beginParticipantEdit(editTarget.dataset.editId);
    return true;
  }

  const participationTarget = event.target.closest("[data-toggle-active-id]");
  if (participationTarget) {
    toggleParticipantActive(participationTarget.dataset.toggleActiveId);
    return true;
  }

  return false;
}

function handleScoringClick(event) {
  const scoreTarget = event.target.closest("[data-score-id]");
  if (scoreTarget) {
    adjustScore(scoreTarget.dataset.scoreId, Number(scoreTarget.dataset.delta));
    return true;
  }

  const noScoreTarget = event.target.closest("#noScoreOption");
  if (noScoreTarget) {
    selectNoScore();
    return true;
  }

  return false;
}

function handleMusicPreviewClick(event) {
  const triplePreviewTarget = event.target.closest("[data-triple-preview-id]");
  if (triplePreviewTarget && window.PartyGame.Games.tripleMusic) {
    window.PartyGame.Games.tripleMusic.playSinglePreview(triplePreviewTarget.dataset.triplePreviewId);
    return true;
  }

  const singleMusicForwardAfterRevealTarget = event.target.closest("[data-single-music-forward-after-reveal]");
  if (singleMusicForwardAfterRevealTarget && window.PartyGame.Games.singleMusic) {
    window.PartyGame.Games.singleMusic.playForwardAudio();
    return true;
  }

  const singleMusicAlternateTarget = event.target.closest("[data-single-music-alternate]");
  if (singleMusicAlternateTarget && window.PartyGame.Games.singleMusic) {
    window.PartyGame.Games.singleMusic.playAlternateAudio();
    return true;
  }

  return false;
}

function handleRoundOptionClick(event) {
  if (isWodiActive() && window.PartyGame.Games.wodi) {
    const undercoverTarget = event.target.closest("[data-wodi-undercover-count]");
    if (undercoverTarget) {
      state.wodiUndercoverCount = Number(undercoverTarget.dataset.wodiUndercoverCount);
      window.PartyGame.Games.wodi.renderSetupOptions();
      return true;
    }

    const useBlankTarget = event.target.closest("[data-wodi-use-blank]");
    if (useBlankTarget) {
      state.wodiUseBlank = useBlankTarget.dataset.wodiUseBlank === "true";
      state.wodiBlankCount = state.wodiUseBlank ? Math.max(1, state.wodiBlankCount || 1) : 0;
      window.PartyGame.Games.wodi.renderSetupOptions();
      return true;
    }

    const blankCountTarget = event.target.closest("[data-wodi-blank-count]");
    if (blankCountTarget) {
      state.wodiBlankCount = Number(blankCountTarget.dataset.wodiBlankCount);
      state.wodiUseBlank = true;
      window.PartyGame.Games.wodi.renderSetupOptions();
      return true;
    }

    const revealRoleTarget = event.target.closest("[data-wodi-reveal-role]");
    if (revealRoleTarget) {
      state.wodiRevealRole = revealRoleTarget.dataset.wodiRevealRole === "true";
      window.PartyGame.Games.wodi.renderSetupOptions();
      return true;
    }
  }

  const sizeTarget = event.target.closest("[data-round-size]");
  if (sizeTarget) {
    state.roundSize = sizeTarget.dataset.roundSize === "ALL" ? "ALL" : Number(sizeTarget.dataset.roundSize);
    renderRoundOptions();
    return true;
  }

  const categoryTarget = event.target.closest("[data-round-category]");
  if (categoryTarget) {
    state.selectedCategory = categoryTarget.dataset.roundCategory;
    renderRoundOptions();
    updateCategoryStatsDisplay();
    return true;
  }

  return false;
}

function handleWodiClick(event) {
  if (!window.PartyGame.Games.wodi) return false;
  const wodi = window.PartyGame.Games.wodi;
  if (event.target.closest("[data-wodi-close-inventory-modal]")) {
    wodi.closeInventoryModal();
    return true;
  }
  if (event.target.closest("[data-wodi-start-round]")) return wodi.startWodiRound();
  if (event.target.closest("[data-wodi-prev-identity]")) {
    wodi.showPreviousIdentity();
    return true;
  }
  if (event.target.closest("[data-wodi-next-identity]")) {
    wodi.showNextIdentity();
    return true;
  }
  if (event.target.closest("[data-wodi-start-discussion]")) {
    wodi.startDiscussion();
    return true;
  }
  const eliminateTarget = event.target.closest("[data-wodi-eliminate-id]");
  if (eliminateTarget) {
    wodi.eliminatePlayer(eliminateTarget.dataset.wodiEliminateId);
    return true;
  }
  if (event.target.closest("[data-wodi-confirm-elimination]")) {
    wodi.confirmElimination();
    return true;
  }
  if (event.target.closest("[data-wodi-cancel-elimination]")) {
    wodi.cancelElimination();
    return true;
  }
  if (event.target.closest("[data-wodi-new-round]")) {
    wodi.newRound();
    return true;
  }
  if (event.target.closest("[data-wodi-return-home]")) {
    wodi.returnHome();
    return true;
  }
  if (event.target.closest("[data-wodi-reset-pool]")) {
    wodi.resetQuestionPool();
    return true;
  }
  return false;
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    if (handleThemeClick(event)) return;
    if (handleSingleMusicPlaybackClick(event)) return;
    if (handleGameCardClick(event)) return;
    if (handleNavigationClick(event)) return;
    if (handleModeClick(event)) return;
    if (handleParticipantClick(event)) return;
    if (handleScoringClick(event)) return;
    if (handleMusicPreviewClick(event)) return;
    if (handleRoundOptionClick(event)) return;
    if (handleWodiClick(event)) return;
  });

  document.addEventListener("change", (event) => {
    if (isWodiActive() && window.PartyGame.Games.wodi) {
      if (event.target.matches("[data-wodi-undercover-select]")) {
        state.wodiUndercoverCount = Number(event.target.value);
        window.PartyGame.Games.wodi.renderSetupOptions();
        return;
      }
      if (event.target.matches("[data-wodi-use-blank-checkbox]")) {
        state.wodiUseBlank = event.target.checked;
        state.wodiBlankCount = state.wodiUseBlank ? Math.max(1, state.wodiBlankCount || 1) : 0;
        window.PartyGame.Games.wodi.renderSetupOptions();
        return;
      }
      if (event.target.matches("[data-wodi-blank-select]")) {
        state.wodiBlankCount = Number(event.target.value);
        state.wodiUseBlank = state.wodiBlankCount > 0;
        window.PartyGame.Games.wodi.renderSetupOptions();
        return;
      }
      if (event.target.matches("[data-wodi-reveal-role-select]")) {
        state.wodiRevealRole = event.target.value === "true";
        window.PartyGame.Games.wodi.renderSetupOptions();
        return;
      }
    }

    if (event.target.matches("#musicCategorySelect")) {
      state.selectedCategory = event.target.value;
      updateCategoryStatsDisplay();
    }
  });

  document.addEventListener("input", (event) => {
    if (
      isWodiActive()
      && window.PartyGame.Games.wodi
      && event.target.matches("[data-wodi-mobile-base-url]")
    ) {
      window.PartyGame.Games.wodi.updateIdentityBaseUrl(event.target.value);
    }
  });

  elements.addParticipant.addEventListener("click", createParticipant);
  elements.cancelParticipantEdit.addEventListener("click", cancelParticipantEdit);
  elements.resetAllGames.addEventListener("click", resetAllGameInventories);
  elements.birthdaySongToggle.addEventListener("click", toggleBirthdaySong);
  elements.cancelExitGame.addEventListener("click", closeExitGameConfirmation);
  elements.confirmExitGame.addEventListener("click", confirmActiveGameExit);
  elements.participantName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") createParticipant();
  });
  elements.startGame.addEventListener("click", () => {
    if (validateStart()) switchScreen("round");
  });
  elements.startRound.addEventListener("click", () => {
    if (isWodiActive()) {
      window.PartyGame.Games.wodi.startWodiRound();
      return;
    }
    clearRoundMessages();
    beginActiveRoundSnapshot();
    if (generateRoundQuestions()) {
      switchScreen("play");
      window.PartyGame.Core.BackgroundAudio?.sync();
    } else {
      discardActiveRoundSnapshot();
    }
  });
  elements.roundSecondaryAction.addEventListener("click", () => {
    if (isWodiActive()) {
      switchScreen("setup");
      return;
    }
    if (state.hasStartedAnyRound) {
      showFinalSettlementOverlay();
    } else {
      switchScreen("setup");
    }
  });
  elements.playPrompt.addEventListener("click", () => {
    if (isWodiActive()) return;
    if (isEmojiGuessActive()) {
      window.PartyGame.Games.emojiGuess.showHint();
      return;
    }
    const musicGame = isMusicGameActive() ? getActiveMusicGame() : null;
    if (musicGame) (musicGame.playMixedAudio || musicGame.playAudio)();
  });
  elements.revealAnswer.addEventListener("click", revealAnswer);
  elements.toggleAnswerText.addEventListener("click", toggleAnswerText);
  elements.confirmScore.addEventListener("click", confirmScore);
  elements.clip.addEventListener("error", handleMediaLoadError);
  elements.questionImage.addEventListener("error", handleMediaLoadError);
  elements.returnToRoundSetup.addEventListener("click", closeRoundResultAndReturnSetup);
  elements.finalReturnHome.addEventListener("click", resetFullGameSession);
  $("#resetQuestionPool").addEventListener("click", resetQuestionPool);
}

async function init() {
  if (!elements.themeSwitcher) console.warn("[PartyGame] Missing #themeSwitcher in PartyGame.html");
  if (!elements.roundExtraOptions) console.warn("[PartyGame] Missing #roundExtraOptions in PartyGame.html");
  updateClock();
  window.setInterval(updateClock, 1000);
  applyUITheme(state.uiTheme || "classic_cream");
  renderHomepageGameCards();
  updateModeCopy();
  renderRoundOptions();
  renderAvatars();
  renderParticipants();
  renderTotalScores();
  bindEvents();
  window.PartyGame.Core.BackgroundAudio?.init();
  await loadQuestionBank();
  if (window.PartyGame.Games.tripleMusic) {
    window.PartyGame.Games.tripleMusic.loadTrackBank();
  }
  if (window.PartyGame.Games.emojiGuess) {
    window.PartyGame.Games.emojiGuess.loadQuestionBank();
  }
  if (window.PartyGame.Games.wodi) {
    window.PartyGame.Games.wodi.loadQuestionBank();
  }
  console.info("[PartyGame]", {
    version: APP_VERSION,
    updateTheme: UPDATE_THEME,
    activeGame: getActiveGame().id,
    externalQuestionDetected: hasExternalQuestionBank(),
    questionSource: state.questionBankSource,
    loadedQuestions: state.preflight.loaded,
    skippedQuestions: state.preflight.skipped,
    tripleMusicSource: state.tripleMusicSource,
    loadedTripleMusicTracks: state.tripleMusicPreflight.loaded,
    skippedTripleMusicTracks: state.tripleMusicPreflight.skipped,
    tripleMusicValidationIssues: state.tripleMusicPreflight.issues
  });
}

Object.assign(window.PartyGame.App, { bindEvents, init });

init();
