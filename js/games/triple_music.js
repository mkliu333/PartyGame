window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};

// 三歌混播：负责三音轨题库预检、混播播放、预览和答案渲染。
// 音乐题库通用分类工具由 music_common.js 提供。

const tripleMusicRuntime = {
  mixedAudios: [],
  previewAudio: null
};

function getTripleMusicSegmentType(id) {
  return window.PartyGame.Games.musicCommon.getMusicSegmentType(id);
}

function getTripleMusicSegmentTypeLabel(segmentType) {
  return window.PartyGame.Games.musicCommon.getMusicSegmentTypeLabel(segmentType);
}

function loadTripleMusicTrackBank() {
  return window.PartyGame.Games.musicBank.loadTrackBank();
}

function getTripleMusicCategories() {
  return window.PartyGame.Games.musicBank.getCategories();
}

function getTripleMusicRoundConfig() {
  return {
    title: "设置三歌混播猜歌",
    subtitle: "选择本轮题量和歌手范围。每题会动态组合最多 3 段音频，同一段音频重置前不会重复。",
    stockTitle: "音频库存",
    sizes: [5, 7, 11],
    categories: getTripleMusicCategories()
  };
}

function getTripleMusicCategoryLabel(category) {
  return window.PartyGame.Games.musicBank.getCategoryLabel(category);
}

function getAvailableTripleMusicTracks(category = "all", excludeIds = new Set(), segmentType = "all") {
  return window.PartyGame.Games.musicBank.getAvailableTracks(category, excludeIds, segmentType);
}

function uniqueAnswerEligibleTracks(tracks) {
  const seenAnswers = new Set();
  return tracks.filter((track) => {
    if (seenAnswers.has(track.answer)) return false;
    seenAnswers.add(track.answer);
    return true;
  });
}

function updateTripleMusicCategoryStatsDisplay() {
  renderQuestionBankInspector();
  const categories = getTripleMusicCategories();
  elements.categoryStats.innerHTML = categories.map((category) => {
    const vocalRemaining = getAvailableTripleMusicTracks(category.id, new Set(), "vocal").length;
    const instrumentalRemaining = getAvailableTripleMusicTracks(category.id, new Set(), "instrumental").length;
    return `
      <div class="stats-row">
        <span>${escapeHTML(category.label)}</span>
        <span>唱歌 ${vocalRemaining} 段 / 间奏 ${instrumentalRemaining} 段</span>
      </div>
    `;
  }).join("");
}

function drawUniqueAnswerTracks(pool, count, usedIds = new Set(), usedAnswers = new Set()) {
  const selected = [];
  shuffleArray(pool).forEach((track) => {
    if (selected.length >= count) return;
    if (usedIds.has(track.id) || usedAnswers.has(track.answer)) return;
    usedIds.add(track.id);
    usedAnswers.add(track.answer);
    selected.push(track);
  });
  return selected;
}

function getTripleMusicRealArtist(track) {
  return window.PartyGame.Games.musicCommon.getMusicTrackArtistLabel(track) || "未知歌手";
}

function getTripleMusicUnknownArtistLabel() {
  return window.PartyGame.Games.musicCommon.getMusicTrackArtistLabel({});
}

function groupTracksByArtist(tracks) {
  const groups = new Map();
  const unknownArtist = getTripleMusicUnknownArtistLabel();
  tracks.forEach((track) => {
    const artist = getTripleMusicRealArtist(track);
    if (!artist || artist === unknownArtist) return;
    if (!groups.has(artist)) groups.set(artist, []);
    groups.get(artist).push(track);
  });
  return groups;
}

function drawBestEffortSameSegmentTracks(displayCategory, localUsedIds) {
  const segmentTypes = shuffleArray(["vocal", "instrumental"]);
  for (const segmentType of segmentTypes) {
    const pool = getAvailableTripleMusicTracks(displayCategory, localUsedIds, segmentType);
    const selected = drawUniqueAnswerTracks(pool, 3, localUsedIds, new Set());
    if (selected.length) return selected;
  }
  return [];
}

function drawStandaloneTripleMusicQuestion(displayCategory, localUsedIds) {
  return drawBestEffortSameSegmentTracks(displayCategory, localUsedIds);
}

