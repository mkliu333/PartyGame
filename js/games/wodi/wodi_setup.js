window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.WodiInternal = window.PartyGame.Games.WodiInternal || {};

function getWodiActivePlayers() {
  return state.players.filter((player) => player.isActive !== false);
}

function validateWodiConfig() {
  const total = getWodiActivePlayers().length;
  const undercoverCount = Number(state.wodiUndercoverCount) || 1;
  const blankCount = state.wodiUseBlank ? Number(state.wodiBlankCount) || 1 : 0;
  const civilianCount = total - undercoverCount - blankCount;
  if (total < 4) return "\u8c01\u662f\u5367\u5e95\u81f3\u5c11\u9700\u8981 4 \u4f4d\u53c2\u4e0e\u73a9\u5bb6\u3002";
  if (total < 6 && undercoverCount > 1) return "\u5c11\u4e8e 6 \u4eba\u65f6\u53ea\u80fd\u8bbe\u7f6e 1 \u4e2a\u5367\u5e95\u3002";
  if (total < 6 && blankCount > 1) return "\u5c11\u4e8e 6 \u4eba\u65f6\u767d\u677f\u6700\u591a 1 \u4e2a\u3002";
  if (total < 8 && blankCount > 1) return "8 \u4eba\u53ca\u4ee5\u4e0a\u624d\u53ef\u4ee5\u8bbe\u7f6e 2 \u4e2a\u767d\u677f\u3002";
  if (civilianCount < 2) return "\u5e73\u6c11\u4eba\u6570\u5fc5\u987b\u81f3\u5c11 2 \u4eba\u3002";
  if (undercoverCount < 1) return "\u5367\u5e95\u4eba\u6570\u5fc5\u987b\u81f3\u5c11 1 \u4eba\u3002";
  if (undercoverCount + blankCount >= total) return "\u5367\u5e95 + \u767d\u677f\u5fc5\u987b\u5c11\u4e8e\u603b\u53c2\u4e0e\u4eba\u6570\u3002";
  if (!state.wodiQuestions.length) return "\u8c01\u662f\u5367\u5e95\u9898\u5e93\u672a\u52a0\u8f7d\uff0c\u8bf7\u68c0\u67e5 data/wodi/wodi_questions_v1.js\u3002";
  return "";
}

function renderWodiSetupOptions() {
  const total = getWodiActivePlayers().length;
  if (total < 6 && state.wodiUndercoverCount > 1) state.wodiUndercoverCount = 1;
  if (total < 8 && state.wodiBlankCount > 1) state.wodiBlankCount = 1;
  if (!state.wodiUseBlank) state.wodiBlankCount = 0;
  const categories = [{ id: WODI_ALL_CATEGORY, label: "\u5927\u5408\u96c6" }, ...getWodiCategories()];
  const canTwoUndercover = total >= 6;
  const canTwoBlank = total >= 8;
  const inventoryWarning = getWodiInventoryWarning();

  $(".round-main").classList.add("wodi-round-main");
  $(".round-main .section-title").textContent = "\u8bbe\u7f6e\u8c01\u662f\u5367\u5e95";
  $(".round-main .section-subtitle").textContent = "\u9009\u62e9\u9898\u5e93\u3001\u5367\u5e95\u548c\u767d\u677f\u6570\u91cf\u3002\u53ea\u6709\u53c2\u4e0e\u73a9\u5bb6\u4f1a\u8fdb\u5165\u672c\u5c40\u3002";
  $("#roundSizeOptions").innerHTML = "";
  $("#roundCategoryOptions").classList.remove("music-category-select-wrap");
  $("#roundCategoryOptions").innerHTML = "";
  elements.roundExtraOptions.innerHTML = `
    <div class="wodi-setup">
      <label class="wodi-field">
        <span>\u9898\u5e93\u5206\u7c7b</span>
        <select data-wodi-category-select>
          ${categories.map((category) => `<option value="${escapeHTML(category.id)}" ${category.id === state.wodiSelectedCategory ? "selected" : ""}>${escapeHTML(category.label)}</option>`).join("")}
        </select>
      </label>
      <label class="wodi-field">
        <span>\u5367\u5e95\u6570\u91cf</span>
        <select data-wodi-undercover-select>
          <option value="1" ${state.wodiUndercoverCount === 1 ? "selected" : ""}>1</option>
          <option value="2" ${state.wodiUndercoverCount === 2 ? "selected" : ""} ${canTwoUndercover ? "" : "disabled"}>2</option>
        </select>
      </label>
      <label class="wodi-switch">
        <input type="checkbox" data-wodi-use-blank-checkbox ${state.wodiUseBlank ? "checked" : ""}>
        <span class="wodi-switch-track" aria-hidden="true"></span>
        <span>\u52a0\u5165\u767d\u677f</span>
      </label>
      <label class="wodi-field">
        <span>\u767d\u677f\u6570\u91cf</span>
        <select data-wodi-blank-select ${state.wodiUseBlank ? "" : "disabled"}>
          <option value="0" ${state.wodiBlankCount === 0 ? "selected" : ""}>0</option>
          <option value="1" ${state.wodiBlankCount === 1 ? "selected" : ""}>1</option>
          <option value="2" ${state.wodiBlankCount === 2 ? "selected" : ""} ${canTwoBlank ? "" : "disabled"}>2</option>
        </select>
      </label>
      <label class="wodi-field">
        <span>\u9635\u8425\u663e\u793a</span>
        <select data-wodi-reveal-role-select>
          <option value="false" ${!state.wodiRevealRole ? "selected" : ""}>\u9690\u85cf\u9635\u8425\uff0c\u53ea\u663e\u793a\u8bcd</option>
          <option value="true" ${state.wodiRevealRole ? "selected" : ""}>\u660e\u793a\u9635\u8425\uff0c\u663e\u793a\u8eab\u4efd + \u8bcd</option>
        </select>
      </label>
      ${inventoryWarning ? `<div class="wodi-warning">${inventoryWarning}</div>` : ""}
      ${renderWodiIdentityDistribution()}
      ${renderWodiInventoryModal()}
    </div>`;
  $(".round-stock h2").textContent = "\u8c01\u662f\u5367\u5e95\u9898\u5e93\u5e93\u5b58";
  elements.totalScoreTitle.textContent = "\u672c\u5c40\u53c2\u4e0e\u73a9\u5bb6";
  elements.totalScoreList.innerHTML = getWodiActivePlayers().map((player) => {
    const avatar = getAvatar(player.avatarId);
    return `<div class="total-score-row"><span class="participant-info"><span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span><span class="mini-name">${escapeHTML(player.name)}</span></span><span>\u53c2\u4e0e</span></div>`;
  }).join("") || '<div class="stats-row"><span>\u7b49\u5f85\u73a9\u5bb6</span><span>0</span></div>';
  elements.startRound.textContent = "\u5f00\u59cb\u672c\u8f6e";
  elements.roundSecondaryAction.textContent = "\u8fd4\u56de\u73a9\u5bb6";
  updateWodiCategoryStatsDisplay();
}

