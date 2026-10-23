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
          <button class="primary" id="h3v-gen" style="flex:none">按正文生成六段</button>
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
      CURTEXT = text || lastMessageText() || '';
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

  const INJECT = `[H3 视频] 这次回复正文之后，按 MiniMax H3 官方全参考模式（Ref2VA）补一个提示词块：[[H3]] 开头、[[/H3]] 结尾，六段顺序固定 subject_definitions / summary / retention_analysis / detailed_description / overall_soundscape / non_diegetic_music。
要点（官方格式）：
1) 六段用英文；台词保留原语言，写成 <d>[Chinese] …</d>。
2) subject_definitions 里把人物/场景/道具定义成 <Subject N>；参考图只用于身份/场景时，把来源写进该 Subject（如 <Subject 1> is the young woman in <Picture 1>, …），不单独写 <Picture N> 行；只有当某图就是某镜首帧/关键帧时才单独写 <Picture N> is the first frame of [Shot 1] …。
3) summary 一段英文，以 [reference generation] 这类方括号任务类型开头，只用已定义标签。
4) retention_analysis 每个标签一行：<Subject 1> (appears in [Shot 1], [Shot 3]): fully_preserved - …（或 partially_preserved / attribute_transfer / weak_reference），这里不写 (Sx)。
5) detailed_description 先一到两句风格，再逐镜头：[Shot 1] 无时间戳，第 2 镜起 [Shot N] At MM:SS.mmm, …；写清构图、主体外观与位置、环境光线、动作、镜头运动、同期声；说话人用 (S1)(S2)，引用主体写 <Subject N> (Sx)；生成类任务 350–500 英文词。
6) overall_soundscape 写全片环境声与物理声；non_diegetic_music 写只有观众听到的配乐（没有就 N/A）。
7) 总时长与用户给的秒数一致；不要写成剧情梗概；六段之外不要任何解释。`;

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

  /* ---------- AI 按正文生成六段 ---------- */
  let CURTEXT = '';

  const SIX_SYS = `你是 MiniMax H3 全参考模式（Ref2VA）提示词作者。把用户给的正文改写成官方六段格式，只输出六段：[[H3]] 开头、[[/H3]] 结尾，段名与顺序严格为 subject_definitions / summary / retention_analysis / detailed_description / overall_soundscape / non_diegetic_music。

官方规则：
1) 六段全写英文；只有台词、歌词、画面里可见的文字保留原语言，台词写成 <d>[Chinese] …</d>。
2) subject_definitions：把要复用的可见内容逐个定义为 <Subject N>（人物、场景、服装道具等），每个一行，说明标签指什么、主要特征。参考图仅用于定义角色/场景/服装/风格时，不要单独写 <Picture N> 行，把来源写进对应 Subject，例如：<Subject 1> is the young woman in <Picture 1>, with long dark hair, wearing …, 只有当某张图本身是某镜首帧/关键帧/尾帧/构图锚点时，才单独写 <Picture N> is the first frame of [Shot 1], …
3) summary：一段英文，以方括号任务类型开头（如 [reference generation]），只用已定义的标签，不引入新标签。
4) retention_analysis：每个标签一行，格式 <Subject 1> (appears in [Shot 1], [Shot 3]): fully_preserved - …；可选标记 partially_preserved / attribute_transfer / weak_reference；这里不写 (Sx)。
5) detailed_description：先一到两句全片风格，再逐镜头。[Shot 1] 不带时间戳；第 2 镜起 [Shot N] At MM:SS.mmm, …。每镜写清构图、主体外观与位置、环境与光线、动作与状态变化、镜头运动、同期声音，以及参考内容出现的准确时点。说话人给稳定编号 (S1)(S2)…，引用主体时写 <Subject N> (Sx)。生成类任务正文约 350–500 英文词。
6) overall_soundscape：全片环境声与物理声概述（对白与逐镜同步音留在 detailed_description）。
7) non_diegetic_music：只有观众能听到的配乐，写乐器/速度/动态；没有就写 N/A。
8) 总时长必须与用户给的秒数一致；不要写成剧情梗概。`;

  function sixUser(text) {
    return '正文：\n"""\n' + text + '\n"""\n\n按上面这段正文写六段视频提示词（[[H3]]…[[/H3]]）。';
  }

  async function stGenerate(sys, user) {
    const ctx = window.SillyTavern.getContext();
    if (!ctx) throw new Error('拿不到 SillyTavern 上下文');
    const quietPrompt = sys + '\n\n' + user;
    try {
      if (typeof ctx.generateQuietPrompt === 'function') {
        const r = await ctx.generateQuietPrompt({ quietPrompt: quietPrompt, quietName: 'h3v-six', responseLength: 1200 });
        if (r) return String(r);
      }
    } catch (e) { LOG('generateQuietPrompt fail', e); }
    try {
      if (typeof ctx.generateRaw === 'function') {
        const r = await ctx.generateRaw({ systemPrompt: sys, prompt: user, responseLength: 1200 });
        if (r) return String(r);
      }
    } catch (e) { LOG('generateRaw fail', e); }
    throw new Error('这个酒馆版本不允许扩展直接调生成（需要 generateQuietPrompt / generateRaw），改用「自定义 API」');
  }

  async function apiGenerate(sys, user) {
    const base = (S.aiBase || '').trim().replace(/\/+$/, '');
    const key = (S.aiKey || '').trim();
    const model = (S.aiModel || '').trim();
    if (!base) throw new Error('先填自定义 API 地址');
    if (!model) throw new Error('先点「拉取模型」选一个');
    const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
    const r = await withTimeout(fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { Authorization: 'Bearer ' + key } : {}),
      body: JSON.stringify({ model: model, temperature: 0.6, stream: false, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
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
    status('run', S.aiMode === 'st' ? '用酒馆当前连接/预设生成中…' : '调用自定义 API 生成中…');
    try {
      const out = (S.aiMode === 'st') ? await stGenerate(SIX_SYS, sixUser(text)) : await apiGenerate(SIX_SYS, sixUser(text));
      $('#h3v-prompt').value = extractPrompt(out) || out;
      status('ok', '六段已生成（' + (S.aiMode === 'st' ? '酒馆预设' : S.aiModel) + ' · ' + Math.round((Date.now() - t0) / 1000) + ' 秒）');
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

  const TEMPLATE = `[[H3]]
subject_definitions:
<Subject 1> is the woman in <Picture 1>, with long dark hair and a light-blue cardigan.
<Subject 2> is the man in <Picture 2>, with short black hair and a grey jacket.
<Subject 3> is the environment in <Picture 3>, a window-side booth with pale wooden partitions and late-afternoon light.

summary:
[reference generation] The target video shows <Subject 1> and <Subject 2> inside <Subject 3> in a single quiet exchange.

retention_analysis:
<Subject 1> (appears in [Shot 1], [Shot 2]): fully_preserved - identity, hair and clothing are retained.
<Subject 2> (appears in [Shot 1]): fully_preserved - identity and clothing are retained.
<Subject 3> (appears in [Shot 1], [Shot 2]): fully_preserved - furniture, props and lighting are retained.

detailed_description:
The target video uses a flat 2D anime cel style with warm late-afternoon window light.
[Shot 1] A medium two-shot across the table inside <Subject 3>. <Subject 2> sits on screen right facing <Subject 1>. He looks down, then up, and says, <d>[Chinese] 抱歉。</d>
[Shot 2] At 00:05.500, the shot cuts to a close-up of <Subject 1> from the front. She forces a small smile and answers, <d>[Chinese] 不要道歉啊。</d> She looks down at her hands.

overall_soundscape:
Quiet restaurant room tone with soft ice-shifting sounds and one chair scrape.

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
