# H3 Ref2VA 分段规格 B（26 段 · 共 310 秒）· 输出目录 _h3out2

## 0. 任务
每个子代理只处理分配给它的段号：把 `[[H3]]…[[/H3]]` 块写入 `D:\cli\repos\sillytavern-h3-video\_h3out2\seg-NN.txt`（NN 两位段号，只写块本身，不加解释）。

## 1. 固定设定（逐字照抄，标签在所有段之间保持一致）

CAST 行必须是块内第一行，逐字：
`<!--CAST: 白井玄一 | SCENE: 白井玄一的廉租房-->`

```
<Subject 1> is the 15-year-old Japanese boy in <Picture 1>, with short messy black hair, a pale narrow face, dark brown eyes and a slim, slightly underfed build; he wears a loose plain white T-shirt and soft gray shorts, barefoot with no socks.
<Subject 2> is the cramped six-mat one-room apartment in <Picture 2>, an old wooden second-floor unit with a yellowed, damp-stained ceiling, a tatami floor of woven rush grass, a thin folded futon, two half-unpacked cardboard boxes with an old supermarket produce logo, a bare wall socket in one corner and almost no furniture, lit by hard afternoon sunlight slicing through a half-closed plastic venetian blind.
<Audio 1> is the voice-timbre reference for <Subject 1>.
```
只有 `<Picture 1>`、`<Picture 2>`，绝不出现 `<Picture 3>`。

固定风格句（`detailed_description` 开头原样使用）：
`Anime style: clean 2D cel animation over hand-painted backgrounds, muted beige and dusty gray palette, warm afternoon light with hard blind-slat shadows, gentle shallow depth of field and steady, unhurried camera movement.`

锁定项：画面里只有 `<Subject 1>` 一个人，无他人、无分屏、不出现第二个他；除明确要求的手机 UI 文字外，不出现字幕/水印/字母；纯 2D 赛璐璐，不做 3D 渲染、不做写实皮肤。

## 2. 六段规则
- `subject_definitions:` 只放上面三行（每条一行）。
- `summary:` 一段英文，以 `[reference generation]` 开头，只用已定义标签。
- `retention_analysis:` 每个标签一行，`<Subject 1> (appears in [Shot 1], [Shot 2]): fully_preserved - …`；重度 UI 特写可给 `<Subject 2>` 标 `partially_preserved`。
- `detailed_description:` 固定风格句 + 严格等于规定数量的镜头；`[Shot 1]` 不带时间戳，后续写 `[Shot 2] At MM:SS.mmm,`，不超过该段时长；每镜写清构图、外观与位置、环境光线、动作与状态变化、镜头运动、同期声、参考内容出现时点（首次写 `the shot begins from <Picture 1>` 或 `in <Picture 2>`）；**英文 350–500 词**。
- 台词：`<Subject 1> (S1) says, <d>[Chinese] …</d>`；内心独白转画外音：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] …</d>`。中文逐字保留。
- `overall_soundscape:` 只写环境声与物理声。
- `non_diegetic_music:` 稀疏钢琴独奏约 60 BPM、低动态、长混响；或 `N/A`。

## 3. 输出
一个块，首行 CAST，六小节标题按序：`subject_definitions:` / `summary:` / `retention_analysis:` / `detailed_description:` / `overall_soundscape:` / `non_diegetic_music:`，整体用 `[[H3]]`、`[[/H3]]` 各自独立一行包裹。写完回 `ok`。

---

## seg-21 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 双手近景，拇指在编辑器里滚动调整段落空行与标点；榻米上那道硬阳光已明显西移，房间边缘转暖变暗。Shot 2: 从 `<Picture 1>` 起；拇指按下最后一章的发布键，按钮变暗、进度环转一圈；他停手，肩膀沉下，长长呼出一口气，画面切到后台总字数稳稳跳过十万的一瞬。

## seg-22 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 手机状态栏极特写，清晰的 `16:28`、`VPN:OFF`、4G 信号、电量 `18%` 与作者后台地址栏。Shot 2: 从 `<Picture 1>` 起；后台作品面板占满画面——作者 `白井`、书名 `とある魔術の禁書目録`、`ID: 894021`、分类 `幻想 / 学園異能 / 戦闘`、状态 `連載中`、已发布 `102,480 字`、`18 話`、稿费状态 `可申请分成`；他虚焦的指尖停在画框边缘。

## seg-23 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 章节列表在拇指下滚动——`第18話 5,820字 · 刚刚`、`第17話 6,410字 · 3分钟前`、`第01話～第16話 90,250字 · 已公开`；玻璃上淡淡映出他的倒影。Shot 2: 从 `<Picture 1>` 起；一条系统提示从页面上方滑下，提示可申请阅读分成与签约审核；他的拇指悬停，然后点了接受。

## seg-24 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 他把手机放低到胸口，抬头看 `<Picture 2>` 那块污渍天花板；窗棂阴影此刻在榻米上拉得又长又橙。Shot 2: 他靠回墙边，抬手揉了揉发酸的眼睛，指腹在眼窝上停了一拍，嘴角有一个很浅的笑。
旁白（放在 Shot 2）：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] 在这个大部分网络作者日更两三千字都算勤奋的年代，开书首日直接甩出十万字完整一卷外加新卷开头的做法，跟拿着消防水枪往池塘里灌水差不多。</d>`

## seg-25 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 右手拇指揉着拇指根部，关节因反复点击发红，指尖微微发颤。Shot 2: 从 `<Picture 1>` 起；他伸手够到插在 `<Picture 2>` 墙插座上的白色充电线，把接头推进发烫的手机，接口反了一下光，屏幕随之亮起。

## seg-26 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 他把手机平放在榻米上，屏幕亮起充电图标，电量百分比往上跳，窗棂阴影横在玻璃上。Shot 2: 从 `<Picture 1>` 起；他向后靠坐，望着那块仍亮着的后台界面与绿色 `已公开连载` 标记，然后仰头看天花板，一个盘算式微笑成形，午后的光转成琥珀色。
旁白（放在 Shot 2）：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] 等第一笔稿费到账，先去秋叶原淘一台能正经干活的笔记本电脑。</d>`
