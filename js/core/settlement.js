window.PartyGame = window.PartyGame || {};
window.PartyGame.Core = window.PartyGame.Core || {};

    function getRoundWinners() {
      const participants = getActiveParticipants();
      if (!participants.length) return [];
      const highScore = Math.max(...participants.map((participant) => participant.score));
      return participants.filter((participant) => participant.score === highScore);
    }

    function renderScoreRows(participants, scoreKey = "score") {
      if (!participants.length) return `<div class="score-row">暂无可结算玩家/队伍</div>`;
      const highScore = Math.max(...participants.map((participant) => participant[scoreKey] || 0));
      const denominator = Math.max(1, highScore);
      return [...participants]
        .sort((a, b) => (b[scoreKey] || 0) - (a[scoreKey] || 0) || a.name.localeCompare(b.name))
        .map((participant, index) => {
          const avatar = getAvatar(participant.avatarId);
          const score = participant[scoreKey] || 0;
          const isWinner = score === highScore;
          const safeName = escapeHTML(participant.name);
          return `
            <div class="score-row rank-row ${isWinner ? "winner" : ""}" style="--rank-width: ${(score / denominator) * 100}%; animation-delay: ${index * 70}ms;">
              <span class="rank-fill"></span>
              <span class="participant-info">
                <span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span>
                <span class="mini-name">${safeName}</span>
                ${isWinner ? `<span class="rank-badge">${scoreKey === "score" ? "🏆 本轮获胜" : "🏅 题库王"}</span>` : ""}
              </span>
              <span class="score-value">${score}</span>
            </div>
          `;
        }).join("");
    }

    function settleCurrentRound() {
      const participants = getActiveParticipants();
      const winners = getRoundWinners();
      if (!participants.length || !winners.length) {
        showRoundError("当前没有可结算的玩家/队伍，请返回分组确认名单");
        switchScreen("round");
        return;
      }
      winners.forEach((winner) => { winner.totalScore = (winner.totalScore || 0) + 1; });
      state.currentRoundResult = {
        winners: winners.map((winner) => winner.name),
        scores: participants.map((participant) => ({
          ...participant,
          score: participant.score,
          totalScore: participant.totalScore || 0
        }))
      };
      state.completedRoundCount += 1;
      completeActiveRoundSnapshot();
      showRoundResultOverlay();
    }

    function showRoundResultOverlay() {
      const result = state.currentRoundResult;
      const names = result.winners.join("、");
      const isTie = result.winners.length > 1;
      elements.roundResultKicker.textContent = isTie ? "本轮平局" : "本轮获胜";
      elements.roundResultTitle.textContent = isTie ? `${names} 并列获胜！` : `恭喜 ${names} 赢下这一轮！`;
      elements.roundResultCopy.textContent = isTie
        ? `恭喜 ${names} 本轮并列获胜，每位获胜者总分 +1。`
        : `恭喜 ${names} 拿下本轮胜利，总分 +1。`;
      elements.roundResultScores.innerHTML = `<h3 class="ranking-title">本轮排行榜</h3>${renderScoreRows(result.scores, "score")}`;
      elements.roundResultOverlay.classList.add("show");
      updateTopbarActions();
      window.PartyGame.Core.BackgroundAudio?.playVictoryRound();
    }

    function closeRoundResultAndReturnSetup() {
      if (typeof stopActiveGameMedia === "function") stopActiveGameMedia();
      elements.roundResultOverlay.classList.remove("show");
      resetParticipantRoundScores();
      state.currentRoundQuestions = [];
      state.currentQuestionIndex = 0;
      resetQuestionFlowState();
      renderTotalScores();
      switchScreen("round");
      window.PartyGame.Core.BackgroundAudio?.sync();
    }

    function getFinalWinners() {
      const participants = getActiveParticipants();
      if (!participants.length) return [];
      const highScore = Math.max(...participants.map((participant) => participant.totalScore || 0));
      return participants.filter((participant) => (participant.totalScore || 0) === highScore);
    }

    function getFinalAwardTitle() {
      if (isEmojiGuessActive()) return "最佳 Emoji猜猜猜王";
      return isMusicGameActive() ? "最佳猜歌王" : "最佳影视题库王";
    }

    function showFinalSettlementOverlay() {
      const participants = getActiveParticipants();
      const awardTitle = getFinalAwardTitle();
      if (!participants.length) {
        elements.finalResultKicker.textContent = "HONOR CERTIFICATE";
        elements.finalResultTitle.textContent = awardTitle;
        elements.finalWinnerNames.textContent = "暂无可结算玩家/队伍";
        elements.finalResultCopy.textContent = "本次游戏还没有可结算的玩家或队伍。";
        elements.certificateEncouragement.textContent = "特发此证，以资鼓励";
        elements.finalRanking.innerHTML = renderScoreRows([], "totalScore");
        elements.finalResultOverlay.classList.add("show");
        updateTopbarActions();
        window.PartyGame.Core.BackgroundAudio?.playVictoryFinal();
        return;
      }
      const winners = getFinalWinners();
      const names = winners.map((winner) => winner.name).join("、");
      const highScore = Math.max(...participants.map((participant) => participant.totalScore || 0));
      const isTie = winners.length > 1;
      const noun = getParticipantNoun();
      elements.finalResultKicker.textContent = "HONOR CERTIFICATE";
      elements.finalResultTitle.textContent = awardTitle;
      elements.finalWinnerNames.textContent = names;
      elements.finalResultCopy.textContent = highScore === 0
        ? `本次游戏尚未产生明确胜负，大家共同获得${awardTitle}体验奖。`
        : isTie
          ? `恭喜 ${names} 共同荣获${awardTitle}。`
          : `恭喜 ${names} 荣获${awardTitle}，成为今晚发挥最稳的${noun}。`;
      elements.certificateEncouragement.textContent = "特发此证，以资鼓励";
      elements.finalRanking.innerHTML = `<h3 class="ranking-title">最终排行榜</h3>${renderScoreRows(participants, "totalScore")}`;
      elements.finalResultOverlay.classList.add("show");
      updateTopbarActions();
      window.PartyGame.Core.BackgroundAudio?.playVictoryFinal();
    }

    function resetFullGameSession() {
      elements.finalResultOverlay.classList.remove("show");
      elements.roundResultOverlay.classList.remove("show");
      state.screen = "home";
      state.selectedAvatarId = AVATAR_LIBRARY[0].id;
      state.selectedCategory = "all";
      state.currentQuestionIndex = 0;
      state.hasStartedAnyRound = false;
      state.completedRoundCount = 0;
      discardActiveRoundSnapshot();
      state.currentRoundResult = null;
      state.currentRoundQuestions = [];
      [...state.players, ...state.teams].forEach((participant) => {
        participant.score = 0;
        participant.totalScore = 0;
      });
      resetQuestionFlowState();
      updateCategoryStatsDisplay();
      renderTotalScores();
      switchScreen("home");
      window.PartyGame.Core.BackgroundAudio?.sync();
    }

Object.assign(window.PartyGame.Core, { getRoundWinners, renderScoreRows, settleCurrentRound, showRoundResultOverlay, closeRoundResultAndReturnSetup, getFinalWinners, getFinalAwardTitle, showFinalSettlementOverlay, resetFullGameSession });
