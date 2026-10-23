/* H3 视频工坊 —— SillyTavern 扩展
 * 作用：把当前/指定楼层正文里模型写好的「六段提示词」抽出来，配上角色四视图 + 场景图，
 *       直接投给同一台手机上运行的「H3工作台」APK（http://127.0.0.1:8899），由它去调 RunningHub 云端出片。
 * 不在这里配任何云端 Key —— Key 都在 H3工作台 里。
 */
(function () {
  'use strict';

  const LSKEY = 'h3video.settings.v1';
  const DEFA = {
    host: 'http://127.0.0.1:8899',
    seconds: 12,
    mp: '0.98',
    aspect: '16:9 (Widescreen)',
    steps: 12,
    del: true,
    views: ['', '', '', '', '', ''],   // 四视图：最多 6 槽（角色1..N）
    scene: '',                           // 场景图
  };
  let S = load();
  let META = { images: [] };
  let POLL = null;

  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(LSKEY) || 'null');
      return Object.assign({}, DEFA, o || {});
    } catch (_) { return Object.assign({}, DEFA); }
  }
  function save() {
    try { localStorage.setItem(LSKEY, JSON.stringify(S)); } catch (_) {}
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- 六段提示词抽取 ---------------- */
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

  /* ---------------- 面板 ---------------- */
  function buildUI() {
    if ($('#h3v-panel')) return;

    const fab = document.createElement('button');
    fab.id = 'h3v-fab';
    fab.title = 'H3 视频工坊';
    fab.textContent = '🎬';
    fab.onclick = () => openPanel(lastMessageText());
    document.body.appendChild(fab);

    const p = document.createElement('div');
    p.id = 'h3v-panel';
    p.innerHTML = `
      <h3>🎬 H3 视频工坊 <span class="hint" style="font-weight:400">→ 手机 H3工作台</span></h3>

      <div class="row">
        <label>H3 地址</label>
        <input type="text" id="h3v-host" value="${esc(S.host)}" placeholder="http://127.0.0.1:8899">
        <button id="h3v-ping">测试</button>
      </div>

      <div class="row"><label>四视图</label><span class="hint" id="h3v-viewsHint">按 <Picture 1..N> 顺序，角色几号就放几号</span></div>
      <div id="h3v-views"></div>

      <div class="row"><label>场景图</label>
        <select id="h3v-scene" style="flex:1"></select>
        <button id="h3v-sceneUp">传</button>
      </div>

      <div class="row">
        <label>时长(秒)</label><input type="text" id="h3v-sec" value="${esc(S.seconds)}" style="max-width:64px;flex:none">
        <label style="min-width:auto">清晰度</label>
        <select id="h3v-mp" style="max-width:150px;flex:none">
          <option value="0.5">0.5MP 960×544</option>
          <option value="0.98">0.98MP 1344×768</option>
          <option value="1.5">1.5MP 1664×928</option>
        </select>
        <label style="min-width:auto">步数</label><input type="text" id="h3v-steps" value="${esc(S.steps)}" style="max-width:56px;flex:none">
      </div>

      <div class="row"><label>六段提示词</label></div>
      <textarea id="h3v-prompt" placeholder="点楼层上的 🎬 会自动抓 [[H3]]…[[/H3]] 之间的内容；也可以直接粘贴"></textarea>

      <div class="row" style="margin-top:8px">
        <button class="primary" id="h3v-run">生成视频</button>
        <button id="h3v-tpl">复制提示词模板</button>
        <label style="min-width:auto"><input type="checkbox" id="h3v-del" ${S.del ? 'checked' : ''}> 跑完删云端</label>
      </div>

      <div id="h3v-status"></div>
      <div id="h3v-out"></div>
    `;
    document.body.appendChild(p);

    // 四视图 6 行
    const wrap = $('#h3v-views');
    for (let i = 0; i < 6; i++) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<label>角色${i + 1}</label>
        <select data-v="${i}" style="flex:1"></select>
        <button data-up="${i}" style="flex:none">传</button>`;
      wrap.appendChild(row);
    }

    $('#h3v-host').onchange = () => { S.host = $('#h3v-host').value.trim().replace(/\/+$/, '') || DEFA.host; save(); loadMeta(); };
    $('#h3v-ping').onclick = ping;
    $('#h3v-sec').onchange = () => { S.seconds = Number($('#h3v-sec').value) || 12; save(); };
    $('#h3v-steps').onchange = () => { S.steps = Number($('#h3v-steps').value) || 12; save(); };
    $('#h3v-mp').onchange = () => { S.mp = $('#h3v-mp').value; save(); };
    $('#h3v-del').onchange = () => { S.del = $('#h3v-del').checked; save(); };
    $('#h3v-tpl').onclick = copyTemplate;
    $('#h3v-run').onclick = runVideo;

    wrap.querySelectorAll('select[data-v]').forEach(sel => {
      sel.onchange = () => { S.views[Number(sel.dataset.v)] = sel.value; save(); };
    });
    wrap.querySelectorAll('button[data-up]').forEach(btn => {
      btn.onclick = () => pickAndUpload(Number(btn.dataset.up));
    });
    $('#h3v-sceneUp').onclick = () => pickAndUpload(-1);
    $('#h3v-scene').onchange = () => { S.scene = $('#h3v-scene').value; save(); };
  }

  function openPanel(text) {
    buildUI();
    const p = $('#h3v-panel');
    p.classList.add('on');
    const ex = extractPrompt(text || lastMessageText());
    if (ex) $('#h3v-prompt').value = ex;
    fillSelects();
    if (!META.images.length) loadMeta();
  }

  function fillSelects() {
    const opts = ['<option value="">（不用）</option>']
      .concat((META.images || []).map(n => `<option value="${esc(n)}">${esc(n)}</option>`)).join('');
    document.querySelectorAll('#h3v-views select[data-v]').forEach((sel, i) => {
      sel.innerHTML = opts;
      sel.value = S.views[i] || '';
    });
    const sc = $('#h3v-scene');
    sc.innerHTML = '<option value="">（不用）</option>' +
      (META.images || []).map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    sc.value = S.scene || '';
    $('#h3v-mp').value = S.mp;
  }

  /* ---------------- 与 H3工作台 通信 ---------------- */
  function api(path) { return (S.host || DEFA.host) + path; }

  async function jget(path) {
    const r = await fetch(api(path), { method: 'GET' });
    const t = await r.text();
    let j = {}; try { j = JSON.parse(t); } catch (_) { throw new Error('返回不是 JSON：' + t.slice(0, 120)); }
    if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  async function jpost(path, body) {
    const r = await fetch(api(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
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
      status('err', '连不上 H3工作台：' + e.message + '\n检查：APK 是否开着、地址是否为 http://127.0.0.1:8899');
    }
  }

  async function ping() {
    try { await loadMeta(); } catch (e) { status('err', e.message); }
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
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: f,
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        if (slot >= 0) S.views[slot] = j.name; else S.scene = j.name;
        save();
        await loadMeta();
        status('ok', '已上传：' + j.name);
      } catch (e) { status('err', '上传失败：' + e.message); }
    };
    inp.click();
  }

  async function runVideo() {
    const prompt = $('#h3v-prompt').value.trim();
    if (!prompt) { status('err', '没有提示词。先在楼层里让模型输出 [[H3]]…[[/H3]]，或直接粘六段。'); return; }

    const images = [];
    for (let i = 0; i < 6; i++) {
      const v = ($('#h3v-views').querySelector(`select[data-v="${i}"]`) || {}).value;
      if (v) images.push(v);
    }
    const scene = $('#h3v-scene').value;
    if (scene) images.push(scene);
    if (!images.length) { status('err', '至少放一张图（四视图或场景图）'); return; }

    const btn = $('#h3v-run');
    btn.disabled = true;
    status('run', '提交中…（图 ' + images.length + ' 张，' + $('#h3v-sec').value + ' 秒）');
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
      status('run', '已提交 taskId=' + j.taskId + '\n云端排队/跑片大约 4–7 分钟…');
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
    if (!el) return;
    el.className = 'on ' + kind;
    el.textContent = text;
  }

  function copyTemplate() {
    const t = TEMPLATE;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => status('ok', '模板已复制，粘到角色卡/世界书/作者注释里'), () => status('err', '复制失败，手动选吧'));
    else status('err', '这个浏览器不支持自动复制');
  }

  /* ---------------- 楼层按钮 ---------------- */
  function lastMessageText() {
    const list = document.querySelectorAll('#chat .mes');
    if (!list.length) return '';
    const last = list[list.length - 1];
    const t = last.querySelector('.mes_text');
    return t ? t.innerText : last.innerText;
  }

  function attachMessageButtons() {
    document.querySelectorAll('#chat .mes').forEach(mes => {
      if (mes.querySelector('.h3v-msgbtn')) return;
      const textEl = mes.querySelector('.mes_text');
      if (!textEl) return;
      const btn = document.createElement('span');
      btn.className = 'h3v-msgbtn';
      btn.title = '这条出视频';
      btn.textContent = '🎬';
      btn.onclick = (ev) => {
        ev.stopPropagation();
        const t = textEl.innerText || '';
        buildUI();
        $('#h3v-panel').classList.add('on');
        const ex = extractPrompt(t);
        $('#h3v-prompt').value = ex || $('#h3v-prompt').value;
        if (!ex) status('err', '这条没有 [[H3]] 六段块。先让模型按模板写，或手动粘。');
        fillSelects();
        loadMeta();
      };
      textEl.insertAdjacentElement('afterend', btn);
    });
  }

  const TEMPLATE = `【给角色卡 / 世界书 / 作者注释用】
每次回复正文写完后，另起一行输出下面这个块，不要解释、不要代码围栏：

[[H3]]
subject_definitions:
<Picture 1> is the identity anchor for <Subject 1>: …（角色A：脸型/发色/瞳色/服装）
<Picture 2> is the identity anchor for <Subject 2>: …（角色B）
<Picture N> is <Subject M>: …（场景图，放在最后一张）
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

  /* ---------------- 启动 ---------------- */
  function boot() {
    buildUI();
    attachMessageButtons();
    try {
      const ctx = window.SillyTavern && window.SillyTavern.getContext ? window.SillyTavern.getContext() : null;
      if (ctx && ctx.eventSource && ctx.eventTypes) {
        ctx.eventSource.on(ctx.eventTypes.MESSAGE_RENDERED, () => setTimeout(attachMessageButtons, 150));
        ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => setTimeout(attachMessageButtons, 300));
      }
    } catch (_) {}
    const mo = new MutationObserver(() => { clearTimeout(boot._t); boot._t = setTimeout(attachMessageButtons, 250); });
    const chat = document.getElementById('chat');
    if (chat) mo.observe(chat, { childList: true, subtree: false });
    loadMeta();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
