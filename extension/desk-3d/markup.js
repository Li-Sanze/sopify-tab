/**
 * Shared desk-3d DOM. Canvas is created in JS (not in newtab.html)
 * so host sky/companion contracts that scan the NTP markup stay intact.
 */

export function stageInnerHTML() {
  return `
    <div class="desk-stage-bar">
      <p class="desk-stage-kicker">微缩桌 · 演示舞台</p>
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
          <div class="desk3d-fallback-surface">
            <button type="button" class="desk3d-chip folder" data-desk3d-workset="focus">专注工作集</button>
            <button type="button" class="desk3d-chip folder research" data-desk3d-workset="research">调研工作集</button>
            <button type="button" class="desk3d-chip note" data-desk3d-note="n1">便签 A</button>
            <button type="button" class="desk3d-chip note n2" data-desk3d-note="n2">便签 B</button>
          </div>
        </div>
        <p id="desk3d-banner" class="desk3d-banner" hidden role="status"></p>
      </div>
      <aside class="desk3d-rail" aria-label="键盘可达入口">
        <h2 class="desk3d-rail-heading">桌面入口</h2>
        <p class="desk3d-hint">与 3D 点击同一路径；不必对准桌面物件。</p>
        <button type="button" class="desk3d-rail-btn" data-desk3d-workset="focus">打开：专注工作集</button>
        <button type="button" class="desk3d-rail-btn" data-desk3d-workset="research">打开：调研工作集</button>
        <button type="button" class="desk3d-rail-btn note" data-desk3d-note="n1">编辑：便签 A</button>
        <button type="button" class="desk3d-rail-btn note" data-desk3d-note="n2">编辑：便签 B</button>
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
          <p class="desk3d-demo-tag">演示数据 · 不操作真实浏览器标签 · 不写 chrome.storage</p>
          <h3 id="desk3d-workset-name"></h3>
          <ul id="desk3d-workset-pages" class="desk3d-page-list"></ul>
          <button type="button" id="desk3d-btn-simulate-restore" class="desk3d-primary">
            模拟恢复（演示）
          </button>
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
          <p class="desk3d-demo-tag">内容仅存于本页 sessionStorage · 不碰 chrome.storage</p>
          <label class="sr-only" for="desk3d-note-editor">便签内容</label>
          <textarea id="desk3d-note-editor" rows="8" maxlength="2000" placeholder="写下备忘…"></textarea>
          <p class="desk3d-save-hint">输入即保存到 session（关闭标签页后清空）。</p>
        </div>
      </form>
    </dialog>
  `;
}
