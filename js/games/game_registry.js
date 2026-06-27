window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};

window.PartyGame.Games.registry = [
  {
    id: "line_guess",
    title: "猜台词",
    subtitle: "看影视片段或者图片，抢答下一句台词。",
    status: "available",
    dataSourceLabel: "script_guess/questions_v3.js"
  },
  {
    id: "triple_music",
    title: "三歌混播猜歌",
    subtitle: "三首歌同时播放，抢答分别是哪三首歌。",
    status: "available",
    dataSourceLabel: "triple_music/triple_music_questions_v3.js"
  },
  {
    id: "single_music",
    title: "单曲猜歌",
    subtitle: "每题播放一段音频，抢答对应歌名。",
    status: "available",
    dataSourceLabel: "triple_music/triple_music_questions_v3.js"
  },
  {
    id: "celebrity_image",
    title: "看图猜名人",
    subtitle: "看图片，抢答人物名。",
    status: "coming_soon"
  },
  {
    id: "emoji_guess",
    title: "Emoji猜猜猜",
    subtitle: "根据 emoji 谐音线索，抢答名人、歌名或成语。",
    status: "available",
    dataSourceLabel: "emoji_guess/emoji_guess_questions_v2.js"
  }
];

function getGameById(id) {
  return window.PartyGame.Games.registry.find((game) => game.id === id);
}

function getActiveGame() {
  return getGameById(state.activeGameId) || getGameById("line_guess");
}

function isTripleMusicActive() {
  return state.activeGameId === "triple_music";
}

function isSingleMusicActive() {
  return state.activeGameId === "single_music";
}

function isMusicGameActive() {
  return isTripleMusicActive() || isSingleMusicActive();
}

function isEmojiGuessActive() {
  return state.activeGameId === "emoji_guess";
}

function getActiveMusicGame() {
  if (isSingleMusicActive()) return window.PartyGame.Games.singleMusic;
  if (isTripleMusicActive()) return window.PartyGame.Games.tripleMusic;
  return null;
}

function selectGame(gameId) {
  const game = getGameById(gameId);
  if (!game || game.status !== "available") return false;
  if (typeof stopActiveGameMedia === "function") stopActiveGameMedia();
  state.activeGameId = game.id;
  state.currentRoundQuestions = [];
  state.currentQuestionIndex = 0;
  state.selectedCategory = "all";
  state.roundSize = isMusicGameActive() ? 5 : 20;
  state.hasStartedAnyRound = false;
  state.completedRoundCount = 0;
  state.activeRoundScoreSnapshot = null;
  state.activeRoundInventorySnapshot = null;
  state.currentRoundResult = null;
  [...state.players, ...state.teams].forEach((participant) => {
    participant.score = 0;
    participant.totalScore = 0;
  });
  resetQuestionFlowState();
  return true;
}

function renderHomepageGameCards() {
  if (!elements.gamesGrid) return;
  elements.gamesGrid.innerHTML = window.PartyGame.Games.registry.map((game) => {
    const available = game.status === "available";
    const classes = available ? "game-card main" : "game-card placeholder";
    const nav = available ? ' data-nav="mode"' : " disabled";
    const tag = available ? "立即开玩" : "敬请期待";
    return `
      <button class="${classes}" type="button" data-game-id="${escapeHTML(game.id)}"${nav}>
        ${available ? '<div class="decor star" style="right: 20px; top: 18px; --rot: 10deg;"></div>' : ""}
        <h2>${escapeHTML(game.title)}</h2>
        <p>${escapeHTML(game.subtitle)}</p>
        <span class="tag">${tag}</span>
      </button>
    `;
  }).join("");
}

Object.assign(window.PartyGame.Games, { getGameById, getActiveGame, isTripleMusicActive, isSingleMusicActive, isMusicGameActive, isEmojiGuessActive, getActiveMusicGame, selectGame, renderHomepageGameCards });

