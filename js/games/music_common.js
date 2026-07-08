window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.musicCommon = window.PartyGame.Games.musicCommon || {};

// 音乐游戏共享工具：只放三歌混播和单曲猜歌共用的纯工具函数。
// 不直接读取 DOM，不直接修改游戏状态。

const MUSIC_ALL_CATEGORY_ID = "all";
const MUSIC_ALL_CATEGORY_LABEL = "大合集";
const MUSIC_MISC_CATEGORY_ID = "华语乐坛";
const MUSIC_MISC_CATEGORY_LABEL = "华语乐坛";
const MUSIC_STANDALONE_ARTIST_THRESHOLD = 18;
const MUSIC_UNKNOWN_ARTIST_LABEL = "未知歌手";
const MUSIC_ARTIST_SLUG_LABELS = {
  "beyond": "Beyond",
  "cai-jian-ya": "蔡健雅",
  "cai-yi-lin": "蔡依林",
  "chen-yi-xun": "陈奕迅",
  "cheng-xiang": "程响",
  "dao-lang": "刀郎",
  "deng-zi-qi": "邓紫棋",
  "feng-huang-chuan-qi": "凤凰传奇",
  "hai-lai-a-mu": "海来阿木",
  "li-rong-hao": "李荣浩",
  "liang-jing-ru": "梁静茹",
  "lin-jun-jie": "林俊杰",
  "lin-yi-lian": "林忆莲",
  "liu-de-hua": "刘德华",
  "liu-ruo-ying": "刘若英",
  "mao-bu-yi": "毛不易",
  "mo-wen-wei": "莫文蔚",
  "pu-shu": "朴树",
  "qu-wan-ting": "曲婉婷",
  "ren-su-xi": "任素汐",
  "ren-xian-qi": "任贤齐",
  "shan-yi-chun": "单依纯",
  "she": "S.H.E",
  "sui-yan-zi": "孙燕姿",
  "tan-yong-lin": "谭咏麟",
  "tao-zhe": "陶喆",
  "wang-fei": "王菲",
  "wang-li-hong": "王力宏",
  "wang-su-long": "汪苏泷",
  "wang-xin-ling": "王心凌",
  "wu-bai": "伍佰",
  "wu-yue-tian": "五月天",
  "xiao-ya-xuan": "萧亚轩",
  "xu-song": "许嵩",
  "xu-wei": "许巍",
  "xue-zhi-qian": "薛之谦",
  "yang-zong-wei": "杨宗纬",
  "zhang-bi-chen": "张碧晨",
  "zhang-jie": "张杰",
  "zhang-liang-ying": "张靓颖",
  "zhang-shao-han": "张韶涵",
  "zhang-xin-zhe": "张信哲",
  "zhang-xue-you": "张学友",
  "zhang-yu": "张宇",
  "zhao-lei": "赵雷",
  "zhou-chuan-xiong": "周传雄",
  "zhou-jie-lun": "周杰伦",
  "zhou-shen": "周深"
};

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

function inferMusicArtistSlug(track) {
  const fileName = normalizeField(track?.music).split("/").pop() || "";
  const trackName = fileName.replace(/\.mp3$/i, "").replace(/^tt?\d+_?/i, "").toLowerCase();
  const artistSlugs = Object.keys(MUSIC_ARTIST_SLUG_LABELS).sort((a, b) => b.length - a.length);
  return artistSlugs.find((slug) => trackName === slug || trackName.startsWith(`${slug}_`)) || "";
}

function getMusicTrackArtistLabel(track) {
  const explicitArtist = normalizeField(track?.artist)
    || normalizeField(track?.singer)
    || normalizeField(track?.artist_name)
    || normalizeField(track?.singer_name);
  if (explicitArtist) return explicitArtist;

  const inferredArtist = MUSIC_ARTIST_SLUG_LABELS[inferMusicArtistSlug(track)];
  if (inferredArtist) return inferredArtist;

  const category = normalizeField(track?.category);
  if (category && category !== MUSIC_ALL_CATEGORY_ID && category !== MUSIC_MISC_CATEGORY_ID) return category;
  return MUSIC_UNKNOWN_ARTIST_LABEL;
}

function getMusicTracksArtistLabel(tracks) {
  const artists = [];
  (Array.isArray(tracks) ? tracks : []).forEach((track) => {
    const artist = getMusicTrackArtistLabel(track);
    if (artist && artist !== MUSIC_UNKNOWN_ARTIST_LABEL && !artists.includes(artist)) artists.push(artist);
  });
  if (!artists.length) return MUSIC_UNKNOWN_ARTIST_LABEL;
  if (artists.length <= 3) return artists.join(" / ");
  return `${artists.slice(0, 3).join(" / ")} 等`;
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
    .filter(([artist, count]) => artist !== MUSIC_MISC_CATEGORY_ID && count >= MUSIC_STANDALONE_ARTIST_THRESHOLD)
    .map(([artist]) => artist));
}

function isStandaloneMusicArtist(artist, tracks) {
  return getStandaloneMusicArtists(tracks).has(artist);
}

function hasMiscMusicCategory(tracks) {
  const counts = getMusicAnswerCountByArtist(tracks);
  return [...counts.entries()].some(([artist, count]) => (
    artist === MUSIC_MISC_CATEGORY_ID || count < MUSIC_STANDALONE_ARTIST_THRESHOLD
  ));
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
  if (categoryId === MUSIC_MISC_CATEGORY_ID) return artist === MUSIC_MISC_CATEGORY_ID || !standaloneArtists.has(artist);
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
  return getMusicTracksArtistLabel(tracks);
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
  getMusicTrackArtistLabel,
  getMusicTracksArtistLabel,
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
