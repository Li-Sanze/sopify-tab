(() => {
  'use strict';

  const HOST_ID = 'com.sopify.tab';

  const state = {
    port: null,
    connected: false,
    reason: '',
    cwd: '',
    upstream: 'cursor',
    cursorAvailable: false,
    claudeAvailable: false,
    codexAvailable: false,
    streaming: false,
    messages: [],
  };

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const hasRuntime = typeof chrome !== 'undefined' && chrome.runtime;
  const hasStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  function normalizeUpstream(id) {
    return id === 'claude' || id === 'codex' ? id : 'cursor';
  }

  function upstreamLabel() {
    if (state.upstream === 'claude') return 'Claude';
    if (state.upstream === 'codex') return 'Codex';
    return 'Cursor';
  }

  function upstreamReady() {
    if (state.upstream === 'claude') return state.claudeAvailable;
    if (state.upstream === 'codex') return state.codexAvailable;
    return state.cursorAvailable;
  }

  async function loadSettings() {
    if (!hasStorage) return { cwd: '', upstream: 'cursor' };
    try {
      const data = await chrome.storage.local.get({ cwd: '', hostUpstream: 'cursor' });
      return {
        cwd: typeof data.cwd === 'string' ? data.cwd : '',
        upstream: normalizeUpstream(data.hostUpstream),
      };
    } catch {
      return { cwd: '', upstream: 'cursor' };
    }
  }

  async function hasNativePermission() {
    if (!chrome?.permissions?.contains) return false;
    try {
      return Boolean(await chrome.permissions.contains({ permissions: ['nativeMessaging'] }));
    } catch {
      return false;
    }
  }

  function lastUser() {
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      if (state.messages[i].role === 'user') return state.messages[i];
    }
    return null;
  }

  function lastAssistant() {
    const m = state.messages[state.messages.length - 1];
    return m && m.role === 'assistant' ? m : null;
  }

  function render() {
    const body = $('#panel-body');
    const hint = $('#compose-hint');
    const prompt = $('#prompt');
    const send = $('#send');
    const sub = $('#panel-sub');
    const neu = $('#session-new');
    const retry = $('#session-retry');
    const stop = $('#session-stop');
    const on = state.connected;
    const ready = on && upstreamReady();
    const busy = state.streaming;
    const label = upstreamLabel();

    sub.textContent = state.cwd.trim()
      ? `经本机 ${label} CLI，只读 · ${state.cwd.trim()}`
      : `经本机 ${label} CLI，只读`;

    prompt.disabled = !ready || busy;
    send.disabled = !ready || busy;
    hint.textContent = !on
      ? '需要本机 Host：只读，不是本地模型，不能写盘或执行。'
      : !ready
        ? (state.upstream === 'claude'
          ? '没找到本机 claude，到设置里看说明。'
          : state.upstream === 'codex'
            ? '没找到本机 Codex，到设置里看说明。'
            : 'Host 还没有快照 cursor-agent-proxy，到设置里看说明。')
        : (busy ? '正在回答… 可停止。' : 'Enter 发送，Shift+Enter 换行；会话只留本栏，关掉即丢。');

    neu.hidden = !on || !state.messages.length;
    retry.hidden = !on || busy || !lastUser();
    stop.hidden = !on || !busy;
    neu.disabled = !on;
    retry.disabled = !on || busy || !lastUser();
    stop.disabled = !busy;

    if (!on) {
      body.innerHTML = `
        <div class="emptystate">
          <div class="ring" aria-hidden="true">
            <svg class="i" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 1 0-5.5l2.5-2.5a4 4 0 0 1 5.5 5.5L16.5 13"/><path d="M14 10a4 4 0 0 1 0 5.5L11.5 18A4 4 0 0 1 6 12.5L7.5 11"/></svg>
          </div>
          <h2>需要本机 Host</h2>
          <p>对话走本机 ${esc(label)} CLI，只读，不是本地模型，不能写盘或执行。</p>
          <p class="note"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.5"/></svg><span>在仓库跑 <code>./host/install-host.sh</code>，再到设置里检测。</span></p>
          <button type="button" class="btn" id="goto-settings">去设置</button>
        </div>`;
      const go = $('#goto-settings');
      if (go) go.addEventListener('click', openSettings);
      return;
    }

    if (!ready) {
      body.innerHTML = `
        <div class="emptystate">
          <div class="ring" aria-hidden="true">
            <svg class="i" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 1 0-5.5l2.5-2.5a4 4 0 0 1 5.5 5.5L16.5 13"/><path d="M14 10a4 4 0 0 1 0 5.5L11.5 18A4 4 0 0 1 6 12.5L7.5 11"/></svg>
          </div>
          <h2>${state.upstream === 'claude' ? '没找到 Claude' : state.upstream === 'codex' ? '没找到 Codex' : '还不能提问'}</h2>
          <p>${state.upstream === 'claude'
            ? '本机没有 claude，到设置里看说明。'
            : state.upstream === 'codex'
              ? '本机没有 Codex，到设置里看说明。'
              : 'Host 还没有快照 cursor-agent-proxy，到设置里看说明。'}</p>
          <button type="button" class="btn" id="goto-settings">去设置</button>
        </div>`;
      const goMissing = $('#goto-settings');
      if (goMissing) goMissing.addEventListener('click', openSettings);
      return;
    }

    if (!state.messages.length) {
      body.innerHTML = `
        <div class="emptystate">
          <div class="ring" aria-hidden="true">
            <svg class="i" viewBox="0 0 24 24"><path d="M5 7l5 5-5 5M12 17h7"/></svg>
          </div>
          <h2>可以提问</h2>
          <p>${state.cwd.trim()
            ? `在 <code>${esc(state.cwd.trim())}</code> 里只读回答。`
            : '工作目录还空着，需要时去设置里填。'}</p>
        </div>`;
      return;
    }

    body.setAttribute('aria-busy', String(busy));
    body.innerHTML = state.messages.map((m) => `
      <div class="msg ${esc(m.role)}${m.status === 'streaming' ? ' streaming' : ''}${m.status === 'error' ? ' error' : ''}">
        <span class="who">${m.role === 'user' ? '你' : esc(label)}</span>
        <div class="bubble">${esc(m.text || (m.status === 'streaming' ? '' : ''))}${m.status === 'stopped' ? '<span class="who"> · 已停止</span>' : ''}</div>
      </div>`).join('');
    body.scrollTop = body.scrollHeight;
  }

  function openSettings() {
    if (!hasRuntime || !chrome.runtime.sendMessage) return;
    try {
      chrome.runtime.sendMessage({ type: 'openSettings' }, () => {
        void chrome.runtime.lastError;
      });
    } catch { /* fail-soft */ }
  }

  function teardown() {
    const port = state.port;
    state.port = null;
    state.connected = false;
    state.streaming = false;
    if (!port) return;
    try { port.postMessage({ type: 'shutdown' }); } catch { /* closing */ }
    try { port.disconnect(); } catch { /* already gone */ }
  }

  function onNative(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'pong') {
      state.connected = Boolean(msg.ok);
      state.reason = msg.ok ? 'ok' : 'failed';
      state.cursorAvailable = Boolean(msg.cursorAvailable || msg.proxySnapshotted);
      state.claudeAvailable = Boolean(msg.claudeAvailable);
      state.codexAvailable = Boolean(msg.codexAvailable);
      render();
      return;
    }
    if (msg.type === 'ask_start') {
      const a = lastAssistant();
      if (a && a.status === 'streaming') a.status = 'streaming';
      render();
      return;
    }
    if (msg.type === 'ask_delta' && typeof msg.text === 'string') {
      const a = lastAssistant();
      if (a && a.status === 'streaming') a.text += msg.text;
      render();
      return;
    }
    if (msg.type === 'ask_done') {
      const a = lastAssistant();
      if (a && a.status === 'streaming') a.status = 'done';
      state.streaming = false;
      render();
      return;
    }
    if (msg.type === 'stopped') {
      const a = lastAssistant();
      if (a && a.status === 'streaming') a.status = 'stopped';
      state.streaming = false;
      render();
      return;
    }
    if (msg.type === 'error') {
      const a = lastAssistant();
      const text = msg.detail || (
        msg.error === 'proxy_not_snapshotted' ? 'Host 还没有快照 cursor-agent-proxy。重新跑一次 install-host.sh。'
          : msg.error === 'claude_not_found' ? '没找到本机 claude。到设置里看说明。书桌不受影响。'
            : msg.error === 'codex_not_found' ? '没找到本机 Codex。到设置里看说明。书桌不受影响。'
            : msg.error === 'empty_prompt' ? '先写一句再发送。'
              : msg.error === 'spawn_failed' ? `没能拉起本机 ${upstreamLabel()} CLI。`
                : msg.error === 'ask_failed' ? `本机 ${upstreamLabel()} CLI 没有回答。`
                  : '本机 Host 返回了错误。'
      );
      if (a && a.status === 'streaming') {
        a.status = 'error';
        if (!a.text) a.text = text;
      } else {
        state.messages.push({ id: uid(), role: 'assistant', text, status: 'error' });
      }
      state.streaming = false;
      render();
    }
  }

  async function connect() {
    teardown();
    const granted = await hasNativePermission();
    if (!granted || !chrome?.runtime?.connectNative) {
      state.connected = false;
      state.reason = granted ? 'no_api' : 'need_host';
      render();
      return;
    }
    let port;
    try {
      port = chrome.runtime.connectNative(HOST_ID);
    } catch {
      state.connected = false;
      state.reason = 'failed';
      render();
      return;
    }
    state.port = port;
    port.onMessage.addListener(onNative);
    port.onDisconnect.addListener(() => {
      if (state.port !== port) return;
      state.port = null;
      state.connected = false;
      state.streaming = false;
      const a = lastAssistant();
      if (a && a.status === 'streaming') a.status = 'stopped';
      state.reason = 'disconnected';
      render();
    });
    try {
      port.postMessage({ type: 'detect' });
    } catch {
      state.connected = false;
      render();
    }
  }

  function stop() {
    if (!state.streaming) return;
    if (state.port) {
      try { state.port.postMessage({ type: 'stop' }); } catch { /* ignore */ }
    }
  }

  async function send(text) {
    const prompt = String(text || '').trim();
    if (!prompt || !state.connected || !upstreamReady() || state.streaming || !state.port) return;
    const loaded = await loadSettings();
    state.cwd = loaded.cwd;
    if (loaded.upstream !== state.upstream) {
      applyUpstream(loaded.upstream);
    }
    if (!state.connected || !upstreamReady() || !state.port) {
      render();
      return;
    }
    state.messages.push({ id: uid(), role: 'user', text: prompt, status: 'done' });
    state.messages.push({ id: uid(), role: 'assistant', text: '', status: 'streaming' });
    state.streaming = true;
    render();
    try {
      state.port.postMessage({ type: 'ask', prompt, cwd: state.cwd, upstream: state.upstream });
    } catch {
      const a = lastAssistant();
      if (a) {
        a.status = 'error';
        a.text = '没能把问题交给本机 Host。';
      }
      state.streaming = false;
      render();
    }
  }

  async function retry() {
    const user = lastUser();
    if (!user || state.streaming) return;
    const i = state.messages.lastIndexOf(user);
    state.messages = state.messages.slice(0, i);
    await send(user.text);
  }

  async function newSession() {
    if (state.streaming) stop();
    state.messages = [];
    state.streaming = false;
    render();
  }

  function applyUpstream(next) {
    const id = normalizeUpstream(next);
    if (id === state.upstream) return;
    if (state.streaming) stop();
    state.upstream = id;
    state.messages = [];
    state.streaming = false;
    render();
  }

  function bind() {
    const prompt = $('#prompt');
    prompt.addEventListener('input', () => {
      prompt.style.height = 'auto';
      prompt.style.height = `${Math.min(prompt.scrollHeight, 160)}px`;
    });
    prompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        $('#compose').requestSubmit();
      }
    });
    $('#compose').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = prompt.value;
      prompt.value = '';
      prompt.style.height = 'auto';
      send(v);
    });
    $('#session-stop').addEventListener('click', stop);
    $('#session-retry').addEventListener('click', () => { retry(); });
    $('#session-new').addEventListener('click', () => { newSession(); });
    const openSettingsBtn = $('#open-settings');
    if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettings);

    window.addEventListener('pagehide', teardown);
    window.addEventListener('beforeunload', teardown);

    if (hasStorage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if ('cwd' in changes && typeof changes.cwd.newValue === 'string') {
          state.cwd = changes.cwd.newValue;
        }
        if ('hostUpstream' in changes) {
          applyUpstream(changes.hostUpstream.newValue);
          return;
        }
        if ('cwd' in changes) render();
      });
    }
  }

  async function boot() {
    const loaded = await loadSettings();
    state.cwd = loaded.cwd;
    state.upstream = loaded.upstream;
    bind();
    render();
    await connect();
  }

  boot();
})();
