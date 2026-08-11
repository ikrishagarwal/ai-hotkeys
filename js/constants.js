const CONFIGS = {
  hotkeys: {
    "Control+I": "openIncognito",
    "Control+Shift+U": "uploadFiles",
    "Control+Shift+K": "searchChats",
  },
  disabled: [],
  autoFocus: true,
  disclaimer: true,
};

const INFO = [
  {
    name: "Open Incognito",
    key: "openIncognito",
    description: "Open a new incognito chat window.",
    defaultCombo: "Control+I",
  },
  {
    name: "Upload Files",
    key: "uploadFiles",
    description: "Upload files to the current chat.",
    defaultCombo: "Control+Shift+U",
  },
  {
    name: "Search Chats",
    key: "searchChats",
    description: "Search through your past chats.",
    defaultCombo: "Control+Shift+K",
  },
];
