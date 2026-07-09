window.PartyGame = window.PartyGame || {};
window.PartyGame.Core = window.PartyGame.Core || {};
window.PartyGame.Core.HostAnswers = window.PartyGame.Core.HostAnswers || {};

(function () {
  const HostAnswers = window.PartyGame.Core.HostAnswers;
  const HOST_ANSWERS_PAGE = "host_answers.html";
  const HOST_ANSWERS_TTL_MS = 2 * 60 * 60 * 1000;

  const runtime = {
    mobileHost: "",
    activeContinue: null,
    hasContinued: false,
    lastUrl: "",
    lastPayload: null
  };

  function normalizeTargetPage(targetPage) {
    return String(targetPage || HOST_ANSWERS_PAGE).replace(/^\/+/, "") || HOST_ANSWERS_PAGE;
  }

  function normalizeHostInput(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `http://${raw}`;

    try {
      const parsed = new URL(withProtocol);
      if (!parsed.hostname) return raw.replace(/[/?#].*$/, "");
      return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    } catch (error) {
      return raw.replace(/[/?#].*$/, "");
    }
  }

  function getCurrentMobileHost() {
    return runtime.mobileHost || location.host || "localhost:8000";
  }

  function buildMobilePageUrl(targetPage = HOST_ANSWERS_PAGE) {
    const page = normalizeTargetPage(targetPage);
    const hostInput = normalizeHostInput(getCurrentMobileHost()) || "localhost";
    const hasPort = /:\d+$/.test(hostInput);
    const hostWithPort = hasPort ? hostInput : `${hostInput}:${location.port || "8000"}`;
    const protocol = location.protocol === "http:" || location.protocol === "https:" ? location.protocol : "http:";
    return `${protocol}//${hostWithPort}/${page}`;
  }

  function getDefaultHostAnswersBaseUrl(targetPage = HOST_ANSWERS_PAGE) {
    return buildMobilePageUrl(targetPage);
  }

  function normalizeMobileBaseUrl(value, targetPage = HOST_ANSWERS_PAGE) {
    const previousHost = runtime.mobileHost;
    const normalizedHost = normalizeHostInput(value);
    if (normalizedHost) runtime.mobileHost = normalizedHost;
    const url = buildMobilePageUrl(targetPage);
    runtime.mobileHost = previousHost;
    return url;
  }

  function encodeBase64Url(value) {
    const json = JSON.stringify(value);
    const utf8 = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, code) => (
      String.fromCharCode(parseInt(code, 16))
    ));
    return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function buildHostAnswersUrl(payload) {
    const baseUrl = buildMobilePageUrl(HOST_ANSWERS_PAGE);
    return `${baseUrl}#p=${encodeBase64Url(payload)}`;
  }

  function getWodiIdentityBaseUrlFromMobileHost() {
    return buildMobilePageUrl("wodi_identity.html");
  }

  function syncWodiIdentityBaseUrlFromHostAnswers() {
    const url = getWodiIdentityBaseUrlFromMobileHost();
    const wodi = window.PartyGame.Games?.wodi;
    if (wodi?.getIdentityBaseUrl?.() === url) return;
    if (typeof wodi?.setIdentityBaseUrl === "function") wodi.setIdentityBaseUrl(url);
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

  function getGamePayloadType(gameId) {
    if (gameId === "single_music") return "single";
    if (gameId === "triple_music") return "triple";
    if (gameId === "emoji_guess") return "emoji";
    if (gameId === "wodi") return "wodi";
    return "script";
  }

  function buildLineGuessAnswer(question) {
    return question?.answer || "暂无答案";
  }

  function compactTrackAnswer(track) {
    const answer = track?.answer || "暂无歌名";
    const artist = getMusicArtistLabel(track);
    return artist ? `${answer} - ${artist}` : answer;
  }

  function buildSingleMusicAnswer(question) {
    return compactTrackAnswer(question?.tracks?.[0] || question?.track || {});
  }

  function buildTripleMusicAnswer(question) {
    const tracks = Array.isArray(question?.tracks) ? question.tracks : [];
    return tracks.map(compactTrackAnswer).join(" / ") || "暂无答案";
  }

  function buildEmojiGuessAnswer(question) {
    return question?.answer || "暂无答案";
  }

  function buildCompactWodiPayload(round) {
    const roleLabels = window.PartyGame.Games?.WodiInternal?.WODI_ROLE_LABELS || {
      civilian: "平民",
      undercover: "卧底",
      blank: "白板"
    };
    const assignments = Array.isArray(round.assignments) ? round.assignments : [];
    const hasBlank = assignments.some((item) => item.role === "blank");
    return {
      t: "wodi",
      c: [round.goodWord || "", round.undercoverWord || "", hasBlank ? "白板" : ""],
      p: assignments.map((assignment) => [
        assignment.name || "",
        roleLabels[assignment.role] || assignment.role || "未知"
      ])
    };
  }

  function buildRoundAnswerList(gameId) {
    const questions = Array.isArray(state.currentRoundQuestions) ? state.currentRoundQuestions : [];
    return questions.map((question) => {
      if (gameId === "single_music") return buildSingleMusicAnswer(question);
      if (gameId === "triple_music") return buildTripleMusicAnswer(question);
      if (gameId === "emoji_guess") return buildEmojiGuessAnswer(question);
      return buildLineGuessAnswer(question);
    });
  }

  function buildPayloadForCurrentRound() {
    const gameId = state.activeGameId || "line_guess";
    if (gameId === "wodi") return buildCompactWodiPayload(state.wodiRound || {});
    return {
      t: getGamePayloadType(gameId),
      r: buildRoundAnswerList(gameId)
    };
  }

  function getOverlayElements() {
    return {
      overlay: document.getElementById("hostAnswersQrOverlay"),
      qr: document.getElementById("hostAnswersQrCode"),
      copy: document.getElementById("hostAnswersQrCopy"),
      primary: document.getElementById("hostAnswersQrContinue")
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
        width: 320,
        height: 320,
        colorDark: "#000000",
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
    if (!els.overlay || !els.qr || !els.primary) {
      console.warn("[HostAnswers] QR modal elements are missing.");
      return false;
    }

    const link = buildHostAnswersUrl(payload);
    runtime.lastUrl = link;
    runtime.lastPayload = payload;
    runtime.activeContinue = typeof options.onContinue === "function" ? options.onContinue : null;
    runtime.hasContinued = false;

    els.copy.textContent = "请主持人扫码查看答案，玩家请勿扫码";
    els.primary.textContent = options.continueLabel || (state.activeGameId === "wodi" ? "已扫码，继续发身份" : "已扫码，开始游戏");
    renderQr(els.qr, link);
    els.overlay.classList.add("show");
    return true;
  }

  function showForCurrentRound(options = {}) {
    try {
      const payload = buildPayloadForCurrentRound();
      console.info("[HostAnswers] showForCurrentRound", {
        type: payload.t,
        answersCount: Array.isArray(payload.r) ? payload.r.length : Array.isArray(payload.p) ? payload.p.length : 0,
        modalFound: Boolean(document.getElementById("hostAnswersQrOverlay"))
      });
      if (payload.t !== "wodi" && (!Array.isArray(payload.r) || !payload.r.length)) {
        payload.r = ["暂无答案"];
      }
      return showHostAnswersQr(payload, options);
    } catch (error) {
      console.warn("[HostAnswers] Cannot build host answers QR:", error);
      return false;
    }
  }

  function bindHomeInput() {
    const input = document.getElementById("mobileBaseUrlInput");
    if (!input) return;
    const initialHost = location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? ""
      : location.hostname;
    runtime.mobileHost = normalizeHostInput(runtime.mobileHost || initialHost);
    input.value = runtime.mobileHost;
    syncWodiIdentityBaseUrlFromHostAnswers();
    input.addEventListener("input", () => {
      runtime.mobileHost = normalizeHostInput(input.value);
      syncWodiIdentityBaseUrlFromHostAnswers();
    });
    input.addEventListener("blur", () => {
      runtime.mobileHost = normalizeHostInput(input.value);
      input.value = runtime.mobileHost;
      syncWodiIdentityBaseUrlFromHostAnswers();
    });
  }

  function bindModal() {
    const { primary } = getOverlayElements();
    primary?.addEventListener("click", continueFromModal);
  }

  function init() {
    bindHomeInput();
    bindModal();
  }

  Object.assign(HostAnswers, {
    runtime,
    normalizeHostInput,
    getCurrentMobileHost,
    buildMobilePageUrl,
    getWodiIdentityBaseUrlFromMobileHost,
    syncWodiIdentityBaseUrlFromHostAnswers,
    getDefaultHostAnswersBaseUrl,
    normalizeMobileBaseUrl,
    encodeBase64Url,
    buildPayloadForCurrentRound,
    buildHostAnswersUrl,
    showForCurrentRound,
    init
  });
}());
