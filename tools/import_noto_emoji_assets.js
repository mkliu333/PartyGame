const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  root,
  assetDir,
  assetDisplayPath,
  questionBankDisplayPath,
  indexDisplayPath,
  flagChecks,
  getNotoFilenameForEmoji,
  collectRequiredAssets
} = require("./check_emoji_assets");

const repoDir = path.join(__dirname, "_tmp_noto_emoji");
const repoUrl = "https://github.com/googlefonts/noto-emoji.git";

function parseArgs(argv) {
  const args = { source: "" };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") {
      args.source = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--source=")) {
      args.source = arg.slice("--source=".length);
    }
  }
  return args;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    stdio: options.stdio || "pipe"
  });
}

function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch (error) {
    return false;
  }
}

function findSvgFiles(dir, byName) {
  const pending = [dir];
  while (pending.length) {
    const current = pending.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      continue;
    }
    entries.forEach((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git") return;
        pending.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".svg")) {
        const key = entry.name.toLowerCase();
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(fullPath);
      }
    });
  }
}

function getFilenameCandidates(filename) {
  const candidates = [filename];
  const withoutVariationSelector = filename.replace(/_fe0f/g, "");
  if (withoutVariationSelector !== filename) candidates.push(withoutVariationSelector);
  return candidates;
}

function buildRequiredSummary() {
  const required = collectRequiredAssets();
  const mapped = required.filter((item) => item.filename);
  const missingMappings = required.filter((item) => !item.filename);
  const requiredFilenames = [...new Set(mapped.map((item) => item.filename.toLowerCase()))].sort();
  return { required, mapped, missingMappings, requiredFilenames };
}

function readBrowserData(filePath) {
  const vm = require("vm");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, "utf8"), context, { filename: filePath });
  return context.window;
}

function collectIndexMappings(required) {
  const indexPath = path.join(root, indexDisplayPath);
  const indexWindow = readBrowserData(indexPath);
  const currentItems = indexWindow.PARTY_EMOJI_ASSETS?.items || {};
  const additions = {};
  required.forEach((item) => {
    if (!item.text || currentItems[item.text]) return;
    const filename = item.filename || getNotoFilenameForEmoji(item.text);
    if (filename) additions[item.text] = filename;
  });
  return additions;
}

function updateEmojiIndex(additions) {
  const entries = Object.entries(additions);
  if (!entries.length) return [];
  const indexPath = path.join(root, indexDisplayPath);
  let source = fs.readFileSync(indexPath, "utf8");
  const insertionPoint = source.lastIndexOf("\n  }\n};");
  if (insertionPoint < 0) throw new Error(`Cannot find insertion point in ${indexDisplayPath}`);
  const needsComma = !source.slice(0, insertionPoint).trimEnd().endsWith("{");
  const rendered = entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([text, filename], index) => `${index === 0 && needsComma ? "," : ""}\n    ${JSON.stringify(text)}: ${JSON.stringify(filename)}`)
    .join(",");
  source = `${source.slice(0, insertionPoint)}${rendered}${source.slice(insertionPoint)}`;
  fs.writeFileSync(indexPath, source, "utf8");
  return entries.map(([text, filename]) => ({ text, filename }));
}

function sourceHasRequiredSvgs(sourceDir, requiredFilenames) {
  if (!isDirectory(sourceDir)) return false;
  const svgFiles = new Map();
  findSvgFiles(sourceDir, svgFiles);
  return requiredFilenames.some((filename) => (
    getFilenameCandidates(filename).some((candidate) => svgFiles.has(candidate.toLowerCase()))
  ));
}

