/* H3 视频工坊 —— SillyTavern 扩展（<dialog> 顶层弹窗，绝不会被正文盖住）
 * 楼层里的「六段提示词」+ 角色四视图/场景图 → 手机上的 H3工作台（127.0.0.1:8899）出片。
 * 不在这里配任何云端 Key。
 */
(function () {
  'use strict';

  const LOG = (...a) => { try { console.log('[h3v]', ...a); } catch (_) {} };
  const LSKEY = 'h3video.settings.v1';
  const DEFA = { host: 'http://127.0.0.1:8899', seconds: 12, mp: '0.98', aspect: '16:9 (Widescreen)', steps: 12, del: true, views: ['', '', '', '', '', ''], scene: '', inject: false, aiMode: 'st', aiBase: '', aiKey: '', aiModel: '' };

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
        <img id="h3v-scenePv" class="pv" alt="">

        <div class="row">
          <label style="min-width:auto"><input type="checkbox" id="h3v-inject" ${S.inject ? 'checked' : ''}> 自动要求模型输出六段</label>
          <button id="h3v-injectBtn">立即注入</button>
          <span class="hint" id="h3v-injectState"></span>
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

        <div class="row">
          <label>AI 补全</label>
          <select id="h3v-aiMode" style="flex:1">
            <option value="st">用酒馆当前连接 / 对话补全预设（和主界面一样）</option>
            <option value="api">自定义 API</option>
          </select>
          <button class="primary" id="h3v-gen" style="flex:none">按正文生成（自动分段）</button>
          <button id="h3v-aidiag" style="flex:none">诊断 ST</button>
        </div>
        <div id="h3v-apiBox" style="display:none">
          <div class="row"><label>API 地址</label><input type="text" id="h3v-aiBase" placeholder="https://api.deepseek.com/v1"></div>
          <div class="row"><label>API Key</label><input type="password" id="h3v-aiKey" placeholder="sk-…（只存本机）"></div>
          <div class="row"><label>模型</label>
            <select id="h3v-aiModel" style="flex:1"></select>
            <button id="h3v-models" style="flex:none">拉取模型</button>
          </div>
          <p class="hint">填地址后点「拉取模型」，列表从 /models 自动取，不用手打模型名。</p>
        </div>

        <div class="row"><label>分段</label>
          <select id="h3v-block" style="flex:1"></select>
          <span class="hint" id="h3v-blockHint"></span>
        </div>

        <div class="row" style="margin-top:8px">
          <button class="primary" id="h3v-run">生成这一条</button>
          <button id="h3v-runAll">全部按顺序生成</button>
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
      const pv = document.createElement('img');
      pv.className = 'pv';
      pv.dataset.pv = String(i);
      pv.alt = '';
      wrap.appendChild(pv);
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
    if ($('#h3v-runAll')) $('#h3v-runAll').onclick = runAllBlocks;
    if ($('#h3v-prompt')) {
      $('#h3v-prompt').addEventListener('input', () => {
        clearTimeout(ensureUI._t);
        ensureUI._t = setTimeout(refreshBlockList, 400);
      });
    }
    dlg.addEventListener('close', () => { dlg.style.display = 'none'; });
    dlg.addEventListener('cancel', () => { dlg.style.display = 'none'; });

    wrap.querySelectorAll('select[data-v]').forEach(sel => { sel.onchange = () => { S.views[Number(sel.dataset.v)] = sel.value; saveS(); }; });
    wrap.querySelectorAll('button[data-up]').forEach(btn => { btn.onclick = () => pickAndUpload(Number(btn.dataset.up)); });
    $('#h3v-sceneUp').onclick = () => pickAndUpload(-1);
    $('#h3v-scene').onchange = () => { S.scene = $('#h3v-scene').value; saveS(); updatePreviews(); };
    wrap.querySelectorAll('select[data-v]').forEach(sel => {
      sel.addEventListener('change', updatePreviews);
    });

    if ($('#h3v-inject')) {
      $('#h3v-inject').checked = S.inject !== false;
      $('#h3v-inject').onchange = () => { S.inject = $('#h3v-inject').checked; saveS(); applyInjection(true); };
    }
    if ($('#h3v-injectBtn')) $('#h3v-injectBtn').onclick = () => applyInjection(true);

    if ($('#h3v-aiMode')) {
      $('#h3v-aiMode').value = S.aiMode || 'st';
      $('#h3v-aiMode').onchange = () => { S.aiMode = $('#h3v-aiMode').value; saveS(); syncAiMode(); };
      $('#h3v-aiBase').value = S.aiBase || '';
      $('#h3v-aiKey').value = S.aiKey || '';
      $('#h3v-aiBase').onchange = () => { S.aiBase = $('#h3v-aiBase').value.trim(); saveS(); };
      $('#h3v-aiKey').onchange = () => { S.aiKey = $('#h3v-aiKey').value.trim(); saveS(); };
      $('#h3v-aiModel').onchange = () => { S.aiModel = $('#h3v-aiModel').value; saveS(); };
      $('#h3v-models').onclick = fetchModels;
      if (S.aiModel) $('#h3v-aiModel').innerHTML = `<option value="${esc(S.aiModel)}">${esc(S.aiModel)}</option>`;
      syncAiMode();
    }
    if ($('#h3v-gen')) $('#h3v-gen').onclick = genSix;
    if ($('#h3v-aidiag')) $('#h3v-aidiag').onclick = aiDiag;

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
      const t = text || lastMessageText();
      CURTEXT = t || '';
      const ex = extractPrompt(t);
      if (ex) { $('#h3v-prompt').value = ex; status('ok', '已抓到这条的六段提示词'); }
      refreshBlockList();
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
    updatePreviews();
  }

  function previewUrl(name) {
    return api('/api/preview?type=input&filename=' + encodeURIComponent(name) + '&t=' + Date.now());
  }

  function updatePreviews() {
    for (let i = 0; i < 6; i++) {
      const sel = document.querySelector(`#h3v-views select[data-v="${i}"]`);
      const img = document.querySelector(`#h3v-views img[data-pv="${i}"]`);
      if (!img) continue;
      const v = sel ? sel.value : '';
      if (v) { img.src = previewUrl(v); img.style.display = 'block'; }
      else { img.removeAttribute('src'); img.style.display = 'none'; }
    }
    const sc = $('#h3v-scene'), si = $('#h3v-scenePv');
    if (si) {
      if (sc && sc.value) { si.src = previewUrl(sc.value); si.style.display = 'block'; }
      else { si.removeAttribute('src'); si.style.display = 'none'; }
    }
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
        try {
          const img = slot >= 0
            ? document.querySelector(`#h3v-views img[data-pv="${slot}"]`)
            : $('#h3v-scenePv');
          if (img) { img.src = URL.createObjectURL(f); img.style.display = 'block'; }
        } catch (_) {}
        await loadMeta();
        status('ok', '已上传：' + j.name);
      } catch (e) { status('err', '上传失败：' + e.message); }
    };
    inp.click();
  }

  /* ---------- 分段解析 ---------- */
  function parseBlocks(text) {
    const out = [];
    const re = /\[\[H3\]\]([\s\S]*?)\[\[\/H3\]\]/g;
    let m;
    while ((m = re.exec(text || ''))) out.push(m[1].trim());
    if (!out.length) { const e = extractPrompt(text); if (e) out.push(e); }
    return out;
  }

  function blockSeconds(b) {
    let max = 0;
    const re = /At\s+(\d{1,2}):(\d{2})\.(\d{3})/g;
    let m;
    while ((m = re.exec(b))) {
      const s = Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 1000;
      if (s > max) max = s;
    }
    let v = max > 0 ? Math.ceil(max * 2) / 2 + 0.6 : (Number(S.seconds) || 15);
    v = Math.min(15, Math.max(3, v));
    return Math.round(v * 2) / 2;
  }

  function refreshBlockList() {
    const sel = $('#h3v-block');
    if (!sel) return;
    const blocks = parseBlocks($('#h3v-prompt').value);
    const prev = sel.value;
    sel.innerHTML = blocks.map((b, i) => {
      const d = blockSeconds(b);
      return `<option value="${i}">第 ${i + 1} 条 · ${d}s${i === 0 ? ' · 从 0 秒开始' : ''}</option>`;
    }).join('') || '<option value="0">（没有 [[H3]] 块）</option>';
    if (prev && Number(prev) < blocks.length) sel.value = prev;
    const total = blocks.reduce((a, b) => a + blockSeconds(b), 0);
    const hint = $('#h3v-blockHint');
    if (hint) hint.textContent = blocks.length ? (blocks.length + ' 条 · 合计 ' + total.toFixed(1) + ' 秒') : '没解析到 [[H3]] 块';
    if ($('#h3v-runAll')) $('#h3v-runAll').disabled = blocks.length < 2;
  }

  /* ---------- 提交 / 轮询（支持多条顺序跑） ---------- */
  async function submitBlock(blockText, seconds) {
    const images = [];
    for (let i = 0; i < 6; i++) {
      const sel = document.querySelector(`#h3v-views select[data-v="${i}"]`);
      if (sel && sel.value) images.push(sel.value);
    }
    if ($('#h3v-scene').value) images.push($('#h3v-scene').value);
    if (!images.length) throw new Error('至少放一张图（四视图或场景图）');
    const j = await jpost('/api/mm/run', {
      images: images,
      prompt: blockText,
      seconds: seconds,
      megapixels: Number($('#h3v-mp').value) || 0.98,
      aspect: S.aspect,
      steps: Number($('#h3v-steps').value) || 12,
      deleteCloud: $('#h3v-del').checked,
    });
    return j.taskId;
  }

  function waitTask(taskId, label) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const timer = setInterval(async () => {
        const el = Math.round((Date.now() - t0) / 1000);
        try {
          const j = await jget('/api/status?id=' + encodeURIComponent(taskId));
          if (j.state === 'done') {
            clearInterval(timer);
            if (j.status === 'error') return reject(new Error(j.message || '云端报错'));
            resolve({ items: (j.items || []).filter(x => x.isVideo), coins: j.coins || 0, secs: el });
          } else {
            status('run', (label ? label + ' · ' : '') + (j.state === 'running' ? '云端正在跑' : '排队中')
              + '… ' + Math.floor(el / 60) + ' 分 ' + (el % 60) + ' 秒');
          }
        } catch (e) { status('run', '查询抖动，继续等：' + e.message); }
      }, 10000);
    });
  }

  function showVideos(r, label) {
    const html = r.items.map(v =>
      `<div style="margin-top:10px"><div class="hint">${esc(label || '')}</div>
       <video src="${api(v.url)}" controls playsinline></video>
       <div><a href="${api(v.url)}" download="${esc(v.filename || 'h3.mp4')}">下载</a></div></div>`).join('');
    $('#h3v-out').innerHTML = html + $('#h3v-out').innerHTML;
  }

  async function runOne(blockText, seconds, label) {
    status('run', (label ? label + ' · ' : '') + '提交中…');
    const id = await submitBlock(blockText, seconds);
    status('run', (label ? label + ' · ' : '') + 'taskId=' + id + '，云端跑片约 4–7 分钟…');
    return await waitTask(id, label);
  }

  async function runVideo() {
    const blocks = parseBlocks($('#h3v-prompt').value);
    if (!blocks.length) { status('err', '没有提示词：点「按正文生成（自动分段）」或直接粘'); return; }
    const sel = Number(($('#h3v-block') || {}).value || 0);
    const idx = Math.min(sel, blocks.length - 1);
    const b = blocks[idx];
    const sec = blockSeconds(b);
    const btn = $('#h3v-run');
    btn.disabled = true;
    try {
      const r = await runOne(b, sec, '第' + (idx + 1) + '条');
      showVideos(r, '第 ' + (idx + 1) + ' 条 · ' + sec + 's');
      status('ok', '第' + (idx + 1) + '条完成 · 用时 ' + Math.floor(r.secs / 60) + ' 分 ' + (r.secs % 60) + ' 秒'
        + (r.coins ? ' · ' + r.coins + ' 币' : ''));
    } catch (e) { status('err', '失败：' + e.message); }
    btn.disabled = false;
    refreshBlockList();
  }

  async function runAllBlocks() {
    const blocks = parseBlocks($('#h3v-prompt').value);
    if (!blocks.length) { status('err', '没有提示词'); return; }
    if (blocks.length === 1) return runVideo();
    const btn = $('#h3v-runAll');
    btn.disabled = true;
    let okN = 0, coins = 0;
    for (let i = 0; i < blocks.length; i++) {
      const sec = blockSeconds(blocks[i]);
      status('run', '第 ' + (i + 1) + ' / ' + blocks.length + ' 条提交中…（' + sec + 's）');
      try {
        const r = await runOne(blocks[i], sec, '第' + (i + 1) + '/' + blocks.length + '条');
        okN++; coins += r.coins;
        showVideos(r, '第 ' + (i + 1) + ' 条 · ' + sec + 's');
      } catch (e) {
        status('err', '第 ' + (i + 1) + ' 条失败：' + e.message + '（继续下一条）');
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    btn.disabled = false;
    status('ok', '全部跑完：成功 ' + okN + ' / ' + blocks.length + ' 条' + (coins ? ' · 共 ' + coins + ' 币' : ''));
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

  const INJECT = `[H3 视频] 这次回复正文之后，按 MiniMax H3 官方全参考模式（Ref2VA）补一个提示词块：[[H3]] 开头、[[/H3]] 结尾，六段顺序固定 subject_definitions / summary / retention_analysis / detailed_description / overall_soundscape / non_diegetic_music。
要点（官方格式）：
1) 六段用英文；台词保留原语言，写成 <d>[Chinese] …</d>。
2) subject_definitions 里把人物/场景/道具定义成 <Subject N>；参考图只用于身份/场景时，把来源写进该 Subject（如 <Subject 1> is the young woman in <Picture 1>, …），不单独写 <Picture N> 行；只有当某图就是某镜首帧/关键帧时才单独写 <Picture N> is the first frame of [Shot 1] …。
3) summary 一段英文，以 [reference generation] 这类方括号任务类型开头，只用已定义标签。
4) retention_analysis 每个标签一行：<Subject 1> (appears in [Shot 1], [Shot 3]): fully_preserved - …（或 partially_preserved / attribute_transfer / weak_reference），这里不写 (Sx)。
5) detailed_description 先一到两句风格，再逐镜头：[Shot 1] 无时间戳，第 2 镜起 [Shot N] At MM:SS.mmm, …；写清构图、主体外观与位置、环境光线、动作、镜头运动、同期声；说话人用 (S1)(S2)，引用主体写 <Subject N> (Sx)；生成类任务 350–500 英文词。
6) overall_soundscape 写全片环境声与物理声；non_diegetic_music 写只有观众听到的配乐（没有就 N/A）。
7) 心理活动/内心独白转成画外音旁白：<Subject N> (Sx, off-screen voice-over) says, <d>[Chinese] …</d>；真说出口的话写 <Subject N> (Sx) says, <d>[Chinese] …</d>。两者都不要丢。
8) 六段各出现一次，不要在 detailed_description 里重开 subject_definitions。
9) 总时长与用户给的秒数一致；不要写成剧情梗概；六段之外不要任何解释。`;

  function applyInjection(verbose) {
    const on = $('#h3v-inject') ? $('#h3v-inject').checked : true;
    let ok = false, why = '';
    try {
      const ctx = window.SillyTavern.getContext();
      if (ctx && typeof ctx.setExtensionPrompt === 'function') {
        const types = ctx.extension_prompt_types || {};
        const pos = (types.IN_CHAT != null) ? types.IN_CHAT : 1;
        ctx.setExtensionPrompt('h3v_six', on ? INJECT : '', pos, 0, false, 0);
        ok = true;
      } else why = '这个酒馆版本没有 setExtensionPrompt（升级酒馆，或把模板手动粘进角色卡/世界书）';
    } catch (e) { why = e.message; }
    const st = $('#h3v-injectState');
    if (st) st.textContent = ok ? (on ? '已注入：每次回复都要求六段' : '注入已关') : ('注入失败：' + why);
    if (verbose) status(ok ? 'ok' : 'err', ok ? (on ? '已把「输出六段」注入提示词' : '已关闭注入') : '注入失败：' + why);
  }

  /* ---------- AI 按正文生成（自动分段） ---------- */
  let CURTEXT = '';

  const SIX_SYS = `你是 MiniMax H3 全参考模式（Ref2VA）提示词作者。把用户给的正文改写成官方六段格式。

【先分条】先估算这段正文完整演完需要多少秒（按镜头节奏，不硬凑也不硬砍）。H3 单条视频最长 15 秒、最短 4 秒，所以：
- 要 N 条就输出 N 个 [[H3]]…[[/H3]] 块，块与块之间空一行；
- 每块都是**完整六段**（subject_definitions / summary / retention_analysis / detailed_description / overall_soundscape / non_diegetic_music），不是把六段拆开；
- <Subject N> 编号在所有块之间保持一致；每块的 [Shot 1] 从 0 秒重新开始，块内最后一镜不超过 14.5 秒；
- 不要把两分钟的剧情硬塞进一条 15 秒，也不要为了凑数把一段戏砍碎。

【六段规则】
1) 六段全写英文；只有台词、歌词、画面里可见的文字保留原语言，台词写成 <d>[Chinese] …</d>。
2) subject_definitions：把要复用的可见内容逐个定义为 <Subject N>（人物、场景、服装道具等），每个一行，说明标签指什么、主要特征。参考图仅用于定义角色/场景/服装/风格时，不要单独写 <Picture N> 行，把来源写进对应 Subject，例如：<Subject 1> is the young woman in <Picture 1>, with long dark hair, wearing …, 只有当某张图本身是某镜首帧/关键帧/尾帧/构图锚点时，才单独写 <Picture N> is the first frame of [Shot 1], …
3) summary：一段英文，以方括号任务类型开头（如 [reference generation]），只用已定义的标签，不引入新标签。
4) retention_analysis：每个标签一行，格式 <Subject 1> (appears in [Shot 1], [Shot 3]): fully_preserved - …；可选标记 partially_preserved / attribute_transfer / weak_reference；这里不写 (Sx)。
5) detailed_description：先一到两句全片风格，再逐镜头。[Shot 1] 不带时间戳；第 2 镜起 [Shot N] At MM:SS.mmm, …。每镜写清构图、主体外观与位置、环境与光线、动作与状态变化、镜头运动、同期声音，以及参考内容出现的准确时点。说话人给稳定编号 (S1)(S2)…，引用主体时写 <Subject N> (Sx)。生成类任务正文约 350–500 英文词。
6) overall_soundscape：全片环境声与物理声概述（对白与逐镜同步音留在 detailed_description）。
7) non_diegetic_music：只有观众能听到的配乐，写乐器/速度/动态；没有就写 N/A。
8) 正文里的心理活动、内心独白（斜体、*…*、【心想】这类）要转成画外音旁白，写在 detailed_description 里：<Subject N> (Sx, off-screen voice-over) says, <d>[Chinese] …</d>；角色真正说出口的话写 <Subject N> (Sx) says, <d>[Chinese] …</d>。两种都要保留，不要丢。
9) 六段每段只出现一次；不要在 detailed_description 里重新开始写 subject_definitions / summary / retention_analysis。
10) 总时长必须与用户给的秒数一致；不要写成剧情梗概。`;

  function sixUser(text) {
    return '正文：\n"""\n' + text + '\n"""\n\n按上面这段正文写六段视频提示词（[[H3]]…[[/H3]]）。';
  }

  async function loadSTScript() {
    try {
      const srcs = Array.from(document.querySelectorAll('script[src]')).map(x => x.src);
      const s = srcs.find(u => /\/script\.js(\?|$)/.test(u));
      if (!s) return null;
      return await import(s);
    } catch (e) { LOG('import script.js fail', e); return null; }
  }

  async function stGenerate(sys, user, len) {
    const maxLen = len || 1600;
    const ctx = window.SillyTavern.getContext();
    if (!ctx) throw new Error('拿不到 SillyTavern 上下文');
    const tries = [];

    // 1) 上下文里自带
    if (typeof ctx.generateQuietPrompt === 'function') {
      try {
        const r = await ctx.generateQuietPrompt({ quietPrompt: sys + '\n\n' + user, quietName: 'h3v-six', responseLength: maxLen });
        if (r) return String(r);
      } catch (e) { tries.push('ctx.generateQuietPrompt: ' + e.message); }
    }
    // 2) generateRaw（换几种参数写法，绕开 "No message generated"）
    if (typeof ctx.generateRaw === 'function') {
      const variants = [
        { systemPrompt: sys, prompt: user, responseLength: maxLen },
        { systemPrompt: sys, prompt: user },
        { prompt: sys + '\n\n' + user },
        { prompt: user },
      ];
      for (let vi = 0; vi < variants.length; vi++) {
        try {
          const r = await ctx.generateRaw(variants[vi]);
          if (r && String(r).trim()) return String(r);
          tries.push('ctx.generateRaw#' + (vi + 1) + ': 空输出');
        } catch (e) { tries.push('ctx.generateRaw#' + (vi + 1) + ': ' + e.message); }
      }
    }
    // 3) 动态 import script.js（老版本把函数放在那里）
    const mod = await loadSTScript();
    if (mod && typeof mod.generateQuietPrompt === 'function') {
      try {
        const r = await mod.generateQuietPrompt({ quietPrompt: sys + '\n\n' + user, quietName: 'h3v-six', responseLength: maxLen });
        if (r) return String(r);
      } catch (e) { tries.push('script.generateQuietPrompt: ' + e.message); }
    }
    if (mod && typeof mod.generateRaw === 'function') {
      try {
        const r = await mod.generateRaw({ systemPrompt: sys, prompt: user, responseLength: maxLen });
        if (r) return String(r);
      } catch (e) { tries.push('script.generateRaw: ' + e.message); }
    }
    // 4) 直接打酒馆自己的补全代理（用当前连接设置）
    try {
      const r = await proxyGenerate(sys, user, maxLen);
      if (r) return r;
    } catch (e) { tries.push('backend proxy: ' + e.message); }

    throw new Error('都试过了没用：' + (tries.join(' | ') || '没有可用的生成接口'));
  }

  function stHeaders() {
    const h = { 'Content-Type': 'application/json' };
    try {
      const ctx = window.SillyTavern.getContext();
      if (ctx && typeof ctx.getRequestHeaders === 'function') Object.assign(h, ctx.getRequestHeaders());
    } catch (_) {}
    if (!h['X-CSRF-Token']) {
      const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
      if (m) h['X-CSRF-Token'] = decodeURIComponent(m[1]);
    }
    return h;
  }
  async function proxyGenerate(sys, user, len) {
    const ctx = window.SillyTavern.getContext();
    const s = ctx.chatCompletionSettings || {};
    const src = s.chat_completion_source || 'openai';
    const model = s.openai_model || s.claude_model || s.openrouter_model || s.custom_model || s.model || '';
    const body = {
      chat_completion_source: src,
      model: model,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      temperature: (s.temperature != null ? s.temperature : 0.7),
      max_tokens: len || 1600,
      stream: false,
    };
    ['reverse_proxy', 'proxy_password', 'proxy_url', 'custom_url', 'custom_include_body', 'custom_exclude_body',
      'custom_include_headers', 'openai_model', 'claude_model', 'google_model', 'vertexai_model', 'mistralai_model',
      'cohere_model', 'perplexity_model', 'groq_model', 'deepseek_model', 'xai_model'].forEach(k => {
        if (s[k] !== undefined && s[k] !== null && s[k] !== '') body[k] = s[k];
      });
    const r = await withTimeout(fetch('/api/backends/chat-completions/generate', {
      method: 'POST', headers: stHeaders(), body: JSON.stringify(body),
    }), 120000, '酒馆补全代理 ');
    const t = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status + '：' + t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120));
    let j = null; try { j = JSON.parse(t); } catch (_) {}
    if (!j) throw new Error('返回不是 JSON：' + t.slice(0, 160));
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error).slice(0, 160));
    const txt = (j.choices && j.choices[0] && (j.choices[0].message ? j.choices[0].message.content : j.choices[0].text)) || j.content || '';
    if (!txt) throw new Error('代理没返回内容');
    return String(txt);
  }

  /* ---------- 两步：先规划时长与分镜，再逐段写六段 ---------- */
  const CAST_SYS = `你是造型设定提取器。读用户给的角色扮演/小说正文，把**所有出场人物与主要场景**的外观固定下来，供后续每一段视频复用。
只输出纯文本，每行一个标签，格式：
<Subject 1>: 名字 + 年龄 + 脸/发/瞳/体型 + 服装（颜色款式）+ 是否赤脚
<Subject 2>: 场景名 + 关键陈设与光线
规则：只写正文里出现过的；外观写具体（颜色、款式），不写情绪；人物按出场顺序编号；最多 6 行；不要解释。`;

  function normalizeBlock(b) {
    let s = String(b || '');
    s = s.replace(/^#{1,6}\s*/gm, '');
    const names = 'subject_definitions|summary|retention_analysis|detailed_description|overall_soundscape|non_diegetic_music';
    s = s.replace(new RegExp('\\*\\*(' + names + ')\\*\\*:?', 'gi'), '$1:');
    s = s.replace(new RegExp('<(' + names + ')>:?', 'gi'), '$1:');
    s = s.replace(new RegExp('</(' + names + ')>', 'gi'), '');
    s = s.split('\n').filter(l => !/(选项|卡片|caption|字幕|界面文字|按钮|option cards?|选择肢)/i.test(l)).join('\n');
    return s.trim();
  }
  const PLAN_SYS = `你是视频分镜规划器。读用户给的正文，判断整段完整演完需要多少秒（按真实节奏估，不硬砍也不注水），并按每段最多 15 秒、最少 4 秒切分。
只输出纯文本，格式严格如下，不要解释、不要代码块：
总时长: 120s
1|0-15|这一段的画面与动作要点（含说出口的台词、内心独白）
2|15-30|…
（每行一段，段数与总时长匹配；最后一段不超过 15 秒）`;

  function parsePlan(text) {
    const out = { total: 0, segs: [] };
    const mt = String(text || '').match(/总时长\s*[:：]\s*(\d+(?:\.\d+)?)\s*s/i);
    if (mt) out.total = Number(mt[1]);
    const re = /^\s*(\d+)\s*[|｜]\s*(\d+(?:\.\d+)?)\s*[-–~]\s*(\d+(?:\.\d+)?)\s*[|｜]\s*(.+)$/gm;
    let m;
    while ((m = re.exec(text || ''))) {
      out.segs.push({ i: Number(m[1]), from: Number(m[2]), to: Number(m[3]), beat: m[4].trim() });
    }
    if (!out.segs.length) {
      // 兜底：按总时长或 15 秒切
      const total = out.total || 15;
      const n = Math.max(1, Math.min(12, Math.ceil(total / 15)));
      for (let i = 0; i < n; i++) out.segs.push({ i: i + 1, from: i * 15, to: Math.min((i + 1) * 15, total), beat: '' });
    }
    if (!out.total) out.total = out.segs[out.segs.length - 1].to;
    return out;
  }

  function callAI(sys, user, len) {
    return (S.aiMode === 'api') ? apiGenerate(sys, user, len) : stGenerate(sys, user, len);
  }

  function aiDiag() {
    const ctx = window.SillyTavern.getContext ? window.SillyTavern.getContext() : null;
    if (!ctx) { status('err', '拿不到 SillyTavern.getContext()'); return; }
    const fns = ['generateQuietPrompt', 'generateRaw', 'generate', 'executeSlashCommands', 'executeSlashCommandsWithOptions']
      .map(k => k + '=' + (typeof ctx[k])).join(', ');
    const s = ctx.chatCompletionSettings || {};
    status('ok', 'ST API：' + fns + '\n连接源=' + (s.chat_completion_source || '?')
      + ' 模型=' + (s.openai_model || s.claude_model || s.custom_model || '?')
      + '\n(ctx 可用项 ' + Object.keys(ctx).length + ' 个)');
  }

  async function apiGenerate(sys, user, len) {
    const base = (S.aiBase || '').trim().replace(/\/+$/, '');
    const key = (S.aiKey || '').trim();
    const model = (S.aiModel || '').trim();
    if (!base) throw new Error('先填自定义 API 地址');
    if (!model) throw new Error('先点「拉取模型」选一个');
    const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
    const r = await withTimeout(fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { Authorization: 'Bearer ' + key } : {}),
      body: JSON.stringify({ model: model, temperature: 0.6, max_tokens: (len || 1600), stream: false, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
    }), 90000, 'AI 请求 ');
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (_) {}
    if (!j) throw new Error('返回不是 JSON：' + t.slice(0, 140));
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error).slice(0, 140));
    const ch = j.choices && j.choices[0];
    const txt = ch && ch.message ? ch.message.content : (ch ? ch.text : '');
    if (!txt) throw new Error('AI 没返回内容');
    return String(txt);
  }

  async function genSix() {
    const text = (CURTEXT || lastMessageText() || '').trim();
    if (!text) { status('err', '没有正文：先在楼层点 🎬 打开面板'); return; }
    const btn = $('#h3v-gen');
    btn.disabled = true;
    const t0 = Date.now();
    try {
      status('run', '① 先估时长 / 排分镜…');
      const planTxt = await callAI(PLAN_SYS, '正文：\n"""\n' + text + '\n"""', 900);
      const plan = parsePlan(planTxt);
      status('run', '规划：总时长约 ' + plan.total + ' 秒，分 ' + plan.segs.length + ' 段；锁定角色外观…');
      let castText = '';
      try { castText = String(await callAI(CAST_SYS, '正文：\n"""\n' + text + '\n"""', 600)).trim(); } catch (e) { LOG('cast fail', e); }
      status('run', '角色外观已锁定（' + (castText ? castText.split('\n').length : 0) + ' 行）；开始逐段写六段…');

      const allBeats = plan.segs.map(s => s.i + '. ' + (s.beat || '')).join('\n');
      const blocks = [];
      for (let i = 0; i < plan.segs.length; i++) {
        const seg = plan.segs[i];
        const sec = Math.min(15, Math.max(3, Math.round((seg.to - seg.from) * 2) / 2));
        const user = '正文：\n"""\n' + text + '\n"""\n\n'
          + (castText ? '全片统一设定（必须原样沿用，颜色/款式/编号都不许改）：\n' + castText + '\n\n' : '')
          + '整片分镜计划（共 ' + plan.segs.length + ' 段，总时长约 ' + plan.total + ' 秒）：\n' + allBeats + '\n\n'
          + '现在只写第 ' + (i + 1) + ' 段（对应 ' + seg.from + '–' + seg.to + ' 秒，成片时长 ' + sec + ' 秒）：' + (seg.beat || '按分镜计划延续上一段')
          + '\n只输出一个 [[H3]]…[[/H3]] 块（完整六段），[Shot 1] 从 0 秒开始，最后一镜不超过 ' + (sec - 0.5).toFixed(1) + ' 秒；'
          + '<Subject N> 编号沿用全片编号；只拍这一段的事。';
        status('run', '第 ' + (i + 1) + ' / ' + plan.segs.length + ' 段生成中…（' + sec + 's）');
        let out = '';
        try { out = await callAI(SIX_SYS, user, 2600); } catch (e) { LOG('seg fail', i, e); }
        let b = extractPrompt(out);
        if (!b) b = String(out || '').trim();
        if (b) blocks.push(normalizeBlock(b));
        await new Promise(r => setTimeout(r, 200));
      }
      if (!blocks.length) throw new Error('一段都没生成出来，换个模型或改用自定义 API');
      $('#h3v-prompt').value = blocks.map(b => '[[H3]]\n' + b.replace(/^\[\[H3\]\]|\[\[\/H3\]\]$/g, '').trim() + '\n[[/H3]]').join('\n\n');
      refreshBlockList();
      status('ok', '已生成 ' + blocks.length + ' 段 · 合计约 ' + plan.total + ' 秒 · 用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒\n下面「分段」里逐条选，或点「全部按顺序生成」');
    } catch (e) {
      status('err', '生成失败：' + (e && e.message ? e.message : e));
    }
    btn.disabled = false;
  }

  async function fetchModels() {
    const base = ($('#h3v-aiBase').value || '').trim().replace(/\/+$/, '');
    const key = ($('#h3v-aiKey').value || '').trim();
    if (!base) { status('err', '先填 API 地址'); return; }
    status('run', '拉取模型列表…');
    try {
      const url = base.endsWith('/models') ? base : base + '/models';
      const r = await withTimeout(fetch(url, { headers: key ? { Authorization: 'Bearer ' + key } : {} }), 15000, '拉模型 ');
      const j = await r.json();
      const arr = (j.data || j.models || []).map(x => (typeof x === 'string' ? x : (x.id || x.name))).filter(Boolean).sort();
      if (!arr.length) throw new Error('接口没返回模型');
      $('#h3v-aiModel').innerHTML = arr.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
      S.aiModel = arr.includes(S.aiModel) ? S.aiModel : arr[0];
      $('#h3v-aiModel').value = S.aiModel;
      saveS();
      status('ok', '拉到 ' + arr.length + ' 个模型，已选 ' + S.aiModel);
    } catch (e) { status('err', '拉模型失败：' + e.message); }
  }

  function syncAiMode() {
    const box = $('#h3v-apiBox');
    if (!box) return;
    box.style.display = (S.aiMode === 'api') ? 'block' : 'none';
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
    // 优先读原始消息（正则折叠后 DOM 里可能已经没有 [[H3]] 标记）
    try {
      const ctx = window.SillyTavern.getContext();
      const id = mes.getAttribute('mesid') != null ? mes.getAttribute('mesid') : mes.dataset.mesid;
      if (ctx && ctx.chat && id != null && ctx.chat[Number(id)]) {
        const raw = ctx.chat[Number(id)].mes;
        if (raw) return raw;
      }
    } catch (_) {}
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

  const TEMPLATE = `【这是填空用的骨架，不是成品：把 (…) 换成你这段正文里真实的人物/地点/台词】
[[H3]]
subject_definitions:
<Subject 1> is (角色A的名字与固定外观：年龄/发型/瞳色/服装/是否赤脚), from <Picture 1>.
<Subject 2> is (角色B的名字与固定外观), from <Picture 2>.
<Subject 3> is (场景名与关键陈设、光线), from <Picture 3>.

summary:
[reference generation] (一句话：谁在哪里做了什么，结局停在哪)

retention_analysis:
<Subject 1> (appears in [Shot 1], [Shot 2]): fully_preserved - (保留哪些外观特征)
<Subject 2> (appears in [Shot 1]): fully_preserved - (同上)
<Subject 3> (appears in [Shot 1], [Shot 2]): fully_preserved - (保留陈设与光线)

detailed_description:
(一到两句全片风格与光线)
[Shot 1] (景别/机位/主体位置/动作)。(说话人) (S1) says, <d>[Chinese] (台词原文)</d>
[Shot 2] At 00:05.500, (切到什么景别、发生了什么)。(内心独白用画外音) <Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] (内心话)</d>

overall_soundscape:
(环境底噪 + 与动作同步的拟音)

non_diegetic_music:
(配乐或 N/A)
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
        ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => { setTimeout(attachMessageButtons, 300); setTimeout(() => applyInjection(false), 400); });
      }
      applyInjection(false);
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
