window.PartyGame = window.PartyGame || {};
window.PartyGame.Core = window.PartyGame.Core || {};
window.PartyGame.App = window.PartyGame.App || {};

function normalizeLegacyThemeId(themeId) {
  if (themeId === "cream_birthday") return "classic_cream";
  if (themeId === "strawberry_milk") return "strawberry_pop";
  if (themeId === "starry_party") return "starry_neon";
  return themeId;
}

function getSafeUITheme(themeId) {
  const normalizedThemeId = normalizeLegacyThemeId(themeId);
  return UI_THEME_OPTIONS.some((theme) => theme.id === normalizedThemeId) ? normalizedThemeId : "classic_cream";
}

function getCurrentThemeOption() {
  const safeTheme = getSafeUITheme(state.uiTheme);
  return UI_THEME_OPTIONS.find((theme) => theme.id === safeTheme) || UI_THEME_OPTIONS[0];
}

function renderThemeFloatLayer() {
  if (!elements.themeFloatLayer) return;
  const theme = getCurrentThemeOption();
  const decor = theme.decor || [];
  const positions = [
    { left: "7%", top: "20%", delay: "0s", scale: 1 },
    { left: "86%", top: "17%", delay: "1.2s", scale: 1.15 },
    { left: "72%", top: "36%", delay: "0.7s", scale: 0.9 },
    { left: "16%", top: "78%", delay: "1.8s", scale: 0.85 },
    { left: "91%", top: "74%", delay: "0.3s", scale: 1 },
    { left: "45%", top: "9%", delay: "1.5s", scale: 0.75 }
  ];

  elements.themeFloatLayer.innerHTML = positions.map((pos, index) => {
    const item = decor[index % decor.length] || "✨";
    return `<span class="theme-float-emoji" style="left:${pos.left}; top:${pos.top}; animation-delay:${pos.delay}; --float-scale:${pos.scale};">${escapeHTML(item)}</span>`;
  }).join("");
}

function renderThemeSwitcher() {
  if (!elements.themeSwitcher) {
    console.warn("[PartyGame] Cannot render theme switcher: #themeSwitcher missing.");
    return;
  }
  elements.themeSwitcher.innerHTML = `
    <span class="theme-switcher-label">主题</span>
    <div class="theme-pill-row">
      ${UI_THEME_OPTIONS.map((theme) => {
        const selected = getSafeUITheme(state.uiTheme) === theme.id;
        return `<button class="theme-pill ${selected ? "selected" : ""}" type="button" data-ui-theme="${escapeHTML(theme.id)}" aria-pressed="${selected ? "true" : "false"}" title="${escapeHTML(theme.label)}"><span class="theme-pill-icon">${escapeHTML(theme.icon || "")}</span><span class="theme-pill-label">${escapeHTML(theme.label)}</span></button>`;
      }).join("")}
    </div>
  `;
}

function applyUITheme(themeId) {
  const safeTheme = getSafeUITheme(themeId);
  state.uiTheme = safeTheme;
  document.body.dataset.theme = safeTheme;
  renderThemeFloatLayer();
  renderThemeSwitcher();
}

Object.assign(window.PartyGame.Core, {
  normalizeLegacyThemeId,
  getSafeUITheme,
  getCurrentThemeOption,
  renderThemeFloatLayer,
  renderThemeSwitcher,
  applyUITheme
});

Object.assign(window.PartyGame.App, {
  applyUITheme,
  renderThemeSwitcher
});
