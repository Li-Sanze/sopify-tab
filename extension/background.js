'use strict';

function enableActionOpen() {
  if (!chrome.sidePanel || !chrome.sidePanel.setPanelBehavior) return;
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(enableActionOpen);
enableActionOpen();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'openSidePanel') {
    const windowId = sender.tab && sender.tab.windowId;
    const open = windowId != null
      ? chrome.sidePanel.open({ windowId })
      : chrome.windows.getCurrent().then((w) => chrome.sidePanel.open({ windowId: w.id }));
    open.then(() => sendResponse({ ok: true })).catch((e) => {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    });
    return true;
  }
  if (msg.type === 'openSettings') {
    const url = chrome.runtime.getURL('newtab.html#settings');
    chrome.tabs.create({ url }).then(() => sendResponse({ ok: true })).catch((e) => {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    });
    return true;
  }
});
