const fs = require("fs");
const path = require("path");
const vm = require("vm");

require("./verify_v212.js");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const errors = [];
const context = { window: {} };
vm.createContext(context);
vm.runInContext(read("data", "emoji_guess", "emoji_guess_questions_v2.js"), context);
const questions = context.window.PARTY_EMOJI_GUESS_QUESTIONS;
const expectedCategories = ["猜名人", "猜歌名", "猜成语"];

if (!Array.isArray(questions) || questions.length !== 80) errors.push("emoji v2 bank must contain 80 questions");
expectedCategories.forEach((category) => {
  const expectedCount = category === "猜成语" ? 20 : 30;
  if (questions.filter((question) => question.category === category).length !== expectedCount) errors.push(`${category} must contain ${expectedCount} questions`);
});
if (new Set(questions.map((question) => question.id)).size !== questions.length) errors.push("emoji IDs are not unique");
if (new Set(questions.map((question) => question.answer)).size !== questions.length) errors.push("emoji answers are not unique");
if (questions.some((question) => !Array.isArray(question.clues) || !question.clues.length)) errors.push("every emoji question must use a non-empty clues array");

const html = read("PartyGame.html");
const config = read("js", "core", "config.js");
const registry = read("js", "games", "game_registry.js");
const emojiGame = read("js", "games", "emoji_guess.js");
const roundEngine = read("js", "core", "round_engine.js");
const media = read("js", "core", "media.js");
const readme = read("README.md");

if (!config.includes('APP_VERSION = "v3.0.3"')) errors.push("config version is not v3.0.3");
if (!registry.includes('id: "emoji_guess"') || !registry.includes('title: "Emoji猜猜猜"')) errors.push("playable emoji registry entry is missing");
if (registry.includes("Emoji猜人名") || registry.includes("emoji_person")) errors.push("old emoji placeholder remains");
if (!html.includes('data/emoji_guess/emoji_guess_questions_v2.js') || html.includes('data/emoji_guess/emoji_guess_questions_v1.js') || !html.includes('js/games/emoji_guess.js')) errors.push("emoji v2 scripts are not loaded exclusively");
if (html.indexOf("data/emoji_guess/emoji_guess_questions_v2.js") > html.indexOf("js/core/config.js")) errors.push("emoji data must load before core scripts");
if (!emojiGame.includes("sizes: [10, 20, 30]") || !emojiGame.includes("state.emojiHintVisible")) errors.push("emoji round sizes or hint state are missing");
if (!emojiGame.includes("token.textContent = clue")) errors.push("emoji tokens are not rendered safely with textContent");
if (!emojiGame.includes('classList.add("emoji-mode")')) errors.push("emoji media mode is missing");
if (!read("css", "style.css").includes(".media-card.emoji-mode video")) errors.push("emoji mode does not hide the video element");
if (!roundEngine.includes("emojiQuestionIds") || !roundEngine.includes("consumedEmojiGuessQuestionIds.clear()")) errors.push("emoji rollback or global reset integration is missing");
if (!media.includes("state.emojiHintVisible = false")) errors.push("emoji hint is not reset for each question");
if (!readme.includes("## Emoji猜猜猜 / emoji_guess")) errors.push("README emoji section is missing");
const liuDehua = questions.find((question) => question.answer === "刘德华");
if (!liuDehua || JSON.stringify(liuDehua.clues) !== JSON.stringify(["6️⃣", "🇩🇪", "🌸"])) errors.push("刘德华 v2 clues are incorrect");
if (questions.some((question) => question.clues.includes("🛹"))) errors.push("skateboard clue remains in emoji bank");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  version: "v3.0.3",
  emojiQuestions: questions.length,
  categories: Object.fromEntries(expectedCategories.map((category) => [category, questions.filter((question) => question.category === category).length])),
  safeClueRendering: true,
  independentHintReveal: true,
  independentInventoryRollback: true,
  legacyRegressionChecks: true
}, null, 2));
