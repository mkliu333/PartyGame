window.PartyGame = window.PartyGame || {};
window.PartyGame.Core = window.PartyGame.Core || {};

    function switchScreen(screen) {
      if (typeof stopActiveGameMedia === "function") stopActiveGameMedia();
      state.screen = screen;
      elements.screens.forEach((node) => node.classList.toggle("active", node.id === screen));
      clearValidationError(elements.setupError);
      clearRoundMessages();

      if (screen === "setup") {
        if (isWodiActive()) state.mode = "single";
        updateModeCopy();
        renderParticipants();
      }

      if (screen === "round") {
        if (isWodiActive()) {
          window.PartyGame.Games.wodi.renderSetupOptions();
          updateTopbarActions();
          window.PartyGame.Core.BackgroundAudio?.sync();
          return;
        }
        renderRoundOptions();
        updateCategoryStatsDisplay();
        renderTotalScores();
      }

      if (screen === "play") {
        clearRoundMessages();
        renderGameplay();
      }
      updateTopbarActions();
      window.PartyGame.Core.BackgroundAudio?.sync();
    }

    function updateTopbarActions() {
      const overlayOpen = elements.roundResultOverlay.classList.contains("show")
        || elements.finalResultOverlay.classList.contains("show")
        || elements.exitConfirmOverlay.classList.contains("show");
      elements.resetAllGames.hidden = state.screen === "play" || overlayOpen;
    }

    function showExitGameConfirmation() {
      elements.exitConfirmOverlay.classList.add("show");
      updateTopbarActions();
    }

    function closeExitGameConfirmation() {
      elements.exitConfirmOverlay.classList.remove("show");
      updateTopbarActions();
      window.PartyGame.Core.BackgroundAudio?.sync();
    }

    function requestReturnHome() {
      if (isActiveRoundUnfinished()) {
        showExitGameConfirmation();
        return;
      }
      switchScreen("home");
    }

    function confirmActiveGameExit() {
      elements.exitConfirmOverlay.classList.remove("show");
      elements.roundResultOverlay.classList.remove("show");
      elements.finalResultOverlay.classList.remove("show");
      rollbackActiveRound();
      switchScreen("home");
    }

    function updateSelectedMode(mode) {
      state.mode = mode;
      state.editingParticipantId = null;
      state.selectedAvatarId = AVATAR_LIBRARY[0].id;
      elements.participantName.value = "";
      setSelectedByDataAttribute(".pill-btn", "mode", mode);
      updateModeCopy();
      renderAvatars();
      renderParticipants();
    }

    function renderRoundOptions() {
      $(".round-main")?.classList.remove("wodi-round-main");
      const musicGame = isMusicGameActive() ? getActiveMusicGame() : null;
      const emojiGame = isEmojiGuessActive() ? window.PartyGame.Games.emojiGuess : null;
      const wodiGame = isWodiActive() ? window.PartyGame.Games.wodi : null;
      const activeConfiguredGame = musicGame || emojiGame;
      if (wodiGame) {
        wodiGame.renderSetupOptions();
        return;
      }
      const roundConfig = activeConfiguredGame
        ? activeConfiguredGame.getRoundConfig()
        : {
          title: "设置本轮题目",
          subtitle: "选择本轮题量和题库范围。已抽过的题目会暂时从题库里拿走，避免连续重复。",
          stockTitle: "题库库存",
          sizes: ROUND_SIZE_OPTIONS,
          categories: [{ id: "all", label: "大合集" }, ...CATEGORY_CONFIG]
        };
      $(".round-main .section-title").textContent = roundConfig.title;
      $(".round-main .section-subtitle").textContent = roundConfig.subtitle;
      $(".round-stock h2").textContent = roundConfig.stockTitle;
      elements.roundSecondaryAction.textContent = state.hasStartedAnyRound ? "结束游戏并结算" : "返回分组";
      $("#roundSizeOptions").innerHTML = roundConfig.sizes.map((option) => `
        <button class="option-btn ${String(option) === String(state.roundSize) ? "selected" : ""}" type="button" data-round-size="${option}">${option}</button>
      `).join("");
      $("#roundCategoryOptions").classList.toggle("music-category-select-wrap", Boolean(musicGame));
      $("#roundCategoryOptions").innerHTML = musicGame
        ? `<label class="music-category-field">
            <span>题库分类</span>
            <select id="musicCategorySelect" aria-label="题库分类">
              ${roundConfig.categories.map((category) => `<option value="${escapeHTML(category.id)}" ${String(category.id) === String(state.selectedCategory) ? "selected" : ""}>${escapeHTML(category.label)}</option>`).join("")}
            </select>
          </label>`
        : roundConfig.categories.map((category) => `
            <button class="option-btn ${String(category.id) === String(state.selectedCategory) ? "selected" : ""}" type="button" data-round-category="${escapeHTML(category.id)}">${escapeHTML(category.label)}</button>
          `).join("");
      if (elements.roundExtraOptions) {
        elements.roundExtraOptions.innerHTML = "";
        if (
          isSingleMusicActive()
          && window.PartyGame.Games.singleMusic
          && typeof window.PartyGame.Games.singleMusic.renderExtraRoundOptions === "function"
        ) {
          window.PartyGame.Games.singleMusic.renderExtraRoundOptions(elements.roundExtraOptions);
        }
      } else {
        console.warn("[PartyGame] Cannot render round extra options: #roundExtraOptions missing.");
      }
      setSelectedByDataAttribute("[data-round-size]", "roundSize", state.roundSize);
      if (!musicGame) setSelectedByDataAttribute("[data-round-category]", "roundCategory", state.selectedCategory);
    }

Object.assign(window.PartyGame.Core, { switchScreen, updateTopbarActions, showExitGameConfirmation, closeExitGameConfirmation, requestReturnHome, confirmActiveGameExit, updateSelectedMode, renderRoundOptions });
