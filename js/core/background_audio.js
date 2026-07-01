window.PartyGame = window.PartyGame || {};
window.PartyGame.Core = window.PartyGame.Core || {};
window.PartyGame.App = window.PartyGame.App || {};

const BG_TRACKS = {
  MAIN: "main",
  GAME: "game",
  VICTORY_ROUND: "victoryRound",
  VICTORY_FINAL: "victoryFinal"
};

const BACKGROUND_AUDIO_TRACKS = {
  [BG_TRACKS.MAIN]: {
    src: "assets/background_song/mainpage-music.mp3",
    volume: 0.28,
    loop: true
  },
  [BG_TRACKS.GAME]: {
    src: "assets/background_song/game-music.mp3",
    volume: 0.22,
    loop: true
  },
  [BG_TRACKS.VICTORY_ROUND]: {
    src: "assets/background_song/victory-1.mp3",
    volume: 0.55,
    loop: false
  },
  [BG_TRACKS.VICTORY_FINAL]: {
    src: "assets/background_song/victory-2.mp3",
    volume: 0.55,
    loop: false
  }
};

const backgroundAudioState = {
  initialized: false,
  unlocked: false,
  currentTrack: "",
  pendingTrack: "",
  playToken: 0,
  victoryActive: false,
  birthdaySuspended: false,
  autoplayWarningShown: false,
  playWarningShown: false,
  audios: {}
};

function createBackgroundAudio(trackName, config) {
  const audio = new Audio(config.src);
  audio.loop = config.loop;
  audio.preload = "auto";
  audio.volume = 0;
  audio.addEventListener("ended", () => {
    if (backgroundAudioState.currentTrack === trackName) {
      backgroundAudioState.currentTrack = "";
    }
    if (trackName === BG_TRACKS.VICTORY_ROUND || trackName === BG_TRACKS.VICTORY_FINAL) {
      backgroundAudioState.victoryActive = false;
    }
  });
  return audio;
}

function initBackgroundAudio() {
  if (backgroundAudioState.initialized) return;
  Object.entries(BACKGROUND_AUDIO_TRACKS).forEach(([trackName, config]) => {
    backgroundAudioState.audios[trackName] = createBackgroundAudio(trackName, config);
  });
  ["click", "keydown", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, unlockBackgroundAudio, { once: true, passive: true });
  });
  backgroundAudioState.initialized = true;
  syncBackgroundAudio();
}

function warnAutoplayDeferredOnce() {
  if (backgroundAudioState.autoplayWarningShown) return;
  console.warn("\u80cc\u666f\u97f3\u4e50\u5c06\u5728\u7528\u6237\u9996\u6b21\u70b9\u51fb\u9875\u9762\u540e\u542f\u52a8\u3002");
  backgroundAudioState.autoplayWarningShown = true;
}

function warnPlayBlockedOnce(error) {
  if (backgroundAudioState.playWarningShown) return;
  console.warn("\u80cc\u666f\u97f3\u4e50\u64ad\u653e\u88ab\u6d4f\u89c8\u5668\u6682\u65f6\u62e6\u622a\u3002", error);
  backgroundAudioState.playWarningShown = true;
}

function unlockBackgroundAudio() {
  backgroundAudioState.unlocked = true;
  syncBackgroundAudio();
}

function fadeAudio(audio, targetVolume, duration = 420) {
  window.clearInterval(audio.fadeTimer);
  const startVolume = Number(audio.volume) || 0;
  const startedAt = performance.now();
  audio.fadeTimer = window.setInterval(() => {
    const progress = Math.min(1, (performance.now() - startedAt) / duration);
    audio.volume = startVolume + ((targetVolume - startVolume) * progress);
    if (progress >= 1) window.clearInterval(audio.fadeTimer);
  }, 40);
}

function stopBackgroundTrack(trackName) {
  const audio = backgroundAudioState.audios[trackName];
  if (!audio) return;
  window.clearInterval(audio.fadeTimer);
  audio.pause();
  audio.currentTime = 0;
  audio.volume = 0;
  if (backgroundAudioState.currentTrack === trackName) {
    backgroundAudioState.currentTrack = "";
  }
  if (backgroundAudioState.pendingTrack === trackName) {
    backgroundAudioState.pendingTrack = "";
  }
  if (trackName === BG_TRACKS.VICTORY_ROUND || trackName === BG_TRACKS.VICTORY_FINAL) {
    backgroundAudioState.victoryActive = false;
  }
}

function pauseAllBackgroundAudio() {
  backgroundAudioState.playToken += 1;
  Object.keys(backgroundAudioState.audios).forEach(stopBackgroundTrack);
  backgroundAudioState.currentTrack = "";
  backgroundAudioState.pendingTrack = "";
  backgroundAudioState.victoryActive = false;
}

