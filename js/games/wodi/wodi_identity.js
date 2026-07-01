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
  showPreviousIdentity: showPreviousWodiIdentity,
  showPreviousWodiIdentity,
  showNextIdentity: showNextWodiIdentity,
  showNextWodiIdentity
});
