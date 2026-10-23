/* H3 视频工坊 —— SillyTavern 扩展（弹窗版）
 * 把楼层里的「六段提示词」+ 角色四视图/场景图，丢给同一台手机上的 H3工作台（127.0.0.1:8899）出片。
 * 不在这里配任何云端 Key。
 */
(function () {
  'use strict';

  const LOG = (...a) => { try { console.log('[h3v]', ...a); } catch (_) {} };
  const LSKEY = 'h3video.settings.v1';
  const DEFA = {
    host: 'http://127.0.0.1:8899',
    seconds: 12, mp: '0.98', aspect: '16:9 (Widescreen)', steps: 12, del: true,
    views: ['', '', '', '', '', ''],
    scene: '',
  };

  let S = {};
  let META = { images: [] };
  let POLL = null;
  let UI = false;

  try { S = Object.assign({}, DEFA, JSON.parse(localStorage.getItem(LSKEY) || '{}')); }
  catch (_) { S = Object.assign({}, DEFA); }
  if (!Array.isArray(S.views)) S.views = ['', '', '', '', '', ''];
  while (S.views.length < 6) S.views.push('');

  const saveS = () => { try { localStorage.setItem(LSKEY, JSON.stringify(S)); } catch (_) {} };
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- 六段提示词抽取 ---------- */
  function extractPrompt(text) {
    if (!text) return '';
    let m = text.match(/\[\[H3\]\]([\s\S]*?)\[\[\/H3\]\]/i);
    if (m) return m[1].trim();
    m = text.match(/```(?:h3|H3)?\s*\n([\s\S]*?)```/);
    if (m && /subject_definitions\s*:/i.test(m[1])) return m[1].trim();
    const i = text.search(/subject_definitions\s*:/i);
    if (i >= 0) return text.slice(i).trim();
    return '';
  }

  /* ---------- UI ---------- */
  function ensureUI() {
    if (UI && $('#h3v-panel')) return;
    UI = true;

    if (!$('#h3v-fab')) {
      const fab = document.createElement('button');
      fab.id = 'h3v-fab';
      fab.title = 'H3 视频工坊';
      fab.textContent = '🎬';
      fab.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openPanel(lastMessageText()); });
      document.body.appendChild(fab);
    }
    if ($('#h3v-panel')) return;

    const mask = document.createElement('div');
    mask.id = 'h3v-mask';
    mask.addEventListener('click', closePanel);
    document.body.appendChild(mask);

    const p = document.createElement('div');
    p.id = 'h3v-panel';
    p.innerHTML = `
      <h3>🎬 H3 视频工坊 <span class="hint" style="font-weight:400">→ 手机 H3工作台</span><span class="x" id="h3v-x">✕</span></h3>

      <div class="row">
        <label>H3 地址</label>
        <input type="text" id="h3v-host" value="${esc(S.host)}" placeholder="http://127.0.0.1:8899">
        <button id="h3v-ping">测试连接</button>
      </div>

      <div class="row"><label>四视图</label><span class="hint">顺序 = &lt;Picture 1..N&gt;；角色几号放几号</span></div>
      <div id="h3v-views"></div>

      <div class="row"><label>场景图</label>
        <select id="h3v-scene" style="flex:1"></select>
        <button id="h3v-sceneUp">传</button>
      </div>

      <div class="row">
        <label>时长(秒)</label><input type="text" id="h3v-sec" value="${esc(S.seconds)}" style="max-width:64px;flex:none">
        <label style="min-width:auto">清晰度</label>
        <select id="h3v-mp" style="max-width:160px;flex:none">
          <option value="0.5">0.5MP 960×544</option>
          <option value="0.98">0.98MP 1344×768</option>
          <option value="1.5">1.5MP 1664×928</option>
        </select>
        <label style="min-width:auto">步数</label><input type="text" id="h3v-steps" value="${esc(S.steps)}" style="max-width:56px;flex:none">
      </div>

      <div class="row"><label>六段提示词</label><button id="h3v-tpl" style="flex:none">复制模板</button></div>
      <textarea id="h3v-prompt" placeholder="点楼层里的 🎬 会自动抓 [[H3]]…[[/H3]]；也可以直接粘贴"></textarea>

      <div class="row" style="margin-top:8px">
        <button class="primary" id="h3v-run">生成视频</button>
        <label style="min-width:auto"><input type="checkbox" id="h3v-del" ${S.del ? 'checked' : ''}> 跑完删云端</label>
      </div>

      <div id="h3v-status"></div>
      <div id="h3v-out"></div>
    `;
    document.body.appendChild(p);

    const wrap = $('#h3v-views');
    for (let i = 0; i < 6; i++) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<label>角色${i + 1}</label>
        <select data-v="${i}" style="flex:1"></select>
        <button data-up="${i}" style="flex:none">传</button>`;
      wrap.appendChild(row);
    }

    $('#h3v-x').onclick = closePanel;
    $('#h3v-host').onchange = () => { S.host = ($('#h3v-host').value || DEFA.host).trim().replace(/\/+$/, ''); saveS(); loadMeta(); };
    $('#h3v-ping').onclick = () => loadMeta();
    $('#h3v-sec').onchange = () => { S.seconds = Number($('#h3v-sec').value) || 12; saveS(); };
    $('#h3v-steps').onchange = () => { S.steps = Number($('#h3v-steps').value) || 12; saveS(); };
    $('#h3v-mp').onchange = () => { S.mp = $('#h3v-mp').value; saveS(); };
    $('#h3v-del').onchange = () => { S.del = $('#h3v-del').checked; saveS(); };
    $('#h3v-tpl').onclick = copyTemplate;
    $('#h3v-run').onclick = runVideo;

    wrap.querySelectorAll('select[data-v]').forEach(sel => {
      sel.onchange = () => { S.views[Number(sel.dataset.v)] = sel.value; saveS(); };
    });
    wrap.querySelectorAll('button[data-up]').forEach(btn => {
      btn.onclick = () => pickAndUpload(Number(btn.dataset.up));
    });
    $('#h3v-sceneUp').onclick = () => pickAndUpload(-1);
    $('#h3v-scene').onchange = () => { S.scene = $('#h3v-scene').value; saveS(); };

    fillSelects();
  }

  function openPanel(text) {
    try {
      ensureUI();
      const p = $('#h3v-panel'), m = $('#h3v-mask');
      if (!p) { alert('面板没建出来（脚本异常），看浏览器控制台 [h3v] 报错'); return; }
      m.classList.add('on');
      p.classList.add('on');
      const ex = extractPrompt(text || lastMessageText());
      if (ex) { $('#h3v-prompt').value = ex; status('ok', '已抓到这条的六段提示词'); }
      fillSelects();
      loadMeta();
      LOG('panel opened', ex ? 'with prompt' : 'no prompt');
    } catch (e) {
      LOG('openPanel error', e);
      alert('打开面板失败：' + (e && e.message ? e.message : e));
    }
  }

  function closePanel() {
    const p = $('#h3v-panel'), m = $('#h3v-mask');
    if (p) p.classList.remove('on');
    if (m) m.classList.remove('on');
  }

  function fillSelects() {
    if (!$('#h3v-scene')) return;
    const opts = '<option value="">（不用）</option>' +
      (META.images || []).map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    document.querySelectorAll('#h3v-views select[data-v]').forEach((sel, i) => {
      sel.innerHTML = opts;
      sel.value = S.views[i] || '';
    });
    const sc = $('#h3v-scene');
    sc.innerHTML = opts;
    sc.value = S.scene || '';
    $('#h3v-mp').value = S.mp;
  }

  /* ---------- 与 H3工作台 通信 ---------- */
  const api = (path) => (S.host || DEFA.host) + path;

  async function jget(path) {
    const r = await fetch(api(path));
    const t = await r.text();
    let j = {}; try { j = JSON.parse(t); } catch (_) { throw new Error('返回不是 JSON：' + t.slice(0, 120)); }
    if (j.error) throw new Error(j.error);
    return j;
  }
  async function jpost(path, body) {
    const r = await fetch(api(path), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
    });
    const t = await r.text();
    let j = {}; try { j = JSON.parse(t); } catch (_) { throw new Error('返回不是 JSON：' + t.slice(0, 120)); }
    if (j.error) throw new Error(j.error);
    return j;
  }

  async function loadMeta() {
    try {
      META = await jget('/api/mm/meta');
      fillSelects();
      status('ok', '已连上 H3工作台：可用图 ' + (META.images || []).length + ' 张');
    } catch (e) {
      status('err', '连不上 H3工作台：' + e.message + '\n检查：APK 开着没、地址是否 http://127.0.0.1:8899');
    }
  }

  async function pickAndUpload(slot) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      try {
        status('run', '上传 ' + f.name + ' …');
        const r = await fetch(api('/api/upload?name=' + encodeURIComponent(f.name) + '&kind=image'), {
          method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: f,
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        if (slot >= 0) S.views[slot] = j.name; else S.scene = j.name;
        saveS();
        await loadMeta();
        status('ok', '已上传：' + j.name);
      } catch (e) { status('err', '上传失败：' + e.message); }
    };
    inp.click();
  }

  async function runVideo() {
    const prompt = $('#h3v-prompt').value.trim();
    if (!prompt) { status('err', '没有提示词：让模型按模板输出 [[H3]]…[[/H3]]，或直接粘六段'); return; }
    const images = [];
    for (let i = 0; i < 6; i++) {
      const sel = document.querySelector(`#h3v-views select[data-v="${i}"]`);
      if (sel && sel.value) images.push(sel.value);
    }
    const scene = $('#h3v-scene').value;
    if (scene) images.push(scene);
    if (!images.length) { status('err', '至少放一张图（四视图或场景图）'); return; }

    const btn = $('#h3v-run');
    btn.disabled = true;
    status('run', '提交中…（图 ' + images.length + ' 张 / ' + $('#h3v-sec').value + ' 秒）');
    try {
      const j = await jpost('/api/mm/run', {
        images: images,
        prompt: prompt,
        seconds: Number($('#h3v-sec').value) || 12,
        megapixels: Number($('#h3v-mp').value) || 0.98,
        aspect: S.aspect,
        steps: Number($('#h3v-steps').value) || 12,
        deleteCloud: $('#h3v-del').checked,
      });
      status('run', '已提交 taskId=' + j.taskId + '\n云端跑片约 4–7 分钟…');
      poll(j.taskId);
    } catch (e) {
      status('err', '提交失败：' + e.message);
      btn.disabled = false;
    }
  }

  function poll(taskId) {
    clearInterval(POLL);
    const t0 = Date.now();
    POLL = setInterval(async () => {
      const el = Math.round((Date.now() - t0) / 1000);
      try {
        const j = await jget('/api/status?id=' + encodeURIComponent(taskId));
        if (j.state === 'done') {
          clearInterval(POLL);
          $('#h3v-run').disabled = false;
          if (j.status === 'error') { status('err', '云端报错：' + (j.message || '')); return; }
          const vids = (j.items || []).filter(x => x.isVideo);
          status('ok', '完成，用时 ' + Math.floor(el / 60) + ' 分 ' + (el % 60) + ' 秒' + (j.coins ? ' · ' + j.coins + ' 币' : ''));
          if (!vids.length) { status('err', '没拿到视频输出'); return; }
          $('#h3v-out').innerHTML = vids.map(v =>
            `<video src="${api(v.url)}" controls playsinline></video>
             <div><a href="${api(v.url)}" download="${esc(v.filename || 'h3.mp4')}">下载</a></div>`).join('');
        } else {
          status('run', (j.state === 'running' ? '云端正在跑' : '排队中') + '… 已等 ' + Math.floor(el / 60) + ' 分 ' + (el % 60) + ' 秒');
        }
      } catch (e) { status('run', '查询抖动，继续等：' + e.message); }
    }, 10000);
  }

  function status(kind, text) {
    const el = $('#h3v-status');
    if (!el) { LOG(kind, text); return; }
    el.className = 'on ' + kind;
    el.textContent = text;
  }

  function copyTemplate() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(TEMPLATE)
        .then(() => status('ok', '模板已复制，粘到角色卡/世界书/作者注释'))
        .catch(() => status('err', '复制失败，手动选吧'));
    } else status('err', '这个浏览器不支持自动复制');
  }

  /* ---------- 楼层按钮（事件委托，防重绘丢 handler） ---------- */
  function lastMessageText() {
    const list = document.querySelectorAll('#chat .mes');
    if (!list.length) return '';
    const last = list[list.length - 1];
    const t = last.querySelector('.mes_text');
    return t ? (t.innerText || t.textContent || '') : (last.innerText || '');
  }

  function messageTextOf(el) {
    const mes = el.closest ? el.closest('.mes') : null;
    if (!mes) return '';
    const t = mes.querySelector('.mes_text');
    return t ? (t.innerText || t.textContent || '') : (mes.innerText || '');
  }

  function attachMessageButtons() {
    let n = 0;
    document.querySelectorAll('#chat .mes').forEach(mes => {
      if (mes.querySelector('.h3v-msgbtn')) return;
      const textEl = mes.querySelector('.mes_text');
      if (!textEl) return;
      const btn = document.createElement('span');
      btn.className = 'h3v-msgbtn';
      btn.dataset.h3v = '1';
      btn.title = '这条出视频';
      btn.textContent = '🎬';
      try { textEl.insertAdjacentElement('afterend', btn); n++; } catch (_) {}
    });
    if (n) LOG('buttons added:', n);
  }

  // 全局委托：即使楼层被 ST 重绘，点击照样生效
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const b = t.closest('.h3v-msgbtn');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const text = messageTextOf(b) || lastMessageText();
    openPanel(text);
  }, true);

  /* ---------- 启动 ---------- */
  function boot() {
    try {
      ensureUI();
      attachMessageButtons();
      const ctx = window.SillyTavern && window.SillyTavern.getContext ? window.SillyTavern.getContext() : null;
      if (ctx && ctx.eventSource && ctx.eventTypes) {
        ctx.eventSource.on(ctx.eventTypes.MESSAGE_RENDERED, () => setTimeout(attachMessageButtons, 120));
        ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => setTimeout(attachMessageButtons, 300));
      }
      const chat = document.getElementById('chat');
      if (chat && window.MutationObserver) {
        new MutationObserver(() => { clearTimeout(boot._t); boot._t = setTimeout(attachMessageButtons, 250); })
          .observe(chat, { childList: true, subtree: true });
      }
      LOG('booted');
      loadMeta();
    } catch (e) {
      LOG('boot error', e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
