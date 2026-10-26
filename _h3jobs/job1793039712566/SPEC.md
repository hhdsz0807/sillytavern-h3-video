# H3 Ref2VA 规格 · job1793039712566 · 26 段 / 310 秒

## 0. 任务
每个子代理只写分配到的段：把 `[[H3]]…[[/H3]]` 块写入 `D:\cli\repos\sillytavern-h3-video\_h3jobs\job1793039712566\seg-NN.txt`（NN 两位，只写块本身，不加解释）。写完回 ok。

## 1. 固定设定（逐字照抄，标签全片一致）

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

锁定：只有 `<Subject 1>` 一人，无他人、无分屏、无第二个他；除要求的手机 UI 文字外无字幕/水印/字母；纯 2D 赛璐璐，无 3D、无写实皮肤。

## 2. 六段规则
- `subject_definitions:` 只放上面三行。
- `summary:` 一段英文，以 `[reference generation]` 开头，只用已定义标签。
- `retention_analysis:` 每标签一行，`<Subject 1> (appears in [Shot 1], [Shot 2]): fully_preserved - …`；重度 UI 特写可给 `<Subject 2>` 标 `partially_preserved`。
- `detailed_description:` 固定风格句 + 规定镜数；`[Shot 1]` 无时间戳，后续 `[Shot 2] At MM:SS.mmm,`，不超时长；每镜写构图、外观与位置、环境光线、动作与状态变化、镜头运动、同期声、参考出现时点（首次写 `the shot begins from <Picture 1>` 或 `in <Picture 2>`）；**英文 350–500 词**。
- 台词：`<Subject 1> (S1) says, <d>[Chinese] …</d>`；内心独白转画外音：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] …</d>`。中文逐字保留。
- `overall_soundscape:` 只写环境声与物理声。
- `non_diegetic_music:` 稀疏钢琴约 60 BPM、低动态、长混响；或 `N/A`。

## 3. 输出
一个块，首行 CAST，六节标题按序：`subject_definitions:` / `summary:` / `retention_analysis:` / `detailed_description:` / `overall_soundscape:` / `non_diegetic_music:`，整体用 `[[H3]]`、`[[/H3]]` 各自独立一行包裹，`[[H3]]` 在原文件第一行、CAST 行紧随其后。

---

## seg-01 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 从 `<Picture 2>` 起，蔺草榻米极特写，窗棂状阳光缓缓扫过，光柱里浮尘翻卷；镜头极缓上摇，掠过空墙、泛黄污渍天花板，落到叠好的薄被与墙角空插座。Shot 2: 从 `<Picture 1>` 起；他撑起坐直，两指按住太阳穴，眼闭、下颌绷紧，两份记忆挤压；睁眼，低头把瘦削手腕举进光里翻看。

## seg-02 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 缓摇过六叠房间，从天花板到空墙到两个半拆封纸箱（超市生鲜旧标志清晰），落在 `<Picture 2>` 里坐在被褥上的他环顾四周。Shot 2: 从 `<Picture 1>` 起；面部近景，目光失焦，随后移向纸箱。
旁白：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] 原身是个在东京公立孤儿院长大的孩子，前天刚满十五岁，也恰好赶上国中毕业典礼。按照孤儿院的规矩，满十五岁且完成义务教育的人就得搬出来独立生活。院里给结了一笔勉强够付头两个月房租的安置费，再帮着签下这间木造公寓二楼的廉租房合同，就算仁至义尽了。</d>`

## seg-03 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 纸箱近景，箱侧旧标志与胶带起翘的边角；他的影子掠过箱面。Shot 2: 从 `<Picture 1>` 起；他坐在 `<Picture 2>` 被褥上望向纸箱，手指无意识摩挲膝盖，眼神沉下来。
旁白：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] 四月八日联合高中石蕗学院就要开学，除去已经交掉的入学金，留在存折上的数字撑不到五月底。接下来每一顿饭和每一度电，都得靠他自己出去打工赚回来。</d>`

## seg-04 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: `<Picture 1>` 近景，他掰着手指算账，下颌绷紧，窗棂阴影横过脸与榻米，目光飘向破墙。Shot 2: 从 `<Picture 1>` 起；他伸手摸过枕边的二手手机，拇指按侧键，锁屏亮起从下方照亮脸，屏幕清楚显示 `2019年3月16日`。

## seg-05 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 面部极特写，手机光从下巴往上打，瞳孔放大，呼吸变快，压不住的嘴角上扬，窗棂阴影滑过脸颊。Shot 2: 越肩看发亮的屏，拇指悬在半空，房间在光晕外发暗，他鼻子里哼出一声短笑。
旁白：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] 作为一个从2026年过来的打工人，他太清楚2019年这个时间节点意味着什么了。只要把手里仅剩的那点安置费加上接下来打工攒的钱全塞进美股，哪怕只买几股英伟达放着不动，等几年后人工智能浪潮一起飞，他这辈子都不用再看任何老板的脸色。</d>`

