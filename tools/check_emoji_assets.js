const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const questionBankPath = path.join(root, "data", "emoji_guess", "emoji_guess_questions_v2.js");
const indexPath = path.join(root, "assets", "emoji", "emoji_index.js");
const assetDir = path.join(root, "assets", "emoji", "noto", "svg");
const questionBankDisplayPath = "data/emoji_guess/emoji_guess_questions_v2.js";
const indexDisplayPath = "assets/emoji/emoji_index.js";
const assetDisplayPath = "assets/emoji/noto/svg/";
const flagChecks = new Map([
  ["🇩🇪", "emoji_u1f1e9_1f1ea.svg"],
  ["🇬🇧", "emoji_u1f1ec_1f1e7.svg"]
]);

function readBrowserData(filePath) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, "utf8"), context, { filename: filePath });
  return context.window;
}

function normalizeCode(code) {
  return String(code || "").trim().toLowerCase();
}

function getClueText(clue) {
  if (typeof clue === "string") return clue;
  if (!clue || typeof clue !== "object" || Array.isArray(clue)) return "";
  return String(clue.text || "");
}

function resolveAsset(clue, text, items) {
  if (clue && typeof clue === "object" && !Array.isArray(clue)) {
    if (clue.asset) return String(clue.asset);
    if (clue.code) return `emoji_u${normalizeCode(clue.code)}.svg`;
  }
  return items[text] || "";
}

function loadEmojiInputs() {
  const questionWindow = readBrowserData(questionBankPath);
  const indexWindow = readBrowserData(indexPath);
  const questions = Array.isArray(questionWindow.PARTY_EMOJI_GUESS_QUESTIONS)
    ? questionWindow.PARTY_EMOJI_GUESS_QUESTIONS
    : [];
  const items = indexWindow.PARTY_EMOJI_ASSETS && indexWindow.PARTY_EMOJI_ASSETS.items
    ? indexWindow.PARTY_EMOJI_ASSETS.items
    : {};
  return { questions, items };
}

function collectRequiredAssets() {
  const { questions, items } = loadEmojiInputs();
  const unique = new Map();

  questions.forEach((question) => {
    if (!Array.isArray(question.clues)) return;
    question.clues.forEach((clue) => {
      const text = getClueText(clue);
      if (!text || unique.has(text)) return;
      const filename = resolveAsset(clue, text, items);
      unique.set(text, {
        text,
        filename,
        targetPath: filename ? path.join(assetDir, filename) : ""
      });
    });
  });

  return [...unique.values()];
}

function buildReport() {
  const required = collectRequiredAssets();
  const missingMappings = required.filter((item) => !item.filename);
  const mapped = required.filter((item) => item.filename);
  const existingSvgFiles = mapped.filter((item) => fs.existsSync(item.targetPath));
  const missingSvgFiles = mapped.filter((item) => !fs.existsSync(item.targetPath));
  const totalCoverageDenominator = required.length || 1;
  const coverage = (existingSvgFiles.length / totalCoverageDenominator) * 100;
  const hasCompleteCoverage = coverage === 100 && missingMappings.length === 0 && missingSvgFiles.length === 0;
  const flagStatus = [...flagChecks].map(([text, filename]) => ({
    text,
    filename,
    exists: fs.existsSync(path.join(assetDir, filename))
  }));

  return {
    questionBank: questionBankDisplayPath,
    emojiIndex: indexDisplayPath,
    targetFolder: assetDisplayPath,
    totalUniqueClueTokens: required.length,
    mappedTokens: mapped.length,
    missingMappings,
    existingSvgFiles,
    missingSvgFiles,
    coveragePercent: coverage,
    hasCompleteCoverage,
    flagStatus,
    required
  };
}

function printReport(report) {
  console.log("Noto Emoji Asset Coverage");
  console.log("=========================");
  console.log(`Unique clue tokens: ${report.totalUniqueClueTokens}`);
  console.log(`Mapped tokens: ${report.mappedTokens}`);
  console.log(`Existing SVG files: ${report.existingSvgFiles.length}`);
  console.log(`Missing SVG files: ${report.missingSvgFiles.length}`);
  console.log(`Coverage: ${report.coveragePercent.toFixed(0)}%`);

  if (report.missingSvgFiles.length) {
    console.log("\nMissing SVG files:");
    report.missingSvgFiles.forEach((item) => {
      console.log(`- ${item.text} -> ${item.filename}`);
    });
  }

  if (report.missingMappings.length) {
    console.log("\nMissing mappings:");
    report.missingMappings.forEach((item) => {
      console.log(`- ${item.text}`);
    });
  }

  if (!report.hasCompleteCoverage) {
    console.log("\nNoto-only mode requires 100% SVG coverage. Missing files will show missing-asset placeholders, not system emoji.");
  }

  console.log("\nCritical flags:");
  report.flagStatus.forEach((item) => {
    console.log(`${item.text} ${item.filename}: ${item.exists ? "FOUND" : "MISSING"}`);
  });
}

if (require.main === module) {
  const report = buildReport();
  printReport(report);
  if (!report.hasCompleteCoverage) process.exitCode = 1;
}

module.exports = {
  root,
  questionBankPath,
  indexPath,
  assetDir,
  questionBankDisplayPath,
  indexDisplayPath,
  assetDisplayPath,
  flagChecks,
  collectRequiredAssets,
  buildReport,
  printReport
};
