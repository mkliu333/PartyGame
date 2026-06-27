const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const errors = [];
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const dataPath = path.join(root, "data", "triple_music", "triple_music_questions_v3.js");
const dataContext = { window: {} };
vm.runInNewContext(fs.readFileSync(dataPath, "utf8"), dataContext, { filename: dataPath });
const tracks = dataContext.window.PARTY_TRIPLE_MUSIC_TRACKS;

const ids = new Set();
const numbers = new Set();
for (const [index, track] of (tracks || []).entries()) {
  if (Object.keys(track).sort().join(",") !== "answer,category,id,music") errors.push(`track ${index + 1}: invalid keys`);
  if (!/^tt?\d+$/.test(track.id)) errors.push(`${track.id}: invalid ID`);
  if (ids.has(track.id)) errors.push(`${track.id}: duplicate ID`);
  ids.add(track.id);
  const number = track.id.replace(/^tt?/, "");
  if (numbers.has(number)) errors.push(`${track.id}: numeric ID collision`);
  numbers.add(number);
  if (!track.music.startsWith("assets/triple_music/") || !track.music.endsWith(".mp3")) errors.push(`${track.id}: invalid MP3 path`);
  if (!fs.existsSync(path.join(root, ...track.music.split("/")))) errors.push(`${track.id}: missing audio`);
}
for (const category of ["周杰伦", "陈奕迅", "林俊杰", "邓紫棋"]) {
  if (!tracks.some((track) => track.category === category)) errors.push(`missing category ${category}`);
}

const html = read("PartyGame.html");
if (!html.includes("triple_music_questions_v3.js") || html.includes("triple_music_questions_v2.js")) errors.push("HTML data source is not exclusively v3");
if (!html.includes("js/games/single_music.js")) errors.push("single_music module is not loaded");
if (!html.includes("id=\"resetAllGames\"")) errors.push("global inventory reset button missing");

const state = {
  tripleMusicTracks: [],
  tripleMusicPreflight: {},
  consumedMusicTrackIds: new Set(),
  skippedMusicTrackIds: new Set(),
  selectedCategory: "all",
  roundSize: 5,
  currentRoundQuestions: [],
  currentQuestionIndex: 0,
  phase: "prompt",
  hasStartedAnyRound: false
};
const context = {
  window: { PARTY_TRIPLE_MUSIC_TRACKS: tracks, PartyGame: { Games: {} } },
  state,
  normalizeCodeField: (value) => String(value || "").trim().toLowerCase(),
  normalizeField: (value) => String(value || "").trim(),
  shuffleArray: (array) => [...array],
  resetQuestionFlowState: () => { state.phase = "prompt"; },
  showRoundError: () => {},
  showRoundInfo: () => {},
  showToast: () => {},
  renderQuestionBankInspector: () => {},
  updateCategoryStatsDisplay: () => {},
  elements: { categoryStats: { innerHTML: "" } },
  escapeHTML: String,
  getCurrentQuestion: () => state.currentRoundQuestions[state.currentQuestionIndex],
  isTripleMusicActive: () => true,
  isSingleMusicActive: () => true,
  Audio: class { addEventListener() {} pause() {} play() { return Promise.resolve(); } },
  console,
  Date
};
vm.createContext(context);
vm.runInContext(read("js", "games", "triple_music.js"), context, { filename: "triple_music.js" });
vm.runInContext(read("js", "games", "single_music.js"), context, { filename: "single_music.js" });
const triple = context.window.PartyGame.Games.tripleMusic;
const single = context.window.PartyGame.Games.singleMusic;
triple.loadTrackBank();
const dynamicCategories = triple.getCategories().map((item) => item.id);
if (!dynamicCategories.includes("邓紫棋")) errors.push("dynamic music categories omit 邓紫棋");

triple.generateRoundQuestions();
const tripleIds = new Set(state.currentRoundQuestions.flatMap((question) => question.tracks.map((track) => track.id)));
for (const question of state.currentRoundQuestions) {
  if (question.tracks.length > 3) errors.push("triple_music generated more than 3 tracks");
  if (new Set(question.tracks.map((track) => track.answer)).size !== question.tracks.length) errors.push("triple_music repeated an answer within one question");
  if (new Set(question.tracks.map((track) => triple.getSegmentType(track.id))).size !== 1) errors.push("triple_music mixed vocal and instrumental tracks");
}
single.generateRoundQuestions();
const singleIds = new Set(state.currentRoundQuestions.map((question) => question.tracks[0].id));
if ([...singleIds].some((id) => tripleIds.has(id))) errors.push("single_music reused triple_music inventory");
if (state.currentRoundQuestions.some((question) => question.tracks.length !== 1)) errors.push("single_music did not generate exactly one track per question");
single.resetQuestionPool();
if (state.consumedMusicTrackIds.size || state.skippedMusicTrackIds.size) errors.push("shared music reset did not clear both sets");

const router = read("js", "core", "router.js");
if (!router.includes("musicCategorySelect") || !router.includes("<select")) errors.push("music category dropdown missing");
const participants = read("js", "core", "participants.js");
if (!participants.includes("data-edit-id") || !participants.includes("beginParticipantEdit")) errors.push("participant editing missing");
const settlement = read("js", "core", "settlement.js");
if (/consumedQuestionIds\.clear|consumedMusicTrackIds\.clear/.test(settlement)) errors.push("return-home settlement still resets inventory");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  tracks: tracks.length,
  categories: Object.fromEntries(dynamicCategories.map((category) => [category, tracks.filter((track) => track.category === category).length])),
  tripleQuestionsChecked: tripleIds.size,
  singleQuestionsChecked: singleIds.size,
  sharedInventory: true,
  allAudioFilesExist: true
}, null, 2));
