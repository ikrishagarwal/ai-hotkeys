const mappings = {
  claude: {
    openIncognito: '[aria-label="Use incognito"]',
    uploadFiles: "#base-ui-_r_b9_",
    searchChats: '[aria-label="Search"]',
    searchBox: '[contenteditable="true"]',
    disclaimer: "[data-disclaimer]",
    inputArea: "fieldset",
  },
  gemini: {
    openIncognito: '[aria-label="Temporary chat"]',
    uploadFiles: () => {
      if (document.querySelector('[aria-label="Upload and tools"]').getAttribute("aria-expanded") !== "true") {
        clickButton('[aria-label="Upload and tools"]');
      }
      setTimeout(() => {
        clickButton('[aria-label="Upload files. Documents, data, code files"]');
        clickButton('[aria-label="Upload and tools"]');
      }, 500);
    },
    searchChats: '[aria-label="Search chats"]',
    searchBox: 'rich-textarea [contenteditable="true"], .ql-editor',
    disclaimer: ["[data-test-id='disclaimer']", "hallucination-disclaimer"],
    inputArea: "fieldset",
  },
  chatgpt: {
    openIncognito: '[aria-label="Turn on temporary chat"]',
    uploadFiles: "#upload-photos",
    searchChats: '[aria-label="Search"]',
    searchBox: "#prompt-textarea",
    disclaimer: ["[data-mobile-disclosure-thread-end]", "[data-testid='thread-disclaimer']"],
  },
};

function clickButton(buttonQuery) {
  const button = document.querySelector(buttonQuery);
  if (button) {
    button.click();
  }
}

let autoFocusEnabled = true;
chrome.storage.sync.get({ autoFocus: true }, (data) => {
  autoFocusEnabled = data.autoFocus !== false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && "autoFocus" in changes) {
    autoFocusEnabled = changes.autoFocus.newValue !== false;
  }
});

if (document.readyState === "complete" || document.readyState === "interactive") {
  init();
} else {
  window.addEventListener("DOMContentLoaded", init);
}

function init() {
  chrome.storage.sync.get("disclaimer", (data) => {
    if (data.disclaimer !== false) {
      const platform = window.location.hostname.includes("claude")
        ? "claude"
        : window.location.hostname.includes("gemini")
          ? "gemini"
          : "chatgpt";

      const disclaimerSelector = mappings[platform].disclaimer;
      const inputArea = mappings[platform].inputArea;
      if (disclaimerSelector.length > 0) {
        const style = document.createElement("style");
        if (typeof disclaimerSelector === "object" && Array.isArray(disclaimerSelector)) {
          style.textContent = disclaimerSelector
            .map((selector) => `${selector} { display: none !important; }`)
            .join(" ");
        } else if (typeof disclaimerSelector === "string") {
          style.textContent = `${disclaimerSelector} { display: none !important; }`;
        }
        if (inputArea) {
          style.textContent += ` ${inputArea} { margin-bottom: 0.8rem !important; }`;
        }
        document.head.appendChild(style);
        console.log(`[AI HOTKEY] Injected CSS to hide disclaimer on ${platform}`);
      }
    }
  });
}

window.addEventListener(
  "keydown",
  (event) => {
    const platform = window.location.hostname.includes("claude")
      ? "claude"
      : window.location.hostname.includes("gemini")
        ? "gemini"
        : "chatgpt";

    const currentCombo = [];

    if (event.ctrlKey) currentCombo.push("Control");
    if (event.shiftKey) currentCombo.push("Shift");
    if (event.altKey) currentCombo.push("Alt");
    if (event.metaKey) currentCombo.push("Meta");

    if (
      currentCombo.length === 0 ||
      (currentCombo.length === 1 && event.shiftKey) ||
      (currentCombo.length === 1 && event.ctrlKey && event.key.toLowerCase() === "v") ||
      (currentCombo.length === 1 && event.metaKey && event.key.toLowerCase() === "v") ||
      (currentCombo.length === 2 && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "v") ||
      (currentCombo.length === 2 && event.metaKey && event.shiftKey && event.key.toLowerCase() === "v")
    ) {
      if (!isTypingInInput() && autoFocusEnabled) {
        const textarea = document.querySelector(mappings[platform].searchBox);
        if (textarea && document.activeElement !== textarea) {
          focusAndMoveCursorToEnd(textarea);
        }
      }
      return;
    }

    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    currentCombo.push(key);

    const pressedCombo = currentCombo.join("+");

    chrome.storage.sync.get(CONFIGS, (data) => {
      const hotkeys = data.hotkeys || CONFIGS.hotkeys;
      const hotkeyMatch = hotkeys[pressedCombo];
      console.log(`[AI HOTKEY] Pressed combo: ${pressedCombo}, Hotkey match: ${hotkeyMatch}`);
      if (!hotkeyMatch) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const buttonQuery = mappings[platform][hotkeyMatch];
      if (typeof buttonQuery === "string") {
        clickButton(buttonQuery);
      } else if (typeof buttonQuery === "function") {
        buttonQuery();
      }
    });
  },
  true,
);

function focusAndMoveCursorToEnd(element) {
  element.focus();

  // Handle standard <textarea> or <input> (just in case they revert their UI)
  if (typeof element.selectionStart === "number") {
    element.selectionStart = element.selectionEnd = element.value.length;
  }
  // Handle modern contenteditable divs
  else if (window.getSelection && document.createRange) {
    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(element);

    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function isTypingInInput() {
  let activeEl = document.activeElement;
  while (activeEl && activeEl.shadowRoot && activeEl.shadowRoot.activeElement) {
    activeEl = activeEl.shadowRoot.activeElement;
  }

  if (!activeEl) return false;

  if (activeEl.isContentEditable) {
    return true;
  }

  const tagName = activeEl.tagName.toUpperCase();

  if (tagName === "TEXTAREA") {
    return true;
  }

  if (tagName === "INPUT") {
    const type = activeEl.type.toLowerCase();

    const validTextTypes = [
      "text",
      "password",
      "number",
      "email",
      "tel",
      "url",
      "search",
      "date",
      "datetime-local",
      "month",
      "week",
      "time",
    ];

    return validTextTypes.includes(type);
  }

  return false;
}
