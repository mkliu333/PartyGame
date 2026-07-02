window.PartyGame = window.PartyGame || {};
window.PartyGame.Games = window.PartyGame.Games || {};
window.PartyGame.Games.WodiInternal = window.PartyGame.Games.WodiInternal || {};

function encodeBase64Url(value) {
  const json = JSON.stringify(value);
  const utf8 = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) => (
    String.fromCharCode(parseInt(p1, 16))
  ));
  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getDefaultWodiIdentityBaseUrl() {
  const path = `${location.protocol}//${location.host}/wodi_identity.html`;
  return path;
}

function getWodiIdentityBaseUrl() {
  if (!wodiRuntime.identityBaseUrl) wodiRuntime.identityBaseUrl = getDefaultWodiIdentityBaseUrl();
  return wodiRuntime.identityBaseUrl;
}

function setWodiIdentityBaseUrl(value) {
  wodiRuntime.identityBaseUrl = String(value || "").trim() || getDefaultWodiIdentityBaseUrl();
  if (state.wodiRound?.status === "assigning") renderWodiGameplay();
}

function updateWodiIdentityBaseUrl(value) {
  wodiRuntime.identityBaseUrl = String(value || "").trim() || getDefaultWodiIdentityBaseUrl();
  const round = state.wodiRound;
  const assignment = round?.assignments?.[round.revealIndex];
  const container = $("#wodiQrCard");
  if (assignment && container) renderWodiQRCode(container, assignment);
  const warning = $("#wodiMobileUrlWarning");
  if (warning) warning.hidden = !isWodiIdentityBaseUrlLocalhost();
}

