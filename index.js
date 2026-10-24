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
      fab.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const list = document.querySelectorAll('#chat .mes');
        const last = list.length ? list[list.length - 1] : null;
        openPanel(lastMessageText(), last ? (last.getAttribute('mesid') || last.dataset.mesid) : null);
      });
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

        <div class="row" style="display:none"><label>四视图</label></div>
        <div id="h3v-views" style="display:none"></div>

        <div class="row"><label>角色库</label>
          <button id="h3v-charUp" style="flex:none">+ 上传角色图</button>
          <span class="hint" id="h3v-charHint">每张填个中文名；分段提示词只会从这些名字里选</span>
        </div>
        <details id="h3v-charDetails" style="margin:2px 0 10px"><summary id="h3v-charSum" style="cursor:pointer;color:#8b98ab;font-size:13px">角色库（点开）</summary><div id="h3v-charList"></div></details>

        <details id="h3v-audDetails" style="margin:2px 0 10px">
          <summary id="h3v-audSum" style="cursor:pointer;color:#8b98ab;font-size:13px">音频库（点开）</summary>
          <div class="row"><label></label><button id="h3v-audUp" style="flex:none">+ 上传参考音频</button>
            <span class="hint">给角色配音色用；mp3/wav/m4a，3–10 秒最稳</span></div>
          <div id="h3v-audList"></div>
        </details>

        <div style="display:none"><select id="h3v-scene"></select></div>

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

        <div class="row"><label>场景</label>
          <button id="h3v-scenePlan" style="flex:none">按正文出场景提示词</button>
          <button id="h3v-sceneGen" style="flex:none">生成全部场景</button>
          <span class="hint" id="h3v-sceneState"></span>
        </div>
        <div class="row"><label>画风</label>
          <select id="h3v-sceneStyle" style="flex:1;max-width:260px">
            <option value="anime">动漫赛璐璐（2D 平涂）</option>
            <option value="real">写实实拍（摄影）</option>
            <option value="cinematic">电影感（写实+调色）</option>
            <option value="mixed">混合（角色2D+场景写实）</option>
            <option value="watercolor">水彩/绘本</option>
          </select>
          <label style="min-width:auto">并发</label>
          <select id="h3v-sceneConc" style="max-width:80px;flex:none">
            <option>1</option><option selected>3</option><option>5</option>
          </select>
        </div>
        <textarea id="h3v-sceneList" rows="4" placeholder="每行一个场景：场景名|英文出图提示词（会自动补 no people / clean background）"></textarea>
        <div class="row"><label>场景库</label>
          <button id="h3v-sceneUp2" style="flex:none">+ 上传场景图</button>
          <span class="hint">可改名、删；名字就是 AI 能选的场景名</span>
        </div>
        <div class="row" style="display:none"><select id="h3v-sceneLib"></select><img id="h3v-sceneLibPv" class="pv" alt=""></div>
        <details id="h3v-sceneDetails" style="margin:2px 0 10px"><summary id="h3v-sceneSum" style="cursor:pointer;color:#8b98ab;font-size:13px">场景库（点开）</summary><div id="h3v-sceneListBox"></div></details>

        <div class="row"><label>六段提示词</label><button id="h3v-tpl" style="flex:none">复制模板</button></div>
        <textarea id="h3v-prompt" placeholder="点楼层里的 🎬 会自动抓 [[H3]]…[[/H3]]；也可以直接粘贴"></textarea>

        <div class="row">
          <label>AI 补全</label>
          <select id="h3v-aiMode" style="flex:1">
            <option value="st">用酒馆当前连接 / 对话补全预设（和主界面一样）</option>
            <option value="api">自定义 API</option>
          </select>
          <button class="primary" id="h3v-gen" style="flex:none">按正文生成（自动分段）</button>
          <label style="min-width:auto">并发</label>
          <input type="number" id="h3v-genConc" min="1" max="8" step="1" value="3" style="max-width:56px;flex:none">
          <label style="min-width:auto"><input type="checkbox" id="h3v-autoQc"> 生成后自动修缮</label>
          <button id="h3v-qc" style="flex:none">检查并修缮</button>
          <button id="h3v-trans" style="flex:none">看中文翻译</button>
          <button id="h3v-cancelAI" style="flex:none">取消</button>
          <button id="h3v-aidiag" style="flex:none">诊断 ST</button>
        </div>
        <div id="h3v-apiBox" style="display:none">
                <div class="row"><label>H3账号</label>
          <button id="h3v-accExport" style="flex:none">导出账号</button>
          <button id="h3v-accImport" style="flex:none">导入账号</button>
          <span class="hint" id="h3v-accState">从 H3工作台 账号页导出的 JSON 可以直接贴进来</span>
        </div>
        <div id="h3v-accBox" style="display:none">
          <textarea id="h3v-accJson" rows="4" placeholder='把导出的 JSON 粘在这里：{"accounts":[...]}'></textarea>
          <div class="row"><button id="h3v-accDo" style="flex:none">确认导入</button>
            <label style="min-width:auto"><input type="checkbox" id="h3v-accReplace"> 覆盖现有账号</label></div>
        </div>

