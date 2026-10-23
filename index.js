/* H3 视频工坊 —— SillyTavern 扩展（<dialog> 顶层弹窗，绝不会被正文盖住）
 * 楼层里的「六段提示词」+ 角色四视图/场景图 → 手机上的 H3工作台（127.0.0.1:8899）出片。
 * 不在这里配任何云端 Key。
 */
(function () {
  'use strict';

  const LOG = (...a) => { try { console.log('[h3v]', ...a); } catch (_) {} };
  const LSKEY = 'h3video.settings.v1';
  const DEFA = { host: 'http://127.0.0.1:8899', seconds: 12, mp: '0.98', aspect: '16:9 (Widescreen)', steps: 12, del: true, views: ['', '', '', '', '', ''], scene: '' };

  let S;
  try { S = Object.assign({}, DEFA, JSON.parse(localStorage.getItem(LSKEY) || '{}')); }
  catch (_) { S = Object.assign({}, DEFA); }
  if (!Array.isArray(S.views)) S.views = ['', '', '', '', '', ''];
  while (S.views.length < 6) S.views.push('');

  let META = { images: [] };
  let POLL = null;

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
  const INLINE = 'position:fixed;inset:0;margin:0;padding:0;border:0;width:100%;height:100%;' +
    'max-width:none;max-height:none;background:#121820;color:#dfe7f0;z-index:2147483000;' +
    'flex-direction:column;overflow:hidden;display:none;';

  function ensureUI() {
    if ($('#h3v-dlg')) return;

    if (!$('#h3v-fab')) {
      const fab = document.createElement('button');
      fab.id = 'h3v-fab';
      fab.title = 'H3 视频工坊';
      fab.textContent = '🎬';
      fab.style.cssText = 'position:fixed;right:14px;bottom:96px;z-index:2147482000;width:46px;height:46px;' +
        'border-radius:50%;background:#2f81f7;color:#fff;border:none;font-size:20px;box-shadow:0 4px 14px rgba(0,0,0,.35);';
      fab.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openPanel(lastMessageText()); });
      document.body.appendChild(fab);
    }

    const dlg = document.createElement('dialog');
    dlg.id = 'h3v-dlg';
    dlg.style.cssText = INLINE;
    dlg.innerHTML = `
      <div class="bar" style="flex:none;display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0e141b;border-bottom:1px solid #26303c;">
        <b style="font-size:15px">🎬 H3 视频工坊</b>
        <span class="hint" style="color:#7d8b9b;font-size:12px">→ 手机 H3工作台</span>
        <span class="sp" style="flex:1"></span>
        <button id="h3v-x" class="close">关闭 ✕</button>
      </div>

      <div class="body" style="flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 14px 30px;">
        <div class="row"><label>H3 地址</label>
          <input type="text" id="h3v-host" value="${esc(S.host)}" placeholder="http://127.0.0.1:8899">
          <button id="h3v-ping">测试连接</button>
          <button id="h3v-diag">诊断</button>
        </div>

        <div class="row"><label>四视图</label><span class="hint">顺序 = &lt;Picture 1..N&gt;</span></div>
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

        <div id="h3v-out"></div>

        <div class="row" style="margin-top:14px"><button class="close" id="h3v-x2" style="flex:1">关闭面板</button></div>
      </div>

      <div class="foot" style="flex:none;border-top:1px solid #26303c;background:#0e141b;padding:8px 12px;">
        <div id="h3v-status"></div>
      </div>
    `;
    document.body.appendChild(dlg);

    const wrap = $('#h3v-views');
    for (let i = 0; i < 6; i++) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<label>角色${i + 1}</label><select data-v="${i}" style="flex:1"></select><button data-up="${i}" style="flex:none">传</button>`;
      wrap.appendChild(row);
    }

    $('#h3v-x').onclick = closePanel;
    $('#h3v-x2').onclick = closePanel;
    $('#h3v-host').onchange = () => { S.host = ($('#h3v-host').value || DEFA.host).trim().replace(/\/+$/, ''); saveS(); pingNow(); };
    $('#h3v-ping').onclick = pingNow;
    $('#h3v-diag').onclick = () => {
      const u = api('/api/mm/meta');
      try { window.open(u, '_blank'); } catch (_) {}
      status('run', '已在新标签打开：' + u + '\n能显示 JSON = 服务正常；一直转圈 = APP 没开/被冻结');
    };
    $('#h3v-sec').onchange = () => { S.seconds = Number($('#h3v-sec').value) || 12; saveS(); };
    $('#h3v-steps').onchange = () => { S.steps = Number($('#h3v-steps').value) || 12; saveS(); };
    $('#h3v-mp').onchange = () => { S.mp = $('#h3v-mp').value; saveS(); };
    $('#h3v-del').onchange = () => { S.del = $('#h3v-del').checked; saveS(); };
    $('#h3v-tpl').onclick = copyTemplate;
    $('#h3v-run').onclick = runVideo;
    dlg.addEventListener('close', () => { dlg.style.display = 'none'; });
    dlg.addEventListener('cancel', () => { dlg.style.display = 'none'; });

    wrap.querySelectorAll('select[data-v]').forEach(sel => { sel.onchange = () => { S.views[Number(sel.dataset.v)] = sel.value; saveS(); }; });
    wrap.querySelectorAll('button[data-up]').forEach(btn => { btn.onclick = () => pickAndUpload(Number(btn.dataset.up)); });
    $('#h3v-sceneUp').onclick = () => pickAndUpload(-1);
    $('#h3v-scene').onchange = () => { S.scene = $('#h3v-scene').value; saveS(); };

    fillSelects();
  }

  function openPanel(text) {
    try {
      ensureUI();
      const d = $('#h3v-dlg');
      if (!d) { alert('面板没建出来（脚本异常）'); return; }
      d.style.display = 'flex';
      // 顶层（top-layer）：不会被酒馆任何容器/层级盖住
      if (typeof d.showModal === 'function') {
        try { if (!d.open) d.showModal(); } catch (_) { d.setAttribute('open', ''); }
      } else {
        d.setAttribute('open', '');
      }
      const ex = extractPrompt(text || lastMessageText());
      if (ex) { $('#h3v-prompt').value = ex; status('ok', '已抓到这条的六段提示词'); }
      fillSelects();
      loadMeta();
      LOG('opened', !!ex);
    } catch (e) {
      LOG('open error', e);
      alert('打开失败：' + (e && e.message ? e.message : e));
    }
  }

  function closePanel() {
    const d = $('#h3v-dlg');
    if (!d) return;
    try { if (d.open && typeof d.close === 'function') d.close(); } catch (_) {}
    d.removeAttribute('open');
    d.style.display = 'none';
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
    if ($('#h3v-mp')) $('#h3v-mp').value = S.mp;
  }

  /* ---------- 与 H3工作台 通信 ---------- */
  const api = (path) => (S.host || DEFA.host) + path;

  async function withTimeout(promise, ms, label) {
    let t;
    const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + '超时（' + ms / 1000 + ' 秒）')), ms); });
    try { return await Promise.race([promise, timeout]); } finally { clearTimeout(t); }
  }

  async function jget(path) {
    const r = await withTimeout(fetch(api(path)), 8000, '请求 ');
    const t = await r.text();
    let j = {}; try { j = JSON.parse(t); } catch (_) { throw new Error('返回不是 JSON：' + t.slice(0, 120)); }
    if (j.error) throw new Error(j.error);
    return j;
  }
  async function jpost(path, body) {
    const r = await withTimeout(fetch(api(path), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
    }), 30000, '提交 ');
    const t = await r.text();
    let j = {}; try { j = JSON.parse(t); } catch (_) { throw new Error('返回不是 JSON：' + t.slice(0, 120)); }
    if (j.error) throw new Error(j.error);
    return j;
  }

  let PINGING = false;
  async function pingNow() {
    if (PINGING) return;
    PINGING = true;
    const btn = $('#h3v-ping');
    if (btn) { btn.disabled = true; btn.textContent = '连接中…'; }
    status('run', '正在连接 ' + (S.host || DEFA.host) + ' …');
    try {
      const meta = await jget('/api/mm/meta');
      META = meta;
      fillSelects();
      status('ok', '连接成功：可用图 ' + (META.images || []).length + ' 张');
    } catch (e) {
      status('err', '连接失败：' + (e && e.message ? e.message : e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '测试连接'; }
      PINGING = false;
    }
  }

  async function loadMeta() {
    try {
      META = await jget('/api/mm/meta');
      fillSelects();
      status('ok', '已连上 H3工作台：可用图 ' + (META.images || []).length + ' 张');
    } catch (e) {
      status('err', '连不上 H3工作台：' + (e && e.message ? e.message : e) + '\n检查：APK 开着没、地址是否 http://127.0.0.1:8899');
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
    if ($('#h3v-scene').value) images.push($('#h3v-scene').value);
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

  /* ---------- 楼层按钮 ---------- */
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
    document.querySelectorAll('#chat .mes').forEach(mes => {
      if (mes.querySelector('.h3v-msgbtn')) return;
      const textEl = mes.querySelector('.mes_text');
      if (!textEl) return;
      const btn = document.createElement('span');
      btn.className = 'h3v-msgbtn';
      btn.dataset.h3v = '1';
      btn.title = '这条出视频';
      btn.textContent = '🎬';
      try { textEl.insertAdjacentElement('afterend', btn); } catch (_) {}
    });
  }

  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#h3v-ping')) { pingNow(); return; }
    const b = t.closest('.h3v-msgbtn');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    openPanel(messageTextOf(b) || lastMessageText());
  }, true);

  const TEMPLATE = `【给角色卡 / 世界书 / 作者注释用】
每次回复正文写完后，另起一行输出下面这个块，不要解释、不要代码围栏：

[[H3]]
subject_definitions:
<Picture 1> is the identity anchor for <Subject 1>: …（角色A：脸型/发色/瞳色/服装）
<Picture 2> is the identity anchor for <Subject 2>: …（角色B）
<Picture N> is <Subject M>: …（场景图，放最后一张）
<Subject 1> is drawn in pure flat 2D Japanese anime cel style: clean ink lineart, flat color fills with simple two-tone shading, big expressive anime eyes and a small mouth; no 3D rendering, no CGI shading, no realistic skin texture anywhere.
<Subject 2> is painted in the same flat 2D anime style as <Subject 1>.
Each reference sheet is an identity reference only: each character appears exactly once; never reproduce a character sheet, panels, borders or labels; no letters, subtitles or watermarks.

summary:
[reference generation] 一句话说清这场戏，并强调画面里只有指定角色（其余座位/背景空无一人）。

retention_analysis:
<Subject 1> (appears in [Shot 1] … [Shot N]): fully_preserved - 保留脸/发/眼/服装
<Subject 2> (…): fully_preserved - …
<Subject N> (…): fully_preserved - 保留场景陈设与光线

detailed_description:
平涂 2D 动画，16:9，光线说明，镜头稳。
[Shot 1] 景别/机位/动作/表情。说话人：<Subject 1> 说 <d>[Chinese] 台词原文</d>，第一句 0.4 秒开口、3.0 秒说完。
[Shot 2] At 00:05.500 …（第 2 镜起必须带时间戳）
[Shot 3] At 00:10.000 …

overall_soundscape:
环境底噪 + 与动作同步的拟音（杯冰、椅子、脚步），台词近麦。
non_diegetic_music:
N/A
[[/H3]]`;

  /* ---------- 启动 ---------- */
  function boot() {
    try {
      ensureUI();
      attachMessageButtons();
      window.addEventListener('error', (ev) => {
        const el = $('#h3v-status');
        if (el) { el.className = 'on err'; el.textContent = '脚本错误：' + (ev && ev.message ? ev.message : ev); }
      });
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
    } catch (e) { LOG('boot error', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
