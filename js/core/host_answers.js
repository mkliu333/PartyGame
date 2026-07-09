window.PartyGame = window.PartyGame || {};
window.PartyGame.Core = window.PartyGame.Core || {};
window.PartyGame.Core.HostAnswers = window.PartyGame.Core.HostAnswers || {};

(function () {
  const HostAnswers = window.PartyGame.Core.HostAnswers;
  const HOST_ANSWERS_PAGE = "host_answers.html";
  const HOST_ANSWERS_TTL_MS = 2 * 60 * 60 * 1000;

  const runtime = {
    mobileBaseUrl: "",
    activeContinue: null,
    hasContinued: false,
    lastUrl: "",
    lastPayload: null
  };

  function getDefaultHostAnswersBaseUrl(targetPage = HOST_ANSWERS_PAGE) {
    return `${location.protocol}//${location.host}/${targetPage}`;
  }

  function normalizeTargetPage(targetPage) {
    return String(targetPage || HOST_ANSWERS_PAGE).replace(/^\/+/, "") || HOST_ANSWERS_PAGE;
  }

  function normalizeMobileBaseUrl(value, targetPage = HOST_ANSWERS_PAGE) {
    const page = normalizeTargetPage(targetPage);
    const raw = String(value || "").trim();
    if (!raw) return getDefaultHostAnswersBaseUrl(page);

    const defaultPort = location.port || "8000";
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `http://${raw}`;

    try {
      const parsed = new URL(withProtocol);
      parsed.hash = "";
      parsed.search = "";
      if (!["http:", "https:"].includes(parsed.protocol)) parsed.protocol = "http:";
      if (!parsed.port && parsed.hostname) parsed.port = defaultPort;
      parsed.pathname = `/${page}`;
      return parsed.toString();
    } catch (error) {
      return getDefaultHostAnswersBaseUrl(page);
    }
  }

  function encodeBase64Url(value) {
    const json = JSON.stringify(value);
    const utf8 = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, code) => (
      String.fromCharCode(parseInt(code, 16))
    ));
    return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function buildHostAnswersUrl(payload) {
    const baseUrl = normalizeMobileBaseUrl(runtime.mobileBaseUrl || "", HOST_ANSWERS_PAGE);
    return `${baseUrl}#payload=${encodeBase64Url(payload)}`;
  }

  function getGameTitle(gameId) {
    return window.PartyGame.Games?.getGameById?.(gameId)?.title || gameId || "聚会游戏";
  }

  function getCategoryLabelSafe(category) {
    try {
      return typeof getCategoryLabel === "function" ? getCategoryLabel(category) : category;
    } catch (error) {
      return category || "";
    }
  }

  function getMusicArtistLabel(track) {
    return window.PartyGame.Games?.musicCommon?.getMusicTrackArtistLabel?.(track) || track?.category || "";
  }

  function getMusicSegmentLabel(question) {
    if (!question?.segmentType) return "";
    return window.PartyGame.Games?.tripleMusic?.getSegmentType
      ? window.PartyGame.Games.musicCommon.getMusicSegmentTypeLabel(question.segmentType)
      : question.segmentType;
  }

  function buildLineGuessAnswer(question, index) {
    const categoryLabel = getCategoryLabelSafe(question.category);
    return {
      index,
      title: question.source || "猜台词",
      answer: question.answer || "暂无文字答案",
      meta: [categoryLabel, question.source].filter(Boolean).join(" / "),
      extra: [question.type === "image_line" ? "图片题" : "视频题"]
    };
  }

  function buildSingleMusicAnswer(question, index) {
    const track = question.tracks?.[0] || {};
    const modeLabel = window.PartyGame.Games?.singleMusic?.getPlaybackModeLabel?.() || "";
    return {
      index,
      title: getMusicArtistLabel(track) || "单曲猜歌",
      answer: track.answer || "暂无歌名",
      meta: ["单曲猜歌", getMusicArtistLabel(track)].filter(Boolean).join(" / "),
      extra: [modeLabel ? `播放方式：${modeLabel}` : ""].filter(Boolean)
    };
  }

  function buildTripleMusicAnswer(question, index) {
    const tracks = Array.isArray(question.tracks) ? question.tracks : [];
    const lines = tracks.map((track, trackIndex) => (
      `${trackIndex + 1}. ${track.answer || "未知歌名"} - ${getMusicArtistLabel(track) || "未知歌手"}`
    ));
    return {
      index,
      title: "三歌混播",
      answer: lines.join("\n"),
      meta: ["三歌混播", getCategoryLabelSafe(question.category), getMusicSegmentLabel(question)].filter(Boolean).join(" / "),
      extra: []
    };
  }

  function getEmojiClueTextSafe(clue) {
    if (typeof clue === "string") return clue;
    if (!clue || typeof clue !== "object") return "";
    return clue.text || clue.label || "";
  }

  function buildEmojiGuessAnswer(question, index) {
    const clues = Array.isArray(question.clues) ? question.clues.map(getEmojiClueTextSafe).filter(Boolean).join(" ") : "";
    return {
      index,
      title: clues || "Emoji 线索",
      answer: question.answer || "暂无答案",
      meta: [question.category, question.sub_category].filter(Boolean).join(" / "),
      extra: [question.hint ? `提示：${question.hint}` : ""].filter(Boolean)
    };
  }

  function buildWodiAnswers(round) {
    const roleLabels = window.PartyGame.Games?.WodiInternal?.WODI_ROLE_LABELS || {
      civilian: "平民",
      undercover: "卧底",
      blank: "白板"
    };
    const answers = [
      {
        index: 1,
        title: "本局词语",
        answer: `平民词：${round.goodWord || ""}\n卧底词：${round.undercoverWord || ""}`,
        meta: `白板：${round.assignments?.some((item) => item.role === "blank") ? "有" : "无"}`,
        extra: []
      }
    ];
    (round.assignments || []).forEach((assignment, index) => {
      answers.push({
        index: index + 2,
        title: assignment.name || `玩家 ${index + 1}`,
        answer: `${assignment.name || `玩家 ${index + 1}`} - ${roleLabels[assignment.role] || assignment.role || "未知"}`,
        meta: assignment.role === "blank" ? "词语：白板" : `词语：${assignment.word || ""}`,
        extra: []
      });
    });
    return answers;
  }

  function buildAnswersForCurrentRound() {
    if (state.activeGameId === "wodi") return buildWodiAnswers(state.wodiRound || {});
    const questions = Array.isArray(state.currentRoundQuestions) ? state.currentRoundQuestions : [];
    return questions.map((question, index) => {
      if (state.activeGameId === "single_music") return buildSingleMusicAnswer(question, index + 1);
      if (state.activeGameId === "triple_music") return buildTripleMusicAnswer(question, index + 1);
      if (state.activeGameId === "emoji_guess") return buildEmojiGuessAnswer(question, index + 1);
      return buildLineGuessAnswer(question, index + 1);
    });
  }

  function buildPayloadForCurrentRound() {
    const createdAt = Date.now();
    const gameId = state.activeGameId || "line_guess";
    return {
      type: "host_answers",
      appVersion: window.PartyGame.Config?.APP_VERSION || (typeof APP_VERSION === "undefined" ? "" : APP_VERSION),
      gameId,
      gameTitle: getGameTitle(gameId),
      roundId: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt,
      expiresAt: createdAt + HOST_ANSWERS_TTL_MS,
      answers: buildAnswersForCurrentRound()
    };
  }

  function getOverlayElements() {
    return {
      overlay: document.getElementById("hostAnswersQrOverlay"),
      qr: document.getElementById("hostAnswersQrCode"),
      url: document.getElementById("hostAnswersQrUrl"),
      base: document.getElementById("hostAnswersQrBaseUrl"),
      title: document.getElementById("hostAnswersQrTitle"),
      copy: document.getElementById("hostAnswersQrCopy"),
      primary: document.getElementById("hostAnswersQrContinue"),
      close: document.getElementById("hostAnswersQrClose")
    };
  }

  function renderQr(container, link) {
    container.replaceChildren();
    if (typeof QRCode !== "function") {
      container.textContent = "二维码库未加载，请复制下方链接。";
      return false;
    }
    try {
      new QRCode(container, {
        text: link,
        width: 260,
        height: 260,
        colorDark: "#111111",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel?.L ?? 1
      });
      return true;
    } catch (error) {
      console.warn("[HostAnswers] QR render failed:", error, { length: link.length });
      container.textContent = "二维码生成失败，请复制下方链接。";
      return false;
    }
  }

  function continueFromModal() {
    const { overlay } = getOverlayElements();
    overlay?.classList.remove("show");
    if (runtime.hasContinued) return;
    runtime.hasContinued = true;
    const callback = runtime.activeContinue;
    runtime.activeContinue = null;
    if (typeof callback === "function") callback();
  }

  function showHostAnswersQr(payload, options = {}) {
    const els = getOverlayElements();
    if (!els.overlay || !els.qr || !els.url || !els.base || !els.primary || !els.close) {
      console.warn("[HostAnswers] QR modal elements are missing.");
      return false;
    }

    const link = buildHostAnswersUrl(payload);
    runtime.lastUrl = link;
    runtime.lastPayload = payload;
    runtime.activeContinue = typeof options.onContinue === "function" ? options.onContinue : null;
    runtime.hasContinued = false;

    els.title.textContent = "主持人答案二维码";
    els.copy.textContent = state.activeGameId === "wodi"
      ? "请主持人扫码保存本局词语和身份分配，玩家请勿查看。"
      : "请主持人扫码保存本轮答案顺序，玩家请勿查看。";
    els.primary.textContent = options.continueLabel || (state.activeGameId === "wodi" ? "已扫码，继续发身份" : "已扫码，开始游戏");
    els.base.textContent = normalizeMobileBaseUrl(runtime.mobileBaseUrl || "", HOST_ANSWERS_PAGE);
    els.url.value = link;
    renderQr(els.qr, link);
    els.overlay.classList.add("show");
    return true;
  }

  function showForCurrentRound(options = {}) {
    try {
      const payload = buildPayloadForCurrentRound();
      if (!payload.answers.length) return false;
      return showHostAnswersQr(payload, options);
    } catch (error) {
      console.warn("[HostAnswers] Cannot build host answers QR:", error);
      return false;
    }
  }

  function bindHomeInput() {
    const input = document.getElementById("mobileBaseUrlInput");
    if (!input) return;
    runtime.mobileBaseUrl = getDefaultHostAnswersBaseUrl();
    input.value = runtime.mobileBaseUrl;
    input.addEventListener("input", () => {
      runtime.mobileBaseUrl = input.value.trim();
    });
    input.addEventListener("blur", () => {
      runtime.mobileBaseUrl = normalizeMobileBaseUrl(input.value, HOST_ANSWERS_PAGE);
      input.value = runtime.mobileBaseUrl;
    });
  }

  function bindModal() {
    const { primary, close } = getOverlayElements();
    primary?.addEventListener("click", continueFromModal);
    close?.addEventListener("click", continueFromModal);
  }

  function init() {
    bindHomeInput();
    bindModal();
  }

  Object.assign(HostAnswers, {
    runtime,
    getDefaultHostAnswersBaseUrl,
    normalizeMobileBaseUrl,
    encodeBase64Url,
    buildPayloadForCurrentRound,
    buildHostAnswersUrl,
    showForCurrentRound,
    init
  });
}());
