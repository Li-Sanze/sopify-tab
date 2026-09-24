/**
 * Shared desk-3d DOM. Canvas is created in JS (not in newtab.html)
 * so host sky contracts that scan the NTP markup stay intact.
 * Stage is board-only: no chip wall. Labels + fallback cards share pick paths.
 */

export function stageInnerHTML() {
  return `
    <div class="desk-stage-bar">
      <p class="desk-stage-kicker"><span id="desk3d-workset-count">0 个窗口</span></p>
      <label class="desk-stage-toggle" for="desk3d-toggle" title="空间视图 / 简洁视图" hidden>
        <input type="checkbox" id="desk3d-toggle" />
        <span class="desk-stage-toggle-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 3.2 3.5 8v8L12 20.8 20.5 16V8L12 3.2zm0 2.3 6.2 3.4v.1L12 12.4 5.8 8.9v-.1L12 5.5zm-6.7 5.3L12 14.3l6.7-3.5v5.1L12 19.4l-6.7-3.5V10.8z"/></svg>
        </span>
        <span id="desk3d-toggle-label">空间视图</span>
      </label>
    </div>
    <div class="desk3d-board" aria-label="空间桌面">
      <div id="desk3d-view" class="desk3d-view">
        <button type="button" class="desk3d-scene-label primary" id="desk3d-label-primary" data-desk3d-pick="primary" hidden>
          <span class="desk3d-label-dot" aria-hidden="true"></span>
          <span><strong></strong><small></small></span>
          <span class="desk3d-label-arrow" aria-hidden="true">↗</span>
        </button>
        <button type="button" class="desk3d-scene-label secondary" id="desk3d-label-secondary" data-desk3d-pick="secondary" hidden>
          <span class="desk3d-label-dot" aria-hidden="true"></span>
          <span><strong></strong><small></small></span>
          <span class="desk3d-label-arrow" aria-hidden="true">↗</span>
        </button>
        <button type="button" class="desk3d-scene-label note" id="desk3d-label-note" data-desk3d-pick="note" hidden>
          <strong>随手记</strong>
          <span class="desk3d-label-arrow" aria-hidden="true">↗</span>
        </button>
      </div>
      <div id="desk3d-fallback" class="desk3d-fallback">
        <p class="desk3d-fallback-title">简洁视图 · 所有操作仍可使用</p>
        <div id="desk3d-fallback-surface" class="desk3d-fallback-surface"></div>
      </div>
      <p id="desk3d-banner" class="desk3d-banner" hidden role="status"></p>
    </div>
    <div class="desk-stage-foot">
      <button type="button" class="desk3d-rail-link" id="desk3d-all-worksets">查看全部存下的窗口 ↗</button>
    </div>
    <!-- Keyboard twins: same route as 3D / labels; visually hidden, no chip wall -->
    <div id="desk3d-rail-entries" class="sr-only" aria-label="桌面键盘入口"></div>
  `;
}

export function panelsInnerHTML() {
  return `
    <dialog id="desk3d-panel-workset" class="desk3d-panel" aria-labelledby="desk3d-workset-title">
      <form method="dialog" class="desk3d-panel-inner">
        <header class="desk3d-panel-head">
          <h2 id="desk3d-workset-title">存下的窗口</h2>
          <button type="submit" class="desk3d-icon-close" value="cancel" aria-label="关闭面板">×</button>
        </header>
        <div class="desk3d-panel-body">
          <h3 id="desk3d-workset-name"></h3>
          <ul id="desk3d-workset-pages" class="desk3d-page-list"></ul>
          <button type="button" id="desk3d-btn-restore" class="desk3d-primary">恢复</button>
          <p id="desk3d-restore-msg" class="desk3d-status" role="status" hidden></p>
        </div>
      </form>
    </dialog>
    <dialog id="desk3d-panel-note" class="desk3d-panel" aria-labelledby="desk3d-note-title">
      <form method="dialog" class="desk3d-panel-inner">
        <header class="desk3d-panel-head">
          <h2 id="desk3d-note-title">随手记</h2>
          <button type="submit" class="desk3d-icon-close" value="cancel" aria-label="关闭面板">×</button>
        </header>
        <div class="desk3d-panel-body">
          <label class="sr-only" for="desk3d-note-editor">随手记内容</label>
          <textarea id="desk3d-note-editor" rows="8" placeholder="记下一个想法。"></textarea>
          <p class="desk3d-save-hint" id="desk3d-note-status" role="status">输入即保存到书桌便签。</p>
        </div>
      </form>
    </dialog>
  `;
}