function drawGroupedTripleMusicQuestion(displayCategory, localUsedIds) {
  const comboCandidates = [];
  shuffleArray(["vocal", "instrumental"]).forEach((segmentType) => {
    const pool = getAvailableTripleMusicTracks(displayCategory, localUsedIds, segmentType);
    groupTracksByArtist(pool).forEach((artistTracks, artist) => {
      if (uniqueAnswerEligibleTracks(artistTracks).length >= 3) {
        comboCandidates.push({ artist, segmentType, pool: artistTracks });
      }
    });
  });

  const selectedCombo = shuffleArray(comboCandidates)[0];
  if (selectedCombo) {
    return drawUniqueAnswerTracks(selectedCombo.pool, 3, localUsedIds, new Set());
  }

  return drawBestEffortSameSegmentTracks(displayCategory, localUsedIds);
}

function drawMixedArtistTripleMusicQuestion(displayCategory, localUsedIds, options = {}) {
  const allowFallback = options.allowFallback !== false;
  const segmentTypes = shuffleArray(["vocal", "instrumental"]);

  for (const segmentType of segmentTypes) {
    const pool = getAvailableTripleMusicTracks(displayCategory, localUsedIds, segmentType);
    const artistGroups = shuffleArray([...groupTracksByArtist(pool).entries()])
      .filter(([, artistTracks]) => uniqueAnswerEligibleTracks(artistTracks).length >= 1);
    const selected = [];
    const trialUsedIds = new Set(localUsedIds);
    const usedAnswers = new Set();
    const usedArtists = new Set();

    artistGroups.forEach(([artist, artistTracks]) => {
      if (selected.length >= 3) return;
      if (usedArtists.has(artist)) return;
      const candidate = shuffleArray(artistTracks).find((track) => (
        !trialUsedIds.has(track.id)
        && !usedAnswers.has(track.answer)
      ));
      if (!candidate) return;
      selected.push(candidate);
      usedArtists.add(artist);
      usedAnswers.add(candidate.answer);
      trialUsedIds.add(candidate.id);
    });

    if (selected.length >= 3) {
      selected.forEach((track) => localUsedIds.add(track.id));
      return selected;
    }
  }

  return allowFallback ? drawBestEffortSameSegmentTracks(displayCategory, localUsedIds) : [];
}

function getMixedArtistQuestionQuota(requestedCount) {
  return Math.floor(requestedCount / 5);
}

function buildMixedArtistQuestionIndexes(requestedCount) {
  const quota = getMixedArtistQuestionQuota(requestedCount);
  const indexes = new Set();
  if (quota <= 0) return indexes;

  for (let index = 5; index <= requestedCount && indexes.size < quota; index += 5) {
    indexes.add(index - 1);
  }

  return indexes;
}

function getTripleMusicArtistMixInfo(tracks) {
  const artists = [...new Set((Array.isArray(tracks) ? tracks : [])
    .map(getTripleMusicRealArtist)
    .filter(Boolean))];
  return {
    artistMixType: artists.length <= 1 ? "same_artist" : "mixed_artist",
    artistLabel: artists.join(" / ")
  };
}

function buildTripleMusicQuestion(index, tracks) {
  const segmentType = getTripleMusicSegmentType(tracks[0]?.id);
  return {
    id: window.PartyGame.Games.musicCommon.createMusicQuestionId("triple_music", index),
    type: "triple_music",
    category: state.selectedCategory,
    segmentType,
    source: "三歌混播",
    tracks,
    ...getTripleMusicArtistMixInfo(tracks)
  };
}

function drawTripleMusicQuestion(selectedCategory, localUsedIds, options = {}) {
  const common = window.PartyGame.Games.musicCommon;
  const isBroadCategory = selectedCategory === common.MUSIC_ALL_CATEGORY_ID
    || selectedCategory === common.MUSIC_MISC_CATEGORY_ID;

  if (!isBroadCategory) {
    return drawStandaloneTripleMusicQuestion(selectedCategory, localUsedIds);
  }

  if (options.forceMixedArtist) {
    const mixedTracks = drawMixedArtistTripleMusicQuestion(selectedCategory, localUsedIds, { allowFallback: false });
    if (mixedTracks.length) return mixedTracks;
  }

  return drawGroupedTripleMusicQuestion(selectedCategory, localUsedIds);
}

