const MODIFIER_ORDER = ["Control", "Shift", "Alt", "Meta"];

let binding = {};
let disabledActions = [];
let recording = null;
let errorEl;
let heldMods = new Set();

document.addEventListener("DOMContentLoaded", init);

function init() {
  errorEl = document.querySelector('[data-role="error"]');

  const content = document.querySelector("#content");

  for (const key of INFO) {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.action = key.key;
    row.innerHTML = `
      <div class="label">
        <div class="title">${key.name}</div>
        <div class="desc">${key.description}</div>
      </div>
      <button type="button" class="hotkey" data-role="capture">None</button>
      <button type="button" class="disable" data-role="disable" title="Unbind this shortcut">Unbind</button>
    `;
    content.appendChild(row);
  }

  const toggleRow = document.createElement("div");
  toggleRow.className = "row";
  toggleRow.innerHTML = `
    <div class="label">
      <div class="title">Auto-focus chat input</div>
      <div class="desc">Focus the chat box when you type or press Shift.</div>
    </div>
    <label class="switch" title="Toggle auto-focus">
      <input type="checkbox" data-role="autofocus" />
      <span class="track"><span class="thumb"></span></span>
    </label>
  `;
  content.appendChild(toggleRow);

  const disclaimerRow = document.createElement("div");
  disclaimerRow.className = "row";
  disclaimerRow.innerHTML = `
    <div class="label">
      <div class="title">Hide disclaimer text</div>
      <div class="desc">Remove the disclaimer message under the chat input.</div>
    </div>
    <label class="switch" title="Toggle disclaimer">
      <input type="checkbox" data-role="disclaimer" />
      <span class="track"><span class="thumb"></span></span>
    </label>
  `;
  content.appendChild(disclaimerRow);

  document.querySelectorAll('[data-role="capture"]').forEach((el) => {
    el.addEventListener("click", () => {
      if (recording === el) {
        cancelRecording();
        return;
      }
      startRecording(el);
    });
    el.addEventListener("keydown", (e) => {
      if (recording !== el) return;
      if (MODIFIER_ORDER.includes(e.key)) {
        e.preventDefault();
        heldMods.add(e.key);
        renderKeycaps(el);
        return;
      }
      recordKeydown(el, e);
    });
    el.addEventListener("keyup", (e) => {
      if (recording !== el) return;
      if (MODIFIER_ORDER.includes(e.key)) {
        heldMods.delete(e.key);
        renderKeycaps(el);
      }
    });
    el.addEventListener("blur", () => {
      if (recording === el) cancelRecording();
    });
  });

  document.querySelectorAll('[data-role="disable"]').forEach((el) => {
    el.addEventListener("click", () => {
      cancelRecording();
      disableAction(el.closest(".row").dataset.action);
      render();
    });
  });

  document.querySelector('[data-role="save"]').addEventListener("click", save);
  document.querySelector('[data-role="reset"]').addEventListener("click", reset);

  const autoFocusToggle = document.querySelector('[data-role="autofocus"]');
  autoFocusToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ autoFocus: autoFocusToggle.checked });
  });

  const disclaimerToggle = document.querySelector('[data-role="disclaimer"]');
  disclaimerToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ disclaimer: disclaimerToggle.checked });
  });

  chrome.storage.sync.get(CONFIGS, (data) => {
    disabledActions = Array.isArray(data.disabled) ? data.disabled : [];
    binding = { ...CONFIGS.hotkeys, ...data.hotkeys };
    for (const combo of Object.keys(binding)) {
      if (disabledActions.includes(binding[combo])) delete binding[combo];
    }
    autoFocusToggle.checked = data.autoFocus !== false;
    disclaimerToggle.checked = data.disclaimer !== false;
    render();
  });
}

function startRecording(el) {
  recording = el;
  heldMods = new Set();
  el.classList.add("recording");
  renderKeycaps(el);
  errorEl.style.display = "none";
}

const MODIFIER_SYMBOL = {
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Meta: "Meta",
};

