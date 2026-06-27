window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};

const tripleMusicRuntime = {
  mixedAudios: [],
  previewAudio: null
};

function normalizeTripleMusicTrack(track) {
  const safe = track || {};
  return {
    id: normalizeCodeField(safe.id),
    category: normalizeField(safe.category),
    answer: normalizeField(safe.answer),
    music: normalizeField(safe.music)
  };
}

function isBrowserRelativeMusicPath(path) {
  return path
    && path.startsWith("assets/triple_music/")
    && !path.startsWith("./")
    && !path.startsWith("/")
    && !/^[a-zA-Z]:[\\/]/.test(path);
}

function getTripleMusicSegmentType(id) {
  const normalized = String(id || "").trim().toLowerCase();
  if (/^tt\d+$/.test(normalized)) return "instrumental";
  if (/^t\d+$/.test(normalized)) return "vocal";
  return "invalid";
}

function getTripleMusicSegmentTypeLabel(segmentType) {
  return segmentType === "instrumental" ? "间奏版" : "唱歌版";
}

function getTripleMusicIdNumber(id) {
  const match = String(id || "").trim().toLowerCase().match(/^tt?(\d+)$/);
  return match ? match[1] : "";
}

function validateTripleMusicTrack(track) {
  const errors = [];
  if (!track.id) errors.push("缺少 id");
  if (track.id && getTripleMusicSegmentType(track.id) === "invalid") errors.push("ID 必须使用 t### 或 tt### 格式");
  if (!track.category) errors.push("缺少 category");
  if (!track.answer) errors.push("缺少 answer");
  if (!isBrowserRelativeMusicPath(track.music)) errors.push("Music 路径必须是 assets/triple_music/ 开头的浏览器相对路径");
  if (track.music && !track.music.toLowerCase().endsWith(".mp3")) errors.push("Music 文件必须使用 .mp3 格式");
  return { valid: errors.length === 0, errors };
}

function loadTripleMusicTrackBank() {
  const rawTracks = Array.isArray(window.PARTY_TRIPLE_MUSIC_TRACKS) ? window.PARTY_TRIPLE_MUSIC_TRACKS : [];
  const seenIds = new Set();
  const seenIdNumbers = new Map();
  const validTracks = [];
  const issues = [];

  rawTracks.forEach((rawTrack) => {
    const track = normalizeTripleMusicTrack(rawTrack);
    if (track.id && seenIds.has(track.id)) {
      issues.push(`${track.id}: 重复 ID，已跳过`);
      return;
    }
    const result = validateTripleMusicTrack(track);
    if (!result.valid) {
      result.errors.forEach((error) => issues.push(`${track.id || "未知音频"}: ${error}`));
      return;
    }
    const idNumber = getTripleMusicIdNumber(track.id);
    if (seenIdNumbers.has(idNumber)) {
      issues.push(`重复数字编号：${idNumber}，不能同时存在 ${seenIdNumbers.get(idNumber)} 和 ${track.id}`);
      return;
    }
    validTracks.push(track);
    seenIds.add(track.id);
    seenIdNumbers.set(idNumber, track.id);
  });

  state.tripleMusicTracks = validTracks;
  state.tripleMusicPreflight = {
    loaded: validTracks.length,
    skipped: rawTracks.length - validTracks.length,
    issues
  };

  if (!Array.isArray(window.PARTY_TRIPLE_MUSIC_TRACKS)) {
    console.warn("window.PARTY_TRIPLE_MUSIC_TRACKS not found. Using empty triple_music track bank.");
  }
  if (issues.length) console.warn("Triple music skipped invalid tracks:", issues);
}

function getTripleMusicCategories() {
  const categoryIds = new Set();
  state.tripleMusicTracks.forEach((track) => {
    if (track.category) categoryIds.add(track.category);
  });
  return [...categoryIds].map((id) => ({ id, label: id }));
}

function getTripleMusicRoundConfig() {
  return {
    title: "设置三歌混播猜歌",
    subtitle: "选择本轮题量和歌手范围。每题会动态组合最多 3 段音频，同一段音频重置前不会重复。",
    stockTitle: "音频库存",
    sizes: [5, 7, 11],
    categories: [{ id: "all", label: "大合集" }, ...getTripleMusicCategories()]
  };
}

