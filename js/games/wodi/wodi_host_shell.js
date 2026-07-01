window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.WodiInternal = window.PartyGame.Games.WodiInternal || {};

function rememberWodiHostShell() {
  if (!wodiRuntime.originalMediaCardHtml) wodiRuntime.originalMediaCardHtml = elements.mediaCard.innerHTML;
  const sideStack = $(".gameplay-side-stack");
  if (sideStack && !wodiRuntime.originalSideStackHtml) wodiRuntime.originalSideStackHtml = sideStack.innerHTML;
}

function restoreWodiHostShell() {
  $(".gameplay-grid")?.classList.remove("wodi-fullscreen");
  if (wodiRuntime.originalMediaCardHtml) {
    elements.mediaCard.innerHTML = wodiRuntime.originalMediaCardHtml;
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
  if (sideStack && wodiRuntime.originalSideStackHtml) {
    sideStack.hidden = false;
    sideStack.innerHTML = wodiRuntime.originalSideStackHtml;
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

Object.assign(window.PartyGame.Games.WodiInternal, {
  rememberWodiHostShell,
  restoreHost: restoreWodiHostShell,
  restoreWodiHostShell
});
