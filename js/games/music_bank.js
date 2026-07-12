window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.musicBank = window.PartyGame.Games.musicBank || {};

// Shared music question bank layer for triple_music and single_music.
// Playback, DOM rendering, scoring, and round composition stay in each game module.

function normalizeMusicBankTrack(rawTrack) {
  const safe = rawTrack || {};
  return {
    id: normalizeCodeField(safe.id),
    category: normalizeField(safe.category),
    artist: normalizeField(safe.artist),
    singer: normalizeField(safe.singer),
    artist_name: normalizeField(safe.artist_name),
    singer_name: normalizeField(safe.singer_name),
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

function getMusicBankIdNumber(id) {
  const match = String(id || "").trim().toLowerCase().match(/^tt?(\d+)$/);
  return match ? match[1] : "";
}

function validateMusicBankTrack(track) {
  const errors = [];
  if (!track.id) errors.push("缺少 id");
  if (track.id && window.PartyGame.Games.musicCommon.getMusicSegmentType(track.id) === "invalid") {
    errors.push("ID 必须使用 t### 或 tt### 格式");
  }
  if (!track.category) errors.push("缺少 category");
  if (!track.answer) errors.push("缺少 answer");
  if (!isBrowserRelativeMusicPath(track.music)) {
    errors.push("Music 路径必须是 assets/triple_music/ 开头的浏览器相对路径");
  }
  if (track.music && !track.music.toLowerCase().endsWith(".mp3")) {
    errors.push("Music 文件必须使用 .mp3 格式");
  }
  return { valid: errors.length === 0, errors };
}

function updateMusicBankPreflight(loaded, skipped, issues) {
  state.tripleMusicPreflight = {
    loaded,
    skipped,
    issues: Array.isArray(issues) ? issues : []
  };
  return state.tripleMusicPreflight;
}

function loadMusicTrackBank() {
  const rawTracks = Array.isArray(window.PARTY_TRIPLE_MUSIC_TRACKS) ? window.PARTY_TRIPLE_MUSIC_TRACKS : [];
  const seenIds = new Set();
  const seenIdNumbers = new Map();
  const validTracks = [];
  const issues = [];

  rawTracks.forEach((rawTrack) => {
    const track = normalizeMusicBankTrack(rawTrack);
    if (track.id && seenIds.has(track.id)) {
      issues.push(`${track.id}: 重复 ID，已跳过`);
      return;
    }
    const result = validateMusicBankTrack(track);
    if (!result.valid) {
      result.errors.forEach((error) => issues.push(`${track.id || "未知音频"}: ${error}`));
      return;
    }
    const idNumber = getMusicBankIdNumber(track.id);
    if (seenIdNumbers.has(idNumber)) {
      issues.push(`重复数字编号：${idNumber}，不能同时存在 ${seenIdNumbers.get(idNumber)} 和 ${track.id}`);
      return;
    }
    validTracks.push(track);
    seenIds.add(track.id);
    seenIdNumbers.set(idNumber, track.id);
  });

  state.tripleMusicTracks = validTracks;
  updateMusicBankPreflight(validTracks.length, rawTracks.length - validTracks.length, issues);

  if (!Array.isArray(window.PARTY_TRIPLE_MUSIC_TRACKS)) {
    console.warn("window.PARTY_TRIPLE_MUSIC_TRACKS not found. Using empty triple_music track bank.");
  }
  if (issues.length) console.warn("Triple music skipped invalid tracks:", issues);
}

function getMusicBankTracks() {
  return state.tripleMusicTracks || [];
}

function getMusicBankCategories() {
  return window.PartyGame.Games.musicCommon.getMusicDisplayCategories(getMusicBankTracks());
}

function getMusicBankCategoryLabel(category) {
  return getMusicBankCategories().find((item) => item.id === category)?.label || category || "歌手";
}

function getAvailableMusicBankTracks(category = "all", excludeIds = new Set(), segmentType = "all") {
  return window.PartyGame.Games.musicCommon.getAvailableTracksByDisplayCategory(getMusicBankTracks(), category, {
    consumedIds: state.consumedMusicTrackIds,
    skippedIds: state.skippedMusicTrackIds,
    excludeIds,
    segmentType
  });
}

function getMusicBankPreflight() {
  return state.tripleMusicPreflight;
}

function handleMusicBankAudioError(track) {
  console.warn("Triple music audio unreadable:", track);
  state.skippedMusicTrackIds.add(track.id);
  showToast("当前音频无法读取，已跳过或请检查素材路径");
}

function resetMusicBankSharedPool() {
  state.consumedMusicTrackIds.clear();
  state.skippedMusicTrackIds.clear();
}

function getMusicBankDebugInfo() {
  return {
    tracks: getMusicBankTracks().length,
    consumed: state.consumedMusicTrackIds.size,
    skipped: state.skippedMusicTrackIds.size,
    preflight: state.tripleMusicPreflight,
    categories: getMusicBankCategories()
  };
}

function debugUnknownArtistTracks() {
  const musicCommon = window.PartyGame.Games.musicCommon;
  const unknownArtist = musicCommon.getMusicTrackArtistLabel({});
  return getMusicBankTracks()
    .filter((track) => musicCommon.getMusicTrackArtistLabel(track) === unknownArtist)
    .map((track) => ({
      id: track.id,
      category: track.category,
      artist: track.artist,
      answer: track.answer,
      music: track.music
    }));
}

Object.assign(window.PartyGame.Games.musicBank, {
  id: "music_bank",
  normalizeTrack: normalizeMusicBankTrack,
  validateTrack: validateMusicBankTrack,
  loadTrackBank: loadMusicTrackBank,
  getTracks: getMusicBankTracks,
  getCategories: getMusicBankCategories,
  getCategoryLabel: getMusicBankCategoryLabel,
  getAvailableTracks: getAvailableMusicBankTracks,
  updatePreflight: updateMusicBankPreflight,
  getPreflight: getMusicBankPreflight,
  handleAudioError: handleMusicBankAudioError,
  resetSharedPool: resetMusicBankSharedPool,
  getDebugInfo: getMusicBankDebugInfo,
  debugUnknownArtistTracks
});