function generateTripleMusicRoundQuestions() {
  const requestedCount = Number(state.roundSize) || 5;
  const mixedArtistIndexes = buildMixedArtistQuestionIndexes(requestedCount);
  const localUsedIds = new Set();
  const questions = [];

  for (let index = 0; index < requestedCount; index += 1) {
    const tracks = drawTripleMusicQuestion(state.selectedCategory, localUsedIds, {
      forceMixedArtist: mixedArtistIndexes.has(index)
    });
    if (!tracks.length) break;
    questions.push(buildTripleMusicQuestion(index + 1, tracks));
  }

  state.currentRoundQuestions = questions;
  state.currentQuestionIndex = 0;
  resetQuestionFlowState();

  if (!questions.length) {
    showRoundError("当前分类没有可用音频啦，请重置音频库后再试");
    return false;
  }

  questions.forEach((question) => {
    question.tracks.forEach((track) => state.consumedMusicTrackIds.add(track.id));
  });

  if (questions.length < requestedCount) {
    showRoundInfo(`当前分类音频不足，已生成 ${questions.length} 题`);
  }

  updateTripleMusicCategoryStatsDisplay();
  state.hasStartedAnyRound = true;
  return true;
}

function ensureTripleMusicPanel() {
  let panel = $(".triple-music-panel", elements.mediaCard);
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "triple-music-panel";
    elements.mediaCard.insertBefore(panel, $(".media-footer", elements.mediaCard));
  }
  return panel;
}

function removeTripleMusicPanel() {
  const panel = $(".triple-music-panel", elements.mediaCard);
  if (panel) panel.remove();
}

function stopAllTripleMusicAudio() {
  tripleMusicRuntime.mixedAudios = window.PartyGame.Games.musicCommon.stopAudioList(tripleMusicRuntime.mixedAudios);
  window.PartyGame.Games.musicCommon.safeStopAudio(tripleMusicRuntime.previewAudio);
  tripleMusicRuntime.previewAudio = null;
}

function handleTripleMusicAudioError(track) {
  window.PartyGame.Games.musicBank.handleAudioError(track);
}

function playMixedAudio() {
  const question = getCurrentQuestion();
  if (!isTripleMusicActive() || !question || !["prompt", "revealed"].includes(state.phase)) return;
  stopAllTripleMusicAudio();
  tripleMusicRuntime.mixedAudios = question.tracks.map((track) => {
    const audio = new Audio(track.music);
    audio.volume = 0.8;
    audio.addEventListener("error", () => handleTripleMusicAudioError(track), { once: true });
    audio.play().catch(() => handleTripleMusicAudioError(track));
    return audio;
  });
}

function playSinglePreview(trackId) {
  const question = getCurrentQuestion();
  if (!question || state.phase !== "revealed") return;
  const track = question.tracks.find((item) => item.id === trackId);
  if (!track) return;
  stopAllTripleMusicAudio();
  const audio = new Audio(track.music);
  audio.volume = 0.8;
  audio.controls = true;
  audio.addEventListener("error", () => handleTripleMusicAudioError(track), { once: true });
  tripleMusicRuntime.previewAudio = audio;
  audio.play().catch(() => handleTripleMusicAudioError(track));
}

function renderTripleMusicMedia(question) {
  elements.mediaCard.classList.remove("empty", "image-mode", "emoji-mode");
  $(".emoji-clue-panel", elements.mediaCard)?.remove();
  elements.mediaCard.classList.add("audio-mode");
  elements.clip.pause();
  elements.clip.removeAttribute("src");
  elements.questionImage.removeAttribute("src");
  const panel = ensureTripleMusicPanel();
  const trackCount = question.tracks.length;
  const trackWord = trackCount === 1 ? "播放" : "混播";
  const segmentLabel = getTripleMusicSegmentTypeLabel(question.segmentType);
  panel.innerHTML = `
    <div class="audio-panel-inner">
      <div class="audio-icon">♪</div>
      <h2>本题 ${trackCount} 首歌${trackWord}</h2>
      <p>${escapeHTML(getTripleMusicCategoryLabel(question.category))} · ${segmentLabel}</p>
      <button class="primary-btn" type="button" id="mixedAudioPanelButton">播放混播</button>
    </div>
  `;
  $("#mixedAudioPanelButton")?.addEventListener("click", playMixedAudio);
}