function getTripleMusicCategoryLabel(category) {
  if (category === "all") return "大合集";
  return getTripleMusicCategories().find((item) => item.id === category)?.label || category || "歌手";
}

function getAvailableTripleMusicTracks(category = "all", excludeIds = new Set(), segmentType = "all") {
  return state.tripleMusicTracks.filter((track) => (
    (category === "all" || track.category === category)
    && (segmentType === "all" || getTripleMusicSegmentType(track.id) === segmentType)
    && !state.consumedMusicTrackIds.has(track.id)
    && !state.skippedMusicTrackIds.has(track.id)
    && !excludeIds.has(track.id)
  ));
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
    const estimated = Math.ceil(vocalRemaining / 3) + Math.ceil(instrumentalRemaining / 3);
    return `
      <div class="stats-row">
        <span>${escapeHTML(category.label)}</span>
        <span>唱歌 ${vocalRemaining} 段 / 间奏 ${instrumentalRemaining} 段，预计可出 ${estimated} 题</span>
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

function buildTripleMusicQuestion(index, tracks) {
  const firstCategory = tracks[0]?.category || state.selectedCategory;
  const allSameCategory = tracks.every((track) => track.category === firstCategory);
  const segmentType = getTripleMusicSegmentType(tracks[0]?.id);
  return {
    id: `triple_music_${Date.now()}_${index}`,
    type: "triple_music",
    category: allSameCategory ? firstCategory : "all",
    segmentType,
    source: "三歌混播",
    tracks
  };
}

function drawTripleMusicQuestion(selectedCategory, localUsedIds) {
  const candidatePools = [];
  const categories = selectedCategory === "all"
    ? getTripleMusicCategories().map((category) => category.id)
    : [selectedCategory];

  categories.forEach((category) => {
    ["vocal", "instrumental"].forEach((segmentType) => {
      const pool = getAvailableTripleMusicTracks(category, localUsedIds, segmentType);
      if (uniqueAnswerEligibleTracks(pool).length) {
        candidatePools.push({ category, segmentType, pool });
      }
    });
  });

  const selectedPool = shuffleArray(candidatePools)[0];
  if (!selectedPool) return [];
  return drawUniqueAnswerTracks(selectedPool.pool, 3, localUsedIds, new Set());
}

function generateTripleMusicRoundQuestions() {
  const requestedCount = Number(state.roundSize) || 5;
  const localUsedIds = new Set();
  const questions = [];

  for (let index = 0; index < requestedCount; index += 1) {
    const tracks = drawTripleMusicQuestion(state.selectedCategory, localUsedIds);
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

function stopAudio(audio) {
  if (!audio) return;
  audio.pause();
  try { audio.currentTime = 0; } catch (error) { console.warn("Unable to reset audio:", error); }
}

function stopAllTripleMusicAudio() {
  tripleMusicRuntime.mixedAudios.forEach(stopAudio);
  tripleMusicRuntime.mixedAudios = [];
  stopAudio(tripleMusicRuntime.previewAudio);
  tripleMusicRuntime.previewAudio = null;
}

function handleTripleMusicAudioError(track) {
  console.warn("Triple music audio unreadable:", track);
  state.skippedMusicTrackIds.add(track.id);
  showToast("当前音频无法读取，已跳过或请检查素材路径");
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
  const trackCount = question.tracks.length;
  const trackWord = trackCount === 1 ? "播放" : "混播";
  const segmentLabel = getTripleMusicSegmentTypeLabel(question.segmentType);
  elements.questionTitle.textContent = `第 ${state.currentQuestionIndex + 1} / ${state.currentRoundQuestions.length} 题`;
  elements.questionMeta.textContent = `${getTripleMusicCategoryLabel(question.category)} · ${segmentLabel} · 本题 ${trackCount} 首歌${trackWord}`;
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

function toggleTripleMusicAnswerText() {}

function resetTripleMusicQuestionPool() {
  state.consumedMusicTrackIds.clear();
  state.skippedMusicTrackIds.clear();
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
  stopAudio,
  handleAudioError: handleTripleMusicAudioError
};
