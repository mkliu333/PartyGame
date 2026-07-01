window.PartyGame = window.PartyGame || {};
window.PartyGame.Diagnostics = window.PartyGame.Diagnostics || {};
window.PartyGame.App = window.PartyGame.App || {};

function getThemeDebugInfo() {
  return {
    uiTheme: state.uiTheme,
    bodyTheme: document.body.dataset.theme,
    themeSwitcherExists: Boolean(document.querySelector("#themeSwitcher")),
    themePillCount: document.querySelectorAll(".theme-pill").length,
    floatLayerExists: Boolean(document.querySelector("#themeFloatLayer")),
    floatEmojiCount: document.querySelectorAll(".theme-float-emoji").length,
    roundExtraOptionsExists: Boolean(document.querySelector("#roundExtraOptions")),
    singleMusicPlaybackButtonCount: document.querySelectorAll("[data-single-music-playback]").length
  };
}

function getStructureDebugInfo() {
  return {
    version: APP_VERSION,
    updateTheme: UPDATE_THEME,
    screen: state.screen,
    activeGameId: state.activeGameId,
    uiTheme: state.uiTheme,
    themeSwitcherExists: Boolean(document.querySelector("#themeSwitcher")),
    themePillCount: document.querySelectorAll(".theme-pill").length,
    themeFloatLayerExists: Boolean(document.querySelector("#themeFloatLayer")),
    themeFloatEmojiCount: document.querySelectorAll(".theme-float-emoji").length,
    roundExtraOptionsExists: Boolean(document.querySelector("#roundExtraOptions")),
    singleMusicPlaybackButtonCount: document.querySelectorAll("[data-single-music-playback]").length,
    localStorageUsed: false,
    sessionStorageUsed: false
  };
}

function getProjectStructureDebugInfo() {
  return {
    version: typeof APP_VERSION === "undefined" ? "" : APP_VERSION,
    updateTheme: typeof UPDATE_THEME === "undefined" ? "" : UPDATE_THEME,
    screen: typeof state === "undefined" ? "" : state.screen,
    activeGameId: typeof state === "undefined" ? "" : state.activeGameId,
    modules: {
      app: Boolean(window.PartyGame.App),
      config: Boolean(window.PartyGame.Config),
      core: Boolean(window.PartyGame.Core),
      games: Boolean(window.PartyGame.Games),
      diagnostics: Boolean(window.PartyGame.Diagnostics),
      backgroundAudio: Boolean(window.PartyGame.Core?.BackgroundAudio),
      musicCommon: Boolean(window.PartyGame.Games?.musicCommon),
      musicBank: Boolean(window.PartyGame.Games?.musicBank),
      wodiInternal: Boolean(window.PartyGame.Games?.WodiInternal)
    },
    games: {
      registryCount: window.PartyGame.Games?.registry?.length || 0,
      lineGuess: Boolean(window.PartyGame.Games?.lineGuess),
      tripleMusic: Boolean(window.PartyGame.Games?.tripleMusic),
      singleMusic: Boolean(window.PartyGame.Games?.singleMusic),
      emojiGuess: Boolean(window.PartyGame.Games?.emojiGuess),
      wodi: Boolean(window.PartyGame.Games?.wodi),
      wodiApiComplete: Boolean(
        window.PartyGame.Games?.wodi?.renderGameplay
        && window.PartyGame.Games?.wodi?.startWodiRound
        && window.PartyGame.Games?.wodi?.renderQRCode
      )
    },
    data: {
      lineQuestions: Array.isArray(window.PARTY_QUESTIONS) ? window.PARTY_QUESTIONS.length : 0,
      tripleMusicTracks: Array.isArray(window.PARTY_TRIPLE_MUSIC_TRACKS) ? window.PARTY_TRIPLE_MUSIC_TRACKS.length : 0,
      emojiQuestions: Array.isArray(window.PARTY_EMOJI_GUESS_QUESTIONS) ? window.PARTY_EMOJI_GUESS_QUESTIONS.length : 0,
      wodiQuestions: Array.isArray(window.PARTY_WODI_QUESTIONS) ? window.PARTY_WODI_QUESTIONS.length : 0,
      emojiAssets: Boolean(window.PARTY_EMOJI_ASSETS)
    },
    dom: {
      themeSwitcherExists: Boolean(document.querySelector("#themeSwitcher")),
      roundExtraOptionsExists: Boolean(document.querySelector("#roundExtraOptions")),
      gamesGridExists: Boolean(document.querySelector("#gamesGrid")),
      mediaCardExists: Boolean(document.querySelector("#mediaCard")),
      scoreboardExists: Boolean(document.querySelector("#scoreboard"))
    },
    storagePolicy: {
      localStorageUsed: false,
      sessionStorageUsed: false
    }
  };
}

Object.assign(window.PartyGame.Diagnostics, {
  getThemeDebugInfo,
  getStructureDebugInfo,
  getProjectStructureDebugInfo
});

Object.assign(window.PartyGame.App, {
  getThemeDebugInfo,
  getStructureDebugInfo,
  getProjectStructureDebugInfo
});