## seg-06 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 双手握机特写，拇指在发涩贴膜上快敲，搜索框填入英文名与股票代码；背景虚化里膝盖在抖。Shot 2: 切到屏幕，加载条爬过后结果是一条生僻词典词条和几页欧洲航运黄页；他的脸从画面上缘入镜，笑容僵住。

## seg-07 · 12 秒 · 2 镜 · 第 2 镜 00:05.000
Shot 1: `<Picture 1>` 近景，皱眉抿嘴，删掉英文改用日文假名重打，屏幕光在眼里闪。Shot 2: 屏幕微距，空白页与一行礼貌的无结果提示；他再输入「显卡」「GPU」，跳出评测榜单，排头全是 `八咫乌电子`、`远东图形工业` 这类陌生厂商。

## seg-08 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 越肩看手机，逐个搜前世巨头与热门作品，有的返回熟悉标志，有的只剩空白；滚动越来越慢，停住。Shot 2: 从 `<Picture 1>` 起；手机落回被褥，他向后瘫靠 `<Picture 2>` 的斑驳墙壁，前臂压在眼睛上，胸腔长长泄气。
旁白：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] 原来是这样……根本不是单纯的回到过去，而是来到了似是而非的平行世界。连公司都不存在，买股票发家致富的美梦算是彻底泡汤了。</d>`

## seg-09 · 12 秒 · 2 镜 · 第 2 镜 00:05.000
Shot 1: `<Picture 1>` 里他叹气，拇指抬起要关标签页，肩膀松垮，窗棂阴影又爬远一点。Shot 2: 状态栏右上角微距，图标闪一下，一枚银蓝色小钥匙在无线网与 4G 旁淡入，边缘反光。

## seg-10 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: `<Picture 1>` 近景，他歪头，眼神失焦，无字句的理解抵达，嘴唇微张，钥匙倒影在瞳孔里是一个小蓝点。Shot 2: 切到屏幕，下拉通知栏里银蓝钥匙下方一行 `已连接：Earth-2026（延迟 1ms）`；指尖悬停，颤了一下。

## seg-11 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 越肩看手机，刷新后熟悉的 2026 年搜索页瞬间就位，资源站、代码库、小说文库一个接一个无延迟打开，屏幕亮度在暗房里发白。Shot 2: 从 `<Subject 1>` 起；他放下手机，歪头慢慢环视 `<Picture 2>` 的空房间，像在重新丈量它。

## seg-12 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 缓摇 `<Picture 2>`——空墙、没有书桌椅子显示器，只有被褥、纸箱和墙插座，光柱里灰尘在转。Shot 2: 从 `<Picture 1>` 起；他单手举起廉价安卓翻看，拇指搓过外壳磕破的角，暗屏里映出模糊的脸。
旁白：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] 他前世倒是有编程和网络技术底子，可这间廉租房里连张像样的书桌都没有，更别提拿去跑代码的电脑了，全身上下唯一的电子设备就是手里这台两年前发布的千元级安卓手机。</d>`

