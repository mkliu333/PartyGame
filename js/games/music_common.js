window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.musicCommon = window.PartyGame.Games.musicCommon || {};

const MUSIC_ALL_CATEGORY_ID = "all";
const MUSIC_ALL_CATEGORY_LABEL = "大合集";
const MUSIC_MISC_CATEGORY_ID = "华语乐坛";
const MUSIC_MISC_CATEGORY_LABEL = "华语乐坛";
const MUSIC_STANDALONE_ARTIST_THRESHOLD = 15;

function createMusicQuestionId(prefix, index) {
  return `${prefix}_${Date.now()}_${index}`;
}

function safeStopAudio(audio) {
  if (!audio) return;
  try {
    audio.pause();
  } catch (error) {
    console.warn("Unable to pause audio:", error);
  }
  try {
    audio.currentTime = 0;
  } catch (error) {
    console.warn("Unable to reset audio:", error);
  }
}

function stopAudioList(audioList) {
  if (!Array.isArray(audioList)) return [];
  audioList.forEach(safeStopAudio);
  return [];
}

function getMusicSegmentType(trackOrId) {
  const id = typeof trackOrId === "object" ? trackOrId?.id : trackOrId;
  const normalized = String(id || "").trim().toLowerCase();
  if (/^tt\d+$/.test(normalized)) return "instrumental";
  if (/^t\d+$/.test(normalized)) return "vocal";
  return "invalid";
}

function getMusicSegmentTypeLabel(segmentType) {
  return segmentType === "instrumental" ? "间奏版" : "唱歌版";
}

function getMusicAnswerCountByArtist(tracks) {
  const answerSets = new Map();
  (Array.isArray(tracks) ? tracks : []).forEach((track) => {
    const artist = normalizeField(track?.category);
    const answer = normalizeField(track?.answer);
    if (!artist || !answer) return;
    if (!answerSets.has(artist)) answerSets.set(artist, new Set());
    answerSets.get(artist).add(answer);
  });
  const counts = new Map();
  answerSets.forEach((answers, artist) => counts.set(artist, answers.size));
  return counts;
}

function getStandaloneMusicArtists(tracks) {
  const counts = getMusicAnswerCountByArtist(tracks);
  return new Set([...counts.entries()]
    .filter(([, count]) => count >= MUSIC_STANDALONE_ARTIST_THRESHOLD)
    .map(([artist]) => artist));
}

function isStandaloneMusicArtist(artist, tracks) {
  return getStandaloneMusicArtists(tracks).has(artist);
}

function hasMiscMusicCategory(tracks) {
  const counts = getMusicAnswerCountByArtist(tracks);
  return [...counts.values()].some((count) => count < MUSIC_STANDALONE_ARTIST_THRESHOLD);
}

function getMusicDisplayCategories(tracks) {
  const standaloneArtists = [...getStandaloneMusicArtists(tracks)].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const categories = [{ id: MUSIC_ALL_CATEGORY_ID, label: MUSIC_ALL_CATEGORY_LABEL }];
  if (hasMiscMusicCategory(tracks)) categories.push({ id: MUSIC_MISC_CATEGORY_ID, label: MUSIC_MISC_CATEGORY_LABEL });
  standaloneArtists.forEach((artist) => categories.push({ id: artist, label: artist }));
  return categories;
}

function trackBelongsToDisplayCategory(track, displayCategoryId, tracks) {
  const categoryId = displayCategoryId || MUSIC_ALL_CATEGORY_ID;
  if (categoryId === MUSIC_ALL_CATEGORY_ID) return true;
  const artist = track?.category;
  if (!artist) return false;
  const standaloneArtists = getStandaloneMusicArtists(tracks);
  if (categoryId === MUSIC_MISC_CATEGORY_ID) return !standaloneArtists.has(artist);
  return artist === categoryId && standaloneArtists.has(artist);
}

function getTracksByDisplayCategory(tracks, displayCategoryId) {
  const allTracks = Array.isArray(tracks) ? tracks : [];
  return allTracks.filter((track) => trackBelongsToDisplayCategory(track, displayCategoryId, allTracks));
}

function getAvailableTracksByDisplayCategory(tracks, displayCategoryId, options = {}) {
  const consumedIds = options.consumedIds || new Set();
  const skippedIds = options.skippedIds || new Set();
  const excludeIds = options.excludeIds || new Set();
  const segmentType = options.segmentType || "all";
  return getTracksByDisplayCategory(tracks, displayCategoryId).filter((track) => (
    (segmentType === "all" || getMusicSegmentType(track) === segmentType)
    && !consumedIds.has(track.id)
    && !skippedIds.has(track.id)
    && !excludeIds.has(track.id)
  ));
}

function getInvolvedArtistLabel(tracks) {
  const artists = [];
  (Array.isArray(tracks) ? tracks : []).forEach((track) => {
    const artist = normalizeField(track?.category);
    if (artist && !artists.includes(artist)) artists.push(artist);
  });
  return artists.join(" / ") || "歌手";
}

Object.assign(window.PartyGame.Games.musicCommon, {
  MUSIC_ALL_CATEGORY_ID,
  MUSIC_ALL_CATEGORY_LABEL,
  MUSIC_MISC_CATEGORY_ID,
  MUSIC_MISC_CATEGORY_LABEL,
  MUSIC_STANDALONE_ARTIST_THRESHOLD,
  createMusicQuestionId,
  safeStopAudio,
  stopAudioList,
  getMusicSegmentType,
  getMusicSegmentTypeLabel,
  getMusicAnswerCountByArtist,
  getStandaloneMusicArtists,
  isStandaloneMusicArtist,
  hasMiscMusicCategory,
  getMusicDisplayCategories,
  trackBelongsToDisplayCategory,
  getTracksByDisplayCategory,
  getAvailableTracksByDisplayCategory,
  getInvolvedArtistLabel
});
