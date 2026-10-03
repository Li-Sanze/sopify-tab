'use strict';

importScripts('note-sync.js', 'collection-sync.js');

const noteCoordinator = SopifyNoteSync.createNoteCoordinator({
  get(defaults) { return chrome.storage.local.get(defaults); },
  set(partial) { return chrome.storage.local.set(partial); },
});

const collectionCoordinator = SopifyCollection.createCollectionCoordinator({
  get(defaults) { return chrome.storage.local.get(defaults); },
  set(partial) { return chrome.storage.local.set(partial); },
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'sopify-note-commit') {
    const req = msg.req && typeof msg.req === 'object' ? msg.req : {};
    noteCoordinator.commit(req).then((res) => {
      sendResponse(res);
    }).catch(() => {
      sendResponse({ ok: false, error: true });
    });
    return true;
  }
  if (msg.type === 'sopify-collection-commit') {
    const req = msg.req && typeof msg.req === 'object' ? msg.req : {};
    collectionCoordinator.commit(req).then((res) => {
      sendResponse(res);
    }).catch(() => {
      sendResponse({ ok: false, error: true });
    });
    return true;
  }
});
