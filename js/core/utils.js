window.PartyGame = window.PartyGame || {};
window.PartyGame.Core = window.PartyGame.Core || {};

    function escapeHTML(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      })[char]);
    }

    function safeSetText(element, text) {
      if (element) element.textContent = text;
    }

    function setSelectedByDataAttribute(selector, dataKey, value) {
      $$(selector).forEach((button) => {
        button.classList.toggle("selected", button.dataset[dataKey] === String(value));
      });
    }

    function normalizeQuestionId(id) {
      const raw = normalizeCodeField(id);
      if (!raw) return "";
      const numeric = raw.replace(/^q/i, "");
      return `q${numeric.padStart(3, "0")}`;
    }

    function normalizeField(value) {
      return String(value ?? "").replace(/\r?\n$/g, "");
    }

    function normalizeCodeField(value) {
      return String(value ?? "").trim();
    }

    function normalizeQuestionType(type) {
      return normalizeCodeField(type);
    }

    function formatClockPart(value) {
      return String(value).padStart(2, "0");
    }

    function updateClock() {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const hourDegrees = ((hours % 12) + minutes / 60) * 30;
      const minuteDegrees = (minutes + seconds / 60) * 6;
      const secondDegrees = seconds * 6;
      if (elements.clockHourHand && elements.clockMinuteHand && elements.clockSecondHand) {
        elements.clockHourHand.setAttribute("transform", `rotate(${hourDegrees} 50 50)`);
        elements.clockMinuteHand.setAttribute("transform", `rotate(${minuteDegrees} 50 50)`);
        elements.clockSecondHand.setAttribute("transform", `rotate(${secondDegrees} 50 50)`);
      }
      safeSetText(elements.clock, `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日，${formatClockPart(now.getHours())}:${formatClockPart(now.getMinutes())}:${formatClockPart(now.getSeconds())}`);
    }

Object.assign(window.PartyGame.Core, { escapeHTML, safeSetText, setSelectedByDataAttribute, normalizeQuestionId, normalizeField, normalizeCodeField, normalizeQuestionType, formatClockPart, updateClock });
