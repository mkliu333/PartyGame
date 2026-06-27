window.PartyGame = window.PartyGame || {};
window.PartyGame.App = window.PartyGame.App || {};

function bindEvents() {
  document.addEventListener("click", (event) => {
    const themeTarget = event.target.closest("[data-ui-theme]");
    if (themeTarget) {
      applyUITheme(themeTarget.dataset.uiTheme);
      return;
    }

    const singleMusicPlaybackTarget = event.target.closest("[data-single-music-playback]");
    if (singleMusicPlaybackTarget && window.PartyGame.Games.singleMusic) {
      window.PartyGame.Games.singleMusic.setPlaybackMode(singleMusicPlaybackTarget.dataset.singleMusicPlayback);
      return;
    }

    const gameTarget = event.target.closest("[data-game-id]");
    if (gameTarget) {
      const game = getGameById(gameTarget.dataset.gameId);
      if (game && game.status !== "available") {
        showToast("这个游戏还在准备中，敬请期待");
        return;
      }
      if (game && !selectGame(game.id)) return;
    }

    const navTarget = event.target.closest("[data-nav]");
    if (navTarget) {
      if (navTarget.dataset.nav === "home") requestReturnHome();
      else switchScreen(navTarget.dataset.nav);
    }

    const modeTarget = event.target.closest("[data-mode]");
    if (modeTarget) updateSelectedMode(modeTarget.dataset.mode);

    const avatarTarget = event.target.closest("[data-avatar-id]");
    if (avatarTarget) {
      state.selectedAvatarId = avatarTarget.dataset.avatarId;
      renderAvatars();
    }

    const removeTarget = event.target.closest("[data-remove-id]");
    if (removeTarget) removeParticipant(removeTarget.dataset.removeId);

    const editTarget = event.target.closest("[data-edit-id]");
    if (editTarget) beginParticipantEdit(editTarget.dataset.editId);

    const participationTarget = event.target.closest("[data-toggle-active-id]");
    if (participationTarget) toggleParticipantActive(participationTarget.dataset.toggleActiveId);

    const scoreTarget = event.target.closest("[data-score-id]");
    if (scoreTarget) adjustScore(scoreTarget.dataset.scoreId, Number(scoreTarget.dataset.delta));

    const noScoreTarget = event.target.closest("#noScoreOption");
    if (noScoreTarget) selectNoScore();

    const triplePreviewTarget = event.target.closest("[data-triple-preview-id]");
    if (triplePreviewTarget && window.PartyGame.Games.tripleMusic) {
      window.PartyGame.Games.tripleMusic.playSinglePreview(triplePreviewTarget.dataset.triplePreviewId);
    }

    const singleMusicReplayTarget = event.target.closest("[data-single-music-replay]");
    if (singleMusicReplayTarget && window.PartyGame.Games.singleMusic) {
      window.PartyGame.Games.singleMusic.playAudio();
    }

    const sizeTarget = event.target.closest("[data-round-size]");
    if (sizeTarget) {
      state.roundSize = sizeTarget.dataset.roundSize === "ALL" ? "ALL" : Number(sizeTarget.dataset.roundSize);
      renderRoundOptions();
    }

    const categoryTarget = event.target.closest("[data-round-category]");
    if (categoryTarget) {
      state.selectedCategory = categoryTarget.dataset.roundCategory;
      renderRoundOptions();
      updateCategoryStatsDisplay();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("#musicCategorySelect")) {
      state.selectedCategory = event.target.value;
      updateCategoryStatsDisplay();
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
    clearRoundMessages();
    beginActiveRoundSnapshot();
    if (generateRoundQuestions()) {
      switchScreen("play");
    } else {
      discardActiveRoundSnapshot();
    }
  });
  elements.roundSecondaryAction.addEventListener("click", () => {
    if (state.hasStartedAnyRound) {
      showFinalSettlementOverlay();
    } else {
      switchScreen("setup");
    }
  });
  elements.playPrompt.addEventListener("click", () => {
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
  await loadQuestionBank();
  if (window.PartyGame.Games.tripleMusic) {
    window.PartyGame.Games.tripleMusic.loadTrackBank();
  }
  if (window.PartyGame.Games.emojiGuess) {
    window.PartyGame.Games.emojiGuess.loadQuestionBank();
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
