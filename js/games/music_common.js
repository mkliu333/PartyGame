window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.musicCommon = window.PartyGame.Games.musicCommon || {};

function createMusicQuestionId(prefix, index) {
  return `${prefix}_${Date.now()}_${index}`;
}

function safeStopAudio(audio) {
  if (!audio) return;
  try {
    audio.pause();
  } catch (error) {
    console.warn("Unable to pause audio:", error);
  }
  try {
    audio.currentTime = 0;
  } catch (error) {
    console.warn("Unable to reset audio:", error);
  }
}

function stopAudioList(audioList) {
  if (!Array.isArray(audioList)) return [];
  audioList.forEach(safeStopAudio);
  return [];
}

Object.assign(window.PartyGame.Games.musicCommon, {
  createMusicQuestionId,
  safeStopAudio,
  stopAudioList
});
