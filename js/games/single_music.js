window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};

// 单曲猜歌：复用音乐题库库存，负责单曲正放/倒放播放和答案阶段控制。
// 与三歌混播共享底层音乐工具，但保留独立的播放运行态。

const singleMusicRuntime = {
  audioContext: null,
  activeSource: null,
  activeForwardAudio: null,
  reverseBufferCache: new Map()
};

function getSingleMusicBank() {
  return window.PartyGame.Games.musicBank;
}

function getSingleMusicAudioContext() {
  if (!singleMusicRuntime.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio API is not available.");
    singleMusicRuntime.audioContext = new AudioContextClass();
  }
  return singleMusicRuntime.audioContext;
}

function stopSingleMusicAudio() {
  if (singleMusicRuntime.activeForwardAudio) {
    window.PartyGame.Games.musicCommon.safeStopAudio(singleMusicRuntime.activeForwardAudio);
    singleMusicRuntime.activeForwardAudio = null;
  }
  if (singleMusicRuntime.activeSource) {
    try {
      singleMusicRuntime.activeSource.stop();
    } catch (error) {}
    try {
      singleMusicRuntime.activeSource.disconnect();
    } catch (error) {}
    singleMusicRuntime.activeSource = null;
  }
}

function getSingleMusicPlaybackModeLabel() {
  return state.singleMusicPlaybackMode === "reverse" ? "倒放" : "正放";
}

function isSingleMusicReverseMode() {
  return state.singleMusicPlaybackMode === "reverse";
}

function getSingleMusicPrimaryPlaybackLabel() {
  return isSingleMusicReverseMode() ? "播放倒放音频" : "播放音频";
}

function getSingleMusicAlternatePlaybackLabel() {
  return isSingleMusicReverseMode() ? "正放音乐" : "倒放音频";
}

function getSingleMusicRoundConfig() {
  const musicBank = getSingleMusicBank();
  return {
    title: "设置单曲猜歌",
    subtitle: "选择本轮题量和歌手范围。每题播放 1 段音频，同一段音频重置前不会重复。",
    stockTitle: "音频库存",
    sizes: [5, 10, 20],
    categories: musicBank.getCategories()
  };
}

function renderSingleMusicExtraRoundOptions(container) {
  if (!container) {
    console.warn("[single_music] Cannot render playback mode controls: container missing.");
    return;
  }
  container.innerHTML = `
    <div class="round-extra-card single-music-mode-card">
      <h2>播放方式</h2>
      <div class="round-options compact single-music-playback-options">
        <button class="option-btn ${state.singleMusicPlaybackMode === "forward" ? "selected" : ""}" type="button" data-single-music-playback="forward">正放</button>
        <button class="option-btn ${state.singleMusicPlaybackMode === "reverse" ? "selected" : ""}" type="button" data-single-music-playback="reverse">倒放</button>
      </div>
      <p class="round-extra-note">倒放模式会将每段音频反向播放，其余抢答和计分规则不变。</p>
    </div>
  `;
}

function setSingleMusicPlaybackMode(mode) {
  state.singleMusicPlaybackMode = mode === "reverse" ? "reverse" : "forward";
  renderRoundOptions();
}

function getSingleMusicCategoryLabel(category) {
  return getSingleMusicBank().getCategoryLabel(category);
}

function updateSingleMusicCategoryStatsDisplay() {
  renderQuestionBankInspector();
  const musicBank = getSingleMusicBank();
  elements.categoryStats.innerHTML = musicBank.getCategories().map((category) => {
    const remaining = musicBank.getAvailableTracks(category.id).length;
    return `<div class="stats-row"><span>${escapeHTML(category.label)}</span><span>剩余 ${remaining} 段，可出 ${remaining} 题</span></div>`;
  }).join("");
}