## seg-13 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: `<Picture 1>` 里他掰着手指数选项，嘴无声地动，手落下，盯着榻米，硬光横过指节。Shot 2: 他重新举起手机到与眼齐平，下决心的浅笑取代皱眉；镜头轻推，拇指找到浏览器图标。
旁白：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] 去便利店或居酒屋端盘子固然能混口饭吃，但高中生打工有严格的工时限制，时薪也就一千日元出头，还得挤占开学后的课余时间。相比之下，不用本金、不看硬件配置、只要有块屏幕就能干的活计，全天下大概就剩当文抄公这一条道了。</d>`

## seg-14 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 中近景，他坐在被褥上，一手握机，另一手朝空房间比划，像在展示什么，带着自嘲的得意说台词。Shot 2: 从 `<Picture 1>` 起；他被自己的笑话逗得哼笑，靠回墙边，肩膀还轻轻抖着。
台词：`<Subject 1> (S1) says, <d>[Chinese] 连电脑都不用买，直接从2026年的网盘里把全本轻小说扒下来复制粘贴，这哪是文抄公，简直是跨位面文件传输工。</d>`

## seg-15 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 手机特写，拇指把银蓝钥匙点灭，状态栏回到普通本地连接，页面重载成本地门户。Shot 2: 从 `<Picture 1>` 起；越肩看他打开「大文豪网」，首页密布榜单、付费分成横幅与文库出版公告；他的脸在画框边缘，读得仔细。

## seg-16 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 拇指下屏幕翻过十几页分类榜单，封面刷刷掠过，搜索框填入 `とある魔術の禁書目録`；结果页一片空白。Shot 2: 从 `<Subject 1>` 起；他的脸被空白页照亮，眉毛抬起，翻分类索引发现连「学园都市＋科学魔法」这类题材都不存在，不敢信地笑了一声。

## seg-17 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 银蓝钥匙再次点亮，状态栏切到 2026 通道，页面刷进他显然很熟的资源站，拇指毫不犹豫一路点下去。Shot 2: 从 `<Picture 1>` 起；屏幕近景，一份完整的日文原版合集压缩包出现，封面缩略图与几十册条目；他从鼻子里呼出一口气，瞥了一眼 `<Picture 2>` 的空房间。

## seg-18 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 屏幕微距，下载条一帧走满，压缩包已躺进本地文件夹；指尖一点，解压软件摊出成排文本文件。Shot 2: 从 `<Subject 1>` 起；文件列表滚动，一册接一册按章节排好，从第一卷的夏夜相遇开始；拇指停下，他缓缓吐气。

## seg-19 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 钥匙关闭，浏览器回到本地平台移动端；两根拇指填完注册表单——手机号、邮箱——笔名一栏敲入 `白井`。Shot 2: 从 `<Picture 1>` 起；新建作品页，`幻想`/`异能`/`学园` 标签逐个勾选，简介框被输入的文字填满，屏幕上隐约映出他专注的脸。

## seg-20 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: `<Picture 2>` 里他挪身子，把被褥叠起垫在背后，靠上斑驳墙壁，一手支机，另一手拇指干活。Shot 2: 从 `<Picture 1>` 起；编辑器微距，粘贴的文字成块灌进输入框，旧手机卡顿，加载圈在章节间打嗝；他的拇指节奏不变地继续。

## seg-21 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 双手近景，拇指滚动调整空行与标点；榻米上那道硬阳光明显西移，房间边缘转暖变暗。Shot 2: 从 `<Picture 1>` 起；拇指按下最后一章的发布键，按钮变暗、进度环转一圈；他停手，肩膀沉下，长长呼出一口气，后台总字数跳过十万。

## seg-22 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 手机状态栏极特写，清晰可读 `16:28`、`VPN:OFF`、4G、电量 `18%` 与作者后台地址栏。Shot 2: 从 `<Picture 1>` 起；后台面板占满画面——作者 `白井`、书名 `とある魔術の禁書目録`、`ID: 894021`、分类 `幻想 / 学園異能 / 戦闘`、状态 `連載中`、已发布 `102,480 字`、`18 話`、稿费状态 `可申请分成`；虚焦指尖停在画框边缘。

## seg-23 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 章节列表在拇指下滚动——`第18話 5,820字 · 刚刚`、`第17話 6,410字 · 3分钟前`、`第01話～第16話 90,250字 · 已公开`；玻璃上淡淡映出倒影。Shot 2: 从 `<Picture 1>` 起；一条系统提示从页面上方滑下，提示可申请阅读分成与签约审核；拇指悬停，然后点了接受。

## seg-24 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 他把手机放低到胸口，抬头看 `<Picture 2>` 那块污渍天花板，窗棂阴影在榻米上又长又橙。Shot 2: 他靠回墙边，抬手揉了揉发酸的眼睛，指腹在眼窝停一拍，嘴角有个很浅的笑。
旁白：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] 在这个大部分网络作者日更两三千字都算勤奋的年代，开书首日直接甩出十万字完整一卷外加新卷开头的做法，跟拿着消防水枪往池塘里灌水差不多。</d>`

## seg-25 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 右手拇指揉着拇指根部的特写，关节因反复点击发红，指尖微颤。Shot 2: 从 `<Picture 1>` 起；他伸手够到插在 `<Picture 2>` 墙插座上的白色充电线，把接头推进发烫的手机，接口反光，屏幕亮起。

## seg-26 · 12 秒 · 2 镜 · 第 2 镜 00:05.500
Shot 1: 他把手机平放在榻米上松手，屏幕亮起充电图标，电量百分比往上跳，窗棂阴影横在玻璃上。Shot 2: 从 `<Picture 1>` 起；他向后靠坐，望着仍亮着的后台界面与绿色 `已公开连载`，仰头看天花板，一个盘算式微笑成形，午后的光转成琥珀色。
旁白：`<Subject 1> (S1, off-screen voice-over) says, <d>[Chinese] 等第一笔稿费到账，先去秋叶原淘一台能正经干活的笔记本电脑。</d>`
