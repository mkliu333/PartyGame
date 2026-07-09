window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.WodiInternal = window.PartyGame.Games.WodiInternal || {};

const WodiInternal = window.PartyGame.Games.WodiInternal;

window.PartyGame.Games.wodi = {
  id: "wodi",
  isActive: isWodiActive,
  loadQuestionBank: WodiInternal.loadQuestionBank,
  getRoundConfig: WodiInternal.getRoundConfig,
  getCategoryLabel: WodiInternal.getCategoryLabel,
  updateCategoryStatsDisplay: WodiInternal.updateCategoryStatsDisplay,
  renderQuestionBankInspector: WodiInternal.renderQuestionBankInspector,
  renderSetupOptions: WodiInternal.renderSetupOptions,
  renderIdentityDistribution: WodiInternal.renderIdentityDistribution,
  generateRoundQuestions: WodiInternal.startWodiRound,
  startWodiRound: WodiInternal.startWodiRound,
  resetQuestionPool: WodiInternal.resetQuestionPool,
  renderGameplay: WodiInternal.renderGameplay,
  renderVoteStage: WodiInternal.renderVoteStage,
  renderResult: WodiInternal.renderResult,
  eliminatePlayer: WodiInternal.eliminatePlayer,
  confirmElimination: WodiInternal.confirmElimination,
  checkWinCondition: WodiInternal.checkWinCondition,
  buildIdentityPayload: WodiInternal.buildIdentityPayload,
  buildIdentityHtml: WodiInternal.buildIdentityUrl,
  buildIdentityUrl: WodiInternal.buildIdentityUrl,
  renderQRCode: WodiInternal.renderQRCode,
  getIdentityBaseUrl: WodiInternal.getIdentityBaseUrl,
  setIdentityBaseUrl: WodiInternal.setIdentityBaseUrl,
  updateIdentityBaseUrl: WodiInternal.updateIdentityBaseUrl,
  showPreviousIdentity: WodiInternal.showPreviousIdentity,
  showNextIdentity: WodiInternal.showNextIdentity,
  startDiscussion: WodiInternal.startDiscussion,
  cancelElimination: WodiInternal.cancelElimination,
  closeInventoryModal: WodiInternal.closeInventoryModal,
  newRound: WodiInternal.newRound,
  returnHome: WodiInternal.returnHome,
  getDebugInfo: WodiInternal.getDebugInfo,
  restoreHost: WodiInternal.restoreHost
};