function renderTripleMusicAnswerPanel() {
  const question = getCurrentQuestion();
  if (!question) return;
  elements.answerState.textContent = state.phase === "revealed" ? "答案已揭晓" : "答案未揭晓";
  if (state.phase !== "revealed") {
    elements.answerText.classList.remove("triple-music-answer-list");
    elements.answerText.textContent = "点击播放混播，大家抢答后再揭晓答案。";
    elements.toggleAnswerText.classList.remove("show");
    return;
  }
  elements.answerText.classList.add("triple-music-answer-list");
  elements.answerText.innerHTML = question.tracks.map((track, index) => `
    <span class="answer-line">
      ${index + 1}. ${escapeHTML(track.answer)}
      <button class="ghost-btn mini-audio-btn" type="button" data-triple-preview-id="${escapeHTML(track.id)}">单独播放</button>
    </span>
  `).join("");
  elements.toggleAnswerText.classList.remove("show");
}

function renderTripleMusicQuestionFooter(question) {
  const segmentLabel = getTripleMusicSegmentTypeLabel(question.segmentType);
  const artistLabel = window.PartyGame.Games.musicCommon.getInvolvedArtistLabel(question.tracks);
  elements.questionTitle.textContent = `第 ${state.currentQuestionIndex + 1} / ${state.currentRoundQuestions.length} 题`;
  elements.questionMeta.textContent = `${artistLabel} · 三歌混播 · ${segmentLabel}`;
}

function renderTripleMusicStageControls() {
  const isPrompt = state.phase === "prompt";
  const isRevealed = state.phase === "revealed";
  elements.playPrompt.textContent = "播放混播";
  elements.revealAnswer.textContent = "揭晓答案";
  elements.playPrompt.disabled = false;
  elements.revealAnswer.disabled = !isPrompt;
  elements.playPrompt.className = isPrompt ? "primary-btn stage-current" : "ghost-btn";
  elements.revealAnswer.className = isRevealed ? "primary-btn stage-current" : "ghost-btn";
}

function renderTripleMusicGameplay() {
  const question = getCurrentQuestion();
  if (!question) {
    removeTripleMusicPanel();
    setEmptyGameplayState();
    return;
  }
  renderTripleMusicMedia(question);
  renderTripleMusicQuestionFooter(question);
  renderTripleMusicAnswerPanel();
  renderTripleMusicStageControls();
  renderScoreboard();
}

function revealTripleMusicAnswer() {
  const question = getCurrentQuestion();
  if (!question || state.phase !== "prompt") return;
  stopAllTripleMusicAudio();
  state.phase = "revealed";
  renderTripleMusicGameplay();
}

// This game does not use text-answer toggling, but keeps the method to satisfy the shared game interface.
function toggleTripleMusicAnswerText() {}

function debugCurrentRoundArtistMix() {
  return (state.currentRoundQuestions || []).map((question, index) => ({
    index: index + 1,
    segmentType: question.segmentType,
    artistMixType: question.artistMixType,
    artistLabel: question.artistLabel,
    answers: question.tracks.map((track) => track.answer),
    artists: question.tracks.map(getTripleMusicRealArtist),
    ids: question.tracks.map((track) => track.id)
  }));
}

function resetTripleMusicQuestionPool() {
  window.PartyGame.Games.musicBank.resetSharedPool();
  updateTripleMusicCategoryStatsDisplay();
  showToast("音频库已重置，所有音频段可以重新抽取啦");
}

window.PartyGame.Games.tripleMusic = {
  id: "triple_music",
  getSegmentType: getTripleMusicSegmentType,
  loadTrackBank: loadTripleMusicTrackBank,
  getRoundConfig: getTripleMusicRoundConfig,
  getCategoryLabel: getTripleMusicCategoryLabel,
  updateCategoryStatsDisplay: updateTripleMusicCategoryStatsDisplay,
  generateRoundQuestions: generateTripleMusicRoundQuestions,
  resetQuestionPool: resetTripleMusicQuestionPool,
  renderGameplay: renderTripleMusicGameplay,
  revealAnswer: revealTripleMusicAnswer,
  toggleAnswerText: toggleTripleMusicAnswerText,
  playMixedAudio,
  playSinglePreview,
  stopAllAudio: stopAllTripleMusicAudio,
  getCategories: getTripleMusicCategories,
  getAvailableTracks: getAvailableTripleMusicTracks,
  getSharedRuntime: () => tripleMusicRuntime,
  stopAudio: window.PartyGame.Games.musicCommon.safeStopAudio,
  handleAudioError: handleTripleMusicAudioError,
  debugCurrentRoundArtistMix
};
