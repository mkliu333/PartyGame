window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.WodiInternal = window.PartyGame.Games.WodiInternal || {};

function startWodiDiscussion() {
  if (!state.wodiRound) return;
  state.wodiRound.status = "voting";
  renderWodiGameplay();
  window.PartyGame.Core.BackgroundAudio?.sync();
}

function eliminateWodiPlayer(id) {
  if (!state.wodiRound) return;
  state.wodiRound.pendingEliminationId = id;
  renderWodiGameplay();
}

function cancelWodiElimination() {
  if (!state.wodiRound) return;
  state.wodiRound.pendingEliminationId = null;
  renderWodiGameplay();
}

function confirmWodiElimination() {
  const round = state.wodiRound;
  if (!round?.pendingEliminationId) return;
  const assignment = round.assignments.find((item) => item.participantId === round.pendingEliminationId);
  if (!assignment || assignment.eliminated) return;
  assignment.eliminated = true;
  assignment.eliminatedRound = round.voteRound;
  assignment.revealed = true;
  round.eliminatedHistory.push({ participantId: assignment.participantId, round: round.voteRound, role: assignment.role });
  round.pendingEliminationId = null;
  const winner = checkWodiWinCondition();
  if (winner) {
    round.winner = winner;
    round.status = "finished";
  } else {
    round.voteRound += 1;
  }
  renderWodiGameplay();
}

function checkWodiWinCondition() {
  const alive = state.wodiRound.assignments.filter((item) => !item.eliminated);
  const aliveCivilian = alive.filter((item) => item.role === "civilian").length;
  const aliveUndercover = alive.filter((item) => item.role === "undercover").length;
  const aliveBlank = alive.filter((item) => item.role === "blank").length;
  if (aliveBlank > 0 && alive.length === aliveBlank + 1) return "blank";
  if (aliveUndercover === 0) return "civilian";
  if (aliveUndercover >= aliveCivilian) return "undercover";
  return null;
}

function renderWodiVoteStage() {
  const round = state.wodiRound;
  rememberWodiHostShell();
  $(".gameplay-grid")?.classList.add("wodi-fullscreen");
  const sideStack = $(".gameplay-side-stack");
  if (sideStack) sideStack.hidden = true;
  elements.mediaCard.className = "media-card wodi-mode";
  elements.mediaCard.innerHTML = `
    <div class="wodi-vote-stage">
      <h1>\u7b2c ${round.voteRound} \u8f6e\uff1a\u8bf7\u6295\u7968\u51b3\u5b9a\u672c\u8f6e\u7968\u51fa\u67d0\u4f4d\u73a9\u5bb6</h1>
      <div class="wodi-vote-grid">
        ${round.assignments.map((assignment) => {
          const avatar = getAvatar(assignment.avatarId);
          return `<button class="wodi-player-tile ${assignment.eliminated ? "eliminated" : ""}" type="button" data-wodi-eliminate-id="${escapeHTML(assignment.participantId)}" ${assignment.eliminated ? "disabled" : ""}>
            <span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span>
            <strong>${escapeHTML(assignment.name)}</strong>
            <span>${assignment.eliminated ? `\u7b2c ${assignment.eliminatedRound} \u8f6e\u6dd8\u6c70` : "\u672a\u6dd8\u6c70"}</span>
            ${assignment.revealed ? `<span class="wodi-role-badge">${WODI_ROLE_LABELS[assignment.role]}</span>` : ""}
          </button>`;
        }).join("")}
      </div>
      ${renderWodiEliminationModal()}
    </div>`;
}

function renderWodiEliminationModal() {
  const pending = state.wodiRound.assignments.find((item) => item.participantId === state.wodiRound.pendingEliminationId);
  if (!pending) return "";
  return `
    <div class="wodi-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="wodiEliminateTitle">
      <div class="wodi-modal-card">
        <div class="result-kicker">\u6295\u7968\u6dd8\u6c70</div>
        <h2 id="wodiEliminateTitle">\u786e\u8ba4\u6dd8\u6c70</h2>
        <p>\u786e\u8ba4\u6dd8\u6c70 ${escapeHTML(pending.name)} \u5417\uff1f</p>
        <div class="modal-actions">
          <button class="ghost-btn" type="button" data-wodi-cancel-elimination>\u53d6\u6d88</button>
          <button class="primary-btn" type="button" data-wodi-confirm-elimination>\u786e\u8ba4\u6dd8\u6c70</button>
        </div>
      </div>
    </div>`;
}

Object.assign(window.PartyGame.Games.WodiInternal, {
  startDiscussion: startWodiDiscussion,
  startWodiDiscussion,
  eliminatePlayer: eliminateWodiPlayer,
  eliminateWodiPlayer,
  cancelElimination: cancelWodiElimination,
  cancelWodiElimination,
  confirmElimination: confirmWodiElimination,
  confirmWodiElimination,
  checkWinCondition: checkWodiWinCondition,
  checkWodiWinCondition,
  renderVoteStage: renderWodiVoteStage,
  renderWodiVoteStage,
  renderWodiEliminationModal
});
