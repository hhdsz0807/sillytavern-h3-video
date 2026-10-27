# H3 视频工坊（SillyTavern 扩展）

把酒馆里**这段正文**变成一条视频：正文里模型自己写好的「六段提示词」+ 你给的角色四视图/场景图 → 直接丢给同一台手机上跑的 **H3工作台 APK**（`http://127.0.0.1:8899`）→ 它去调 RunningHub 云端出片。

**不需要在这里配任何云端 Key**，RunningHub 的 Key/账号都在 H3工作台 里。

## 一键安装（GitHub 地址）

酒馆 → 扩展（Extensions）→ 安装扩展（Install Extension）→ 填：

```
https://github.com/hhdsz0807/sillytavern-h3-video
```

装完刷新页面，右下角出现蓝色 🎬 按钮即成功。手机酒馆（Termux）同样适用。

## 安装（安卓 Termux 跑的酒馆）

1. 把整个 `sillytavern-h3-video` 文件夹放进酒馆的扩展目录：
   - 常见：`~/SillyTavern/data/default-user/extensions/sillytavern-h3-video/`
   - 或全局第三方：`~/SillyTavern/public/extensions/third-party/sillytavern-h3-video/`
2. 重启酒馆（或浏览器里刷新页面）。
3. 右下角出现蓝色 🎬 按钮 = 装好了。

## 用法

1. **先开 H3工作台**（手机上），确认它是前台提醒过一次、后台常驻（它是 `127.0.0.1:8899`，只监听本机）。
2. 在角色卡 / 世界书 / 作者注释里粘一段 `h3-提示词模板.txt` 的内容 —— 让模型每次回复完正文，再输出一个 `[[H3]] … [[/H3]]` 块（六段：subject_definitions / summary / retention_analysis / detailed_description / overall_soundscape / non_diegetic_music，含台词和分镜时间点）。
3. 回复出来后，楼层正文下面会有 🎬；点它 → 面板自动抓取这段六段提示词。
4. 面板里：
   - **四视图**：角色1…角色6 各放一张（顺序 = `<Picture 1>`…；点「传」从相册选，或者用 H3 里已经上传过的图）
   - **场景图**：放最后一张（对应 `<Picture N>`）
   - 时长 / 清晰度 / 步数
5. 点 **生成视频** → 云端排队 4–7 分钟（0.98MP/15s 实测 71–95 币）→ 面板里直接出片，可下载。

## 27B 通道（用 RunningHub 的 Qwen3.8-27B 当聊天模型）

面板里有一行「27B通道」：

| 控件 | 填什么 |
|---|---|
| RunningHub API Key | 你自己的 key（只存本机 localStorage，不上传） |
| 模型 | `qwen27b-q4`（Huihui-27B-abliterated-Q4_K）或 `qwen27b-q4-uncensored` |
| 测试通道 | 校验 key + 端点是否通 |
| 接入酒馆 | 一键把酒馆「聊天补全」切到 `自定义（兼容 OpenAI）`：端点 `http://<H3地址>/v1`、模型 `qwen27b-q4`、密钥填你刚才的 key |

**前提**：那个地址上的 H3工作台要支持 `/v1/chat/completions`（电脑版 `server.js` 已内置）。
手机 APK 自带的服务端目前只有出片接口，**没有 /v1**；想在手机上用 27B，就把面板顶部「H3 地址」填成电脑的局域网地址（如 `http://192.168.1.3:8899`），走电脑那台。

成本参考：单条回复 20–90 秒、4–20 币；上下文超过约 11,000 字会被保头保尾截断。

## 让六段块别把聊天撑丑（正则折叠）

导入 `h3-正则-折叠.json`：酒馆 → 扩展 → 正则（Regex）→ 导入 → 选这个文件。

里面有两条：
1. **H3 六段折叠（显示用）** —— 默认启用。把 `[[H3]]…[[/H3]]` 换成可折叠的
   `<details><summary>🎬 H3 六段提示词（点开看）</summary>…</details>`，聊天里只占一行。
   （需要酒馆开启「渲染 Markdown / HTML」）
2. **H3 六段不发给模型（可选，默认关）** —— 打开后这段不再进上下文，省 token；建议跑长对话时再开。

折叠只影响**显示**，原始消息里仍是 `[[H3]]…[[/H3]]`，所以扩展点 🎬 时照样能抓到（扩展读的是原始 message，不是折叠后的 DOM）。

## 提示词模板（简版）

```
[[H3]]
subject_definitions:
<Picture 1> is the identity anchor for <Subject 1>: …
<Picture 2> is the identity anchor for <Subject 2>: …
<Picture 3> is <Subject 3>: the location …
…
summary:
[reference generation] …
retention_analysis:
<Subject 1> (appears in [Shot 1] …): fully_preserved - …
detailed_description:
[Shot 1] … <d>[Chinese] 台词</d>
[Shot 2] At 00:05.500 …
overall_soundscape:
…
non_diegetic_music:
N/A
[[/H3]]
```

完整版见 `h3-提示词模板.txt`，或面板里的「复制提示词模板」。

## 排障

| 现象 | 原因 |
|---|---|
| 「连不上 H3工作台」 | APK 没开 / 被系统杀了后台 / 地址不是 `http://127.0.0.1:8899` |
| 点 🎬 提示「这条没有 [[H3]] 块」 | 模型没按模板输出；把模板塞进作者注释或世界书，或手动粘六段到面板 |
| 提交报「这个模式必须选图」之类 | 图槽没选；先「传」一张 |
| 视频能出但人物不像 | 四视图要整张给（别裁单格），场景图单独放最后 |
| 页面白屏/按钮不出 | ST 版本太旧不支持 `SillyTavern.getContext()`；升级或手动 `localStorage` 清一下 `h3video.settings.v1` |

## 已验证 / 未验证

- 已验证：`index.js` 语法（`node --check`）、与 H3工作台 的接口契约（`/api/mm/meta`、`/api/upload`、`/api/mm/run`、`/api/status`，字段名按 v67 代码核对）
- **未验证**：真机酒馆里实际跑通（没有可用的手机环境），以及跨域预检（H3工作台 v68 才加了 `OPTIONS` 支持，务必用 v68 及以上）

## 弹窗里的 AI 补全（v0.2）

| 模式 | 说明 |
|---|---|
| 用酒馆当前连接 / 对话补全预设 | 走酒馆自己的生成通路（generateQuietPrompt，退回 generateRaw），模型/预设/温度跟主界面一致，不用填任何东西 |
| 自定义 API | 只填 API 地址 + Key，点「拉取模型」从 /models 自动列出下拉选，不用手打模型名 |

点「按正文生成六段」= 拿当前楼层正文 → AI 改写成六段 → 直接填进提示词框。
注入开关「自动要求模型输出六段」现在默认关闭，避免正文后面挂一大串英文。