function formatCloneError(result) {
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

function printManualFallback() {
  console.log("\nGitHub clone failed. This is usually caused by network/sandbox restrictions.");
  console.log("Manual fallback:");
  console.log("1. Open https://github.com/googlefonts/noto-emoji");
  console.log("2. Download ZIP manually");
  console.log("3. Extract it locally");
  console.log("4. Run:");
  console.log('   node tools/import_noto_emoji_assets.js --source "PATH_TO_EXTRACTED_NOTO_EMOJI"');
}

function resolveSourceFolder(explicitSource, requiredFilenames) {
  if (explicitSource) {
    const sourcePath = path.resolve(root, explicitSource);
    if (!isDirectory(sourcePath)) {
      throw new Error(`Source folder does not exist or is not a directory: ${sourcePath}`);
    }
    return { sourceFolder: sourcePath, cloneFailed: false, cloneError: "" };
  }

  if (sourceHasRequiredSvgs(repoDir, requiredFilenames)) {
    return { sourceFolder: repoDir, cloneFailed: false, cloneError: "" };
  }

  if (isDirectory(repoDir)) {
    const resolvedRepoDir = path.resolve(repoDir);
    const allowedParent = path.resolve(__dirname);
    if (!resolvedRepoDir.startsWith(`${allowedParent}${path.sep}`)) {
      throw new Error(`Refusing to recreate unexpected path: ${resolvedRepoDir}`);
    }
    fs.rmSync(repoDir, { recursive: true, force: true });
  }

  console.log(`Existing ${path.relative(root, repoDir) || repoDir} is missing or does not contain required SVG files.`);
  console.log(`Trying git clone --depth 1 ${repoUrl} ${path.relative(root, repoDir)}`);
  const result = run("git", ["clone", "--depth", "1", repoUrl, repoDir], { stdio: "pipe" });
  if (result.status === 0 && sourceHasRequiredSvgs(repoDir, requiredFilenames)) {
    return { sourceFolder: repoDir, cloneFailed: false, cloneError: "" };
  }

  return {
    sourceFolder: "",
    cloneFailed: true,
    cloneError: formatCloneError(result)
  };
}

function copyRequiredFiles(sourceFolder, requiredFilenames) {
  fs.mkdirSync(assetDir, { recursive: true });
  const sourceSvgFiles = new Map();
  findSvgFiles(sourceFolder, sourceSvgFiles);

  const copied = [];
  const alreadyExisting = [];
  const missingSvgFiles = [];

  requiredFilenames.forEach((filename) => {
    const target = path.join(assetDir, filename);
    if (fs.existsSync(target)) {
      alreadyExisting.push(filename);
      return;
    }
    const source = getFilenameCandidates(filename)
      .flatMap((candidate) => sourceSvgFiles.get(candidate.toLowerCase()) || [])[0];
    if (!source) {
      missingSvgFiles.push(filename);
      return;
    }
    fs.copyFileSync(source, target);
    copied.push(filename);
  });

  return { copied, alreadyExisting, missingSvgFiles };
}

function importAssets(options = {}) {
  const { required, mapped, missingMappings, requiredFilenames } = buildRequiredSummary();
  const indexAdditions = collectIndexMappings(required);
  const addedIndexMappings = updateEmojiIndex(indexAdditions);
  const explicitSource = options.source || "";
  const alreadyExistingTargets = requiredFilenames.filter((filename) => fs.existsSync(path.join(assetDir, filename)));
  const missingTargetFilenames = requiredFilenames.filter((filename) => !fs.existsSync(path.join(assetDir, filename)));
  let sourceInfo = isDirectory(repoDir)
    ? { sourceFolder: repoDir, cloneFailed: false, cloneError: "" }
    : {
        sourceFolder: "(not needed; all required SVG files already exist)",
        cloneFailed: false,
        cloneError: ""
      };
  let copyResult = { copied: [], alreadyExisting: alreadyExistingTargets, missingSvgFiles: [] };

  if (explicitSource || missingTargetFilenames.length) {
    sourceInfo = resolveSourceFolder(explicitSource, missingTargetFilenames);
    if (sourceInfo.sourceFolder) {
      const copiedMissing = copyRequiredFiles(sourceInfo.sourceFolder, missingTargetFilenames);
      copyResult = {
        copied: copiedMissing.copied,
        alreadyExisting: alreadyExistingTargets,
        missingSvgFiles: copiedMissing.missingSvgFiles
      };
    } else {
      copyResult = {
        copied: [],
        alreadyExisting: alreadyExistingTargets,
        missingSvgFiles: missingTargetFilenames
      };
    }
  }

  const flagReport = [...flagChecks].map(([text, filename]) => ({
    text,
    filename,
    exists: fs.existsSync(path.join(assetDir, filename))
  }));

  return {
    questionBank: questionBankDisplayPath,
    emojiIndex: indexDisplayPath,
    sourceFolder: sourceInfo.sourceFolder || "(none)",
    targetFolder: assetDisplayPath,
    totalUniqueClueTokens: required.length,
    mappedClueTokens: mapped.length,
    copiedSvgFiles: copyResult.copied.length,
    alreadyExistingSvgFiles: copyResult.alreadyExisting.length,
    addedIndexMappings,
    missingMappings,
    missingSvgFiles: copyResult.missingSvgFiles,
    flagReport,
    cloneFailed: sourceInfo.cloneFailed,
    cloneError: sourceInfo.cloneError
  };
}

function printReport(report) {
  console.log("\nNoto Emoji Import Report");
  console.log("========================");
  console.log(`Question bank: ${report.questionBank}`);
  console.log(`Emoji index: ${report.emojiIndex}`);
  console.log(`Source folder: ${report.sourceFolder}`);
  console.log(`Target folder: ${report.targetFolder}`);
  console.log("");
  console.log(`Unique clue tokens: ${report.totalUniqueClueTokens}`);
  console.log(`Mapped tokens: ${report.mappedClueTokens}`);
  console.log(`Copied SVG files: ${report.copiedSvgFiles}`);
  console.log(`Already existing SVG files: ${report.alreadyExistingSvgFiles}`);
  console.log(`Added index mappings: ${report.addedIndexMappings.length}`);
  console.log(`Missing mappings: ${report.missingMappings.length}`);
  console.log(`Missing SVG files: ${report.missingSvgFiles.length}`);
  console.log("");
  console.log("Critical flags:");
  report.flagReport.forEach((item) => {
    console.log(`${item.text} ${item.filename}: ${item.exists ? "FOUND IN TARGET" : "MISSING IN TARGET"}`);
  });

  if (report.missingMappings.length) {
    console.log("\nMissing mappings:");
    report.missingMappings.forEach((item) => console.log(`- ${item.text}`));
  }

  if (report.addedIndexMappings.length) {
    console.log("\nAdded index mappings:");
    report.addedIndexMappings.forEach((item) => console.log(`- ${item.text} -> ${item.filename}`));
  }

  if (report.missingSvgFiles.length) {
    console.log("\nMissing SVG files:");
    report.missingSvgFiles.forEach((filename) => console.log(`- ${filename}`));
  }

  if (report.cloneFailed) {
    if (report.cloneError) {
      console.log("\nClone output:");
      console.log(report.cloneError);
    }
    printManualFallback();
  }
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv);
    const report = importAssets(args);
    printReport(report);
    if (report.missingMappings.length || report.missingSvgFiles.length || report.cloneFailed) process.exitCode = 1;
  } catch (error) {
    console.error(`\nNoto Emoji import failed: ${error.message}`);
    printManualFallback();
    process.exitCode = 1;
  }
}

module.exports = { importAssets };