function generateSingleMusicRoundQuestions() {
  const requestedCount = Number(state.roundSize) || 5;
  const pool = shuffleArray(getSingleMusicBank().getAvailableTracks(state.selectedCategory));
  const tracks = pool.slice(0, requestedCount);
  state.currentRoundQuestions = tracks.map((track, index) => ({
    id: window.PartyGame.Games.musicCommon.createMusicQuestionId("single_music", index + 1),
    type: "single_music",
    category: track.category,
    source: "单曲猜歌",
    tracks: [track]
  }));
  state.currentQuestionIndex = 0;
  resetQuestionFlowState();
  if (!tracks.length) {
    showRoundError("当前分类没有可用音频啦，请重置音频库后再试");
    return false;
  }
  tracks.forEach((track) => state.consumedMusicTrackIds.add(track.id));
  if (tracks.length < requestedCount) showRoundInfo(`当前分类音频不足，已生成 ${tracks.length} 题`);
  updateSingleMusicCategoryStatsDisplay();
  state.hasStartedAnyRound = true;
  return true;
}

function ensureSingleMusicPanel() {
  let panel = $(".triple-music-panel", elements.mediaCard);
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "triple-music-panel";
    elements.mediaCard.insertBefore(panel, $(".media-footer", elements.mediaCard));
  }
  return panel;
}

function playSingleMusicForward(track) {
  stopSingleMusicAudio();
  window.PartyGame.Games.tripleMusic?.stopAllAudio?.();
  const audio = new Audio(track.music);
  audio.volume = 0.8;
  audio.addEventListener("error", () => getSingleMusicBank().handleAudioError(track), { once: true });
  singleMusicRuntime.activeForwardAudio = audio;
  audio.play().catch(() => getSingleMusicBank().handleAudioError(track));
}

async function getReversedAudioBuffer(track) {
  const cacheKey = track.music;
  if (singleMusicRuntime.reverseBufferCache.has(cacheKey)) {
    return singleMusicRuntime.reverseBufferCache.get(cacheKey);
  }
  const context = getSingleMusicAudioContext();
  const response = await fetch(track.music);
  if (!response.ok) throw new Error(`Audio fetch failed: ${track.music}`);
  const arrayBuffer = await response.arrayBuffer();
  const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
  const reversed = context.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
  for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
    const sourceData = decoded.getChannelData(channel);
    const targetData = reversed.getChannelData(channel);
    for (let i = 0, j = sourceData.length - 1; i < sourceData.length; i += 1, j -= 1) {
      targetData[i] = sourceData[j];
    }
  }
  singleMusicRuntime.reverseBufferCache.set(cacheKey, reversed);
  return reversed;
}

async function playSingleMusicReverse(track) {
  stopSingleMusicAudio();
  window.PartyGame.Games.tripleMusic?.stopAllAudio?.();
  try {
    const context = getSingleMusicAudioContext();
    if (context.state === "suspended") await context.resume();
    const buffer = await getReversedAudioBuffer(track);
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.8;
    source.buffer = buffer;
    source.connect(gain).connect(context.destination);
    singleMusicRuntime.activeSource = source;
    source.onended = () => {
      if (singleMusicRuntime.activeSource === source) {
        singleMusicRuntime.activeSource = null;
      }
    };
    source.start(0);
  } catch (error) {
    console.warn("Reverse audio playback failed:", track, error);
    showToast("倒放音频暂时无法播放，已尝试正常播放");
    playSingleMusicForward(track);
  }
}

function playSingleMusicClip({ reverse = false } = {}) {
  const question = getCurrentQuestion();
  if (!isSingleMusicActive() || !question || !["prompt", "revealed"].includes(state.phase)) return;
  const track = question.tracks[0];
  if (reverse) {
    playSingleMusicReverse(track);
  } else {
    playSingleMusicForward(track);
  }
}

function playSingleMusicAudio() {
  playSingleMusicClip({ reverse: isSingleMusicReverseMode() });
}

function playSingleMusicAlternateAudio() {
  playSingleMusicClip({ reverse: !isSingleMusicReverseMode() });
}

function playSingleMusicForwardOnly() {
  const question = getCurrentQuestion();
  if (!isSingleMusicActive() || !question || !question.tracks?.length) return;
  playSingleMusicForward(question.tracks[0]);
}

