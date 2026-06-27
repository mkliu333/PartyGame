window.PartyGame = window.PartyGame || {};
window.PartyGame.Core = window.PartyGame.Core || {};

    function getParticipantNoun() {
      return state.mode === "single" ? "玩家" : "队伍";
    }

    function getParticipantListLabel() {
      return state.mode === "single" ? "玩家列表" : "队伍列表";
    }

    function getTotalScoreTitle() {
      return state.mode === "single" ? "个人总分" : "团队总分";
    }

    function getParticipantMinimumMessage() {
      return state.mode === "single" ? "请至少选择2位参与游戏的玩家哟" : "请至少选择2个参与游戏的队伍哟";
    }

    function resetParticipantRoundScores() {
      getCurrentModeParticipants().forEach((participant) => { participant.score = 0; });
    }

    function addActiveParticipant(participant) {
      getCurrentModeParticipants().push(participant);
    }

    function removeActiveParticipant(id) {
      if (state.mode === "single") {
        state.players = state.players.filter((player) => player.id !== id);
      } else {
        state.teams = state.teams.filter((team) => team.id !== id);
      }
    }

    function findActiveParticipantById(id) {
      return getActiveParticipants().find((participant) => participant.id === id);
    }

    function findParticipantById(id) {
      return getCurrentModeParticipants().find((participant) => participant.id === id);
    }

    function getCurrentModeParticipants() {
      return state.mode === "single" ? state.players : state.teams;
    }

    function getActiveParticipants() {
      return getCurrentModeParticipants().filter((participant) => participant.isActive !== false);
    }

    function getAvatar(avatarId) {
      return AVATAR_LIBRARY.find((avatar) => avatar.id === avatarId) || AVATAR_LIBRARY[0];
    }

    function updateModeCopy() {
      const isSingle = state.mode === "single";
      elements.setupTitle.textContent = isSingle ? "创建玩家档案" : "创建队伍档案";
      elements.setupSubtitle.textContent = isSingle
        ? "取个好记的名字，挑一个软乎乎的头像。至少添加 2 位玩家即可开始。"
        : "取个好记的队伍名，挑一个软乎乎的头像。至少添加 2 个队伍即可开始。";
      elements.nameLabel.textContent = isSingle ? "玩家名称" : "队伍名称";
      elements.participantName.placeholder = isSingle ? "例如：Melody" : "例如：奶油小队";
      elements.addParticipant.textContent = state.editingParticipantId ? "保存修改" : `添加${getParticipantNoun()}`;
      elements.cancelParticipantEdit.hidden = !state.editingParticipantId;
      elements.listTitle.textContent = getParticipantListLabel();
    }

    function renderAvatars() {
      elements.avatarGrid.innerHTML = AVATAR_LIBRARY.map((avatar) => `
        <button class="avatar-card ${avatar.id === state.selectedAvatarId ? "selected" : ""}" type="button" data-avatar-id="${avatar.id}" aria-label="选择头像 ${escapeHTML(avatar.label)}">
          <span class="avatar-face" style="background: ${avatar.color}">${avatar.emoji}</span>
        </button>
      `).join("");
    }

    function renderParticipants() {
      const participants = getCurrentModeParticipants();
      const emptyText = state.mode === "single" ? "等待添加玩家" : "等待添加组队";

      if (!participants.length) {
        elements.participantList.innerHTML = `
          <div class="participant-row">
            <span class="participant-info">
              <span class="mini-avatar">✦</span>
              <span class="mini-name">${emptyText}</span>
            </span>
          </div>
        `;
        return;
      }

      elements.participantList.innerHTML = participants.map((participant) => {
        const avatar = getAvatar(participant.avatarId);
        const safeName = escapeHTML(participant.name);
        return `
          <div class="participant-row ${participant.isActive === false ? "participant-inactive" : ""}">
            <span class="participant-info">
              <span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span>
              <span class="mini-name">${safeName}</span>
            </span>
            <span class="participant-actions">
              <button class="participation-btn ${participant.isActive === false ? "inactive" : "active"}" type="button" data-toggle-active-id="${participant.id}" aria-pressed="${participant.isActive !== false}">${participant.isActive === false ? "休息" : "参与"}</button>
              <button class="edit-btn" type="button" data-edit-id="${participant.id}" aria-label="编辑 ${safeName}">编辑</button>
              <button class="remove-btn" type="button" data-remove-id="${participant.id}" aria-label="移除 ${safeName}">×</button>
            </span>
          </div>
        `;
      }).join("");
    }

    function normalizeNameInput(value) {
      return value.replace(/\s+$/g, "");
    }

    function showValidationError(target, message) {
      target.textContent = message;
      target.classList.add("show");
    }

    function clearValidationError(target) {
      if (!target) return;
      target.textContent = "";
      target.classList.remove("show");
    }

    function showRoundError(message) {
      showValidationError(elements.roundError, message);
    }

    function showRoundInfo(message) {
      elements.roundInfo.textContent = message;
      elements.roundInfo.classList.add("show");
    }

    function clearRoundMessages() {
      clearValidationError(elements.roundError);
      clearValidationError(elements.roundInfo);
    }

    function isDuplicateName(name, excludeId = null) {
      return getCurrentModeParticipants().some((participant) => participant.id !== excludeId && participant.name === name);
    }

    function validateStart() {
      if (getActiveParticipants().length < 2) {
        showValidationError(elements.setupError, getParticipantMinimumMessage());
        return false;
      }

      return true;
    }

    function showToast(message) {
      elements.toast.textContent = message;
      elements.toast.classList.add("show");
      window.clearTimeout(showToast.timer);
      showToast.timer = window.setTimeout(() => elements.toast.classList.remove("show"), 2200);
    }

    function createParticipant() {
      const name = normalizeNameInput(elements.participantName.value);
      const noun = getParticipantNoun();
      const wasEditing = Boolean(state.editingParticipantId);

      if (!name.trim()) {
        showValidationError(elements.setupError, `请填写${noun}名称哟`);
        elements.participantName.focus();
        return;
      }

      if (name.length > 6) {
        showValidationError(elements.setupError, "名称最多6个字符哟");
        elements.participantName.focus();
        return;
      }

      if (isDuplicateName(name, state.editingParticipantId)) {
        showValidationError(elements.setupError, "该名称已存在，请换一个名字");
        elements.participantName.focus();
        return;
      }

      if (!state.selectedAvatarId) {
        showValidationError(elements.setupError, "请选择头像");
        return;
      }

      if (state.editingParticipantId) {
        const participant = findParticipantById(state.editingParticipantId);
        if (!participant) return cancelParticipantEdit();
        participant.name = name;
        participant.avatarId = state.selectedAvatarId;
        state.editingParticipantId = null;
      } else {
        addActiveParticipant({
          id: `${state.mode}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name,
          avatarId: state.selectedAvatarId,
          isActive: true,
          score: 0,
          totalScore: 0
        });
      }

      elements.participantName.value = "";
      clearValidationError(elements.setupError);
      updateModeCopy();
      renderParticipants();
      showToast(`${noun}${wasEditing ? "已更新" : "已加入"}`);
    }

    function beginParticipantEdit(id) {
      const participant = findParticipantById(id);
      if (!participant) return;
      state.editingParticipantId = id;
      state.selectedAvatarId = participant.avatarId;
      elements.participantName.value = participant.name;
      clearValidationError(elements.setupError);
      updateModeCopy();
      renderAvatars();
      elements.participantName.focus();
    }

    function cancelParticipantEdit() {
      state.editingParticipantId = null;
      state.selectedAvatarId = AVATAR_LIBRARY[0].id;
      elements.participantName.value = "";
      clearValidationError(elements.setupError);
      updateModeCopy();
      renderAvatars();
    }

    function removeParticipant(id) {
      if (state.editingParticipantId === id) cancelParticipantEdit();
      removeActiveParticipant(id);
      renderParticipants();
    }

    function toggleParticipantActive(id) {
      const participant = findParticipantById(id);
      if (!participant) return;
      participant.isActive = participant.isActive === false;
      renderParticipants();
      showToast(`${participant.name}${participant.isActive ? "已参与本局" : "本局休息"}`);
    }

Object.assign(window.PartyGame.Core, { getParticipantNoun, getParticipantListLabel, getTotalScoreTitle, getParticipantMinimumMessage, resetParticipantRoundScores, addActiveParticipant, removeActiveParticipant, findActiveParticipantById, findParticipantById, getCurrentModeParticipants, getActiveParticipants, getAvatar, updateModeCopy, renderAvatars, renderParticipants, normalizeNameInput, showValidationError, clearValidationError, showRoundError, showRoundInfo, clearRoundMessages, isDuplicateName, validateStart, showToast, createParticipant, removeParticipant, beginParticipantEdit, cancelParticipantEdit, toggleParticipantActive });
