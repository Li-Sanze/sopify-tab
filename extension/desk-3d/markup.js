/**
 * Shared desk-3d DOM. Canvas is created in JS (not in newtab.html)
 * so host sky/companion contracts that scan the NTP markup stay intact.
 * Folder / note chips are filled from real worksets + the single desk note.
 */

export function stageInnerHTML() {
  return `
    <div class="desk-stage-bar">
      <p class="desk-stage-kicker">微缩桌</p>
      <label class="desk-stage-toggle" for="desk3d-toggle">
        <input type="checkbox" id="desk3d-toggle" />
        <span>有 3D</span>
      </label>
    </div>
    <div class="desk-stage-body">
      <div class="desk3d-board" aria-label="工作桌舞台">
        <div id="desk3d-view" class="desk3d-view"></div>
        <div id="desk3d-fallback" class="desk3d-fallback">
          <p class="desk3d-fallback-title">静态桌面（无 3D / 已关 3D）</p>
          <div id="desk3d-fallback-surface" class="desk3d-fallback-surface"></div>
        </div>
        <p id="desk3d-banner" class="desk3d-banner" hidden role="status"></p>
      </div>
      <aside class="desk3d-rail" aria-label="键盘可达入口">
        <h2 class="desk3d-rail-heading">桌面入口</h2>
        <p class="desk3d-hint">与 3D 点击同一路径；不必对准桌面物件。</p>
        <div id="desk3d-rail-entries"></div>
      </aside>
    </div>
  `;
}

export function panelsInnerHTML() {
  return `
    <dialog id="desk3d-panel-workset" class="desk3d-panel" aria-labelledby="desk3d-workset-title">
      <form method="dialog" class="desk3d-panel-inner">
        <header class="desk3d-panel-head">
          <h2 id="desk3d-workset-title">工作集</h2>
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
          <h2 id="desk3d-note-title">便签</h2>
          <button type="submit" class="desk3d-icon-close" value="cancel" aria-label="关闭面板">×</button>
        </header>
        <div class="desk3d-panel-body">
          <label class="sr-only" for="desk3d-note-editor">便签内容</label>
          <textarea id="desk3d-note-editor" rows="8" placeholder="还没有便签。"></textarea>
          <p class="desk3d-save-hint">输入即保存到书桌便签。</p>
        </div>
      </form>
    </dialog>
  `;
}
