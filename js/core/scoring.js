window.PartyGame = window.PartyGame || {};
window.PartyGame.Core = window.PartyGame.Core || {};

    function renderScoreboard() {
      const participants = getActiveParticipants();
      const scoringEnabled = state.phase === "revealed";
      elements.confirmScore.hidden = !(state.questionScoreChanged || state.noScoreSelected);
      elements.scoreboard.innerHTML = participants.map((participant) => {
        const avatar = getAvatar(participant.avatarId);
        const plusUsed = state.questionPositiveAwardedIds.has(participant.id);
        const safeName = escapeHTML(participant.name);
        return `
          <div class="score-row ${plusUsed ? "active" : ""} ${scoringEnabled ? "" : "disabled"}">
            <span class="participant-info">
              <span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span>
              <span class="mini-name">${safeName}</span>
            </span>
            <span class="score-value">${participant.score}</span>
            <span class="score-actions">
              <button class="score-btn" type="button" data-score-id="${participant.id}" data-delta="-1" ${scoringEnabled ? "" : "disabled"}>−</button>
              <button class="score-btn ${plusUsed ? "score-btn-used" : ""}" type="button" data-score-id="${participant.id}" data-delta="1" ${scoringEnabled && !plusUsed ? "" : "disabled"} title="${plusUsed ? "本题已加过分" : ""}" aria-label="${plusUsed ? "本题已加过分" : "加一分"}">＋</button>
            </span>
          </div>
        `;
      }).join("") + `
        <button class="score-row no-score-row ${state.noScoreSelected ? "selected" : ""}" type="button" id="noScoreOption" ${scoringEnabled ? "" : "disabled"}>
          此轮没有组别加分
        </button>
      `;
    }

    function renderTotalScores() {
      const participants = getActiveParticipants();
      elements.totalScoreTitle.textContent = getTotalScoreTitle();
      if (!participants.length) {
        elements.totalScoreList.innerHTML = `<div class="stats-row"><span>等待分组完成</span><span>0 分</span></div>`;
        return;
      }
      elements.totalScoreList.innerHTML = participants
        .map((participant) => {
          const avatar = getAvatar(participant.avatarId);
          const safeName = escapeHTML(participant.name);
          return `
            <div class="total-score-row">
              <span class="participant-info">
                <span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span>
                <span class="mini-name">${safeName}</span>
              </span>
              <span class="score-value">${participant.totalScore || 0}</span>
            </div>
          `;
        }).join("");
    }

    function rollbackCurrentQuestionPositiveAwards() {
      state.questionPositiveAwardedIds.forEach((id) => {
        const participant = findActiveParticipantById(id);
        if (participant) participant.score = Math.max(0, participant.score - 1);
        const nextDelta = (state.questionDeltaById.get(id) || 0) - 1;
        if (nextDelta) {
          state.questionDeltaById.set(id, nextDelta);
        } else {
          state.questionDeltaById.delete(id);
        }
      });
      state.questionPositiveAwardedIds.clear();
    }

    function clearCurrentQuestionScoringState() {
      state.questionPositiveAwardedIds.clear();
      state.questionDeltaById = new Map();
      state.questionScoreChanged = false;
      state.noScoreSelected = false;
    }

    function adjustScore(id, delta) {
      if (state.phase !== "revealed") return;
      const participant = findActiveParticipantById(id);
      if (!participant) return;

      if (delta > 0) {
        if (state.questionPositiveAwardedIds.has(id)) return;
        participant.score += 1;
        state.questionPositiveAwardedIds.add(id);
        state.questionDeltaById.set(id, (state.questionDeltaById.get(id) || 0) + 1);
      } else {
        participant.score = Math.max(0, participant.score - 1);
        state.questionDeltaById.set(id, (state.questionDeltaById.get(id) || 0) - 1);
        state.questionPositiveAwardedIds.delete(id);
      }

      state.questionScoreChanged = true;
      state.noScoreSelected = false;
      renderScoreboard();
    }

    function selectNoScore() {
      if (state.phase !== "revealed") return;
      if (!state.noScoreSelected) {
        rollbackCurrentQuestionPositiveAwards();
        state.noScoreSelected = true;
        state.questionScoreChanged = false;
      } else {
        state.noScoreSelected = false;
        state.questionScoreChanged = [...state.questionDeltaById.values()].some((delta) => delta !== 0);
      }
      renderScoreboard();
    }

    function confirmScore() {
      if (state.phase !== "revealed") return;
      if (!state.questionScoreChanged && !state.noScoreSelected) return;
      if (typeof stopActiveGameMedia === "function") stopActiveGameMedia();
      state.currentQuestionIndex += 1;
      if (state.currentQuestionIndex >= state.currentRoundQuestions.length) {
        state.phase = "finished";
        settleCurrentRound();
        return;
      }
      resetQuestionFlowState();
      renderGameplay();
    }

Object.assign(window.PartyGame.Core, { renderScoreboard, renderTotalScores, rollbackCurrentQuestionPositiveAwards, clearCurrentQuestionScoringState, adjustScore, selectNoScore, confirmScore });