<div class="row"><label>配置</label>
          <select id="h3v-apiProf" style="flex:1;max-width:280px"></select>
          <button id="h3v-apiSave" style="flex:none">存为新配置</button>
          <button id="h3v-apiDel" style="flex:none">删</button>
        </div>
          <div class="row"><label>API 地址</label><input type="text" id="h3v-aiBase" placeholder="https://api.deepseek.com/v1"></div>
          <div class="row"><label>API Key</label><input type="password" id="h3v-aiKey" placeholder="sk-…（只存本机）"></div>
          <div class="row"><label>模型</label>
            <select id="h3v-aiModel" style="flex:1"></select>
            <button id="h3v-models" style="flex:none">拉取模型</button>
            <button id="h3v-testapi" style="flex:none">测 API</button>
          </div>
          <div class="row"><label>max_tokens</label>
            <input type="text" id="h3v-maxtok" value="100000" style="max-width:120px;flex:none" placeholder="100000">
            <span class="hint">默认 10 万；中转卡住的话改 8000（10 万会让它憋很久）</span>
          </div>
          <div class="row"><label style="min-width:auto"><input type="checkbox" id="h3v-usePreset" checked> 套用预设采样参数（温度/top_p/惩罚/stop/seed）</label></div>
          <div class="row"><label style="min-width:auto"><input type="checkbox" id="h3v-usePresetPrompt" checked> 把预设里的提示词也作为参考带上</label></div>
          <p class="hint">填地址后点「拉取模型」，列表从 /models 自动取，不用手打模型名。</p>
        </div>

        <div class="row"><label>分段</label>
          <select id="h3v-block" style="flex:1"></select>
          <span class="hint" id="h3v-blockHint"></span>
        </div>


        <div class="row" style="margin-top:8px">
          <button class="primary" id="h3v-run">生成这一条</button>
          <button id="h3v-runAll">全部生成</button>
        </div>

        <div class="row">
          <label style="min-width:auto">区间</label>
          <input type="number" id="h3v-from" min="1" step="1" value="1" style="max-width:60px;flex:none">
          <label style="min-width:auto">→</label>
          <input type="number" id="h3v-to" min="1" step="1" value="2" style="max-width:60px;flex:none">
          <button id="h3v-runRange" style="flex:none">生成这个区间</button>
        </div>

        <div class="row">
          <label style="min-width:auto">并发</label>
          <input type="number" id="h3v-videoConc" min="1" max="10" step="1" value="2" style="max-width:64px;flex:none">
          <label style="min-width:auto">画风</label>
          <select id="h3v-videoStyle" style="max-width:150px;flex:none">
            <option value="anime">动漫赛璐璐</option>
            <option value="real">写实实拍</option>
            <option value="cinematic">电影感</option>
            <option value="watercolor">水彩/绘本</option>
          </select>
          <label style="min-width:auto"><input type="checkbox" id="h3v-videoCloud"> 云端直连</label>
          <label style="min-width:auto"><input type="checkbox" id="h3v-chain"> 接尾帧</label>
          <label style="min-width:auto"><input type="checkbox" id="h3v-del" ${S.del ? 'checked' : ''}> 跑完删云端</label>
        </div>

        <div id="h3v-out"></div>

        <div class="row" style="margin-top:14px"><button class="close" id="h3v-x2" style="flex:1">关闭面板</button></div>
      </div>

      <div class="foot" style="flex:none;border-top:1px solid #26303c;background:#0e141b;padding:8px 12px;">
        <div id="h3v-status"></div>
        <div id="h3v-pgWrap" style="height:6px;background:#1c222c;border-radius:99px;overflow:hidden;margin-top:6px;display:none"><i id="h3v-pg" style="display:block;height:100%;width:0%;background:#2f81f7;transition:width .3s"></i></div>
      </div>
    `;
    document.body.appendChild(dlg);

    const wrap = $('#h3v-views');
    for (let i = 0; i < 6; i++) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<label>角色${i + 1}</label><select data-v="${i}" style="flex:1"></select><input data-name="${i}" placeholder="名字(中文)" style="max-width:108px;flex:none"><button data-up="${i}" style="flex:none">传</button>`;
      wrap.appendChild(row);
      const pv = document.createElement('img');
      pv.className = 'pv';
      pv.dataset.pv = String(i);
      pv.alt = '';
      wrap.appendChild(pv);
      const nm = row.querySelector('input[data-name]');
      if (nm) {
        const nidx = i;
        if (!Array.isArray(S.charNames)) S.charNames = ['', '', '', '', '', ''];
        nm.value = S.charNames[nidx] || '';
        nm.oninput = function () { S.charNames[nidx] = nm.value.trim(); saveS(); };
      }
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
    if ($('#h3v-accExport')) $('#h3v-accExport').onclick = accExport;
    if ($('#h3v-accImport')) $('#h3v-accImport').onclick = accImport;
    if ($('#h3v-accDo')) $('#h3v-accDo').onclick = accImportDo;
    if ($('#h3v-apiProf')) {
      renderApiProfiles();
      $('#h3v-apiProf').onchange = function () { if ($('#h3v-apiProf').value !== '') applyProfile($('#h3v-apiProf').value); };
    }
    if ($('#h3v-apiSave')) $('#h3v-apiSave').onclick = saveProfile;
    if ($('#h3v-apiDel')) $('#h3v-apiDel').onclick = delProfile;
    if ($('#h3v-videoStyle')) {
      $('#h3v-videoStyle').value = S.videoStyle || 'anime';
      $('#h3v-videoStyle').onchange = function () { S.videoStyle = $('#h3v-videoStyle').value; saveS(); };
    }
    if ($('#h3v-videoCloud')) {
      $('#h3v-videoCloud').checked = !!S.videoCloud;
      $('#h3v-videoCloud').onchange = function () { S.videoCloud = $('#h3v-videoCloud').checked; saveS(); };
    }
    if ($('#h3v-chain')) {
      $('#h3v-chain').checked = S.chain !== false;
      $('#h3v-chain').onchange = function () { S.chain = $('#h3v-chain').checked; saveS(); };
    }
    if ($('#h3v-videoConc')) {
      $('#h3v-videoConc').value = String(S.videoConc || 2);
      $('#h3v-videoConc').onchange = function () { S.videoConc = Number($('#h3v-videoConc').value) || 2; saveS(); };
    }
    if ($('#h3v-runAll')) $('#h3v-runAll').onclick = runAllBlocks;
    if ($('#h3v-runRange')) $('#h3v-runRange').onclick = runRange;
    if ($('#h3v-prompt')) {
      $('#h3v-prompt').addEventListener('input', () => {
        clearTimeout(ensureUI._t);
        ensureUI._t = setTimeout(refreshBlockList, 400);
      });
      $('#h3v-prompt').addEventListener('input', function () { saveBlocks(CURMESID, $('#h3v-prompt').value); });
    }
    dlg.addEventListener('close', () => { dlg.style.display = 'none'; });
    dlg.addEventListener('cancel', () => { dlg.style.display = 'none'; });

    wrap.querySelectorAll('select[data-v]').forEach(sel => { sel.onchange = () => { S.views[Number(sel.dataset.v)] = sel.value; saveS(); }; });
    wrap.querySelectorAll('button[data-up]').forEach(btn => { btn.onclick = () => pickAndUpload(Number(btn.dataset.up)); });
    if ($('#h3v-sceneUp')) $('#h3v-sceneUp').onclick = () => pickAndUpload(-1);
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
      if ($('#h3v-testapi')) $('#h3v-testapi').onclick = testApi;
      if ($('#h3v-maxtok')) {
        $('#h3v-maxtok').value = String(S.maxTokens || 100000);
        $('#h3v-maxtok').onchange = function () { S.maxTokens = Number($('#h3v-maxtok').value) || 100000; saveS(); };
      }
      if ($('#h3v-usePreset')) {
        $('#h3v-usePreset').checked = S.usePreset !== false;
        $('#h3v-usePreset').onchange = function () { S.usePreset = $('#h3v-usePreset').checked; saveS(); };
      }
      if ($('#h3v-usePresetPrompt')) {
        $('#h3v-usePresetPrompt').checked = S.usePresetPrompt !== false;
        $('#h3v-usePresetPrompt').onchange = function () { S.usePresetPrompt = $('#h3v-usePresetPrompt').checked; saveS(); PRESET_PROMPTS = null; };
      }
      if (S.aiModel) $('#h3v-aiModel').innerHTML = `<option value="${esc(S.aiModel)}">${esc(S.aiModel)}</option>`;
      syncAiMode();
    }
    if ($('#h3v-cancelAI')) $('#h3v-cancelAI').onclick = function () {
      try { if (ABORT) ABORT.abort(); } catch (_) {}
      jobEnd();
      pgSet(-1);
      status('err', '已取消本次 AI 请求');
    };
    if ($('#h3v-gen')) $('#h3v-gen').onclick = genSix;
    if ($('#h3v-qc')) $('#h3v-qc').onclick = function () { qcFix(false); };
    if ($('#h3v-trans')) $('#h3v-trans').onclick = translateAll;
    if ($('#h3v-transHide')) $('#h3v-transHide').onclick = function () { var b = $('#h3v-transBox'); if (b) b.style.display = 'none'; };
    if ($('#h3v-genConc')) {
      $('#h3v-genConc').value = String(S.genConc || 3);
      $('#h3v-genConc').onchange = function () { S.genConc = Number($('#h3v-genConc').value) || 3; saveS(); };
    }
    if ($('#h3v-autoQc')) {
      $('#h3v-autoQc').checked = !!S.autoQc;
      $('#h3v-autoQc').onchange = function () { S.autoQc = $('#h3v-autoQc').checked; saveS(); };
    }
    if ($('#h3v-aidiag')) $('#h3v-aidiag').onclick = aiDiag;
    if ($('#h3v-sceneStyle')) {
      $('#h3v-sceneStyle').value = S.sceneStyle || 'anime';
      $('#h3v-sceneStyle').onchange = function () { S.sceneStyle = $('#h3v-sceneStyle').value; saveS(); };
    }
    if ($('#h3v-sceneCloud')) {
      $('#h3v-sceneCloud').checked = !!S.sceneCloud;
      $('#h3v-sceneCloud').onchange = function () { S.sceneCloud = $('#h3v-sceneCloud').checked; saveS(); };
    }
    if ($('#h3v-sceneConc')) {
      $('#h3v-sceneConc').value = String(S.sceneConc || 3);
      $('#h3v-sceneConc').onchange = function () { S.sceneConc = Number($('#h3v-sceneConc').value) || 3; saveS(); };
    }
    if ($('#h3v-audUp')) $('#h3v-audUp').onclick = uploadAudioLib;
    renderAudioLib();
    if ($('#h3v-charUp')) $('#h3v-charUp').onclick = uploadChar;
    if ($('#h3v-sceneUp2')) $('#h3v-sceneUp2').onclick = uploadScene;
    renderCharList();
    renderSceneListBox();
    if ($('#h3v-scenePlan')) $('#h3v-scenePlan').onclick = scenePlan;
    if ($('#h3v-sceneGen')) $('#h3v-sceneGen').onclick = sceneGen;
    if ($('#h3v-sceneLib')) {
      $('#h3v-sceneLib').onchange = sceneLibPreview;
      refreshSceneLib();
    }
    if ($('#h3v-sceneUse')) $('#h3v-sceneUse').onclick = function () {
      const s = SCENES[Number($('#h3v-sceneLib').value)];
      if (!s || !s.file) { status('err', '先选一个场景'); return; }
      S.scene = s.file; saveS();
      const sel = $('#h3v-scene');
      if (sel) { if (!Array.from(sel.options).some(o => o.value === s.file)) { const o = document.createElement('option'); o.value = s.file; o.textContent = s.file; sel.appendChild(o); } sel.value = s.file; }
      status('ok', '已把「' + s.name + '」设为视频场景图');
    };
    if ($('#h3v-sceneDel')) $('#h3v-sceneDel').onclick = function () {
      const i = Number($('#h3v-sceneLib').value);
      if (!isNaN(i) && SCENES[i] && confirm('从场景库删掉「' + SCENES[i].name + '」？（不会删文件）')) { SCENES.splice(i, 1); saveScenes(); refreshSceneLib(); }
    };

    fillSelects();
  }

  function openPanel(text, mesid) {
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
      CURMESID = (mesid === undefined || mesid === null) ? null : String(mesid);
      reloadLibsIfCardChanged();
      const savedB = CURMESID ? loadBlocks(CURMESID) : '';
      const ex = extractPrompt(t);
      if (savedB) { $('#h3v-prompt').value = savedB; status('ok', '已载入这条之前保存的六段提示词'); }
      else if (ex) { $('#h3v-prompt').value = ex; status('ok', '已抓到这条的六段提示词'); }
      else { $('#h3v-prompt').value = ''; }
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
    }), 90000, '提交 ');
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
  /* ---------- 按段配场景 ---------- */
  /* ---------- 每条正文绑定保存的六段提示词 ---------- */
  const BLOCKS = (function () {
    try { const o = JSON.parse(localStorage.getItem('h3v.blocks') || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (_) { return {}; }
  })();
  let SAVE_T = null;
  function saveBlocks(id, text) {
    if (id === null || id === undefined || id === '') return;
    BLOCKS[String(id)] = { text: String(text || ''), ts: Date.now() };
    clearTimeout(SAVE_T);
    SAVE_T = setTimeout(function () {
      try { localStorage.setItem('h3v.blocks', JSON.stringify(BLOCKS)); } catch (e) { LOG('save blocks fail', e); }
    }, 300);
  }
  function loadBlocks(id) {
    const v = BLOCKS[String(id)];
    return v && v.text ? v.text : '';
  }

  const SEGCFG = {};   // { blockIndex: sceneFile }

  function renderSegTable() {
    const box = $('#h3v-segTable');
    if (!box) return;
    const blocks = parseBlocks($('#h3v-prompt').value);
    if (blocks.length < 2) { box.innerHTML = ''; return; }
    const opts = '<option value="">（用全局场景图）</option>' +
      SCENES.map(function (s) { return '<option value="' + esc(s.file) + '">' + esc(s.name) + '</option>'; }).join('');
    let html = '<div class="hint" style="margin:6px 0 4px">每段可以指定自己的场景图（角色四视图仍是全局那几张，编号不会乱）</div>';
    blocks.forEach(function (b, i) {
      const sec = blockSeconds(b);
      const cast = SEGCAST[i];
      const tag = cast ? (' · ' + (cast.cast || []).join('/') + ' @ ' + (cast.scene || '未指定场景')) : '';
      html += '<div class="row"><label>第 ' + (i + 1) + ' 条 · ' + sec + 's' + esc(tag) + '</label>' +
        '<select data-seg="' + i + '" style="flex:1">' + opts + '</select></div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('select[data-seg]').forEach(function (sel) {
      const i = Number(sel.dataset.seg);
      if (SEGCFG[i]) sel.value = SEGCFG[i];
      sel.onchange = function () { SEGCFG[i] = sel.value; };
    });
  }

  function charAudioFor(file) {
    if (!file) return '';
    for (let i = 0; i < CHARLIB.length; i++) {
      if (CHARLIB[i].file === file) return (Array.isArray(S.charAudio) ? (S.charAudio[i] || '') : '');
    }
    return '';
  }

  function buildImagesFor(idx, sceneOverride, filesOverride) {
    let images = [];
    if (Array.isArray(filesOverride) && filesOverride.length) {
      images = filesOverride.slice();
    } else {
      CHARLIB.forEach(function (c) { if (images.length < 5) images.push(c.file); });
      const scenePick = sceneOverride || ($('#h3v-scene') ? $('#h3v-scene').value : '');
      if (scenePick) images.push(scenePick);
    }
    const i2 = Number(idx);
    if (S.chain !== false && i2 > 0 && SEGLAST[i2 - 1]) images.push(SEGLAST[i2 - 1]);
    return images;
  }

  async function submitBlock(blockText, seconds, sceneOverride, filesOverride, idx) {
    let images = [];
    if (Array.isArray(filesOverride) && filesOverride.length) {
      images = filesOverride.slice();
    } else {
      CHARLIB.forEach(function (c) { if (images.length < 5) images.push(c.file); });
      const scenePick = sceneOverride || ($('#h3v-scene') ? $('#h3v-scene').value : '');
      if (scenePick) images.push(scenePick);
    }

    // 接上一段尾帧
    let text = String(blockText || '');
    const i2 = Number(idx);
    if (S.chain !== false && i2 > 0 && SEGLAST[i2 - 1]) {
      images.push(SEGLAST[i2 - 1]);
      text = injectTailFrame(text, images.length);
      LOG('chain: segment', i2 + 1, 'uses tail of', i2);
    }

    if (!images.length) throw new Error('至少放一张图（角色或场景）');

    // 按角色顺序取音色（最多 3）
    const audios = [];
    images.forEach(function (f) {
      const a = charAudioFor(f);
      if (a && audios.length < 3 && audios.indexOf(a) < 0) audios.push(a);
    });

    const j = await jpost('/api/mm/run', {
      images: images,
      audios: audios,
      prompt: text,
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

  /* ---------- 云端直连：H3 视频 ---------- */
  const WF_MM = "{\"23\":{\"class_type\":\"LoadImage\",\"inputs\":{\"image\":\"None\"},\"_meta\":{\"title\":\"加载图像\"}},\"48\":{\"class_type\":\"LoadAudio\",\"inputs\":{\"audio\":\"None\",\"audioUI\":\"\"},\"_meta\":{\"title\":\"加载音频\"}},\"27\":{\"class_type\":\"VHS_LoadVideo\",\"inputs\":{\"custom_height\":0,\"force_rate\":0,\"custom_width\":0,\"select_every_nth\":1,\"frame_load_cap\":0,\"format\":\"AnimateDiff\",\"video\":\"\",\"skip_first_frames\":0,\"force_size\":\"Disabled\"},\"_meta\":{\"title\":\"加载视频\"}},\"49\":{\"class_type\":\"LoadImage\",\"inputs\":{\"image\":\"22785d770f0efdcf632f8e8a954a4b05032b63a4ac5a92e74da551fed6020ab2.jpg\"},\"_meta\":{\"title\":\"加载图像\"}},\"192\":{\"class_type\":\"UNETLoader\",\"inputs\":{\"weight_dtype\":\"default\",\"unet_name\":\"minimax_h3_hybrid_fl2va_ref2va_b25-49-int8.safetensors\"},\"_meta\":{\"title\":\"UNET加载器\"}},\"250\":{\"class_type\":\"ComfyMathExpression\",\"inputs\":{\"expression\":\"max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17\",\"values.a\":[\"259\",0]},\"_meta\":{\"title\":\"Math Expression\"}},\"252\":{\"class_type\":\"ResolutionSelector\",\"inputs\":{\"aspect_ratio\":\"16:9 (Widescreen)\",\"megapixels\":1.5,\"multiple\":32},\"_meta\":{\"title\":\"分辨率选择器\"}},\"253\":{\"class_type\":\"VAEDecode\",\"inputs\":{\"vae\":[\"36\",0],\"samples\":[\"397\",0]},\"_meta\":{\"title\":\"VAE解码\"}},\"254\":{\"class_type\":\"VAEDecodeAudio\",\"inputs\":{\"vae\":[\"37\",0],\"samples\":[\"397\",0]},\"_meta\":{\"title\":\"VAE解码_Audio\"}},\"331\":{\"class_type\":\"ModelAttentionBackend\",\"inputs\":{\"attention\":\"comfy kitchen attention\",\"model\":[\"400\",0]},\"_meta\":{\"title\":\"ModelAttentionBackend\"}},\"397\":{\"class_type\":\"SelfLiftH3Sampler\",\"inputs\":{\"upscaler_model\":\"minimax_h3_latent_upscaler_3d_fp16_V2.safetensors\",\"latent_image\":[\"265\",1],\"seed\":29732110694208,\"upscaler_unload\":true,\"cfg\":1,\"w_max\":1,\"transition_step\":6,\"positive\":[\"265\",0],\"lowres_scale\":0.6000000000000001,\"sampler\":[\"255\",0],\"negative\":[\"328\",0],\"w_min\":0.5,\"rho\":0,\"model\":[\"329\",0],\"vae\":[\"36\",0],\"sigmas\":[\"261\",0],\"highres_tiling\":false},\"_meta\":{\"title\":\"SelfLift Progressive Sampler (MiniMax H3)\"}},\"255\":{\"class_type\":\"KSamplerSelect\",\"inputs\":{\"sampler_name\":\"euler\"},\"_meta\":{\"title\":\"K采样器选择\"}},\"332\":{\"class_type\":\"BlockSparseAttention\",\"inputs\":{\"selection\":\"sol-attn\",\"extra_tokens\":256,\"selection.tau\":1.3,\"dense_blocks\":\"\",\"start_percent\":0.2,\"model\":[\"331\",0],\"end_percent\":1,\"sink_conditioning\":\"exact_kv_and_rows\",\"min_tokens\":12288,\"verbose\":true},\"_meta\":{\"title\":\"Model Sparse Attention\"}},\"333\":{\"class_type\":\"MiniMaxH3SigmaShift\",\"inputs\":{\"shift_audio\":3.0000000000000004,\"shift_video\":12,\"model\":[\"332\",0]},\"_meta\":{\"title\":\"ModelSamplingMiniMaxH3\"}},\"259\":{\"class_type\":\"PrimitiveFloat\",\"inputs\":{\"value\":12},\"_meta\":{\"title\":\"视频时长（秒）\"}},\"50\":{\"class_type\":\"LoadImage\",\"inputs\":{\"image\":\"ccdfa9981fda9e6d1d6ca858ff717afd359a62c2ddf4d322449653d5814d265e.jpg\"},\"_meta\":{\"title\":\"加载图像\"}},\"51\":{\"class_type\":\"LoadImage\",\"inputs\":{\"image\":\"c715baaee3fa989a7a8c94643fb7945e36f943b91a5a28182e44c895c565eec3.jpg\"},\"_meta\":{\"title\":\"加载图像\"}},\"53\":{\"class_type\":\"LoraLoaderModelOnly\",\"inputs\":{\"lora_name\":\"minimax_h3_dmad_full_dareties_v4_step600_comfy_fro.safetensors\",\"strength_model\":0.8000000000000002,\"model\":[\"192\",0]},\"_meta\":{\"title\":\"LoRA加载器(仅模型)\"}},\"14\":{\"class_type\":\"LoadAudio\",\"inputs\":{\"audio\":\"None\",\"audioUI\":\"\"},\"_meta\":{\"title\":\"加载音频\"}},\"36\":{\"class_type\":\"VAELoader\",\"inputs\":{\"vae_name\":\"minimax_h3_video_vae_int8_convrot.safetensors\"},\"_meta\":{\"title\":\"VAE加载器\"}},\"15\":{\"class_type\":\"LoadAudio\",\"inputs\":{\"audio\":\"None\",\"audioUI\":\"\"},\"_meta\":{\"title\":\"加载音频\"}},\"37\":{\"class_type\":\"VAELoader\",\"inputs\":{\"vae_name\":\"minimax_h3_audio_vae_fp32.safetensors\"},\"_meta\":{\"title\":\"VAE加载器\"}},\"38\":{\"class_type\":\"CLIPLoader\",\"inputs\":{\"clip_name\":\"qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors\",\"type\":\"minimax\",\"device\":\"default\"},\"_meta\":{\"title\":\"CLIP加载器\"}},\"19\":{\"class_type\":\"LoadImage\",\"inputs\":{\"image\":\"None\"},\"_meta\":{\"title\":\"加载图像\"}},\"261\":{\"class_type\":\"BasicScheduler\",\"inputs\":{\"scheduler\":\"simple\",\"denoise\":1,\"model\":[\"329\",0],\"steps\":12},\"_meta\":{\"title\":\"基础调度器\"}},\"263\":{\"class_type\":\"Text\",\"inputs\":{\"text\":\"subject_definitions:\\n\\u003cSubject 1\\u003e is the female doctor from \\u003cPicture 1\\u003e, preserving her facial identity, low black hair bun, white medical coat, green scrubs, and stethoscope.\\n\\u003cSubject 2\\u003e is the young adult male patient from \\u003cPicture 2\\u003e, preserving his facial identity, short textured black hair, slate-blue T-shirt, black trousers, and white shoes.\\n\\u003cSubject 3\\u003e is the consultation room from \\u003cPicture 3\\u003e, preserving the desk, monitor, rear window and blinds, cabinet, hospital posters, medical trolley, and black patient chair. The nearby exit is just beyond the original framing on the patient\\u0027s side, screen right. Character identities follow \\u003cPicture 1\\u003e and \\u003cPicture 2\\u003e.\\n\\u003cAudio 1\\u003e is the voice-timbre reference for \\u003cSubject 1\\u003e (S2).\\n\\u003cAudio 2\\u003e is the voice-timbre reference for \\u003cSubject 2\\u003e (S1).\\n\\nsummary:\\n[reference generation + audio reference] A 14-second conclusion to the consultation. \\u003cSubject 2\\u003e thanks \\u003cSubject 1\\u003e and leaves \\u003cSubject 3\\u003e. She silently acknowledges him, then answers a vibrating smartphone and speaks affectionately to her husband. The patient follows \\u003cAudio 2\\u003e; all of the doctor\\u0027s phone dialogue follows \\u003cAudio 1\\u003e.\\n\\nretention_analysis:\\n\\u003cSubject 1\\u003e (appears in [Shot 1], [Shot 2], [Shot 3], [Shot 4]): fully_preserved - retain her identity, hairstyle, clothing, and stethoscope.\\n\\u003cSubject 2\\u003e (appears in [Shot 1], [Shot 2]): fully_preserved - retain his identity and clothing throughout his farewell and departure.\\n\\u003cSubject 3\\u003e (appears in [Shot 1], [Shot 2], [Shot 3], [Shot 4]): fully_preserved - retain furniture, daylight, desk-prop positions, and established spatial relationships.\\n\\u003cAudio 1\\u003e: reference - retain the doctor\\u0027s vocal identity and timbre during her affectionate phone conversation, adapting emotion without changing the speaker\\u0027s voice; source dialogue and background sounds are not copied.\\n\\u003cAudio 2\\u003e: reference - retain the patient\\u0027s vocal identity and timbre during his polite farewell; source dialogue and background sounds are not copied.\\n\\ndetailed_description:\\nContinue the same realistic live-action Chinese drama, 16:9, with matched daylight, color, character identities, and restrained performances. The doctor\\u0027s voice remains tied to \\u003cAudio 1\\u003e as her delivery changes from clinical reserve to private warmth. The patient\\u0027s voice remains tied to \\u003cAudio 2\\u003e. All dialogue is newly performed with synchronized Mandarin lip movement.\\n\\n[Shot 1] A medium close-up frames \\u003cSubject 2\\u003e, still seated in his slate-blue T-shirt, looking toward \\u003cSubject 1\\u003e off screen left. Her softly blurred white-coated shoulder remains at the left foreground edge. He briefly lowers his eyes, then looks back with a polite, accepting expression. \\u003cSubject 2\\u003e (S1), using the vocal identity and timbre of \\u003cAudio 2\\u003e, says with a brief hesitation after “那”: \\u003cd\\u003e[Chinese] 好吧，那……我先回去了，谢谢主任。\\u003c/d\\u003e Complete the sentence by approximately 00:03.200. He then leans forward slightly to prepare to stand.\\n\\n[Shot 2] At 00:03.500, the camera cuts to the established medium-wide two-shot of \\u003cSubject 3\\u003e, with \\u003cSubject 1\\u003e behind the desk on screen left and \\u003cSubject 2\\u003e on screen right. He rises naturally, moving the black chair backward a short distance with a subdued scrape. She gives one small silent nod and follows him with her eyes. He walks around his side of the desk and exits frame right by approximately 00:06.400. His footsteps recede toward the nearby exit. At approximately 00:06.600, the black smartphone on the doctor\\u0027s side of the desk starts vibrating against the tabletop. She looks down toward it.\\n\\n[Shot 3] At 00:07.200, the camera cuts to a tight desk-level insert of the vibrating phone beside the closed medical file. \\u003cSubject 1\\u003e\\u0027s right hand picks it up and taps once to answer. The vibration stops. Her right hand begins lifting the phone toward her ear, preserving the continuous physical action.\\n\\n[Shot 4] At 00:08.300, the camera cuts to a medium close-up of \\u003cSubject 1\\u003e with the phone at her right ear. Her shoulders relax and her expression softens. \\u003cSubject 1\\u003e (S2), using the vocal identity and timbre of \\u003cAudio 1\\u003e with affectionate, familiar delivery, says: \\u003cd\\u003e[Chinese] 喂，老公……\\u003c/d\\u003e During the short listening pause, she raises her left wrist and glances at her watch around 00:09.700–00:10.300. Keeping the phone at her right ear, \\u003cSubject 1\\u003e (S2) continues with the same timbre referenced from \\u003cAudio 1\\u003e: \\u003cd\\u003e[Chinese] 刚好下班，你等我一下。\\u003c/d\\u003e Finish by approximately 00:12.800. She lowers her wrist and holds a small private smile while listening until 00:14.000. Her husband\\u0027s voice is not audible.\\n\\noverall_soundscape:\\nContinuous quiet room ambience supports the synchronized chair scrape, clothing movement, receding footsteps, phone vibration against the desk, and phone-handling sounds. Generate these physical sounds independently of the voice-reference recordings. Use no ringtone, audible caller response, added comedy effects, or music.\\n\\nnon_diegetic_music:\\nN/A\"},\"_meta\":{\"title\":\"文本\"}},\"363\":{\"class_type\":\"忽略多组孤海\",\"inputs\":{},\"_meta\":{\"title\":\"忽略多组 孤海\"}},\"265\":{\"class_type\":\"MiniMaxH3ReferenceToVideo\",\"inputs\":{\"ref_images.ref_image_0\":[\"51\",0],\"ref_images.ref_image_1\":[\"49\",0],\"length\":[\"250\",1],\"ref_images.ref_image_2\":[\"50\",0],\"ref_image_size\":\"match\",\"audio_vae\":[\"37\",0],\"ref_images.ref_image_3\":[\"43\",0],\"ref_images.ref_image_4\":[\"19\",0],\"ref_images.ref_image_5\":[\"23\",0],\"ref_videos.ref_video_0\":[\"27\",0],\"ref_audios.ref_audio_2\":[\"15\",0],\"width\":[\"252\",0],\"vae\":[\"36\",0],\"ref_audios.ref_audio_1\":[\"14\",0],\"prompt\":[\"263\",0],\"ref_audios.ref_audio_0\":[\"48\",0],\"clip\":[\"38\",0],\"height\":[\"252\",1]},\"_meta\":{\"title\":\"MiniMax H3 Reference to Video\"}},\"364\":{\"class_type\":\"VHS_VideoCombine\",\"inputs\":{\"images\":[\"253\",0],\"pix_fmt\":\"yuv420p\",\"format\":\"video/h264-mp4\",\"frame_rate\":24,\"pingpong\":false,\"save_output\":true,\"filename_prefix\":\"YZ_H3_\",\"loop_count\":0,\"save_metadata\":true,\"crf\":19,\"trim_to_audio\":false,\"no_preview\":false,\"audio\":[\"254\",0]},\"_meta\":{\"title\":\"合并为视频\"}},\"400\":{\"class_type\":\"LoraLoaderModelOnly\",\"inputs\":{\"lora_name\":\"MysticXXX_MMH3-V1.safetensors\",\"strength_model\":0.3500000000000001,\"model\":[\"53\",0]},\"_meta\":{\"title\":\"LoRA加载器(仅模型)\"}},\"401\":{\"class_type\":\"MiniMaxChunkFeedForward\",\"inputs\":{\"chunks\":2,\"model\":[\"333\",0],\"seq_threshold\":4096},\"_meta\":{\"title\":\"MiniMax H3 ChunkFeedForward\"}},\"328\":{\"class_type\":\"ConditioningZeroOut\",\"inputs\":{\"conditioning\":[\"265\",0]},\"_meta\":{\"title\":\"条件零化\"}},\"307\":{\"class_type\":\"忽略多组孤海\",\"inputs\":{},\"_meta\":{\"title\":\"忽略多组 孤海\"}},\"329\":{\"class_type\":\"ModelPreviewOverrideKJ\",\"inputs\":{\"preview_frames\":1024,\"suppress_default_preview\":true,\"jpeg_quality\":80,\"tiny_vae\":\"taeh3.safetensors\",\"model\":[\"401\",0],\"vae\":[\"36\",0],\"preview_fps\":12,\"max_resolution\":1024},\"_meta\":{\"title\":\"Model Preview Override KJ\"}},\"308\":{\"class_type\":\"忽略多组孤海\",\"inputs\":{},\"_meta\":{\"title\":\"忽略多组 孤海\"}},\"309\":{\"class_type\":\"忽略多组孤海\",\"inputs\":{},\"_meta\":{\"title\":\"忽略多组 孤海\"}},\"43\":{\"class_type\":\"LoadImage\",\"inputs\":{\"image\":\"None\"},\"_meta\":{\"title\":\"加载图像\"}}}";
  const MM_IMG_NODES = ['51', '49', '50', '43', '19', '23'];
  const MM_AUD_NODES = ['48', '14', '15'];

  async function rhUpload(name, blob) {
    const acc = cloudAcc();
    if (!acc || !acc.apiKey) throw new Error('云端直连需要带 API Key 的账号');
    const fd = new FormData();
    fd.append('apiKey', acc.apiKey);
    fd.append('file', blob, name);
    const r = await fetch(RH_BASE + '/task/openapi/upload', { method: 'POST', body: fd });
    const txt = await r.text();
    let j = null;
    try { j = JSON.parse(txt); } catch (_) { throw new Error('上传返回非 JSON：' + txt.slice(0, 120)); }
    const fn = (j.data && (j.data.fileName || j.data.name)) || j.fileName;
    if (!fn) throw new Error('上传失败：' + txt.slice(0, 140));
    return fn;
  }

  async function apkFileBlob(file) {
    const local = await IDB.get(file);
    if (local) return local;
    const r = await fetch(api('/api/preview?type=input&filename=' + encodeURIComponent(file)));
    if (!r.ok) throw new Error('从手机取文件失败：' + file);
    const blob = await r.blob();
    try { await IDB.put(file, blob, 'cache'); } catch (_) {}
    return blob;
  }

  async function captureTailFromUrl(url) {
    const blob = await (await fetch(url)).blob();
    const u = URL.createObjectURL(blob);
    try {
      const v = document.createElement('video');
      v.src = u; v.muted = true; v.preload = 'auto';
      await new Promise(function (res, rej) {
        const to = setTimeout(function () { rej(new Error('取尾帧超时')); }, 25000);
        v.onloadeddata = function () { try { v.currentTime = Math.max(0, (v.duration || 1) - 0.08); } catch (_) {} };
        v.onseeked = function () { clearTimeout(to); res(); };
        v.onerror = function () { clearTimeout(to); rej(new Error('视频加载失败')); };
      });
      const c = document.createElement('canvas');
      c.width = v.videoWidth || 768;
      c.height = v.videoHeight || 1344;
      c.getContext('2d').drawImage(v, 0, 0);
      return await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.92); });
    } finally { URL.revokeObjectURL(u); }
  }

  async function cloudVideo(opts) {
    const acc = cloudAcc();
    if (!acc || !acc.apiKey) throw new Error('云端直连需要先在「H3账号」里导入带 API Key 的账号');
    const wf = JSON.parse(WF_MM);
    if (wf['263']) wf['263'].inputs.text = opts.prompt;
    if (wf['252']) {
      wf['252'].inputs.aspect_ratio = opts.aspect || '16:9 (Widescreen)';
      wf['252'].inputs.megapixels = opts.mp || 0.98;
    }
    if (wf['259']) wf['259'].inputs.value = opts.seconds;
    if (wf['261']) wf['261'].inputs.steps = opts.steps || 12;

    const imgs = (opts.images || []).slice(0, 6);
    for (let i = 0; i < MM_IMG_NODES.length; i++) {
      const id = MM_IMG_NODES[i];
      if (!wf[id]) continue;
      if (imgs[i]) {
        jobLabel('云端上传图 ' + (i + 1) + '/' + imgs.length);
        const blob = await apkFileBlob(imgs[i]);
        wf[id].inputs.image = await rhUpload(imgs[i], blob);
      } else {
        wf[id].inputs.image = 'None';
      }
    }
    const auds = (opts.audios || []).slice(0, 3);
    for (let i = 0; i < MM_AUD_NODES.length; i++) {
      const id = MM_AUD_NODES[i];
      if (!wf[id]) continue;
      if (auds[i]) {
        jobLabel('云端上传音频 ' + (i + 1) + '/' + auds.length);
        const blob = await apkFileBlob(auds[i]);
        wf[id].inputs.audio = await rhUpload(auds[i], blob);
      }
    }

    const c = await rhPost('/task/openapi/create', {
      workflowId: '2112032226968285186',
      workflow: JSON.stringify(wf),
    });
    const tid = c && c.data && c.data.taskId;
    if (!tid) throw new Error('提交失败：' + JSON.stringify(c).slice(0, 180));

    const t0 = Date.now();
    let st = 'RUNNING';
    while (Date.now() - t0 < 900000) {
      await new Promise(function (r) { setTimeout(r, 8000); });
      const s = await rhPost('/task/openapi/status', { taskId: tid });
      st = s && s.data;
      jobLabel('云端跑片 ' + Math.floor((Date.now() - t0) / 60000) + ' 分 ' + (Math.round((Date.now() - t0) / 1000) % 60) + ' 秒');
      if (st === 'SUCCESS' || st === '3') break;
      if (st === 'FAILED' || st === '2') throw new Error('云端任务失败（' + tid + '）');
    }
    const o = await rhPost('/task/openapi/outputs', { taskId: tid });
    const arr = (o && o.data) || [];
    const vids = arr.filter(function (x) { return /\.(mp4|webm|mov)(\?|$)/i.test(x.fileUrl || ''); });
    if (!vids.length) throw new Error('任务结束但没拿到视频');
    return {
      items: vids.map(function (v) {
        return { url: v.fileUrl, filename: (v.fileUrl.split('/').pop() || 'h3.mp4') };
      }),
      coins: 0,
      secs: Math.round((Date.now() - t0) / 1000),
      taskId: tid,
    };
  }

  const VIDEOS = [];

  function showVideos(r, label) {
    (r.items || []).forEach(function (v) {
      VIDEOS.push({ name: v.filename || '', url: v.url, label: label || '' });
    });
    renderOut();
  }

  function vurl(u) { return /^https?:/i.test(u) ? u : api(u); }

  function renderOut() {
    const box = $('#h3v-out');
    if (!box) return;
    let head = '';
    if (VIDEOS.length) {
      head = '<div class="row" style="margin:8px 0">'
        + '<button id="h3v-merge" style="flex:none">合并成一条（' + VIDEOS.length + '）</button>'
        + '<button id="h3v-clear" style="flex:none">清空列表</button>'
        + '<span class="hint">合并按列表顺序；删除只删手机里的文件</span></div>';
    }
    const body = VIDEOS.map(function (v, i) {
      return '<div style="margin-top:10px"><div class="hint">' + esc(v.label || '') + ' · ' + esc(v.name || '') + '</div>'
        + '<video src="' + vurl(v.url) + '" controls playsinline></video>'
        + '<div><a href="' + vurl(v.url) + '" download="' + esc(v.name || 'h3.mp4') + '">下载</a>'
        + ' <button data-vdel="' + i + '" style="margin-left:8px">删</button></div></div>';
    }).join('');
    box.innerHTML = head + body;

    box.querySelectorAll('button[data-vdel]').forEach(function (el) {
      const i = Number(el.dataset.vdel);
      el.onclick = async function () {
        const v = VIDEOS[i];
        if (!v) return;
        if (!confirm('删掉「' + (v.name || '') + '」？手机上会直接删除')) return;
        try {
          const j = await jpost('/api/del-output', { name: v.name });
          if (!j.ok) throw new Error(j.error || '删除失败');
          VIDEOS.splice(i, 1);
          renderOut();
          status('ok', '已删除 ' + v.name);
        } catch (e) { status('err', '删除失败：' + e.message); }
      };
    });
    const m = $('#h3v-merge');
    if (m) m.onclick = mergeAll;
    const c = $('#h3v-clear');
    if (c) c.onclick = function () { VIDEOS.length = 0; renderOut(); };
  }

  async function mergeAll() {
    if (VIDEOS.length < 2) { status('err', '至少两条才能合并'); return; }
    const files = VIDEOS.map(function (v) { return v.name; }).filter(Boolean);
    if (files.length < 2) { status('err', '文件名缺失，先在下面重新生成一次'); return; }
    const btn = $('#h3v-merge');
    if (btn) btn.disabled = true;
    jobBegin('合并 ' + files.length + ' 条成片');
    pgSet(30);
    try {
      const out = 'merged_' + Date.now() + '.mp4';
      const j = await jpost('/api/merge', { files: files, out: out });
      if (!j.ok) throw new Error(j.error || '合并失败');
      pgSet(100);
      VIDEOS.push({ name: j.name, url: j.url, label: '合并结果（' + files.length + ' 段）' });
      renderOut();
      status('ok', '已合并 ' + files.length + ' 条 → ' + j.name + '（' + Math.round((j.size || 0) / 1024) + ' KB，' + Math.round((j.ms || 0) / 1000) + ' 秒）');
    } catch (e) {
      status('err', '合并失败：' + e.message);
    } finally {
      if (btn) btn.disabled = false;
      jobEnd();
    }
  }

  async function runOne(blockText, seconds, label, sceneOverride, filesOverride, idx) {
    status('run', (label ? label + ' · ' : '') + '提交中…');
    const id = await submitBlock(blockText, seconds, sceneOverride, filesOverride, idx);
    status('run', (label ? label + ' · ' : '') + 'taskId=' + id + '，云端跑片约 4–7 分钟…');
    const r = await waitTask(id, label);
    try { await rememberTail(Number(idx), r.items.map(function (v) { return v.url; })); } catch (_) {}
    return r;
  }

  async function runRange() {
    const blocks = parseBlocks($('#h3v-prompt').value);
    if (!blocks.length) { status('err', '没有提示词'); return; }
    let a = Math.max(1, Number(($('#h3v-from') || {}).value || 1));
    let b = Math.min(blocks.length, Number(($('#h3v-to') || {}).value || a));
    if (b < a) { const tmp = a; a = b; b = tmp; }
    const btn = $('#h3v-runRange');
    if (btn) btn.disabled = true;
    jobBegin('生成区间 ' + a + '–' + b + '（串行）');
    pgSet(0);
    let okN = 0, coins = 0;
    for (let i = a - 1; i < b; i++) {
      const sec = blockSeconds(blocks[i]);
      jobLabel('第 ' + (i + 1) + '/' + blocks.length + ' 条（' + sec + 's）');
      status('run', '正在提交第 ' + (i + 1) + ' 条…' + (i > a - 1 ? '（会用上一段尾帧）' : ''));
      try {
        const r = await runOne(blocks[i], sec, '第 ' + (i + 1) + ' 条', SEGCFG[i], SEGIMG[i], i);
        okN++; coins += r.coins || 0;
        showVideos(r, '第 ' + (i + 1) + ' 条 · ' + sec + 's');
        pgSet(100 * (i - a + 2) / (b - a + 1));
      } catch (e) {
        status('err', '第 ' + (i + 1) + ' 条失败：' + e.message);
        break;
      }
    }
    jobEnd();
    if (btn) btn.disabled = false;
    status(okN ? 'ok' : 'err', '区间完成：' + okN + ' 条' + (coins ? ' · ' + coins + ' 币' : ''));
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
    jobBegin('生成视频 · 第' + (idx + 1) + '条');
    try {
      const r = await runOne(b, sec, '第' + (idx + 1) + '条', SEGCFG[idx], SEGIMG[idx], idx);
      showVideos(r, '第 ' + (idx + 1) + ' 条 · ' + sec + 's');
      status('ok', '第' + (idx + 1) + '条完成 · 用时 ' + Math.floor(r.secs / 60) + ' 分 ' + (r.secs % 60) + ' 秒'
        + (r.coins ? ' · ' + r.coins + ' 币' : ''));
    } catch (e) { status('err', '失败：' + e.message); }
    finally { jobEnd(); }
    btn.disabled = false;
    refreshBlockList();
  }

  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  async function runAllBlocks() {
    const blocks = parseBlocks($('#h3v-prompt').value);
    if (!blocks.length) { status('err', '没有提示词'); return; }
    if (blocks.length === 1) return runVideo();
    let conc = Math.max(1, Number(S.videoConc || 2));
    if (S.chain !== false) { conc = 1; status('run', '已开启「接上一段尾帧」→ 只能串行跑（否则后一段拿不到前一段的尾帧）'); }
    const btn = $('#h3v-runAll');
    btn.disabled = true;
    jobBegin('批量生成 ' + blocks.length + ' 条 · 并发 ' + conc);
    pgSet(0);
    let next = 0, okN = 0, doneN = 0, coins = 0;

    async function worker() {
      while (true) {
        const i = next++;
        if (i >= blocks.length) return;
        const sec = blockSeconds(blocks[i]);
        jobLabel('批量 · 第 ' + (i + 1) + '/' + blocks.length + ' 条（' + sec + 's）');
        try {
          let id = null, tries = 8;
          while (tries-- > 0) {
            try {
              id = await submitBlock(blocks[i], sec, SEGCFG[i], SEGIMG[i]);
              break;
            } catch (e) {
              const m = String(e && e.message || '');
              if (tries > 0 && /并发|busy|已满|RUNNING/i.test(m)) { await sleep(5000); continue; }
              throw e;
            }
          }
          const r = await waitTask(id, '第 ' + (i + 1) + ' 条');
          try { await rememberTail(i, r.items.map(function (v) { return v.url; })); } catch (_) {}
          okN++; coins += r.coins || 0;
          showVideos(r, '第 ' + (i + 1) + ' 条 · ' + sec + 's');
        } catch (e) {
          LOG('block fail', i, e);
          status('err', '第 ' + (i + 1) + ' 条失败：' + e.message);
          await sleep(1200);
        }
        doneN++;
        pgSet(100 * doneN / blocks.length);
        status('run', '进度 ' + doneN + '/' + blocks.length + '（成功 ' + okN + '）' + (coins ? ' · 已花 ' + coins + ' 币' : ''));
      }
    }

    const workers = [];
    for (let k = 0; k < Math.min(conc, blocks.length); k++) workers.push(worker());
    await Promise.all(workers);

    pgSet(100);
    jobEnd();
    btn.disabled = false;
    status(okN ? 'ok' : 'err', '全部跑完：成功 ' + okN + ' / ' + blocks.length + ' 条' + (coins ? ' · 共 ' + coins + ' 币' : ''));
  }

  function pgSet(p) {
    const wrap = $('#h3v-pgWrap'), bar = $('#h3v-pg');
    if (!wrap || !bar) return;
    if (p === null || p === undefined || p < 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    bar.style.width = Math.max(0, Math.min(100, p)) + '%';
  }

  const JOB = { t0: 0, label: '', timer: null };
  function jobPaint() {
    if (!JOB.t0) return;
    const tot = Math.round((Date.now() - JOB.t0) / 1000);
    const m = Math.floor(tot / 60), s = tot % 60;
    status('run', (JOB.label || '处理中') + ' · 累计 ' + (m ? m + ' 分 ' + s + ' 秒' : s + ' 秒') + '…');
  }
  function jobBegin(label) {
    jobEnd();
    JOB.t0 = Date.now();
    JOB.label = label || '';
    JOB.timer = setInterval(jobPaint, 1000);
    jobPaint();
  }
  function jobLabel(label) { JOB.label = label; jobPaint(); }
  function jobEnd() { if (JOB.timer) clearInterval(JOB.timer); JOB.timer = null; JOB.t0 = 0; JOB.label = ''; }
  function tick(prefix) { jobLabel(prefix); return function () {}; }
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
9) 总时长与用户给的秒数一致；不要写成剧情梗概；六段之外不要任何解释。
10) 人名、地名、台词、服装颜色一律来自正文；不许套用任何示例里的名字或句子（例如 woman in a light-blue cardigan、抱歉 / 不要道歉啊 这类），不许留括号占位符。\n11) 人物名必须用正文里的**原字**（中文或日文），不要音译成罗马字；同一角色在所有分段里用完全相同的一个名字。`;

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
  let CURMESID = null;

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
10) 总时长必须与用户给的秒数一致；不要写成剧情梗概。
12) 在 [[H3]] 内**第一行**先输出一行机器标记（只这一行，不要解释）：<!--CAST: 角色名1, 角色名2 | SCENE: 场景名-->；角色名、场景名必须从用户给的【素材清单】里照抄（没有清单才用正文原字）。然后六段；六段里 <Subject 1..k> 与 <Picture 1..k> 的顺序必须与 CAST 里角色顺序一致，场景图永远排在最后一位。只使用 CAST 里出现的角色。\n13) 如果给了音频参考：在 subject_definitions 里按角色顺序写 <Audio N> is the voice-timbre reference for <Subject N>.（最多 3 条），台词仍用 <d>[Chinese] …</d>。
14) 每个分段的 subject_definitions 都必须写出参考图编号：角色写 <Subject 1> is … in <Picture 1>，场景写 <Subject 2> is … in <Picture 2>；detailed_description 里首次出现时也要写 the shot begins from <Picture 1> 或 in <Picture 2>。绝对不要只写 keep consistent with reference 而不给编号——不写编号，参考图就等于没用。`;

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
    const maxLen = Number(S.maxTokens || 100000);
    const ctx = window.SillyTavern.getContext();
    if (!ctx) throw new Error('拿不到 SillyTavern 上下文');
    const tries = [];

    // 1) 上下文里自带
    if (typeof ctx.generateQuietPrompt === 'function') {
      try {
        const r = await withTimeout(ctx.generateQuietPrompt({ quietPrompt: sys + '\n\n' + user, quietName: 'h3v-six', responseLength: Math.max(maxLen, Number(S.maxTokens || 100000)) }), 90000, '酒馆安静生成 ');
        if (r) return String(r);
      } catch (e) { tries.push('ctx.generateQuietPrompt: ' + e.message); }
    }
    // 2) generateRaw（换几种参数写法，绕开 "No message generated"）
    if (typeof ctx.generateRaw === 'function') {
      const variants = [
        { systemPrompt: sys, prompt: user, responseLength: Math.max(maxLen, Number(S.maxTokens || 100000)) },
        { systemPrompt: sys, prompt: user },
        { prompt: sys + '\n\n' + user },
        { prompt: user },
      ];
      for (let vi = 0; vi < variants.length; vi++) {
        try {
          const r = await withTimeout(ctx.generateRaw(variants[vi]), 45000, '酒馆 raw 生成 ');
          if (r && String(r).trim()) return String(r);
          tries.push('ctx.generateRaw#' + (vi + 1) + ': 空输出');
        } catch (e) { tries.push('ctx.generateRaw#' + (vi + 1) + ': ' + e.message); }
      }
    }
    // 3) 动态 import script.js（老版本把函数放在那里）
    const mod = await loadSTScript();
    if (mod && typeof mod.generateQuietPrompt === 'function') {
      try {
        const r = await withTimeout(mod.generateQuietPrompt({ quietPrompt: sys + '\n\n' + user, quietName: 'h3v-six', responseLength: Math.max(maxLen, Number(S.maxTokens || 100000)) }), 90000, '酒馆安静生成2 ');
        if (r) return String(r);
      } catch (e) { tries.push('script.generateQuietPrompt: ' + e.message); }
    }
    if (mod && typeof mod.generateRaw === 'function') {
      try {
        const r = await withTimeout(mod.generateRaw({ systemPrompt: sys, prompt: user, responseLength: Math.max(maxLen, Number(S.maxTokens || 100000)) }), 45000, '酒馆 raw 生成2 ');
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

  function dedupSections(s) {
    const names = ['subject_definitions', 'summary', 'retention_analysis', 'detailed_description', 'overall_soundscape', 'non_diegetic_music'];
    const lines = s.split('\n');
    const seen = {};
    const out = [];
    let skipping = false;
    for (const line of lines) {
      const m = line.match(/^\s*(subject_definitions|summary|retention_analysis|detailed_description|overall_soundscape|non_diegetic_music)\s*:?\s*$/i);
      if (m) {
        const key = m[1].toLowerCase();
        if (seen[key]) { skipping = true; continue; }
        seen[key] = true; skipping = false; out.push(line); continue;
      }
      if (!skipping) out.push(line);
    }
    return out.join('\n');
  }

  function normalizeBlock(b) {
    let s = String(b || '');
    s = s.replace(/^#{1,6}\s*/gm, '');
    const names = 'subject_definitions|summary|retention_analysis|detailed_description|overall_soundscape|non_diegetic_music';
    s = s.replace(new RegExp('\\*\\*(' + names + ')\\*\\*:?', 'gi'), '$1:');
    s = s.replace(new RegExp('<(' + names + ')>:?', 'gi'), '$1:');
    s = s.replace(new RegExp('</(' + names + ')>', 'gi'), '');
    // 段名单独成行、漏冒号 → 自动补齐
    s = s.replace(new RegExp('^\\s*(' + names + ')\\s*$', 'gim'), '$1:');
    s = s.split('\n').filter(l => !/(选项|卡片|caption|字幕|界面|按钮|选择肢|option\s*(card|line|list|interface)|interface\s*(overlay|element|glow)|blinking cursor|tip text|subtitle|on-screen ui)/i.test(l)).join('\n');
    return dedupSections(s).trim();
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

  /* ---------- 酒馆「对话补全预设」里的提示词 ---------- */
  let PRESET_PROMPTS = null;
  async function getPresetPrompts() {
    if (PRESET_PROMPTS !== null) return PRESET_PROMPTS;
    try {
      const r = await withTimeout(fetch('/api/settings/get', { method: 'POST', headers: stHeaders(), body: '{}' }), 15000, '读酒馆设置 ');
      const j = await r.json();
      const oai = j.oai_settings || (j.settings && j.settings.oai_settings) || {};
      const prompts = Array.isArray(oai.prompts) ? oai.prompts : [];
      const byId = {};
      prompts.forEach(p => { if (p && p.identifier) byId[p.identifier] = p; });

      // 找到当前预设对应的 prompt_order（100001 = 预设级，100000 = 全局）
      let order = [];
      const po = Array.isArray(oai.prompt_order) ? oai.prompt_order : [];
      const pick = po.find(x => x && x.character_id === 100001) || po.find(x => x && x.character_id === 100000);
      if (pick && Array.isArray(pick.order)) order = pick.order;

      const parts = [];
      const push = (p) => { if (p && p.content && String(p.content).trim()) parts.push('[' + (p.name || p.identifier) + ']\n' + String(p.content).trim()); };
      if (order.length) {
        order.forEach(o => { if (!o || o.enabled === false) return; const p = byId[o.identifier]; if (p) push(p); });
      } else {
        prompts.forEach(p => { if (p && p.content && String(p.content).trim()) push(p); });
      }
      const txt = parts.join('\n\n');   // 不截断，预设提示词全文带上
      PRESET_PROMPTS = txt;
      return txt;
    } catch (e) {
      LOG('preset prompts fail', e);
      PRESET_PROMPTS = '';
      return '';
    }
  }

  async function withPreset(sys, user) {
    if (S.aiMode !== 'api') return [sys, user];
    if (S.usePresetPrompt === false) return [sys, user];
    const extra = await getPresetPrompts();
    if (!extra) return [sys, user];
    return [sys + '\n\n【酒馆对话补全预设里的提示词（风格与规则参考，冲突时以上面的六段规范为准）】\n' + extra, user];
  }
  function callAI(sys, user, len) {
    jobLabel(S.aiMode === 'api' ? '调自定义 API' : '等酒馆生成');
    const stop = function () {};
    const p = withPreset(sys, user).then(function (pair) {
      return (S.aiMode === 'api') ? apiGenerate(pair[0], pair[1], len) : stGenerate(pair[0], pair[1], len);
    });
    return Promise.resolve(p).then(function (v) { stop(); return v; }, function (e) { stop(); throw e; });
  }

  async function aiDiag() {
    const ctx = window.SillyTavern.getContext ? window.SillyTavern.getContext() : null;
    if (!ctx) { status('err', '拿不到 SillyTavern.getContext()'); return; }
    const fns = ['generateQuietPrompt', 'generateRaw', 'generate', 'executeSlashCommands', 'executeSlashCommandsWithOptions']
      .map(function (k) { return k + '=' + (typeof ctx[k]); }).join(', ');
    const s = ctx.chatCompletionSettings || {};
    let pLen = 0;
    try { pLen = ((await getPresetPrompts()) || '').length; } catch (_) {}
    status('ok', 'ST API：' + fns
      + '\n连接源=' + (s.chat_completion_source || '?') + ' 模型=' + (s.openai_model || s.claude_model || s.custom_model || '?')
      + '\n预设提示词：' + (pLen ? (pLen + ' 字（会附加到每次请求）') : '0 字（没读到 / 已关闭）')
      + '\n(ctx 可用项 ' + Object.keys(ctx).length + ' 个)');
  }

  function presetParams(len) {
    // 套用酒馆当前「对话补全预设」的采样参数（不套模型、不套连接）
    const out = {};
    try {
      const ctx = window.SillyTavern.getContext ? window.SillyTavern.getContext() : null;
      const s = (ctx && ctx.chatCompletionSettings) || {};
      if (s.temperature != null) out.temperature = s.temperature;
      if (s.top_p != null && s.top_p !== 0) out.top_p = s.top_p;
      if (s.presence_penalty != null) out.presence_penalty = s.presence_penalty;
      if (s.frequency_penalty != null) out.frequency_penalty = s.frequency_penalty;
      if (Array.isArray(s.stop)) { const st = s.stop.filter(Boolean); if (st.length) out.stop = st; }
      if (s.seed != null && s.seed !== -1 && s.seed !== '') out.seed = s.seed;
      if (s.repetition_penalty != null && s.repetition_penalty !== 1) out.repetition_penalty = s.repetition_penalty;
    } catch (_) {}
    out.max_tokens = Number(S.maxTokens || 100000);
    return out;
  }

  function urlCandidates(base, path) {
    const b = base.trim().replace(/\/+$/, '');
    const out = [];
    if (b.endsWith('/chat/completions') || b.endsWith('/models')) {
      out.push(b);
    } else {
      out.push(b + path);
      if (!/\/v1$/.test(b)) out.push(b + '/v1' + path);
    }
    return Array.from(new Set(out));
  }

  let ABORT = null;
  let MAXTOK_OVERRIDE = 0;
  let MAXTIMEOUT = 0;

  async function postJSON(urls, key, bodyObj, label) {
    const signal = ABORT ? ABORT.signal : undefined;
    let lastErr = null;
    for (const u of urls) {
      try {
        const r = await withTimeout(fetch(u, {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { Authorization: 'Bearer ' + key } : {}),
          body: JSON.stringify(bodyObj),
        }), (MAXTIMEOUT || 60000), label + ' ');
        const txt = await r.text();
        if (!r.ok) { lastErr = new Error(u + ' → HTTP ' + r.status + '：' + txt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 140)); continue; }
        let j = null; try { j = JSON.parse(txt); } catch (_) { lastErr = new Error(u + ' → 不是 JSON：' + txt.slice(0, 120)); continue; }
        return { j, txt, url: u };
      } catch (e) { lastErr = new Error(u + ' → ' + e.message); }
    }
    throw lastErr || new Error(label + '失败');
  }

  function extractText(j) {
    const ch = j && j.choices && j.choices[0];
    if (ch) {
      if (ch.message) {
        const c = ch.message.content;
        if (typeof c === 'string' && c.trim()) return c;
        if (Array.isArray(c)) {
          const s = c.map(x => (x && (x.text || x.content)) || '').join('');
          if (s.trim()) return s;
        }
      }
      if (typeof ch.text === 'string' && ch.text.trim()) return ch.text;
      if (ch.finish_reason === 'length') return '';
      if (ch.delta && typeof ch.delta.content === 'string' && ch.delta.content.trim()) return ch.delta.content;
    }
    if (typeof j.content === 'string' && j.content.trim()) return j.content;
    if (Array.isArray(j.content)) {
      const s = j.content.map(x => (x && (x.text || x.content)) || '').join('');
      if (s.trim()) return s;
    }
    if (typeof j.response === 'string' && j.response.trim()) return j.response;
    if (typeof j.output_text === 'string' && j.output_text.trim()) return j.output_text;
    return '';
  }

  async function testApi() {
    const base = ($('#h3v-aiBase').value || '').trim();
    const key = ($('#h3v-aiKey').value || '').trim();
    const model = ($('#h3v-aiModel').value || S.aiModel || '').trim();
    if (!base || !model) { status('err', '先填地址、拉到模型'); return; }
    status('run', '测接口中…');
    try {
      const body = { model: model, stream: false, max_tokens: 30, messages: [{ role: 'user', content: '只回两个字：收到' }] };
      const { j, txt, url } = await postJSON(urlCandidates(base, '/chat/completions'), key, body, '测接口');
      const got = extractText(j);
      if (got) status('ok', '接口可用 · ' + url + '\n模型回：' + got.slice(0, 60));
      else status('err', '接口通但没正文 · ' + url + '\n原始：' + txt.slice(0, 380));
    } catch (e) { status('err', '测接口失败：' + e.message); }
  }

  async function apiGenerate(sys, user, len) {
    ABORT = new AbortController();
    const base = (S.aiBase || '').trim();
    const key = (S.aiKey || '').trim();
    const model = (S.aiModel || '').trim();
    if (!base) throw new Error('先填自定义 API 地址');
    if (!model) throw new Error('先点「拉取模型」选一个');
    const params = (S.usePreset === false) ? { max_tokens: Number(S.maxTokens || 100000) } : presetParams(len);
    const bodyObj = Object.assign({
      model: model, stream: false,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    }, params);
    let maxTok = MAXTOK_OVERRIDE || Number(S.maxTokens || 100000);
    for (let attempt = 0; attempt < 2; attempt++) {
      jobLabel('调自定义 API · 第 ' + (attempt + 1) + '/2 次（max_tokens ' + maxTok + '）');
      const body = Object.assign({}, bodyObj, { max_tokens: maxTok });
      if (attempt > 0) {
        // 推理模型常常把 token 全花在 reasoning 上，第二次强制“只给结果”
        body.messages = bodyObj.messages.map(function (m, i, arr) {
          if (i !== arr.length - 1) return m;
          return { role: m.role, content: m.content + '\n\n（重要：不要输出思考过程或 reasoning，直接给出最终结果正文。）' };
        });
      }
      let resp;
      try {
        resp = await postJSON(urlCandidates(base, '/chat/completions'), key, body, 'AI 请求');
      } catch (e) {
        const m = String(e && e.message || '');
        if (attempt === 0 && /max_tokens|maximum context|too large|token limit|400/i.test(m)) {
          maxTok = 8192;
          LOG('服务端嫌 max_tokens 大，退到 8192 重试：' + m.slice(0, 120));
          continue;
        }
        throw e;
      }
      const { j, txt, url } = resp;
      if (j.error) throw new Error((j.error.message || JSON.stringify(j.error)).slice(0, 180));
      const out = extractText(j);
      if (out) return String(out);
      const ch0 = j.choices && j.choices[0];
      const msg = ch0 && ch0.message;
      const reasoning = msg && (msg.reasoning_content || msg.reasoning);
      const truncated = ch0 && ch0.finish_reason === 'length';
      if (attempt === 0 && (reasoning || truncated)) {
        maxTok = Math.max(4000, maxTok * 3);
        LOG('空正文(推理' + (reasoning ? '有' : '无') + '/截断' + (truncated ? '是' : '否') + ')，max_tokens 提到 ' + maxTok + ' 重试');
        continue;
      }
      const why = reasoning ? '（模型只输出了推理 reasoning_content，正文为空）' : (truncated ? '（被 max_tokens 截断）' : '');
      throw new Error('接口回了但正文为空' + why + '（' + url + '）：' + String(txt || '').slice(0, 380));
    }
    return '';
  }

  /* ---------- 视频画风强制 ---------- */
  const VIDEO_STYLE_LINE = {
    anime: 'Visual style: 2D anime, cel-shaded flat colors, clean lineart, painted 2D backgrounds, no photorealistic texture, no 3D render, no live-action footage.',
    real: 'Visual style: photorealistic live-action footage, natural light, real materials, 35mm lens.',
    cinematic: 'Visual style: cinematic live-action, photorealistic, moody color grading, shallow depth of field.',
    watercolor: 'Visual style: watercolor illustration animation, soft washes, paper texture, hand-painted look, no photoreal detail.',
    mixed: 'Visual style: mixed media — ALL characters are 2D anime (cel-shaded, clean lineart, flat color); ALL environments and props are photorealistic live-action (real materials, natural light, photographic detail). Keep the two treatments clearly separated: anime figures composited into a photographic world, never blending their rendering.',
  };
  const LIVE_WORDS = [
    [/\bnaturalistic live[- ]action\b/gi, '2D anime style'],
    [/\blive[- ]action\b/gi, '2D anime'],
    [/\bphotorealistic\b/gi, '2D cel-shaded'],
    [/\bphotograph(y|ic)\b/gi, 'anime illustration'],
    [/\bfilm grain\b/gi, 'clean flat shading'],
    [/\bhandheld[- ]?[a-z]*/gi, 'steady'],
  ];


  function applyVideoStyle(block) {
    let s = String(block || '');
    const key = S.videoStyle || 'anime';
    const line = VIDEO_STYLE_LINE[key] || VIDEO_STYLE_LINE.anime;

    // 1) 先把旧的风格行整行删掉（否则替换规则会把风格行自己也改坏）
    s = s.replace(/^[ \t]*Visual style:.*$/gim, '');
    // 2) 再替换正文里的实拍词
    if (key === 'anime' || key === 'watercolor') {  // mixed 保留 photorealistic 词
      LIVE_WORDS.forEach(function (pair) { s = s.replace(pair[0], pair[1]); });
      s = s.replace(/\b(\w+)\s+\1\b/gi, '$1');
      s = s.replace(/[ \t]{2,}/g, ' ');
    }
    // 3) 插回干净的风格行
    const lines = s.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*detailed_description\s*:/i.test(lines[i])) {
        lines.splice(i + 1, 0, line);
        break;
      }
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  function blockTail(b) {
    const m = String(b || '').match(/detailed_description\s*:?\s*([\s\S]*?)(?:\n\s*overall_soundscape\s*:?|$)/i);
    const dd = (m ? m[1] : String(b || '')).trim();
    const shots = dd.split(/\n(?=\[Shot\s)/);
    let last = shots[shots.length - 1] || dd;
    last = last.replace(/\s+/g, ' ').trim();
    return last.slice(-320);
  }

  /* ---------- 场景库（Krea2 出图 → 存库 → 视频用） ---------- */
  /* ---------- 按角色卡隔离的三个库 ---------- */
  function cardTag() {
    try {
      const ctx = window.SillyTavern && window.SillyTavern.getContext ? window.SillyTavern.getContext() : null;
      const ch = ctx && ctx.characters && ctx.characters[ctx.characterId];
      const id = ch && (ch.avatar || ch.name);
      return String(id || 'default').replace(/[^\w\-.\u4e00-\u9fa5]/g, '_');
    } catch (_) { return 'default'; }
  }

  function loadLib(base) {
    try {
      const cur = localStorage.getItem(base + '.' + cardTag());
      if (cur) { const a = JSON.parse(cur); return Array.isArray(a) ? a : []; }
      // 首次使用：把旧的全局数据迁到当前角色卡下
      const old = JSON.parse(localStorage.getItem(base) || '[]');
      const arr = Array.isArray(old) ? old : [];
      if (arr.length) localStorage.setItem(base + '.' + cardTag(), JSON.stringify(arr));
      return arr;
    } catch (_) { return []; }
  }

  function saveLib(base, arr) {
    try { localStorage.setItem(base + '.' + cardTag(), JSON.stringify(arr)); } catch (_) {}
  }

  let CURCARD_TAG = null;
  function reloadLibsIfCardChanged(force) {
    const tag = cardTag();
    if (!force && tag === CURCARD_TAG) return;
    CURCARD_TAG = tag;
    SCENES = loadLib('h3v.scenes');
    CHARLIB = loadLib('h3v.chars');
    AUDIOLIB = loadLib('h3v.audios');
    try { renderCharList(); renderSceneListBox(); renderAudioLib(); } catch (_) {}
  }

  let SCENES = loadLib('h3v.scenes');

  const _OLDSCENES = (function () {
    try { const a = JSON.parse(localStorage.getItem('h3v.scenes') || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
  })();
  const saveScenes = function () { saveLib('h3v.scenes', SCENES); };

  const SCENE_STYLE = {
    anime: '2D anime background art, cel-shaded, clean lineart, flat color fills, two-tone shading, no photorealistic texture, no 3D render',
    real: 'photorealistic photograph, natural light, 35mm lens, realistic materials, fine detail',
    cinematic: 'cinematic film still, photorealistic, moody color grading, shallow depth of field',
    watercolor: 'watercolor illustration, soft washes, paper texture, hand-painted look, no photoreal detail',
    real: 'photorealistic photograph, natural light, 35mm lens, real materials, fine detail',
  };

  const SCENE_SYS = '你是场景设定师。读用户给的角色扮演/小说正文，找出这段里出现过的**所有场景**（同一个地方不同时间算一个），为每个场景写一条**英文出图提示词**。\n' +
    '输出格式：每行一条，纯文本，不要编号解释：\n场景名|英文提示词\n' +
    '提示词要求：空间类型 + 关键陈设（3–6 个）+ 材质/色调 + 光源方向与时间 + 镜头（wide shot, 35mm）+ no people, clean background, empty scene；60–100 单词；不要出现人物、文字、水印。\n' +
    '场景数量不超过 6 个；只写正文里真实出现过的地点。';

  function normName(x) {
    return String(x || '').replace(/[\s\-_·,，。.:：()（）\[\]【】]/g, '').toLowerCase();
  }
  function sceneExists(name) {
    const want = normName(name);
    if (!want) return null;
    for (let i = 0; i < SCENES.length; i++) {
      const nm = normName(SCENES[i].name);
      if (nm && (nm === want || nm.includes(want) || want.includes(nm))) return SCENES[i];
    }
    return null;
  }

  function parseSceneLines(text) {
    const out = [];
    String(text || '').split('\n').forEach(function (l) {
      l = l.trim().replace(/^[-*\d.、\s]+/, '');
      if (!l) return;
      const parts = l.split(/[|｜]/);
      if (parts.length >= 2) out.push({ name: parts[0].trim(), prompt: parts.slice(1).join('|').trim() });
      else out.push({ name: '场景' + (out.length + 1), prompt: l });
    });
    return out.slice(0, 6);
  }

  async function scenePlan() {
    const st = SCENE_STYLE[$('#h3v-sceneStyle') ? $('#h3v-sceneStyle').value : 'anime'] || SCENE_STYLE.anime;
    const text = (CURTEXT || lastMessageText() || '').trim();
    if (!text) { status('err', '没有正文：先点楼层 🎬'); return; }
    status('run', '正在从正文提取场景…');
    try {
      const presetLen = (S.aiMode === 'api' && S.usePresetPrompt !== false) ? (await getPresetPrompts() || '').length : 0;
      const existNames = SCENES.map(function (s) { return String(s.name || '').trim(); }).filter(Boolean);
      const existBlock = existNames.length ? ('【已有场景，能对上就直接照抄这些名字，不要重复造新场景】\n' + existNames.map(function (n) { return '- ' + n; }).join('\n') + '\n') : '';
      const out = await callAI(SCENE_SYS, '画风要求：' + st + '\n' + existBlock + '正文：\n"""\n' + text + '\n"""', 1500);
      const all = parseSceneLines(out);
      if (!all.length) throw new Error('模型没给出场景');
      const fresh = [], skipped = [];
      all.forEach(function (s) { (sceneExists(s.name) ? skipped : fresh).push(s); });
      if (!fresh.length) {
        $('#h3v-sceneList').value = '';
        status('ok', '这 ' + all.length + ' 个场景库里都已经有了（' + skipped.map(function (s) { return s.name; }).join('、') + '），不用重生成');
        return;
      }
      $('#h3v-sceneList').value = fresh.map(function (s) { return s.name + '|' + s.prompt; }).join('\n');
      status('ok', '需要新生成 ' + fresh.length + ' 个' + (skipped.length ? '，跳过已有 ' + skipped.length + ' 个（' + skipped.map(function (s) { return s.name; }).join('、') + '）' : '') + (presetLen ? '（含预设提示词 ' + presetLen + ' 字）' : '') + '，确认后点「生成全部场景」');
    } catch (e) { status('err', '提取失败：' + e.message); }
  }

  /* ---------- 浏览器本地文件库（脱离 APK 用） ---------- */
  const IDB = (function () {
    let dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        const r = indexedDB.open('h3v-files', 1);
        r.onupgradeneeded = function () {
          const db = r.result;
          if (!db.objectStoreNames.contains('f')) db.createObjectStore('f', { keyPath: 'name' });
        };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
      return dbp;
    }
    async function put(name, blob, kind) {
      const db = await open();
      return new Promise(function (res, rej) {
        const tx = db.transaction('f', 'readwrite');
        tx.objectStore('f').put({ name: name, blob: blob, kind: kind || '', ts: Date.now() });
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { rej(tx.error); };
      });
    }
    async function get(name) {
      try {
        const db = await open();
        return await new Promise(function (res, rej) {
          const tx = db.transaction('f', 'readonly');
          const rq = tx.objectStore('f').get(name);
          rq.onsuccess = function () { res(rq.result ? rq.result.blob : null); };
          rq.onerror = function () { rej(rq.error); };
        });
      } catch (_) { return null; }
    }
    async function del(name) {
      try {
        const db = await open();
        const tx = db.transaction('f', 'readwrite');
        tx.objectStore('f').delete(name);
      } catch (_) {}
    }
    return { put: put, get: get, del: del };
  })();

  /* ---------- 云端直连（Krea2 出图，不经过手机 APK） ---------- */
  const RH_BASE = 'https://www.runninghub.ai';
  const WF_K2_T2I = "{\r\n \"53\": {\r\n  \"class_type\": \"CLIPTextEncode\",\r\n  \"inputs\": {\r\n   \"clip\": [\r\n    \"36\",\r\n    0\r\n   ],\r\n   \"text\": [\r\n    \"52\",\r\n    0\r\n   ]\r\n  }\r\n },\r\n \"31\": {\r\n  \"class_type\": \"ConditioningZeroOut\",\r\n  \"inputs\": {\r\n   \"conditioning\": [\r\n    \"53\",\r\n    0\r\n   ]\r\n  }\r\n },\r\n \"30\": {\r\n  \"class_type\": \"VAEDecode\",\r\n  \"inputs\": {\r\n   \"samples\": [\r\n    \"28\",\r\n    0\r\n   ],\r\n   \"vae\": [\r\n    \"34\",\r\n    0\r\n   ]\r\n  }\r\n },\r\n \"29\": {\r\n  \"class_type\": \"EmptyLatentImage\",\r\n  \"inputs\": {\r\n   \"width\": [\r\n    \"55\",\r\n    0\r\n   ],\r\n   \"height\": [\r\n    \"55\",\r\n    1\r\n   ],\r\n   \"batch_size\": 1\r\n  }\r\n },\r\n \"27\": {\r\n  \"class_type\": \"SaveImage\",\r\n  \"inputs\": {\r\n   \"images\": [\r\n    \"30\",\r\n    0\r\n   ],\r\n   \"filename_prefix\": \"Krea2-%date:yyyyMMddhhmmss%\"\r\n  }\r\n },\r\n \"35\": {\r\n  \"class_type\": \"Seed (rgthree)\",\r\n  \"inputs\": {\r\n   \"seed\": 685212704886219\r\n  }\r\n },\r\n \"28\": {\r\n  \"class_type\": \"KSampler\",\r\n  \"inputs\": {\r\n   \"model\": [\r\n    \"37\",\r\n    0\r\n   ],\r\n   \"positive\": [\r\n    \"53\",\r\n    0\r\n   ],\r\n   \"negative\": [\r\n    \"31\",\r\n    0\r\n   ],\r\n   \"latent_image\": [\r\n    \"29\",\r\n    0\r\n   ],\r\n   \"seed\": [\r\n    \"35\",\r\n    0\r\n   ],\r\n   \"steps\": 8,\r\n   \"cfg\": 1,\r\n   \"sampler_name\": \"euler\",\r\n   \"scheduler\": \"simple\",\r\n   \"denoise\": 1\r\n  }\r\n },\r\n \"36\": {\r\n  \"class_type\": \"CLIPLoader\",\r\n  \"inputs\": {\r\n   \"clip_name\": \"qwen3vl_4b_fp8_scaled.safetensors\",\r\n   \"type\": \"krea2\",\r\n   \"device\": \"default\"\r\n  }\r\n },\r\n \"34\": {\r\n  \"class_type\": \"VAELoader\",\r\n  \"inputs\": {\r\n   \"vae_name\": \"qwen_image_vae.safetensors\"\r\n  }\r\n },\r\n \"55\": {\r\n  \"class_type\": \"ResolutionSelector\",\r\n  \"inputs\": {\r\n   \"aspect_ratio\": \"9:16 (Portrait Widescreen)\",\r\n   \"megapixels\": 1.2,\r\n   \"multiple\": 32\r\n  }\r\n },\r\n \"37\": {\r\n  \"class_type\": \"UNETLoader\",\r\n  \"inputs\": {\r\n   \"unet_name\": \"krea2_turbo_fp8.safetensors\",\r\n   \"weight_dtype\": \"default\"\r\n  }\r\n },\r\n \"50\": {\r\n  \"class_type\": \"PrimitiveStringMultiline\",\r\n  \"inputs\": {\r\n   \"value\": \"一位黑色长发的年轻亚洲女子站在阳光斑驳的森林中，头发自然披散在肩头并编成一条松散的长辫，用紫色发圈固定。她的皮肤白皙，嘴唇微张，笑容甜美，表情温柔。她身穿一袭白色露肩上衣，领口和袖口饰有精致蕾丝花边，胸前系着蝴蝶结，下摆微微收紧露出紫色腰带；脖子上戴着一条金色细链，坠着一枚椭圆形紫色宝石吊坠。她的右手轻轻捏住一朵紫色风铃草，花瓣舒展，花茎细长带有绿色叶片。柔和的金色阳光从左侧树叶间洒落，整体画面呈现温暖。\"\r\n  }\r\n },\r\n \"52\": {\r\n  \"class_type\": \"easy stylesSelector\",\r\n  \"inputs\": {\r\n   \"positive\": [\r\n    \"50\",\r\n    0\r\n   ],\r\n   \"styles\": \"fooocus_styles\"\r\n  }\r\n }\r\n}";

  function cloudAccounts() {
    if (!Array.isArray(S.cloudAccounts)) S.cloudAccounts = [];
    return S.cloudAccounts;
  }
  function cloudAcc() {
    const list = cloudAccounts();
    if (!list.length) return null;
    const i = Math.min(Number(S.cloudAccIdx || 0), list.length - 1);
    return list[i];
  }

  async function rhPost(path, body, withKey) {
    const acc = cloudAcc();
    const payload = Object.assign({}, body);
    if (withKey !== false && acc && acc.apiKey) payload.apiKey = acc.apiKey;
    const r = await fetch(RH_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch (_) { throw new Error(path + ' 返回非 JSON：' + txt.slice(0, 120)); }
  }

  async function cloudKrea2(prompt, aspect, mp) {
    const acc = cloudAcc();
    if (!acc || !acc.apiKey) throw new Error('云端直连需要先导入带 API Key 的账号');
    const wf = JSON.parse(WF_K2_T2I);
    if (wf['13']) wf['13'].inputs.text = prompt;
    if (wf['15']) {
      wf['15'].inputs.aspect_ratio = aspect || '16:9 (Widescreen)';
      wf['15'].inputs.megapixels = mp || 1.5;
    }
    if (wf['17']) wf['17'].inputs.seed = Math.floor(Math.random() * 1e12);
    const c = await rhPost('/task/openapi/create', {
      workflowId: '2112032226968285186',
      workflow: JSON.stringify(wf),
    });
    const tid = c && c.data && c.data.taskId;
    if (!tid) throw new Error('提交失败：' + JSON.stringify(c).slice(0, 160));
    const t0 = Date.now();
    while (Date.now() - t0 < 600000) {
      await new Promise(function (r) { setTimeout(r, 5000); });
      const s = await rhPost('/task/openapi/status', { taskId: tid });
      const st = s && s.data;
      if (st === 'SUCCESS' || st === '3') break;
      if (st === 'FAILED' || st === '2') throw new Error('云端任务失败');
      jobLabel('云端出图 ' + Math.round((Date.now() - t0) / 1000) + 's');
    }
    const o = await rhPost('/task/openapi/outputs', { taskId: tid });
    const arr = (o && o.data) || [];
    const hit = arr.find(function (x) { return /\.(png|jpe?g|webp)(\?|$)/i.test(x.fileUrl || ''); });
    if (!hit) throw new Error('任务结束但没拿到图片');
    return hit.fileUrl;
  }

  async function sceneGen() {
    const raw = $('#h3v-sceneList').value.trim();
    if (!raw) { status('err', '先点「按正文出场景提示词」或手写'); return; }
    const listAll = parseSceneLines(raw);
    const list = listAll.filter(function (s) { return !sceneExists(s.name); });
    if (!list.length) { status('ok', '这些场景库里都已经有了，跳过生成'); return; }
    const styleKey = $('#h3v-sceneStyle') ? $('#h3v-sceneStyle').value : 'anime';
    const styleText = SCENE_STYLE[styleKey] || SCENE_STYLE.anime;
    const conc = Math.max(1, Number($('#h3v-sceneConc') ? $('#h3v-sceneConc').value : 3) || 3);
    const btn = $('#h3v-sceneGen');
    btn.disabled = true;
    jobBegin('生成场景（' + list.length + ' 张 · 并发 ' + conc + '）');
    pgSet(0);
    let done = 0, ok = 0, idx = 0;
    let firstErr = '';

    async function submitOne(s, tries) {
      try {
        return await jpost('/api/krea2/run', {
          mode: 't2i',
          prompt: styleText + ', ' + s.prompt + ', no people, clean background, empty scene',
          aspect: '16:9 (Widescreen)',
          mp: 1.5,
          prefix: 'scene',
        });
      } catch (e) {
        const msg = String(e && e.message || '');
        if (tries > 0 && /并发|busy|并发已满|RUNNING|超时|timeout|Failed to fetch/i.test(msg)) {
          await new Promise(r => setTimeout(r, 4000));
          return submitOne(s, tries - 1);
        }
        throw e;
      }
    }

    async function worker() {
      while (idx < list.length) {
        const i = idx++;
        const s = list[i];
        jobLabel('场景 ' + (i + 1) + '/' + list.length + '：' + s.name);
        pgSet(100 * (done / list.length));
        try {
          let file;
          if (S.sceneCloud) {
            file = await cloudKrea2(styleText + ', ' + s.prompt + ', no people, clean background, empty scene', '16:9 (Widescreen)', 1.5);
          } else {
            const j = await submitOne(s, 8);
            file = await waitKrea2(j.taskId);
          }
          const fullUrl = /^https?:/i.test(file) ? file : api(file);
          const blob = await (await fetch(fullUrl)).blob();
          const fname = 'scene_' + Date.now() + '_' + i + '.png';
          const up = await fetch(api('/api/upload?name=' + encodeURIComponent(fname) + '&kind=image'), {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob,
          }).then(r => r.json());
          if (up.error) throw new Error(up.error);
          SCENES.unshift({ name: s.name, prompt: s.prompt, style: styleKey, file: up.name, ts: Date.now() });
          saveScenes();
          ok++;
        } catch (e) {
          LOG('scene fail', s.name, e);
          if (!firstErr) firstErr = (s.name + '：' + (e && e.message ? e.message : e));
        }
        done++;
        status('run', '场景进度 ' + done + '/' + list.length + '（成功 ' + ok + '）…');
      }
    }

    const workers = [];
    for (let k = 0; k < conc; k++) workers.push(worker());
    await Promise.all(workers);

    jobEnd();
    btn.disabled = false;
    pgSet(100);
    renderSceneListBox();
    status(ok ? 'ok' : 'err', '场景完成 ' + ok + '/' + list.length + '（画风：' + styleKey + '）'
      + (ok ? '，已存进场景库' : '') + (firstErr ? '\n首个错误：' + firstErr.slice(0, 160) : ''));
  }

  function waitKrea2(taskId) {
    return new Promise(function (resolve, reject) {
      const t0 = Date.now();
      const timer = setInterval(async function () {
        try {
          const j = await jget('/api/krea2/history');
          const job = (j.jobs || []).find(function (x) { return x.taskId === taskId; });
          if (job && job.state === 'done' && job.files && job.files.length) { clearInterval(timer); resolve(job.files[0]); return; }
          if (job && job.state === 'error') { clearInterval(timer); reject(new Error(job.error || 'Krea2 失败')); return; }
          if (Date.now() - t0 > 600000) { clearInterval(timer); reject(new Error('Krea2 超时')); }
        } catch (e) { /* 抖动继续 */ }
      }, 5000);
    });
  }

  function refreshSceneLib() {
    renderSceneListBox();
    const sel = $('#h3v-sceneLib');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = SCENES.length
      ? SCENES.map(function (s, i) { return '<option value="' + i + '">' + esc(s.name) + ' · ' + esc(s.file || '') + '</option>'; }).join('')
      : '<option value="">（场景库空）</option>';
    if (cur !== '' && SCENES[Number(cur)]) sel.value = cur;
    sceneLibPreview();
  }

  function sceneLibPreview() {
    const sel = $('#h3v-sceneLib'), img = $('#h3v-sceneLibPv');
    if (!sel || !img) return;
    const s = SCENES[Number(sel.value)];
    if (s && s.file) { img.src = api('/api/preview?type=input&filename=' + encodeURIComponent(s.file) + '&t=' + Date.now()); img.style.display = 'block'; }
    else { img.removeAttribute('src'); img.style.display = 'none'; }
  }

  /* ---------- 按段解析 CAST → 取对应素材 ---------- */
  const SEGIMG = {};   // { blockIndex: [file, ...] }
  const SEGCAST = {};  // { blockIndex: {cast:[names], scene:'name'} }

  /* ---------- 分段接续：抓上一段尾帧，当下一段首帧参考 ---------- */
  const SEGLAST = {};

  function grabLastFrame(videoUrl) {
    return new Promise(function (resolve, reject) {
      const v = document.createElement("video");
      v.src = videoUrl;
      v.muted = true;
      v.preload = "auto";
      v.playsInline = true;
      const to = setTimeout(function () { reject(new Error("取帧超时")); }, 20000);
      v.onloadeddata = function () {
        try { v.currentTime = Math.max(0, (v.duration || 1) - 0.08); } catch (_) { try { v.currentTime = 0; } catch (_) {} }
      };
      v.onseeked = function () {
        try {
          const c = document.createElement("canvas");
          c.width = v.videoWidth || 768;
          c.height = v.videoHeight || 1344;
          c.getContext("2d").drawImage(v, 0, 0);
          c.toBlob(function (b) { clearTimeout(to); b ? resolve(b) : reject(new Error("canvas 导出失败")); }, "image/jpeg", 0.92);
        } catch (e) { clearTimeout(to); reject(e); }
      };
      v.onerror = function () { clearTimeout(to); reject(new Error("视频加载失败")); };
    });
  }

  async function rememberTail(idx, files) {
    try {
      if (S.chain === false || !files || !files.length) return;
      const first = files[0];
      const url = api(typeof first === "string" ? first : (first.url || first.viewUrl || ""));
      const blob = await grabLastFrame(url);
      const fname = "tail_" + Date.now() + "_" + idx + ".jpg";
      const up = await fetch(api("/api/upload?name=" + encodeURIComponent(fname) + "&kind=image"), {
        method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob,
      }).then(function (r) { return r.json(); });
      if (up && up.name) { SEGLAST[idx] = up.name; LOG("tail saved", idx, up.name); }
    } catch (e) { LOG("tail fail", idx, e); }
  }

  function injectTailFrame(blockText, picNo) {
    let s = String(blockText || "");
    const line = "<Picture " + picNo + "> is the exact last frame of the previous segment and the required first frame of [Shot 1].";
    const arr = s.split("\n");
    let at = -1;
    for (let i = 0; i < arr.length; i++) { if (/^\s*summary\s*:/i.test(arr[i])) { at = i; break; } }
    if (at >= 0) arr.splice(at, 0, line);
    s = arr.join("\n");
    s = s.replace(/\[Shot 1\]\s*/, "[Shot 1] The frame opens exactly on <Picture " + picNo + ">, the last frame of the previous segment, with no cut and no camera reset. ");
    return s;
  }

  function charAudioByName(name) {
    if (!name) return '';
    const want = String(name).replace(/\s+/g, '');
    for (let i = 0; i < CHARLIB.length; i++) {
      const nm = String(CHARLIB[i].name || '').replace(/\s+/g, '');
      if (!nm) continue;
      if (nm === want || want.includes(nm) || nm.includes(want)) {
        return (Array.isArray(S.charAudio) ? (S.charAudio[i] || '') : '');
      }
    }
    return '';
  }

  // 有音色的角色：在 subject_definitions 末尾补 <Audio N> is the voice-timbre reference for <Subject N>.
  function ensureAudioTags(block, cast) {
    let s = String(block || '');
    const names = (cast && cast.cast) ? cast.cast : [];
    if (!names.length) return s;
    const tags = [];
    for (let k = 0; k < names.length && tags.length < 3; k++) {
      if (!charAudioByName(names[k])) continue;
      const n = k + 1;
      if (new RegExp('<Audio\\s*' + n + '\\b', 'i').test(s)) continue;
      tags.push('<Audio ' + n + '> is the voice-timbre reference for <Subject ' + n + '>.');
    }
    if (!tags.length) return s;
    const lines = s.split('\n');
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*summary\s*:/i.test(lines[i])) { idx = i; break; }
    }
    if (idx < 0) return s;
    lines.splice(idx, 0, tags.join('\n'));
    return lines.join('\n');
  }

  /* ---------- 自定义 API 多配置 ---------- */
  /* ---------- H3 账号导出/导入 ---------- */
  async function accExport() {
    try {
      const j = await jget('/api/accounts/export');
      if (!j || !Array.isArray(j.accounts)) throw new Error('导出失败');
      const text = JSON.stringify(j);
      try { await navigator.clipboard.writeText(text); } catch (_) {}
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'h3-accounts-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      if ($('#h3v-accState')) $('#h3v-accState').textContent = '已导出 ' + j.accounts.length + ' 个账号（已复制到剪贴板）';
      status('ok', '账号已导出（' + j.accounts.length + ' 个），文件也下载了');
    } catch (e) { status('err', '导出失败：' + e.message); }
  }

  async function accImport() {
    // 直接选文件导入（导出的是 .json 文件，不用手贴）
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = async function () {
      const f = (inp.files || [])[0];
      if (!f) return;
      try {
        const txt = await f.text();
        const ta = $('#h3v-accJson');
        if (ta) ta.value = txt;
        await accImportDo(txt);
      } catch (e) {
        status('err', '读取文件失败：' + e.message);
      }
    };
    inp.click();
  }

  async function accImportDo() {
    const raw = ($('#h3v-accJson') || {}).value || '';
    if (!raw.trim()) { status('err', '先粘贴账号 JSON'); return; }
    let j = null;
    try { j = JSON.parse(raw); } catch (e) { status('err', 'JSON 解析失败：' + e.message); return; }
    const list = Array.isArray(j) ? j : (j.accounts || []);
    if (!list.length) { status('err', '这份数据里没有账号'); return; }
    try {
      const r = await jpost('/api/accounts/import', {
        accounts: list,
        mode: ($('#h3v-accReplace') && $('#h3v-accReplace').checked) ? 'replace' : 'merge',
      });
      if (!r.ok) throw new Error(r.error || '导入失败');
      S.cloudAccounts = list.slice();
      if (S.cloudAccIdx == null) S.cloudAccIdx = 0;
      saveS();
      $('#h3v-accBox').style.display = 'none';
      $('#h3v-accJson').value = '';
      status('ok', '导入完成：新增 ' + r.added + '，跳过重复 ' + r.skipped + '，现在共 ' + r.total + ' 个账号');
      if ($('#h3v-accState')) $('#h3v-accState').textContent = '共 ' + r.total + ' 个账号';
    } catch (e) { status('err', '导入失败：' + e.message); }
  }

  function apiProfiles() {
    if (!Array.isArray(S.apiProfiles)) S.apiProfiles = [];
    return S.apiProfiles;
  }
  function renderApiProfiles() {
    const sel = $('#h3v-apiProf');
    if (!sel) return;
    const list = apiProfiles();
    sel.innerHTML = '<option value="">（当前手动填写）</option>' +
      list.map(function (p, i) { return '<option value="' + i + '">' + esc(p.name || p.model || ('配置' + (i + 1))) + '</option>'; }).join('');
    sel.value = '';
  }
  function applyProfile(i) {
    const list = apiProfiles();
    const p = list[Number(i)];
    if (!p) return;
    S.aiBase = p.base || '';
    S.aiKey = p.key || '';
    S.aiModel = p.model || '';
    if ($('#h3v-aiBase')) $('#h3v-aiBase').value = S.aiBase;
    if ($('#h3v-aiKey')) $('#h3v-aiKey').value = S.aiKey;
    if ($('#h3v-aiModel')) {
      const sel = $('#h3v-aiModel');
      if (!Array.from(sel.options).some(function (o) { return o.value === S.aiModel; })) {
        const o = document.createElement('option'); o.value = S.aiModel; o.textContent = S.aiModel; sel.appendChild(o);
      }
      sel.value = S.aiModel;
    }
    saveS();
    status('ok', '已切到配置「' + (p.name || p.model) + '」');
  }
  function saveProfile() {
    const name = (prompt('配置名字（比如 commandcode / deepseek 官方）', (S.aiModel || 'config')) || '').trim();
    if (!name) return;
    const list = apiProfiles();
    const item = { name: name, base: ($('#h3v-aiBase') || {}).value || S.aiBase || '', key: ($('#h3v-aiKey') || {}).value || S.aiKey || '', model: S.aiModel || '' };
    const idx = list.findIndex(function (p) { return p.name === name; });
    if (idx >= 0) list[idx] = item; else list.push(item);
    S.aiBase = item.base; S.aiKey = item.key;
    saveS();
    renderApiProfiles();
    status('ok', '已保存配置「' + name + '」（共 ' + list.length + ' 个）');
  }
  function delProfile() {
    const sel = $('#h3v-apiProf');
    const i = sel ? sel.value : '';
    if (i === '') { status('err', '先在下拉里选一个配置'); return; }
    const list = apiProfiles();
    if (!list[Number(i)]) return;
    if (!confirm('删掉配置「' + (list[Number(i)].name || '') + '」？')) return;
    list.splice(Number(i), 1);
    saveS();
    renderApiProfiles();
    status('ok', '已删除，剩 ' + list.length + ' 个配置');
  }

  function buildAssetList() {
    const chars = CHARLIB.map(function (c) { return String(c.name || '').trim(); }).filter(Boolean);
    const scenes = SCENES.map(function (s) { return String(s.name || '').trim(); }).filter(Boolean);
    const voiced = [];
    for (let i = 0; i < CHARLIB.length; i++) {
      const a = (Array.isArray(S.charAudio) ? S.charAudio[i] : '');
      if (a && CHARLIB[i].name) voiced.push(CHARLIB[i].name);
    }
    let text = '';
    if (chars.length) text += '可用角色（CAST 里只能照抄这些名字）：\n' + chars.map(function (c) { return '- ' + c; }).join('\n') + '\n';
    if (scenes.length) text += '可用场景（SCENE 里只能照抄这些名字）：\n' + scenes.map(function (c) { return '- ' + c; }).join('\n') + '\n';
    if (voiced.length) text += '可用音色（<Audio N> 必须按角色出现顺序对应）：\n' + voiced.map(function (c, i) { return '- ' + c + ' → <Audio ' + (i + 1) + '>'; }).join('\n') + '\n';
    if (!text) text = '（素材清单为空：请先在视频弹窗里填角色名字、并生成场景库）\n';
    return { chars: chars, scenes: scenes, text: text };
  }

  function resolveChar(name) {
    if (!name) return '';
    const want = String(name).replace(/\s+/g, '');
    for (let i = 0; i < CHARLIB.length; i++) {
      const nm = String(CHARLIB[i].name || '').replace(/\s+/g, '');
      if (nm && (nm === want || want.includes(nm) || nm.includes(want))) return CHARLIB[i].file;
    }
    return '';
  }
  function resolveScene(name) {
    if (!name) return ($('#h3v-scene') ? $('#h3v-scene').value : '');
    const want = String(name).replace(/\s+/g, '');
    for (let i = 0; i < SCENES.length; i++) {
      const nm = (SCENES[i].name || '').replace(/\s+/g, '');
      if (nm && (nm === want || want.includes(nm) || nm.includes(want))) return SCENES[i].file || '';
    }
    return '';
  }
  function parseCastLine(block) {
    const m = String(block || '').match(/<!--\s*CAST:\s*([^|]*(?:\|[^>]*)?)\s*-->/i);
    if (!m) return null;
    const body = m[1];
    const parts = body.split(/\|/);
    const cast = (parts[0] || '').split(/[,,、]/).map(function (s) { return s.trim(); }).filter(Boolean);
    let scene = '';
    for (let i = 1; i < parts.length; i++) {
      const mm = parts[i].match(/SCENE\s*:\s*(.+)/i);
      if (mm) scene = mm[1].trim();
    }
    return { cast: cast, scene: scene, raw: m[0] };
  }

  /* ---------- 角色库 / 场景库界面 ---------- */
  /* ---------- 角色库（独立持久化，不依赖下拉框） ---------- */
  let CHARLIB = loadLib('h3v.chars');
  const saveChars = function () { saveLib('h3v.chars', CHARLIB); };
  // 旧数据迁移：早期角色存在 S.views 里
  (function () {
    try {
      if (CHARLIB.length) return;
      const v = Array.isArray(S.views) ? S.views : [];
      const nm = Array.isArray(S.charNames) ? S.charNames : [];
      v.forEach(function (f, i) { if (f) CHARLIB.push({ file: f, name: nm[i] || ('角色' + (i + 1)) }); });
      if (CHARLIB.length) saveChars();
    } catch (_) {}
  })();

  function thumbUrl(file) {
    return api('/api/preview?type=input&filename=' + encodeURIComponent(file) + '&t=' + Date.now());
  }

  async function hydrateThumbs(root) {
    if (!root) return;
    const imgs = root.querySelectorAll('img[data-file]');
    for (let i = 0; i < imgs.length; i++) {
      const el = imgs[i];
      const name = el.getAttribute('data-file');
      if (!name || el.dataset.done) continue;
      el.dataset.done = '1';
      try {
        const blob = await IDB.get(name);
        if (blob) {
          const u = URL.createObjectURL(blob);
          el.src = u;
          el.onload = function () { setTimeout(function () { URL.revokeObjectURL(u); }, 8000); };
        }
      } catch (_) {}
    }
  }

  function renderCharList() {
    const box = $('#h3v-charList');
    if (!box) return;
    const sum = $('#h3v-charSum');
    if (sum) sum.textContent = '角色库（' + CHARLIB.length + ' 张，点开）';
    if (!CHARLIB.length) { box.innerHTML = '<div class="hint">还没有角色图，点上面「+ 上传角色图」</div>'; return; }
    let html = '';
    CHARLIB.forEach(function (c, i) {
      html += '<div class="row">' +
        '<img class="pv" style="display:block;width:46px;height:46px;object-fit:cover;margin:0;border-radius:6px" src="' + thumbUrl(c.file) + '">' +
        '<input data-cn="' + i + '" value="' + esc(c.name || '') + '" placeholder="角色名（中文）" style="flex:1">' +
        '<select data-ca="' + i + '" style="max-width:130px;flex:none"></select>' +
        '<button data-cdel="' + i + '" style="flex:none">删</button></div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('input[data-cn]').forEach(function (el) {
      const i = Number(el.dataset.cn);
      el.oninput = function () { CHARLIB[i].name = el.value.trim(); saveChars(); };
    });
    box.querySelectorAll('button[data-cdel]').forEach(function (el) {
      const i = Number(el.dataset.cdel);
      el.onclick = function () { CHARLIB.splice(i, 1); saveChars(); renderCharList(); };
    });
    fillCharAudioSelects();
  }

  function renderSceneListBox() {
    const box = $('#h3v-sceneListBox');
    if (!box) return;
    const ssum = $('#h3v-sceneSum');
    if (ssum) ssum.textContent = '场景库（' + SCENES.length + ' 张，点开）';
    if (!SCENES.length) { box.innerHTML = '<div class="hint">场景库还是空的：先用上面「按正文出场景提示词 → 生成全部场景」，或点「+ 上传场景图」</div>'; return; }
    let html = '';
    SCENES.forEach(function (s, i) {
      html += '<div class="row">' +
        (s.file ? '<img class="pv" data-file="' + esc(s.file) + '" style="display:block;width:64px;height:40px;object-fit:cover;margin:0;border-radius:6px" src="' + thumbUrl(s.file) + '">' : '') +
        '<input data-sn="' + i + '" value="' + esc(s.name || '') + '" placeholder="场景名（中文）" style="flex:1">' +
        '<button data-suse="' + i + '" style="flex:none">设为默认</button>' +
        '<button data-sdel="' + i + '" style="flex:none">删</button></div>';
    });
    box.innerHTML = html;
    hydrateThumbs(box);
    box.querySelectorAll('input[data-sn]').forEach(function (el) {
      const i = Number(el.dataset.sn);
      el.oninput = function () { SCENES[i].name = el.value.trim(); saveScenes(); };
    });
    box.querySelectorAll('button[data-suse]').forEach(function (el) {
      const i = Number(el.dataset.suse);
      el.onclick = function () {
        const s = SCENES[i];
        if (!s || !s.file) return;
        S.scene = s.file; saveS();
        const hidden = $('#h3v-scene');
        if (hidden) {
          if (!Array.from(hidden.options).some(function (o) { return o.value === s.file; })) {
            const o = document.createElement('option'); o.value = s.file; o.textContent = s.file; hidden.appendChild(o);
          }
          hidden.value = s.file;
        }
        status('ok', '默认场景设为「' + s.name + '」');
      };
    });
    hydrateThumbs(box);
    box.querySelectorAll('button[data-sdel]').forEach(function (el) {
      const i = Number(el.dataset.sdel);
      el.onclick = function () {
        if (!confirm('从场景库删掉「' + (SCENES[i] && SCENES[i].name) + '」？（不会删文件）')) return;
        SCENES.splice(i, 1); saveScenes(); renderSceneListBox();
      };
    });
  }

  function uploadOne(f) {
    const ext = (f.name.match(/\.[^.]+$/) || ['.bin'])[0];
    const localName = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + ext;
    return fetch(api('/api/upload?name=' + encodeURIComponent(f.name) + '&kind=image'), {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: f,
    }).then(function (r) { return r.json(); }).catch(function () {
      return { name: localName, local: true };  // APK 不在也能用：文件只存浏览器本地库
    }).then(function (j) {
      if (j && !j.error && j.name) return j;
      return { name: localName, local: true };
    });
  }

  function uploadChar() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.onchange = async function () {
      const files = Array.from(inp.files || []);
      for (let k = 0; k < files.length; k++) {
        const f = files[k];
        try {
          status('run', '上传角色图 ' + (k + 1) + '/' + files.length + '…');
          const j = await uploadOne(f);
          if (j.error) throw new Error(j.error);
          if (CHARLIB.length >= 6) { status('err', '角色库最多 6 张'); break; }
          CHARLIB.push({ file: j.name, name: f.name.replace(/\.[^.]+$/, '') });
          try { await IDB.put(j.name, f, 'image'); } catch (_) {}
          saveChars();
          renderCharList();
        } catch (e) { status('err', '上传失败：' + e.message); }
      }
      status('ok', '角色库已更新（记得填中文名）');
      renderCharList();
    };
    inp.click();
  }

  function uploadScene() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.onchange = async function () {
      const files = Array.from(inp.files || []);
      for (let k = 0; k < files.length; k++) {
        try {
          status('run', '上传场景图 ' + (k + 1) + '/' + files.length + '…');
          const j = await uploadOne(files[k]);
          if (j.error) throw new Error(j.error);
          SCENES.unshift({ name: files[k].name.replace(/\.[^.]+$/, ''), prompt: '', style: 'upload', file: j.name, ts: Date.now() });
          try { await IDB.put(j.name, files[k], 'image'); } catch (_) {}
          saveScenes();
          renderSceneListBox();
        } catch (e) { status('err', '上传失败：' + e.message); }
      }
      status('ok', '场景库已更新');
    };
    inp.click();
  }

  /* ---------- 音频库（角色音色参考） ---------- */
  let AUDIOLIB = loadLib('h3v.audios');
  const saveAudios = function () { saveLib('h3v.audios', AUDIOLIB); };

  function renderAudioLib() {
    const box = $('#h3v-audList');
    if (!box) return;
    const sum = $('#h3v-audSum');
    if (sum) sum.textContent = '音频库（' + AUDIOLIB.length + ' 条，点开）';
    if (!AUDIOLIB.length) { box.innerHTML = '<div class="hint">还没有音频</div>'; return; }
    let html = '';
    AUDIOLIB.forEach(function (a, i) {
      html += '<div class="row">' +
        '<input data-an="' + i + '" value="' + esc(a.name || '') + '" placeholder="音色名（如：男主）" style="flex:1">' +
        '<button data-aplay="' + i + '" style="flex:none">试听</button>' +
        '<button data-adel="' + i + '" style="flex:none">删</button></div>' +
        '<div class="hint" style="margin:-4px 0 8px 68px">文件：' + esc(a.file || '(空)') + '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('input[data-an]').forEach(function (el) {
      const i = Number(el.dataset.an);
      el.oninput = function () { AUDIOLIB[i].name = el.value.trim(); saveAudios(); fillCharAudioSelects(); };
    });
    box.querySelectorAll('button[data-aplay]').forEach(function (el) {
      const i = Number(el.dataset.aplay);
      el.onclick = function () {
        const a = AUDIOLIB[i];
        if (!a || !a.file) return;
        const url = api('/api/preview?type=input&filename=' + encodeURIComponent(a.file) + '&t=' + Date.now());
        try { new Audio(url).play(); status('ok', '试听：' + (a.name || a.file)); } catch (e) { status('err', '这个浏览器不支持内联播放'); }
      };
    });
    box.querySelectorAll('button[data-adel]').forEach(function (el) {
      const i = Number(el.dataset.adel);
      el.onclick = function () { AUDIOLIB.splice(i, 1); saveAudios(); renderAudioLib(); fillCharAudioSelects(); };
    });
    fillCharAudioSelects();
  }

  function fillCharAudioSelects() {
    const box = $('#h3v-charList');
    if (!box) return;
    box.querySelectorAll('select[data-ca]').forEach(function (sel) {
      const i = Number(sel.dataset.ca);
      if (!CHARLIB[i]) return;
      const cur = (Array.isArray(S.charAudio) ? S.charAudio[i] : '') || '';
      sel.innerHTML = '<option value="">音色：无</option>' + AUDIOLIB.map(function (a) {
        return '<option value="' + esc(a.file) + '">' + esc(a.name || a.file) + '</option>';
      }).join('');
      sel.value = cur;
      sel.onchange = function () {
        if (!Array.isArray(S.charAudio)) S.charAudio = ['', '', '', '', '', ''];
        S.charAudio[i] = sel.value; saveS();
      };
    });
  }

  function uploadAudioLib() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'audio/*'; inp.multiple = true;
    inp.onchange = async function () {
      const files = Array.from(inp.files || []);
      for (let k = 0; k < files.length; k++) {
        try {
          status('run', '上传音频 ' + (k + 1) + '/' + files.length + '…');
          const j = await fetch(api('/api/upload?name=' + encodeURIComponent(files[k].name) + '&kind=audio'), {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: files[k],
          }).then(function (r) { return r.json(); });
          if (j.error) throw new Error(j.error);
          AUDIOLIB.unshift({ name: files[k].name.replace(/\.[^.]+$/, ''), file: j.name, ts: Date.now() });
          try { await IDB.put(j.name, files[k], 'audio'); } catch (_) {}
          saveAudios(); renderAudioLib();
        } catch (e) { status('err', '上传失败：' + e.message); }
      }
      status('ok', '音频库已更新，去角色库里给角色选音色');
    };
    inp.click();
  }

  const CHECK_SYS = [
    '你是 MiniMax H3 全参考模式（Ref2VA）提示词审校员。用户给你若干 [[H3]]…[[/H3]] 段，每段六小节。逐段检查并直接给出修缮后的完整版本。',
    '',
    '必须修的问题：',
    '1) 六段名必须齐全且带冒号：subject_definitions: / summary: / retention_analysis: / detailed_description: / overall_soundscape: / non_diegetic_music:',
    '2) 六段用英文写；但人名必须原样照抄素材清单里的中文名（如 白井玄一），严禁音译成罗马字（Shiroi / Shirai Genichi / Hakui 这类一律改回中文）；除人名外的中文描述必须译成英文；中文台词只允许在 <d>[Chinese] …</d> 里。',
    '3) [Shot 1] 不允许出现任何时间戳；从第 2 镜起才写 [Shot N] At MM:SS.mmm, …',
    '4) <Subject N> 从 1 开始连续编号，不许跳号；<Picture N> 的编号与 subject_definitions 里的引用一致，且顺序＝本段角色顺序、场景永远最后。',
    '5) 若本段用到音色参考，写成 <Audio N> is the voice-timbre reference for <Subject N>.（最多 3 条）；没有音色就不要编造。',
    '6) 删掉任何界面/选项/字幕/光标/UI 描述；删掉 keep consistent with reference 这类不带编号的空话。',
    '7) 末镜时间不超过 00:14.500，整段不超过 15 秒；除非明显违规，不要随意增删镜头。',
    '8) 每段第一行必须有 <!--CAST: 角色名 | SCENE: 场景名-->，名字只能用用户给的素材清单里的；本段没出现的角色不要写。',
    '',
    '只输出修缮后的全部 [[H3]]…[[/H3]] 段，段数与输入完全一致，不要解释、不要前缀后缀、不要代码块。',
  ].join('\n');

  const TRANS_SYS = [
    '你是影视分镜字幕翻译。用户给你若干 [[H3]]…[[/H3]] 段（每段六小节英文提示词）。',
    '请逐段翻译成简体中文，要求：',
    '1) 保留 [[H3]] 与 [[/H3]] 标记、保留六小节英文标题（subject_definitions / summary / retention_analysis / detailed_description / overall_soundscape / non_diegetic_music）不动，只翻译标题后面的内容；',
    '2) 保留 <Subject N>、<Picture N>、<Audio N>、(S1)=等标签原样，不翻译标签本身；',
    '3) <d>[Chinese] …</d> 里的台词保持原文不动；',
    '4) 时间戳 At MM:SS.mmm 保持原样；',
    '5) 不增删内容、不写解释、不加评论。',
    '只输出翻译后的完整内容。',
  ].join('\n');

  async function translateAll() {
    const src = ($('#h3v-prompt') || {}).value || '';
    if (!src.trim()) { status('err', '没有提示词可翻译'); return; }
    const box = $('#h3v-transBox'), out = $('#h3v-transText');
    const btn = $('#h3v-trans');
    if (btn) btn.disabled = true;
    if (box) box.style.display = 'block';
    if (out) out.textContent = '翻译中…';
    jobBegin('翻译提示词');
    pgSet(20);
    try {
      const blocks = parseBlocks(src);
      const outLines = [];
      for (let i = 0; i < blocks.length; i++) {
        jobLabel('翻译 第 ' + (i + 1) + '/' + blocks.length + ' 段');
        pgSet(20 + 70 * (i / Math.max(1, blocks.length)));
        const one = '[[H3]]\n' + blocks[i] + '\n[[/H3]]';
        let zh = '';
        try { zh = await callAI(TRANS_SYS, one, 3000); } catch (e) { zh = '（这段翻译失败：' + e.message + '）'; }
        outLines.push(String(zh || '').trim());
      }
      if (out) out.textContent = outLines.join('\n\n');
      pgSet(100);
      status('ok', '翻译完成（' + blocks.length + ' 段），左边英文原文没动');
    } catch (e) {
      status('err', '翻译失败：' + e.message);
    } finally {
      if (btn) btn.disabled = false;
      jobEnd();
    }
  }

  async function qcFix(auto) {
    const box = $('#h3v-prompt');
    if (!box) return;
    const src = box.value.trim();
    if (!src) { status('err', '没有提示词可检查'); return; }
    const before = parseBlocks(src);
    if (!before.length) { status('err', '没解析到 [[H3]] 块'); return; }
    const btn = $('#h3v-qc');
    if (btn) btn.disabled = true;
    jobBegin(auto ? '自动修缮分段' : '检查并修缮');
    pgSet(5);
    const assets = buildAssetList();
    const wrap = function (b) { return '[[H3]]\n' + String(b).replace(/^\[\[H3\]\]|\[\/H3\]$/g, '').trim() + '\n[[/H3]]'; };
    const BATCH = 2;
    const outBlocks = new Array(before.length);
    let fixedCount = 0, keptCount = 0;

    async function repairOne(text, budget) {
      MAXTOK_OVERRIDE = budget;
      MAXTIMEOUT = budget <= 4000 ? 90000 : 60000;
      try {
        const out = await callAI(CHECK_SYS, assets.text + '\n以下是待审校的分段（' + text.blocks + ' 段）：\n' + text.body, budget);
        const got = parseBlocks(out);
        if (got.length !== text.blocks) throw new Error('段数不一致 ' + got.length + '≠' + text.blocks);
        return got;
      } finally {
        MAXTOK_OVERRIDE = 0;
        MAXTIMEOUT = 0;
      }
    }

    for (let i = 0; i < before.length; i += BATCH) {
      const slice = before.slice(i, i + BATCH);
      const hi = Math.min(i + BATCH, before.length);
      jobLabel('审校第 ' + (i + 1) + '–' + hi + ' 段（共 ' + before.length + ' 段）');
      pgSet(5 + 90 * (i / before.length));
      let got = null;
      try {
        got = await repairOne({ blocks: slice.length, body: slice.map(wrap).join('\n\n') }, 6000);
        fixedCount += slice.length;
      } catch (e) {
        LOG('qc batch fail', i, e);
        // 降级：逐段重试
        got = [];
        for (let k = 0; k < slice.length; k++) {
          try {
            const one = await repairOne({ blocks: 1, body: wrap(slice[k]) }, 4000);
            got.push(one[0]);
            fixedCount++;
          } catch (e2) {
            LOG('qc single fail', i + k, e2);
            got.push(slice[k]);
            keptCount++;
          }
        }
      }
      for (let k = 0; k < slice.length; k++) outBlocks[i + k] = got[k] || slice[k];
    }

    // 重新解析 CAST + 组装
    Object.keys(SEGIMG).forEach(function (k) { delete SEGIMG[k]; });
    Object.keys(SEGCAST).forEach(function (k) { delete SEGCAST[k]; });
    const clean = outBlocks.map(function (b, i) {
      let s = String(b || '');
      const cast = parseCastLine(s);
      if (cast) s = s.replace(cast.raw, '').trim();
      let nb = normalizeBlock(s);
      nb = ensureAudioTags(nb, cast);
          nb = applyVideoStyle(nb);
      if (cast) {
        SEGCAST[i] = cast;
        const files = [];
        (cast.cast || []).forEach(function (nm) { const f = resolveChar(nm); if (f) files.push(f); });
        const sf = resolveScene(cast.scene);
        if (sf) files.push(sf);
        if (files.length) SEGIMG[i] = files;
      }
      return nb;
    });

    box.value = clean.map(wrap).join('\n\n');
    saveBlocks(CURMESID, box.value);
    refreshBlockList();
    renderSegTable();
    pgSet(100);
    if (btn) btn.disabled = false;
    jobEnd();
    status(keptCount ? 'err' : 'ok', '已修缮 ' + fixedCount + ' 段' + (keptCount ? '，' + keptCount + ' 段超时保留原文（可再点一次「检查并修缮」）' : ''));
  }

  async function genSix() {
    jobBegin('生成六段');
    const text = (CURTEXT || lastMessageText() || '').trim();
    if (!text) { status('err', '没有正文：先在楼层点 🎬 打开面板'); return; }
    const btn = $('#h3v-gen');
    btn.disabled = true;
    const t0 = Date.now();
    try {
      status('run', '① 先估时长 / 排分镜…');
      pgSet(10);
      const assets = buildAssetList();
      const planTxt = await callAI(PLAN_SYS, '正文：\n"""\n' + text + '\n"""\n\n' + assets.text, 2000);
      const plan = parsePlan(planTxt);
      status('run', '规划：总时长约 ' + plan.total + ' 秒，分 ' + plan.segs.length + ' 段；锁定角色外观…');
      pgSet(20);
      let castText = '';
      try { castText = String(await callAI(CAST_SYS, '正文：\n"""\n' + text + '\n"""', 1200)).trim(); } catch (e) { LOG('cast fail', e); }
      status('run', '角色外观已锁定（' + (castText ? castText.split('\n').length : 0) + ' 行）；开始逐段写六段…');
      pgSet(30);

      const allBeats = plan.segs.map(s => s.i + '. ' + (s.beat || '')).join('\n');
      const blocksArr = new Array(plan.segs.length).fill(null);
      const GENCONC = Math.max(1, Number(S.genConc || 3));
      let nextI = 0, doneI = 0;

      async function genOne(i) {
        const seg = plan.segs[i];
        const sec = Math.min(15, Math.max(3, Math.round((seg.to - seg.from) * 2) / 2));
        const prevBlock = i > 0 ? blocksArr[i - 1] : null;
        const prevTail = prevBlock ? blockTail(prevBlock) : '';
        const user = '正文：\n"""\n' + text + '\n"""\n\n'
          + (castText ? '全片统一设定（必须原样沿用，颜色/款式/编号都不许改）：\n' + castText + '\n\n' : '')
          + '【素材清单】每段第一行的 CAST 标记只能用下面清单里的原字名字；本段出现谁就写谁，没出现的不写：\n' + assets.text + '\n'
          + '【画风】全片画风＝' + (S.videoStyle || 'anime') + '。每段 detailed_description 第一句必须写风格；画风为 anime 时禁止出现 live-action / photorealistic / film grain / handheld 等实拍词。\n'
          + '整片分镜计划（共 ' + plan.segs.length + ' 段，总时长约 ' + plan.total + ' 秒）：\n' + allBeats + '\n\n'
          + '现在只写第 ' + (i + 1) + ' 段（对应 ' + seg.from + '–' + seg.to + ' 秒，成片时长 ' + sec + ' 秒）：' + (seg.beat || '按分镜计划延续上一段')
          + '\n只输出一个 [[H3]]…[[/H3]] 块（完整六段），[Shot 1] 从 0 秒开始，最后一镜不超过 ' + (sec - 0.5).toFixed(1) + ' 秒；'
          + '<Subject N> 编号沿用全片编号；只拍这一段的事。'
          + (prevTail ? '\n\n上一段结尾状态（能接上就接上；不要重拍上一段已经发生的事）：\n' + prevTail : '');
        jobLabel('生成六段 · 第 ' + (i + 1) + '/' + plan.segs.length + ' 段（' + sec + 's）');
        let out = '';
        try { out = await callAI(SIX_SYS, user, 3000); } catch (e) { LOG('seg fail', i, e); }
        let b = extractPrompt(out);
        if (!b) b = String(out || '').trim();
        if (b && !/<Picture\s*\d/i.test(b)) {
          try {
            const retryUser = user + '\n\n注意：上一版一个 Picture 编号都没写。本次必须在 subject_definitions 里给角色/场景标注 <Picture N>。';
            const out2 = await callAI(SIX_SYS, retryUser, 3000);
            const b2 = extractPrompt(out2) || String(out2 || '').trim();
            if (b2 && /<Picture\s*\d/i.test(b2)) b = b2;
          } catch (e) { LOG('picture retry fail', i, e); }
        }
        if (!b) return;
        const cast = parseCastLine(b);
        if (cast) { b = b.replace(cast.raw, '').trim(); }
        let nb = normalizeBlock(b);
        nb = ensureAudioTags(nb, cast);
        nb = applyVideoStyle(nb);
        blocksArr[i] = nb;
        if (cast) {
          SEGCAST[i] = cast;
          const files = [];
          cast.cast.forEach(function (nm) { const f = resolveChar(nm); if (f) files.push(f); });
          const sf = resolveScene(cast.scene);
          if (sf) files.push(sf);
          if (files.length) SEGIMG[i] = files;
        }
      }

      async function genWorker() {
        while (true) {
          const i = nextI++;
          if (i >= plan.segs.length) return;
          try { await genOne(i); } catch (e) { LOG('gen fail', i, e); }
          doneI++;
          pgSet(30 + 70 * (doneI / plan.segs.length));
          status('run', '已写 ' + doneI + '/' + plan.segs.length + ' 段（并发 ' + GENCONC + '）…');
        }
      }

      const workers = [];
      for (let k = 0; k < Math.min(GENCONC, plan.segs.length); k++) workers.push(genWorker());
      await Promise.all(workers);
      const blocks = blocksArr.filter(Boolean);
      if (!blocks.length) throw new Error('一段都没生成出来，换个模型或改用自定义 API');
      $('#h3v-prompt').value = blocks.map(b => '[[H3]]\n' + b.replace(/^\[\[H3\]\]|\[\/H3\]$/g, '').trim() + '\n[[/H3]]').join('\n\n');
      if (S.autoQc) { try { await qcFix(true); } catch (_) {} }
      refreshBlockList();
      pgSet(100);
      status('ok', '已生成 ' + blocks.length + ' 段 · 合计约 ' + plan.total + ' 秒 · 用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒\n下面「分段」里逐条选，或点「全部按顺序生成」');
    } catch (e) {
      status('err', '生成失败：' + (e && e.message ? e.message : e));
    } finally { jobEnd(); }
    btn.disabled = false;
  }

  async function fetchModels() {
    const base = ($('#h3v-aiBase').value || '').trim();
    const key = ($('#h3v-aiKey').value || '').trim();
    if (!base) { status('err', '先填 API 地址'); return; }
    status('run', '拉取模型列表…');
    try {
      let j = null, used = '';
      let lastErr = null;
      for (const u of urlCandidates(base, '/models')) {
        try {
          const r = await withTimeout(fetch(u, { headers: key ? { Authorization: 'Bearer ' + key } : {} }), 15000, '拉模型 ');
          if (!r.ok) { lastErr = new Error(u + ' → HTTP ' + r.status); continue; }
          j = await r.json(); used = u; break;
        } catch (e) { lastErr = new Error(u + ' → ' + e.message); }
      }
      if (!j) throw lastErr || new Error('拉不到 /models');
      const arr = (j.data || j.models || []).map(x => (typeof x === 'string' ? x : (x.id || x.name))).filter(Boolean).sort();
      if (!arr.length) throw new Error('接口没返回模型：' + JSON.stringify(j).slice(0, 160));
      $('#h3v-aiModel').innerHTML = arr.map(m => '<option value="' + esc(m) + '">' + esc(m) + '</option>').join('');
      S.aiModel = arr.includes(S.aiModel) ? S.aiModel : arr[0];
      $('#h3v-aiModel').value = S.aiModel;
      S.aiBase = ($('#h3v-aiBase').value || '').trim();
      saveS();
      status('ok', '拉到 ' + arr.length + ' 个模型（' + used + '），已选 ' + S.aiModel);
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
  function messageId(el) {
    const mes = el && el.closest ? el.closest('.mes') : null;
    if (!mes) return null;
    return mes.getAttribute('mesid') != null ? mes.getAttribute('mesid') : (mes.dataset ? mes.dataset.mesid : null);
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
    openPanel(messageTextOf(b) || lastMessageText(), messageId(b));
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