function isWodiIdentityBaseUrlLocalhost() {
  try {
    const parsed = new URL(getWodiIdentityBaseUrl(), location.href);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch (error) {
    return false;
  }
}

function buildWodiIdentityPayload(assignment) {
  return {
    playerName: assignment.name,
    role: assignment.role,
    word: assignment.word,
    revealRole: Boolean(state.wodiRevealRole),
    roundTitle: "\u8c01\u662f\u5367\u5e95"
  };
}

function buildWodiIdentityUrl(assignment) {
  const payload = buildWodiIdentityPayload(assignment);
  const baseUrl = getWodiIdentityBaseUrl();
  const separator = baseUrl.includes("#") ? "&" : "#";
  return `${baseUrl}${separator}payload=${encodeBase64Url(payload)}`;
}

function renderWodiQRFallback(container, link) {
  const fallback = document.createElement("textarea");
  fallback.className = "wodi-fallback-link show";
  fallback.readOnly = true;
  fallback.value = link;
  container.appendChild(fallback);
}

function renderWodiQRCode(container, assignment) {
  const link = buildWodiIdentityUrl(assignment);
  container.replaceChildren();
  if (typeof QRCode !== "function") {
    console.error("[Wodi] QRCode global is missing. Check vendor/qrcode.min.js load order.");
    container.innerHTML = `<div class="error-message show">\u4e8c\u7ef4\u7801\u5e93\u672a\u52a0\u8f7d\uff0c\u8bf7\u68c0\u67e5 vendor/qrcode.min.js</div>`;
    renderWodiQRFallback(container, link);
    return;
  }

  try {
    // QR strategy: encode only a short static-page URL plus base64url JSON hash.
    // This is easier for iPhone Camera and scanner apps than dense data URLs.
    new QRCode(container, {
      text: link,
      width: 240,
      height: 240,
      colorDark: "#111111",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel?.L ?? 1
    });
  } catch (error) {
    console.error("[Wodi] QR render failed:", error, { payloadLength: link.length });
    container.innerHTML = `<div class="error-message show">\u4e8c\u7ef4\u7801\u751f\u6210\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u624b\u673a\u8bbf\u95ee\u5730\u5740\u3002</div>`;
    renderWodiQRFallback(container, link);
  }
}

function renderWodiSpeechTips() {
  const revealRole = Boolean(state.wodiRevealRole);
  const tips = revealRole ? [
    "\u597d\u5427\uff01\u4f60\u4eec\u5404\u81ea\u77e5\u9053\u81ea\u5df1\u7684\u8eab\u4efd\uff0c\u5367\u5e95\u548c\u767d\u677f\u8bf7\u597d\u597d\u4f2a\u88c5\uff0c\u5e73\u6c11\u8bf7\u6316\u51fa\u85cf\u5728\u4f60\u4eec\u8eab\u8fb9\u7684\u574f\u4eba\uff01",
    "\u672c\u6e38\u620f\u9f13\u52b1\u8111\u6d1e\u53d1\u8a00\uff0c\u4e5f\u5141\u8bb8\u9002\u5ea6\u778e\u626f\uff0c\u4f46\u4e0d\u5141\u8bb8\u8bf4\u8c0e\u3002\u80fd\u5706\u56de\u6765\u7684\u53eb\u778e\u626f\uff0c\u5706\u4e0d\u56de\u6765\u7684\u53eb\u8bf4\u8c0e\u3002"
  ] : [
    "\u672c\u5c40\u4e0d\u4f1a\u544a\u8bc9\u4f60\u81ea\u5df1\u662f\u597d\u4eba\u3001\u5367\u5e95\u8fd8\u662f\u767d\u677f\u3002\u8bf7\u4ece\u6a21\u7cca\u3001\u6666\u6da9\u3001\u80fd\u5706\u56de\u6765\u7684\u63cf\u8ff0\u5f00\u59cb\uff0c\u4e0d\u8981\u4e00\u4e0a\u6765\u628a\u8bcd\u8bf4\u6b7b\u3002",
    "\u5982\u679c\u4f60\u542c\u5230\u548c\u81ea\u5df1\u5b8c\u5168\u4e0d\u4e00\u6837\u7684\u63cf\u8ff0\uff0c\u5148\u522b\u6025\u3002\u4e5f\u8bb8\u5bf9\u65b9\u4e0d\u662f\u540c\u4e00\u9635\u8425\uff0c\u4e5f\u8bb8\u4f60\u81ea\u5df1\u624d\u662f\u90a3\u4e2a\u4e0d\u5bf9\u52b2\u7684\u4eba\u3002",
    "\u672c\u6e38\u620f\u9f13\u52b1\u8111\u6d1e\u53d1\u8a00\uff0c\u4e5f\u5141\u8bb8\u9002\u5ea6\u778e\u626f\uff0c\u4f46\u4e0d\u5141\u8bb8\u8bf4\u8c0e\u3002\u80fd\u5706\u56de\u6765\u7684\u53eb\u778e\u626f\uff0c\u5706\u4e0d\u56de\u6765\u7684\u53eb\u8bf4\u8c0e\u3002",
    "\u5367\u5e95\u548c\u767d\u677f\u5982\u679c\u9010\u6e10\u53d1\u73b0\u81ea\u5df1\u597d\u50cf\u5b64\u7acb\u65e0\u63f4\uff0c\u8bf7\u52aa\u529b\u7ba1\u7406\u8868\u60c5\u3002\u5982\u679c\u56e0\u4e3a\u618b\u7b11\u5931\u8d25\u88ab\u201c\u573a\u5916\u6293\u5305\u201d\uff0c\u540e\u679c\u81ea\u8d1f\ud83d\ude02"
  ];
  return `
    <section class="wodi-speech-tips">
      <div class="wodi-speech-kicker">\u6e38\u620f\u63d0\u793a</div>
      <div class="wodi-tips-list">
        ${tips.map((tip, index) => `<div class="wodi-tip-card"><strong class="wodi-tip-number">${index + 1}</strong><span>${tip}</span></div>`).join("")}
      </div>
    </section>`;
}

function renderWodiAssigning() {
  const round = state.wodiRound;
  const assignment = round.assignments[round.revealIndex];
  const avatar = getAvatar(assignment.avatarId);
  rememberWodiHostShell();
  $(".gameplay-grid")?.classList.add("wodi-fullscreen");
  const sideStack = $(".gameplay-side-stack");
  if (sideStack) sideStack.hidden = true;
  elements.mediaCard.className = "media-card wodi-mode";
  elements.mediaCard.innerHTML = `
    <div class="wodi-identity-stage">
      <h1>\u8c01\u662f\u5367\u5e95\uff1a\u626b\u7801\u67e5\u770b\u8eab\u4efd</h1>
      <p>\u6b63\u5728\u53d1\u653e\uff1a\u7b2c ${round.revealIndex + 1} / ${round.assignments.length} \u4f4d</p>
      <div class="wodi-current-player"><span class="mini-avatar" style="background: ${avatar.color}">${avatar.emoji}</span><strong>${escapeHTML(assignment.name)}</strong></div>
      <div class="wodi-qr-card" id="wodiQrCard"></div>
      <label class="wodi-mobile-url-field">
        <span>\u624b\u673a\u8bbf\u95ee\u5730\u5740</span>
        <input value="${escapeHTML(getWodiIdentityBaseUrl())}" data-wodi-mobile-base-url>
      </label>
      <p class="wodi-mobile-url-note">\u624b\u673a\u626b\u7801\u9700\u8981\u548c\u7535\u8111\u5728\u540c\u4e00\u4e2a Wi-Fi \u4e0b\u3002\u8bf7\u786e\u8ba4\u4e0a\u9762\u5730\u5740\u662f\u624b\u673a\u53ef\u4ee5\u8bbf\u95ee\u7684\u7535\u8111\u5730\u5740\u3002</p>
      <p class="wodi-warning" id="wodiMobileUrlWarning" ${isWodiIdentityBaseUrlLocalhost() ? "" : "hidden"}>\u5f53\u524d\u4f7f\u7528\u7684\u662f localhost\uff0c\u624b\u673a\u901a\u5e38\u65e0\u6cd5\u8bbf\u95ee\u3002\u8bf7\u628a localhost \u6539\u6210\u7535\u8111\u5c40\u57df\u7f51 IP\uff0c\u4f8b\u5982 http://192.168.x.x:8000/wodi_identity.html</p>
      <p>\u8bf7\u5f53\u524d\u73a9\u5bb6\u626b\u7801\u67e5\u770b\u81ea\u5df1\u7684\u8eab\u4efd\u8bcd\uff0c\u4e0d\u8981\u8ba9\u5176\u4ed6\u4eba\u770b\u5230\u624b\u673a\u3002</p>
      <div class="action-row">
        <button class="ghost-btn" type="button" data-wodi-prev-identity ${round.revealIndex === 0 ? "disabled" : ""}>\u4e0a\u4e00\u4f4d\u73a9\u5bb6</button>
        <button class="ghost-btn" type="button" data-wodi-next-identity ${round.revealIndex >= round.assignments.length - 1 ? "disabled" : ""}>\u4e0b\u4e00\u4f4d\u73a9\u5bb6</button>
        <button class="primary-btn" type="button" data-wodi-start-discussion>\u5f00\u59cb\u6e38\u620f</button>
      </div>
      ${renderWodiSpeechTips()}
    </div>`;
  renderWodiQRCode($("#wodiQrCard"), assignment);
}

function showPreviousWodiIdentity() {
  if (!state.wodiRound) return;
  state.wodiRound.revealIndex = Math.max(0, state.wodiRound.revealIndex - 1);
  renderWodiGameplay();
}

function showNextWodiIdentity() {
  if (!state.wodiRound) return;
  state.wodiRound.revealIndex = Math.min(state.wodiRound.assignments.length - 1, state.wodiRound.revealIndex + 1);
  renderWodiGameplay();
}

Object.assign(window.PartyGame.Games.WodiInternal, {
  encodeBase64Url,
  getDefaultWodiIdentityBaseUrl,
  getWodiIdentityBaseUrl,
  setIdentityBaseUrl: setWodiIdentityBaseUrl,
  setWodiIdentityBaseUrl,
  updateIdentityBaseUrl: updateWodiIdentityBaseUrl,
  updateWodiIdentityBaseUrl,
  isWodiIdentityBaseUrlLocalhost,
  buildIdentityPayload: buildWodiIdentityPayload,
  buildWodiIdentityPayload,
  buildIdentityUrl: buildWodiIdentityUrl,
  buildWodiIdentityUrl,
  renderWodiQRFallback,
  renderQRCode: renderWodiQRCode,
  renderWodiQRCode,
  renderWodiAssigning,
  renderWodiSpeechTips,
  showPreviousIdentity: showPreviousWodiIdentity,
  showPreviousWodiIdentity,
  showNextIdentity: showNextWodiIdentity,
  showNextWodiIdentity
});