function stopMainBackgroundAudio() {
  stopBackgroundTrack(BG_TRACKS.MAIN);
}

function stopGameBackgroundAudio() {
  stopBackgroundTrack(BG_TRACKS.GAME);
}

function stopVictoryBackgroundAudio() {
  stopBackgroundTrack(BG_TRACKS.VICTORY_ROUND);
  stopBackgroundTrack(BG_TRACKS.VICTORY_FINAL);
}

function playBackgroundTrack(trackName) {
  const config = BACKGROUND_AUDIO_TRACKS[trackName];
  const audio = backgroundAudioState.audios[trackName];
  if (!config || !audio || backgroundAudioState.birthdaySuspended) return;
  if (backgroundAudioState.currentTrack === trackName && !audio.paused) {
    backgroundAudioState.pendingTrack = "";
    return;
  }
  const token = ++backgroundAudioState.playToken;
  const isVictoryTrack = trackName === BG_TRACKS.VICTORY_ROUND || trackName === BG_TRACKS.VICTORY_FINAL;
  backgroundAudioState.pendingTrack = trackName;
  if (!backgroundAudioState.unlocked) {
    backgroundAudioState.victoryActive = isVictoryTrack;
    warnAutoplayDeferredOnce();
    return;
  }
  Object.keys(backgroundAudioState.audios)
    .filter((name) => name !== trackName)
    .forEach(stopBackgroundTrack);
  backgroundAudioState.victoryActive = isVictoryTrack;
  window.clearInterval(audio.fadeTimer);
  audio.loop = config.loop;
  audio.currentTime = 0;
  audio.volume = 0;
  audio.play()
    .then(() => {
      if (token !== backgroundAudioState.playToken || backgroundAudioState.birthdaySuspended) {
        const trackWasReused = backgroundAudioState.pendingTrack === trackName || backgroundAudioState.currentTrack === trackName;
        if (!trackWasReused || backgroundAudioState.birthdaySuspended) {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0;
          if (backgroundAudioState.currentTrack === trackName) backgroundAudioState.currentTrack = "";
          if (backgroundAudioState.pendingTrack === trackName) backgroundAudioState.pendingTrack = "";
          if (isVictoryTrack) backgroundAudioState.victoryActive = false;
        }
        return;
      }
      backgroundAudioState.currentTrack = trackName;
      backgroundAudioState.pendingTrack = "";
      fadeAudio(audio, config.volume);
    })
    .catch((error) => {
      backgroundAudioState.currentTrack = "";
      backgroundAudioState.pendingTrack = "";
      if (isVictoryTrack) backgroundAudioState.victoryActive = false;
      warnPlayBlockedOnce(error);
    });
}

function playMainBackgroundAudio() {
  playBackgroundTrack(BG_TRACKS.MAIN);
}

function playGameBackgroundAudio() {
  playBackgroundTrack(BG_TRACKS.GAME);
}

function playRoundVictoryAudio() {
  playBackgroundTrack(BG_TRACKS.VICTORY_ROUND);
}

function playFinalVictoryAudio() {
  playBackgroundTrack(BG_TRACKS.VICTORY_FINAL);
}

function isOverlayOpen(overlay) {
  return Boolean(overlay?.classList?.contains("show"));
}

function isResultOverlayOpen() {
  return typeof elements !== "undefined" && isOverlayOpen(elements.roundResultOverlay);
}

function isFinalOverlayOpen() {
  return typeof elements !== "undefined" && isOverlayOpen(elements.finalResultOverlay);
}

function isBirthdaySongCurrentlyPlaying() {
  return typeof isBirthdaySongPlaying === "function" && isBirthdaySongPlaying();
}

function shouldPlayGameMusic() {
  if (typeof state === "undefined" || state.screen !== "play") return false;
  if (state.activeGameId === "emoji_guess") {
    return !isResultOverlayOpen() && !isFinalOverlayOpen();
  }
  if (state.activeGameId === "wodi") {
    return state.wodiRound?.status === "assigning" || state.wodiRound?.status === "voting";
  }
  return false;
}

function isWodiResultActive() {
  return (
    typeof state !== "undefined"
    && state.screen === "play"
    && typeof isWodiActive === "function"
    && isWodiActive()
    && state.wodiRound?.status === "finished"
  );
}

function shouldMuteForAudioGame() {
  if (typeof state === "undefined" || state.screen !== "play") return false;
  return (
    state.activeGameId === "line_guess"
    || state.activeGameId === "triple_music"
    || state.activeGameId === "single_music"
  );
}

