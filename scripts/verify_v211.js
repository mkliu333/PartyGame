const fs = require("fs");
const path = require("path");
const vm = require("vm");

require("./verify_v210.js");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const errors = [];
const state = {
  mode: "single",
  players: [
    { id: "p1", name: "玩家甲", avatarId: "a", score: 2, totalScore: 2 },
    { id: "p2", name: "玩家乙", avatarId: "a", isActive: true, score: 1, totalScore: 1 },
    { id: "p3", name: "玩家丙", avatarId: "a", isActive: false, score: 99, totalScore: 99 }
  ],
  teams: [],
  selectedAvatarId: "a",
  editingParticipantId: null,
  phase: "revealed",
  questionPositiveAwardedIds: new Set(),
  questionDeltaById: new Map(),
  questionScoreChanged: false,
  noScoreSelected: false
};
const classList = { add() {}, remove() {}, toggle() {} };
const participantName = { value: "", focus() {} };
const elements = {
  participantList: { innerHTML: "" },
  participantName,
  avatarGrid: { innerHTML: "" },
  setupError: { textContent: "", classList },
  roundError: { textContent: "", classList },
  roundInfo: { textContent: "", classList },
  toast: { textContent: "", classList },
  setupTitle: {}, setupSubtitle: {}, nameLabel: {}, addParticipant: {}, cancelParticipantEdit: {}, listTitle: {},
  scoreboard: { innerHTML: "" }, confirmScore: { hidden: true }
};
let validationMessage = "";
const context = {
  window: { PartyGame: { Core: {} }, clearTimeout() {}, setTimeout() {} },
  state,
  elements,
  AVATAR_LIBRARY: [{ id: "a", label: "头像", emoji: "🙂", color: "#fff" }],
  escapeHTML: String,
  console
};
vm.createContext(context);
vm.runInContext(read("js", "core", "participants.js"), context, { filename: "participants.js" });

if (context.getCurrentModeParticipants().length !== 3) errors.push("setup list does not retain all identities");
if (context.getActiveParticipants().length !== 2) errors.push("active helper does not treat missing isActive as active");
context.renderParticipants();
if (!["玩家甲", "玩家乙", "玩家丙"].every((name) => elements.participantList.innerHTML.includes(name))) errors.push("inactive participant is hidden from setup list");
if (!elements.participantList.innerHTML.includes("participant-inactive")) errors.push("inactive state is not rendered");
context.beginParticipantEdit("p3");
if (state.editingParticipantId !== "p3") errors.push("inactive participant cannot be edited");
context.cancelParticipantEdit();
context.toggleParticipantActive("p2");
if (context.getActiveParticipants().length !== 1) errors.push("participant could not be marked inactive");
context.showValidationError = (_target, message) => { validationMessage = message; };
if (context.validateStart()) errors.push("game starts with fewer than two active participants");
if (validationMessage !== "请至少选择2位参与游戏的玩家哟") errors.push("active participant validation message is incorrect");
context.toggleParticipantActive("p2");
if (!context.validateStart() || context.getActiveParticipants().length !== 2) errors.push("participant could not be reactivated");

vm.runInContext(read("js", "core", "scoring.js"), context, { filename: "scoring.js" });
context.renderScoreboard();
if (!elements.scoreboard.innerHTML.includes("玩家甲") || !elements.scoreboard.innerHTML.includes("玩家乙") || elements.scoreboard.innerHTML.includes("玩家丙")) {
  errors.push("scoreboard does not restrict itself to active participants");
}
vm.runInContext(read("js", "core", "settlement.js"), context, { filename: "settlement.js" });
if (context.getRoundWinners().map((item) => item.id).join() !== "p1") errors.push("inactive participant affected round winner calculation");
if (context.getFinalWinners().map((item) => item.id).join() !== "p1") errors.push("inactive participant affected final winner calculation");

const singleMusic = read("js", "games", "single_music.js");
const tripleMusic = read("js", "games", "triple_music.js");
if (!singleMusic.includes("sizes: [5, 10, 20]")) errors.push("single_music round sizes are not 5/10/20");
if (singleMusic.includes("answer-line\">1. ${escapeHTML(track.answer)}")) errors.push("single_music answer still has numbering");
if (!tripleMusic.includes("sizes: [5, 7, 11]")) errors.push("triple_music round sizes changed");
if (!tripleMusic.includes("${index + 1}. ${escapeHTML(track.answer)}")) errors.push("triple_music answer numbering was removed");
const config = read("js", "core", "config.js");
if (!config.includes('APP_VERSION = "v3.0.3"')) errors.push("config version is not v3.0.3");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ participantToggle: true, inactiveSetupVisibility: true, activeOnlyScoring: true, activeOnlyWinners: true, singleMusicSizes: [5, 10, 20], tripleMusicSizes: [5, 7, 11], singleAnswerNumbering: false }, null, 2));
