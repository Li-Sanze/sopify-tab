# PR #51 closeout acceptance

Desk-only. Mac and system IME are 未测. This file does not mark them passed.

Columns: static, stub, real extension, Mac, system IME. `未测` means this run did not execute that surface.

| Item | Static | Stub | Real extension | Mac | System IME |
| --- | --- | --- | --- | --- | --- |
| A reopen after close | `closeTab` / `closeHost` / `offerReopen` in `extension/newtab.js` | `tests/test-r1-r7-browser.js` single, domain, filter, partial close, all-fail, duplicate urls, partial reopen, double-click, old action replaced | same file, `real extension reopened a closed tab` | 未测 | 未测 |
| B1–B2 dynamic CDP port and this-run Chrome | `tests/test-w13-firstscreen.js` `openChrome` | occupied decoy refused; second pid and port differ; `DevToolsActivePort` matches | n/a (port check is the test Chrome) | 未测 | 未测 |
| B3 external 240s supervisor | `scripts/supervise-browser.js`, `scripts/test-reliability.sh` | `tests/test-r1-r7.js` short timeout plus two parallel runs | n/a | 未测 | 未测 |
| B4 real-extension column | `write_summary` prints `reliability real-extension:` separately from the 12-segment count | gate log | Chrome for Testing must load; branded miss is `skipped` | 未测 | 未测 |
| B5 dialog next item | `openTodosDialog` uses `pickResume` | existing 设为下一件 checks in w13 | n/a | 未测 | 未测 |
| B6 text outside the checkbox label | dialog row in `openTodosDialog`; `#todos-dialog-list > .todo > label` | w13 `checkbox is the only control in the label` | n/a | 未测 | 未测 |
| C field patch | `diffCollection` / `applyOps` in `extension/collection-sync.js` | `tests/test-r3-collection.js` both orders, undo-after-rename, delete does not revive | same module in the extension worker; the race itself is the node coordinator | 未测 | 未测 |
| C edit draft and blur focus | `beginTodoTextEdit` | w13 failed rename keeps the draft; blur leaves focus on `todo-input-dialog` | n/a | 未测 | 未测 |
| C composition | `createImeGuard` in the edit field | w13 synthetic composition Enter does not save | n/a | 未测 | 未测 |
| C test isolation | profiles under `SOPIFY_RUN_ROOT`; no global `sopify-*` kill | supervisor parallel test; browser profiles are per run | n/a | 未测 | 未测 |
| Toast undo still separate from window retry | `#toast-action` and `#workset-retry-unopened` | w13 undo; browser partial restore still uses 重试未打开 | n/a | 未测 | 未测 |
| Space view | default off in `extension/newtab.js` | not opened by the gate | 未测 | 未测 | 未测 |

`.sopify/` was not edited. Those Wave / Host / sidebar notes stay historical.
