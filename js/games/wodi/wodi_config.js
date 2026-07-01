window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.WodiInternal = window.PartyGame.Games.WodiInternal || {};

// 谁是卧底：负责扫码发词、线下投票、淘汰判定和阵营结算。
// 这是特殊游戏，不使用普通计分板和普通回合题目渲染。

const WODI_ALL_CATEGORY = "all";
const WODI_ROLE_LABELS = {
  civilian: "\u5e73\u6c11",
  undercover: "\u5367\u5e95",
  blank: "\u767d\u677f"
};
const wodiRuntime = {
  originalMediaCardHtml: "",
  originalSideStackHtml: "",
  identityBaseUrl: "",
  inventoryModalOpen: false
};

Object.assign(window.PartyGame.Games.WodiInternal, {
  WODI_ALL_CATEGORY,
  WODI_ROLE_LABELS,
  runtime: wodiRuntime
});