function shouldPlayMainMusic() {
  if (typeof state === "undefined") return false;
  return (
    !backgroundAudioState.birthdaySuspended
    && !isBirthdaySongCurrentlyPlaying()
    && !isResultOverlayOpen()
    && !isFinalOverlayOpen()
    && !isWodiResultActive()
    && !shouldPlayGameMusic()
    && !shouldMuteForAudioGame()
  );
}

function syncBackgroundAudio() {
  if (!backgroundAudioState.initialized) return;
  if (backgroundAudioState.birthdaySuspended || isBirthdaySongCurrentlyPlaying()) {
    pauseAllBackgroundAudio();
    return;
  }
  if (
    backgroundAudioState.victoryActive
    && (backgroundAudioState.currentTrack === BG_TRACKS.VICTORY_ROUND || backgroundAudioState.currentTrack === BG_TRACKS.VICTORY_FINAL)
    && (isResultOverlayOpen() || isFinalOverlayOpen() || isWodiResultActive())
  ) {
    return;
  }
  if (shouldPlayGameMusic()) {
    playGameBackgroundAudio();
    return;
  }
  if (shouldMuteForAudioGame()) {
    pauseAllBackgroundAudio();
    return;
  }
  if (isResultOverlayOpen() || isFinalOverlayOpen()) {
    pauseAllBackgroundAudio();
    return;
  }
  if (shouldPlayMainMusic()) {
    playMainBackgroundAudio();
    return;
  }
  pauseAllBackgroundAudio();
}

function suspendBackgroundAudioForBirthday() {
  backgroundAudioState.birthdaySuspended = true;
  backgroundAudioState.playToken += 1;
  pauseAllBackgroundAudio();
}

function resumeBackgroundAudioAfterBirthday() {
  backgroundAudioState.birthdaySuspended = false;
  syncBackgroundAudio();
}

function getBackgroundAudioDebugInfo() {
  return {
    unlocked: backgroundAudioState.unlocked,
    currentTrack: backgroundAudioState.currentTrack,
    pendingTrack: backgroundAudioState.pendingTrack,
    playToken: backgroundAudioState.playToken,
    mainPlaying: Boolean(backgroundAudioState.audios[BG_TRACKS.MAIN] && !backgroundAudioState.audios[BG_TRACKS.MAIN].paused),
    gamePlaying: Boolean(backgroundAudioState.audios[BG_TRACKS.GAME] && !backgroundAudioState.audios[BG_TRACKS.GAME].paused),
    victoryRoundPlaying: Boolean(backgroundAudioState.audios[BG_TRACKS.VICTORY_ROUND] && !backgroundAudioState.audios[BG_TRACKS.VICTORY_ROUND].paused),
    victoryFinalPlaying: Boolean(backgroundAudioState.audios[BG_TRACKS.VICTORY_FINAL] && !backgroundAudioState.audios[BG_TRACKS.VICTORY_FINAL].paused),
    birthdaySuspended: backgroundAudioState.birthdaySuspended,
    birthdayPlaying: isBirthdaySongCurrentlyPlaying(),
    shouldPlayMain: shouldPlayMainMusic(),
    shouldPlayGame: shouldPlayGameMusic(),
    shouldMuteForAudioGame: shouldMuteForAudioGame(),
    resultOverlayOpen: isResultOverlayOpen(),
    finalOverlayOpen: isFinalOverlayOpen(),
    screen: typeof state === "undefined" ? "" : state.screen,
    activeGameId: typeof state === "undefined" ? "" : state.activeGameId,
    wodiStatus: typeof state === "undefined" ? "" : state.wodiRound?.status || ""
  };
}

window.PartyGame.Core.BackgroundAudio = {
  init: initBackgroundAudio,
  unlock: unlockBackgroundAudio,
  sync: syncBackgroundAudio,
  playMain: playMainBackgroundAudio,
  playGame: playGameBackgroundAudio,
  playVictoryRound: playRoundVictoryAudio,
  playVictoryFinal: playFinalVictoryAudio,
  pauseAll: pauseAllBackgroundAudio,
  suspendForBirthday: suspendBackgroundAudioForBirthday,
  resumeAfterBirthday: resumeBackgroundAudioAfterBirthday,
  stopMain: stopMainBackgroundAudio,
  stopGame: stopGameBackgroundAudio,
  stopVictory: stopVictoryBackgroundAudio,
  getDebugInfo: getBackgroundAudioDebugInfo
};

window.PartyGame.App.getBackgroundAudioDebugInfo = getBackgroundAudioDebugInfo;
