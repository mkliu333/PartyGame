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

Object.assign(window.PartyGame.Diagnostics, {
  getThemeDebugInfo,
  getStructureDebugInfo
});

Object.assign(window.PartyGame.App, {
  getThemeDebugInfo,
  getStructureDebugInfo
});