function renderKeyGroup(el, combo) {
  if (!combo) {
    el.textContent = "None";
    return;
  }
  el.innerHTML = combo
    .split("+")
    .map((k) => `<kbd class="keycap">${MODIFIER_SYMBOL[k] || k}</kbd>`)
    .join("");
}

function renderKeycaps(el) {
  const parts = MODIFIER_ORDER.filter((m) => heldMods.has(m));
  if (!parts.length) {
    el.textContent = "Press keys...";
    return;
  }
  const chips = parts.map((m) => `<kbd class="keycap">${MODIFIER_SYMBOL[m] || m}</kbd>`).join("");
  el.innerHTML = chips + '<kbd class="keycap keycap-ghost">…</kbd>';
}

function cancelRecording() {
  if (!recording) return;
  recording.classList.remove("recording");
  recording = null;
  heldMods = new Set();
  render();
}

function recordKeydown(el, event) {
  event.preventDefault();
  event.stopPropagation();

  if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return;

  const combo = buildCombo(event);
  if (!combo) return;

  const action = el.closest(".row").dataset.action;
  const otherAction = binding[combo];
  if (otherAction && otherAction !== action) {
    showError(`"${combo}" is already assigned to ${labelFor(otherAction)}.`);
    startRecording(el);
    return;
  }

  removeComboFor(action);
  binding[combo] = action;
  disabledActions = disabledActions.filter((a) => a !== action);
  recording = null;
  el.classList.remove("recording");
  render();
}

function buildCombo(event) {
  const parts = MODIFIER_ORDER.filter((m) => {
    if (m === "Control") return event.ctrlKey;
    if (m === "Shift") return event.shiftKey;
    if (m === "Alt") return event.altKey;
    if (m === "Meta") return event.metaKey;
  });

  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  parts.push(key);
  return parts.join("+");
}

function removeComboFor(action) {
  for (const [combo, mapped] of Object.entries(binding)) {
    if (mapped === action) delete binding[combo];
  }
}

function disableAction(action) {
  removeComboFor(action);
  if (!disabledActions.includes(action)) disabledActions.push(action);
}

function labelFor(action) {
  for (const key of INFO) {
    if (key.key === action) return key.name;
  }
  return action;
}

function getComboFor(action) {
  for (const [combo, mapped] of Object.entries(binding)) {
    if (mapped === action) return combo;
  }
  return null;
}

function render() {
  document.querySelectorAll(".row").forEach((row) => {
    const action = row.dataset.action;
    const combo = getComboFor(action);
    const captureEl = row.querySelector('[data-role="capture"]');

    if (recording !== captureEl) renderKeyGroup(captureEl, combo);
    if (captureEl) captureEl.classList.toggle("is-disabled", !combo);
    row.classList.toggle("is-disabled", !combo);
  });
}

function showError(message) {
  errorEl.textContent = message;
  // errorEl.style.visibility = "visible";
  errorEl.style.display = "block";
}

function save(event) {
  event.preventDefault();
  cancelRecording();
  errorEl.style.display = "none";

  const invalid = [];
  for (const [combo, action] of Object.entries(binding)) {
    if (combo.split("+").length < 2) invalid.push(labelFor(action));
  }

  if (invalid.length) {
    showError(`${invalid.join(", ")} need a modifier (Ctrl/Shift/Alt/Meta) and was not saved.`);
    return;
  }

  chrome.storage.sync.set({ hotkeys: binding, disabled: disabledActions }, () => {
    if (chrome.runtime.lastError) {
      showError(chrome.runtime.lastError.message);
      return;
    }
    window.close();
  });
}

function reset(event) {
  event.preventDefault();

  cancelRecording();
  errorEl.style.display = "none";
  binding = { ...CONFIGS.hotkeys };
  disabledActions = [];
  const autoFocusToggle = document.querySelector('[data-role="autofocus"]');
  if (autoFocusToggle) autoFocusToggle.checked = true;
  const disclaimerToggle = document.querySelector('[data-role="disclaimer"]');
  if (disclaimerToggle) disclaimerToggle.checked = true;
  render();
  chrome.storage.sync.set(CONFIGS, () => window.close());
}
