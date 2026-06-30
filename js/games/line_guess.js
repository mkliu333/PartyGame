window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};

    function normalizeQuestion(question) {
      const safe = question || {};
      return {
        id: normalizeQuestionId(safe.id),
        type: normalizeQuestionType(safe.type),
        category: normalizeCodeField(safe.category),
        source: normalizeField(safe.source),
        answer: normalizeField(safe.answer),
        image: normalizeField(safe.image),
        prompt_clip: normalizeField(safe.prompt_clip),
        answer_clip: normalizeField(safe.answer_clip)
      };
    }

    function hasExpectedQuestionShape(question) {
      return question && typeof question === "object" && !Array.isArray(question);
    }

    function validateQuestion(question) {
      const errors = [];
      const warnings = [];
      const validCategories = CATEGORY_CONFIG.map((category) => category.id);
      const validTypes = ["next_line", "image_line"];

      if (!question.id) errors.push("缺少 ID");
      if (!question.type || !validTypes.includes(question.type)) errors.push("题型无效");
      if (!validCategories.includes(question.category)) errors.push("分类无效");
      if (!question.source) errors.push("缺少 Source");
      if (question.type === "next_line" && !question.prompt_clip) errors.push("缺少 Prompt_clip");
      if (question.type === "image_line" && !question.image) errors.push("缺少 Image");
      if (question.type === "next_line" && question.prompt_clip && !question.prompt_clip.startsWith("assets/")) warnings.push(`路径可能异常：${question.prompt_clip}`);
      if (question.type === "image_line" && question.image && !question.image.startsWith("assets/")) warnings.push(`路径可能异常：${question.image}`);
      if (question.answer_clip && !question.answer_clip.startsWith("assets/")) warnings.push(`路径可能异常：${question.answer_clip}`);
      if (!question.answer_clip) errors.push("缺少 Answer_clip");
      if (!question.answer) errors.push("缺少 Answer");

      return { valid: errors.length === 0, errors, warnings };
    }

    async function runQuestionPreflight(questionBank) {
      const validQuestions = [];
      const invalidQuestions = [];
      const warnings = [];
      const issues = [];
      const seenIds = new Set();

      for (const rawQuestion of questionBank) {
        if (!hasExpectedQuestionShape(rawQuestion)) {
          invalidQuestions.push({ question: rawQuestion, errors: ["题目格式不是对象"] });
          issues.push("未知题目：题目格式不是对象");
          continue;
        }
        const question = normalizeQuestion(rawQuestion);
        if (question.id && seenIds.has(question.id)) {
          const message = `重复 ID：${question.id}，已跳过后续重复题目`;
          invalidQuestions.push({ question, errors: [message] });
          issues.push(`${question.id}: ${message}`);
          console.warn(message);
          continue;
        }
        if (question.id) seenIds.add(question.id);
        const result = validateQuestion(question);
        if (!result.valid) {
          invalidQuestions.push({ question, errors: result.errors });
          result.errors.forEach((error) => issues.push(`${question.id || "未知题目"}: ${error}`));
          continue;
        }

        const requiredMedia = question.type === "image_line" ? question.image : question.prompt_clip;
        const exists = await mediaExists(requiredMedia);
        if (exists === false) {
          invalidQuestions.push({ question, errors: [`素材无法读取：${requiredMedia}`] });
          issues.push(`${question.id}: 素材无法读取：${requiredMedia}`);
          continue;
        }

        if (exists === null) warnings.push(`无法预检查素材，已允许进入题库：${question.id}`);
        result.warnings.forEach((warning) => {
          const message = `${question.id}: ${warning}`;
          warnings.push(message);
          issues.push(message);
        });
        validQuestions.push(question);
      }

      return { validQuestions, invalidQuestions, warnings, issues };
    }

    function getExternalQuestionBank() {
      return Array.isArray(window.PARTY_QUESTIONS) ? window.PARTY_QUESTIONS : [];
    }

    function hasExternalQuestionBank() {
      return getExternalQuestionBank().length > 0;
    }

    function countInvalidError(invalidQuestions, target) {
      return invalidQuestions.filter((item) => item.errors.includes(target)).length;
    }

    async function loadQuestionBank() {
      const externalQuestions = getExternalQuestionBank();
      let source = "script_guess/questions_v3.js";
      let rawQuestions = externalQuestions;

      if (externalQuestions.length) {
        console.info("Question bank loaded from script_guess/questions_v3.js:", externalQuestions.length);
      } else {
        source = "内置备用";
        rawQuestions = [...BUILT_IN_QUESTIONS];
        console.warn("window.PARTY_QUESTIONS not found. Using built-in fallback question bank.");
      }
      const preflight = await runQuestionPreflight(rawQuestions);
      if (preflight.invalidQuestions.length) console.warn("Skipped invalid questions:", preflight.invalidQuestions);
      if (preflight.warnings.length) console.warn("Question preflight warnings:", preflight.warnings);
      state.questionBank = preflight.validQuestions;
      state.questionBankSource = source;
      state.preflight = {
        loaded: preflight.validQuestions.length,
        skipped: preflight.invalidQuestions.length,
        warnings: preflight.warnings,
        issues: preflight.issues
      };
      state.preflightSummary = {
        missingAnswer: countInvalidError(preflight.invalidQuestions, "缺少 Answer"),
        missingAnswerClip: countInvalidError(preflight.invalidQuestions, "缺少 Answer_clip"),
        invalidCount: preflight.invalidQuestions.length
      };
      updateCategoryStatsDisplay();
    }

    function renderGameplay() {
      if (isEmojiGuessActive()) {
        window.PartyGame.Games.emojiGuess.renderGameplay();
        return;
      }
      if (isWodiActive()) {
        window.PartyGame.Games.wodi.renderGameplay();
        return;
      }
      const musicGame = isMusicGameActive() ? getActiveMusicGame() : null;
      if (musicGame) {
        musicGame.renderGameplay();
        return;
      }
      const question = getCurrentQuestion();
      if (!question) {
        setEmptyGameplayState();
        return;
      }

      renderQuestionMedia(question);
      renderQuestionFooter(question);
      renderAnswerPanel();
      renderStageControls();
      renderScoreboard();
    }

    function revealAnswer() {
      if (isEmojiGuessActive()) {
        window.PartyGame.Games.emojiGuess.revealAnswer();
        return;
      }
      if (isWodiActive()) return;
      const musicGame = isMusicGameActive() ? getActiveMusicGame() : null;
      if (musicGame) {
        musicGame.revealAnswer();
        return;
      }
      const question = getCurrentQuestion();
      if (!question || state.phase !== "prompt") return;
      state.phase = "revealed";
      renderGameplay();
    }

    function toggleAnswerText() {
      if (isEmojiGuessActive()) return;
      if (isWodiActive()) return;
      const musicGame = isMusicGameActive() ? getActiveMusicGame() : null;
      if (musicGame) {
        musicGame.toggleAnswerText();
        return;
      }
      if (state.phase !== "revealed") return;
      state.textAnswerVisible = !state.textAnswerVisible;
      renderAnswerPanel();
    }

window.PartyGame.Games.lineGuess = { id: "line_guess", normalizeQuestion, validateQuestion, loadQuestionBank, renderGameplay, revealAnswer, toggleAnswerText };