function renderWodiInventoryModal() {
  if (!wodiRuntime.inventoryModalOpen) return "";
  return `
    <div class="wodi-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="wodiInventoryTitle">
      <div class="wodi-modal-card">
        <div class="result-kicker">\u9898\u5e93\u5e93\u5b58</div>
        <h2 id="wodiInventoryTitle">\u9898\u5e93\u5df2\u7528\u5b8c</h2>
        <p>\u5f53\u524d\u5206\u7c7b\u5df2\u6ca1\u6709\u65b0\u9898\uff0c\u8bf7\u9009\u62e9\u5176\u5b83\u5206\u7c7b\u6216\u8005\u91cd\u7f6e\u9898\u5e93\u3002</p>
        <div class="modal-actions">
          <button class="primary-btn" type="button" data-wodi-close-inventory-modal>\u77e5\u9053\u4e86</button>
        </div>
      </div>
    </div>`;
}

function showWodiInventoryModal() {
  wodiRuntime.inventoryModalOpen = true;
  renderWodiSetupOptions();
}

function closeWodiInventoryModal() {
  wodiRuntime.inventoryModalOpen = false;
  renderWodiSetupOptions();
}

function renderWodiIdentityDistribution() {
  const total = getWodiActivePlayers().length;
  const undercover = Number(state.wodiUndercoverCount) || 1;
  const blank = state.wodiUseBlank ? Number(state.wodiBlankCount) || 1 : 0;
  const civilian = Math.max(0, total - undercover - blank);
  return `<div class="wodi-distribution">\u672c\u5c40\uff1a\u5e73\u6c11 ${civilian} \u4eba\uff0c\u5367\u5e95 ${undercover} \u4eba${blank ? `\uff0c\u767d\u677f ${blank} \u4eba` : ""}\u3002</div>`;
}

Object.assign(window.PartyGame.Games.WodiInternal, {
  getWodiActivePlayers,
  validateWodiConfig,
  renderSetupOptions: renderWodiSetupOptions,
  renderWodiSetupOptions,
  renderIdentityDistribution: renderWodiIdentityDistribution,
  renderWodiIdentityDistribution,
  renderWodiInventoryModal,
  showWodiInventoryModal,
  closeInventoryModal: closeWodiInventoryModal,
  closeWodiInventoryModal
});
