window.PartyGame = window.PartyGame || {};
window.PartyGame.Core = window.PartyGame.Core || {};

    let birthdaySongAudio = null;
    let birthdaySongErrorShown = false;

    function handleBirthdaySongError() {
      if (!birthdaySongErrorShown) {
        showToast("生日歌暂时无法播放，请检查 assets/birthday_song/Birthday.mp3");
        birthdaySongErrorShown = true;
      }
      if (elements.birthdaySongToggle) {
        elements.birthdaySongToggle.classList.remove("playing");
        elements.birthdaySongToggle.setAttribute("aria-pressed", "false");
      }
    }

    function getBirthdaySongAudio() {
      if (birthdaySongAudio) return birthdaySongAudio;
      birthdaySongAudio = new Audio("assets/birthday_song/Birthday.mp3");
      birthdaySongAudio.loop = true;
      birthdaySongAudio.addEventListener("error", handleBirthdaySongError);
      return birthdaySongAudio;
    }

    function toggleBirthdaySong() {
      const audio = getBirthdaySongAudio();
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        elements.birthdaySongToggle.classList.remove("playing");
        elements.birthdaySongToggle.setAttribute("aria-pressed", "false");
        return;
      }
      birthdaySongErrorShown = false;
      audio.currentTime = 0;
      audio.play().then(() => {
        elements.birthdaySongToggle.classList.add("playing");
        elements.birthdaySongToggle.setAttribute("aria-pressed", "true");
      }).catch(handleBirthdaySongError);
    }

    async function mediaExists(path) {
      if (!path) return false;
      if (location.protocol === "file:") return null;
      try {
        const head = await fetch(path, { method: "HEAD" });
        if (head.ok) return true;
        if (head.status === 404) return false;
        const response = await fetch(path);
        return response.ok;
      } catch (error) {
        console.warn("Media check skipped:", path, error);
        return null;
      }
    }

    function getCurrentQuestion() {
      return state.currentRoundQuestions[state.currentQuestionIndex] || null;
    }

    function resetQuestionFlowState() {
      if (typeof stopActiveGameMedia === "function") stopActiveGameMedia();
      state.phase = "prompt";
      state.textAnswerVisible = false;
      state.emojiHintVisible = false;
      clearCurrentQuestionScoringState();
    }

    function isImageQuestion(question) {
      return question?.type === "image_line";
    }

    function setEmptyGameplayState() {
      elements.mediaCard.classList.add("empty");
      elements.mediaCard.classList.remove("image-mode", "audio-mode", "emoji-mode");
      elements.clip.removeAttribute("src");
      elements.questionImage.removeAttribute("src");
      elements.questionTitle.textContent = "本轮暂无题目";
      elements.questionMeta.textContent = "请返回设置本轮题目";
      elements.answerState.textContent = "等待新一轮";
      elements.answerText.textContent = "当前没有可播放题目，请重新设置本轮或重置题库。";
      elements.playPrompt.disabled = true;
      elements.revealAnswer.disabled = true;
      elements.toggleAnswerText.classList.remove("show");
      elements.confirmScore.hidden = true;
    }

    function renderQuestionMedia(question) {
      elements.mediaCard.classList.remove("empty", "image-mode", "audio-mode", "emoji-mode");
      $(".triple-music-panel", elements.mediaCard)?.remove();
      $(".emoji-clue-panel", elements.mediaCard)?.remove();
      elements.clip.pause();
      elements.clip.removeAttribute("src");
      elements.questionImage.removeAttribute("src");

      if (isImageQuestion(question) && state.phase !== "revealed") {
        elements.mediaCard.classList.add("image-mode");
        if (question.image) {
          elements.questionImage.src = question.image;
          elements.questionImage.alt = `${question.source} 题目图片`;
        } else {
          elements.mediaCard.classList.add("empty");
        }
        return;
      }

      const clipSrc = state.phase === "revealed" ? question.answer_clip : question.prompt_clip;
      if (clipSrc) {
        elements.clip.src = clipSrc;
        elements.clip.load();
      } else if (isImageQuestion(question) && question.image) {
        elements.mediaCard.classList.add("image-mode");
        elements.questionImage.src = question.image;
        elements.questionImage.alt = `${question.source} 题目图片`;
      } else {
        elements.mediaCard.classList.add("empty");
      }
    }

    function renderAnswerPanel() {
      const question = getCurrentQuestion();
      if (!question) return;
      elements.answerState.textContent = state.phase === "revealed" ? "答案已揭晓" : "答案未揭晓";
      elements.answerText.textContent = state.textAnswerVisible
        ? `正确答案：${question.answer || "暂无文字答案，请以答案片段为准"}`
        : "先播放题目片段，大家抢答后再揭晓答案视频。";
      elements.toggleAnswerText.classList.toggle("show", state.phase === "revealed");
    }

    function renderQuestionFooter(question) {
      elements.questionTitle.textContent = `第 ${state.currentQuestionIndex + 1} / ${state.currentRoundQuestions.length} 题`;
      elements.questionMeta.textContent = `${getCategoryLabel(question.category)} · ${question.source}`;
    }

    function renderStageControls() {
      const isPrompt = state.phase === "prompt";
      const isRevealed = state.phase === "revealed";
      elements.playPrompt.textContent = "播放题目";
      elements.revealAnswer.textContent = "揭晓答案";
      elements.playPrompt.disabled = !isPrompt;
      elements.revealAnswer.disabled = !isPrompt;
      elements.playPrompt.className = isPrompt ? "primary-btn stage-current" : "ghost-btn stage-disabled";
      elements.revealAnswer.className = isRevealed ? "primary-btn stage-current" : "ghost-btn";
    }

    function handleMediaLoadError() {
      if (isMusicGameActive()) return;
      const question = getCurrentQuestion();
      if (!question) return;
      if (state.phase === "revealed" && elements.clip.currentSrc.includes(question.answer_clip || "__missing__")) {
        console.warn("Answer media unreadable, keeping revealed question active:", question);
        elements.clip.removeAttribute("src");
        if (!state.textAnswerVisible) {
          elements.answerText.textContent = "答案片段暂时无法读取，请点击翻看文字答案后继续计分。";
        } else {
          renderAnswerPanel();
        }
        return;
      }
      console.warn("Skipping question with unreadable media:", question);
      state.skippedQuestionIds.add(question.id);
      state.currentRoundQuestions.splice(state.currentQuestionIndex, 1);
      showToast("当前素材无法读取，已自动跳过");

      if (!state.currentRoundQuestions.length) {
        setEmptyGameplayState();
        switchScreen("round");
        showRoundError("本轮素材无法读取，请返回设置题目重新抽取");
        return;
      }

      if (state.currentQuestionIndex >= state.currentRoundQuestions.length) {
        state.phase = "finished";
        settleCurrentRound();
        return;
      }

      resetQuestionFlowState();
      renderGameplay();
    }

    function stopActiveGameMedia() {
      elements.clip.pause();
      elements.clip.removeAttribute("src");
      if (window.PartyGame.Games.tripleMusic) {
        window.PartyGame.Games.tripleMusic.stopAllAudio();
      }
      if (window.PartyGame.Games.singleMusic) {
        window.PartyGame.Games.singleMusic.stopAllAudio();
      }
    }

Object.assign(window.PartyGame.Core, { toggleBirthdaySong, mediaExists, getCurrentQuestion, resetQuestionFlowState, isImageQuestion, setEmptyGameplayState, renderQuestionMedia, renderAnswerPanel, renderQuestionFooter, renderStageControls, handleMediaLoadError, stopActiveGameMedia });
