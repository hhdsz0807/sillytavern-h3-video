# H3 视频工坊（SillyTavern 扩展）

把酒馆里**这段正文**变成一条视频：正文里模型自己写好的「六段提示词」+ 你给的角色四视图/场景图 → 直接丢给同一台手机上跑的 **H3工作台 APK**（`http://127.0.0.1:8899`）→ 它去调 RunningHub 云端出片。

**不需要在这里配任何云端 Key**，RunningHub 的 Key/账号都在 H3工作台 里。

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