function renderSingleMusicGameplay() {
  const question = getCurrentQuestion();
  if (!question) {
    $(".triple-music-panel", elements.mediaCard)?.remove();
    setEmptyGameplayState();
    return;
  }
  const track = question.tracks[0];
  const modeLabel = getSingleMusicPlaybackModeLabel();
  const playLabel = getSingleMusicPrimaryPlaybackLabel();
  elements.mediaCard.classList.remove("empty", "image-mode", "emoji-mode");
  $(".emoji-clue-panel", elements.mediaCard)?.remove();
  elements.mediaCard.classList.add("audio-mode");
  elements.clip.pause();
  elements.clip.removeAttribute("src");
  elements.questionImage.removeAttribute("src");
  ensureSingleMusicPanel().innerHTML = `
    <div class="audio-panel-inner">
      <div class="audio-icon">♪</div>
      <h2>单曲猜歌</h2>
      <p>${escapeHTML(track.category)}</p>
      <button class="primary-btn" type="button" id="singleAudioPanelButton">${playLabel}</button>
    </div>`;
  $("#singleAudioPanelButton")?.addEventListener("click", playSingleMusicAudio);
  elements.questionTitle.textContent = `第 ${state.currentQuestionIndex + 1} / ${state.currentRoundQuestions.length} 题`;
  elements.questionMeta.textContent = `${track.category} · 单曲猜歌 · ${modeLabel}`;
  elements.answerState.textContent = state.phase === "revealed" ? "答案已揭晓" : "答案未揭晓";
  if (state.phase === "revealed") {
    elements.answerText.classList.add("triple-music-answer-list");
    if (isSingleMusicReverseMode()) {
      elements.answerText.innerHTML = `<span class="answer-line">${escapeHTML(track.answer)}<button class="ghost-btn mini-audio-btn" type="button" data-single-music-forward-after-reveal="current">正放音乐</button></span>`;
    } else {
      elements.answerText.innerHTML = `<span class="answer-line">${escapeHTML(track.answer)}</span>`;
    }
  } else {
    elements.answerText.classList.remove("triple-music-answer-list");
    elements.answerText.textContent = "点击播放音频，大家抢答后再揭晓答案。";
  }
  elements.toggleAnswerText.classList.remove("show");
  elements.playPrompt.textContent = playLabel;
  elements.revealAnswer.textContent = "揭晓答案";
  elements.playPrompt.disabled = false;
  elements.revealAnswer.disabled = state.phase !== "prompt";
  elements.playPrompt.className = state.phase === "prompt" ? "primary-btn stage-current" : "ghost-btn";
  elements.revealAnswer.className = state.phase === "revealed" ? "primary-btn stage-current" : "ghost-btn";
  renderScoreboard();
}

function revealSingleMusicAnswer() {
  if (!getCurrentQuestion() || state.phase !== "prompt") return;
  stopSingleMusicAudio();
  window.PartyGame.Games.tripleMusic?.stopAllAudio?.();
  state.phase = "revealed";
  renderSingleMusicGameplay();
}

function resetSingleMusicQuestionPool() {
  getSingleMusicBank().resetSharedPool();
  updateSingleMusicCategoryStatsDisplay();
  showToast("音频库已重置，两个猜歌游戏可重新抽取所有音频啦");
}

window.PartyGame.Games.singleMusic = {
  id: "single_music",
  getRoundConfig: getSingleMusicRoundConfig,
  renderExtraRoundOptions: renderSingleMusicExtraRoundOptions,
  setPlaybackMode: setSingleMusicPlaybackMode,
  getPlaybackMode: () => state.singleMusicPlaybackMode,
  getPlaybackModeLabel: getSingleMusicPlaybackModeLabel,
  getRuntime: () => singleMusicRuntime,
  getCategoryLabel: getSingleMusicCategoryLabel,
  updateCategoryStatsDisplay: updateSingleMusicCategoryStatsDisplay,
  generateRoundQuestions: generateSingleMusicRoundQuestions,
  resetQuestionPool: resetSingleMusicQuestionPool,
  renderGameplay: renderSingleMusicGameplay,
  revealAnswer: revealSingleMusicAnswer,
  // This game does not use text-answer toggling, but keeps the method to satisfy the shared game interface.
  toggleAnswerText() {},
  playAudio: playSingleMusicAudio,
  playForwardAudio: playSingleMusicForwardOnly,
  playAlternateAudio: playSingleMusicAlternateAudio,
  stopAllAudio: stopSingleMusicAudio
};
