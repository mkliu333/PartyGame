const fs = require("fs");
const path = require("path");
const vm = require("vm");

require("./verify_v211.js");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const errors = [];
const state = {
  mode: "single",
  players: [
    { id: "p1", name: "玩家甲", score: 0, totalScore: 1 },
    { id: "p2", name: "玩家乙", score: 0, totalScore: 0 }
  ],
  teams: [],
  consumedQuestionIds: new Set(["q-completed"]),
  consumedMusicTrackIds: new Set(["t-completed"]),
  consumedEmojiGuessQuestionIds: new Set(["eg-completed"]),
  skippedQuestionIds: new Set(),
  skippedMusicTrackIds: new Set(),
  skippedEmojiGuessQuestionIds: new Set(),
  currentRoundQuestions: [],
  currentQuestionIndex: 0,
  currentRoundResult: null,
  completedRoundCount: 1,
  hasStartedAnyRound: true,
  activeRoundScoreSnapshot: null,
  activeRoundInventorySnapshot: null
};
let resetFlowCalls = 0;
const context = {
  window: { PartyGame: { Core: {} } },
  state,
  CATEGORY_CONFIG: [],
  elements: { categoryStats: {}, questionBankInspectPanel: null },
  getCurrentModeParticipants: () => state.players,
  findParticipantById: (id) => state.players.find((participant) => participant.id === id),
  resetQuestionFlowState: () => { resetFlowCalls += 1; },
  isMusicGameActive: () => false,
  getActiveMusicGame: () => null,
  renderQuestionBankInspector() {},
  updateCategoryStatsDisplay() {},
  showToast() {},
  showRoundError() {},
  showRoundInfo() {},
  escapeHTML: String,
  console,
  Math,
  Date
};
vm.createContext(context);
vm.runInContext(read("js", "core", "round_engine.js"), context, { filename: "round_engine.js" });

context.beginActiveRoundSnapshot();
state.consumedQuestionIds.add("q-unfinished");
state.consumedMusicTrackIds.add("t-unfinished");
state.consumedEmojiGuessQuestionIds.add("eg-unfinished");
state.currentRoundQuestions = [{ id: "q-unfinished" }];
state.players[0].score = 3;
state.players[0].totalScore = 7;
if (!context.rollbackActiveRound()) errors.push("unfinished round was not rolled back");
if (![...state.consumedQuestionIds].includes("q-completed") || state.consumedQuestionIds.has("q-unfinished")) errors.push("script inventory rollback touched completed inventory or retained unfinished inventory");
if (![...state.consumedMusicTrackIds].includes("t-completed") || state.consumedMusicTrackIds.has("t-unfinished")) errors.push("music inventory rollback touched completed inventory or retained unfinished inventory");
if (![...state.consumedEmojiGuessQuestionIds].includes("eg-completed") || state.consumedEmojiGuessQuestionIds.has("eg-unfinished")) errors.push("emoji inventory rollback touched completed inventory or retained unfinished inventory");
if (state.players[0].score !== 0 || state.players[0].totalScore !== 1) errors.push("unfinished score snapshot was not restored");
if (state.players.length !== 2 || state.currentRoundQuestions.length || state.currentQuestionIndex !== 0) errors.push("rollback removed identities or retained round state");
if (!state.hasStartedAnyRound || resetFlowCalls !== 1) errors.push("completed-round state or question flow was not preserved correctly");

context.beginActiveRoundSnapshot();
state.consumedQuestionIds.add("q-second-completed");
context.completeActiveRoundSnapshot();
if (context.rollbackActiveRound()) errors.push("completed round was treated as unfinished");
if (!state.consumedQuestionIds.has("q-second-completed")) errors.push("completed round inventory was rolled back");

const html = read("PartyGame.html");
if (!html.includes('id="exitConfirmOverlay"') || !html.includes("确认退出") || !html.includes("返回游戏")) errors.push("custom exit confirmation UI is missing");
if (!html.includes('id="birthdaySongToggle"') || !html.includes("播放或停止生日歌")) errors.push("birthday cake toggle is missing or inaccessible");
const router = read("js", "core", "router.js");
if (!router.includes('elements.resetAllGames.hidden = state.screen === "play" || overlayOpen')) errors.push("global reset is not hidden during gameplay/overlays");
if (!router.includes("isActiveRoundUnfinished()") || !router.includes("rollbackActiveRound()")) errors.push("return-home confirmation does not use active-round rollback");
const media = read("js", "core", "media.js");
if (!media.includes('new Audio("assets/birthday_song/Birthday.mp3")') || !media.includes("birthdaySongAudio.loop = true")) errors.push("birthday song audio path or looping is missing");
if (!media.includes("audio.currentTime = 0")) errors.push("birthday song does not reset after stopping");
if (!fs.existsSync(path.join(root, "assets", "birthday_song", "Birthday.mp3"))) errors.push("Birthday.mp3 is missing");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ midGameConfirmation: true, unfinishedInventoryRollback: true, emojiInventoryRollback: true, unfinishedScoreRollback: true, completedRoundsPreserved: true, participantsPreserved: true, resetHiddenDuringGameplay: true, birthdaySongPresent: true }, null, 2));
