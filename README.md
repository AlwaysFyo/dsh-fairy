# dsh-fairy

把《绝区零》里 Fairy 的「空洞深潜系统（H.D.D）」做成 DeepSeekRuntime 的插件主题：
整站换肤、常驻吉祥物舞台、满宽 HUD 输入坞、语音朗读、余额/电量卡、以及每个新
文档都落在空白会话页。

本仓库是 [Chengzhibense/Fairy-DSH](https://github.com/Chengzhibense/Fairy-DSH)
在 **DSH 0.2.1-rc.2** 上的移植与适配（上游按 0.1.1-rc.2 编写）。上游许可
（Apache-2.0）与全部改动说明见 `NOTICE`、`LICENSE`、`THIRD_PARTY_NOTICES.md`。

## 包结构

| 包 | 作用 |
| --- | --- |
| `packages/dsh-fairy` | 锚包。市场只需安装它：`skin.json` 让它被识别为主题，`cordis.patch.yml` 一次插入下面五行，市场一键停/起整组 |
| `packages/dsh-fairy-visual` | 主题主体：HDD 背景网格、Fairy 舞台与状态机、侧栏聚合物板、满宽 composer dock、滚动条、Hero 投影、模式切换 glitch、设置页 |
| `packages/dsh-fairy-startup` | 每个新 document 落到空白会话页（不再恢复上次会话） |
| `packages/dsh-balance-meter` | 侧栏底部余额卡 + 今日 token 估算；HDD 下文案变「今日电量」 |
| `packages/dsh-fairy-voice` | 朗读控制与波形；依赖外部本地 TTS（默认 `http://127.0.0.1:9880/tts`，可用 `DSH_FAIRY_TTS_URL`/`DSH_FAIRY_DOCS_URL` 覆盖），不可用时静默降级。选型与接入见 [docs/TTS.md](docs/TTS.md) |
| `packages/dsh-browser-dock` | 浏览器 dock，配合 `@playwright/mcp` 的 stdio 代理 |
| `packages/dsh-fairy-contracts` | 跨包只读契约：设置命名空间与版本、DOM 锚点、activity/lifecycle 词汇、诊断边界 |

## 与 0.1.1 的必要适配

1. **`ctx.settingsScope` 在 0.2.1 已不存在** → `dsh-fairy-visual/src/client/scope-shim.js`
   用宿主路由 `GET/PUT /dsh-fairy/settings?ns=<namespace>` 复刻
   `getSnapshot()/subscribe()/set()` 三个方法，数据落在 `$DSH_HOME/fairy-visual/settings.json`
   与 `$DSH_HOME/fairy-identity/identity.json`（原子写）。
2. **DOM 漂移** → `dom-adapter.js` 同时接受 `[data-slot="main.conversation"]` 与
   `[data-composer-input]`（0.2.1 的输入是 contenteditable div，不是 textarea）；
   `[data-phase="plain"]` **不能**当成 active，那是 composer 自己的词表。
3. **`sessions.clear()` 不存在** → `dsh-fairy-startup` 降级为「能清就清」，
   否则 0.2.1「任一 entry 失败即整体失败」会让整页白屏。
4. **`sessions.list.getSnapshot().current` 不存在** → 0.1.1 的选中会话在 `sessions.list`
   快照上，0.2.1 搬到了 **`uiSession.current`**（`getSnapshot().key` 才是 SessionId）。
   上游直接读旧字段会得到 `undefined`，于是「切换会话」永远检测不到、
   `activity/lifecycle` 永远停在 `normal/idle`。`session-source.js` 做了这个转接层
   （懒解析 + 兼容 `getSnapshot()`/`.value`），并把 `uiSession` 加进 `inject`。

## 配置面：HDD / 身份 / 语音 / 人设

设置 →「Fairy 控制台」把四类配置收在同一页（`settings.section` 只占一个导航格）：

| 区块 | 内容 | 存放位置 |
| --- | --- | --- |
| HDD 视觉 | 启用 HDD、日间模式、显示主视觉、低功耗 | `$DSH_HOME/fairy-visual/settings.json` |
| 身份 | 铃 / 哲 / 自定义（自定义时另有第二助手、家庭成员） | `$DSH_HOME/fairy-identity/identity.json` |
| 语音服务（TTS） | 协议（`gpt-sovits` / `yovoice`）、`ttsUrl`、`docsUrl`、API Key（可选，Bearer）、参考音频提示文本、参考音频文件（≤24 MB，wav/mp3/flac/ogg/m4a）、yovoice 的模型与音色 id、保存 / 测试连接 / 试听 / 读取引擎模型音色 / 清除 API Key | `$DSH_HOME/fairy-voice/tts-config.json`，音频落在 `$DSH_HOME/fairy-voice/runtime/reference/` |
| Fairy 人设 | 字数不限的人设正文（留空 = 内置参考人设），可检索并插入 11 份参考语料 | `$DSH_HOME/fairy-persona/persona.json` |

三者如何进入模型：

- 人设以 `fairy:persona` **section**（`order: 100`，`interpolate: false`）注入系统提示词，
  `text` 是函数 → **每次组装都会重新求值**，保存后下一条消息即生效，不用重启。
  `/dsh-fairy/persona/probe` 会跑一次真实组装，回报 `sectionNames`、注入长度、身份条款是否命中。
- 身份（铃/哲/自定义 + 家庭成员）在合成时以「【本次会话身份】…」追加到人设末尾，
  由 `src/persona.js` 的 `identityClause()` 生成，不依赖模型猜称呼。
- 语料按需插入（单份或全部），上限 400 000 字符；全部插入约 400 KB，token 成本很高，
  UI 里有明确提示。
- TTS 的 `ttsUrl`/`docsUrl`/`apiKey` 在保存后**优先于** `DSH_FAIRY_TTS_URL`/`DSH_FAIRY_DOCS_URL`/`DSH_FAIRY_TTS_APIKEY`，
  环境变量只是默认值（`/fairy-voice/config` 的 `env.overridden` 会说明当前是否被界面覆盖）。
  搬运整套配置只需拷 `$DSH_HOME/fairy-voice/`。
- API Key 只写不读：`GET /fairy-voice/config` 永远返回 `apiKey: ""`，只给 `apiKeySet` 与末四位掩码
  `apiKeyMask`；留空提交表示「保持不变」，清空要点「清除 API Key」（`clearApiKey: true`）。
  设置后探活与合成请求都带 `Authorization: Bearer <key>`，未设置则完全不带该头（本地 GPT-SoVITS 不受影响）。
  Key 以明文存在 `tts-config.json`（与 `voice-brain.json` 同属本机凭据文件，权限随 `$DSH_HOME`）。
- **两种 TTS 协议**（`protocol` 字段）：`gpt-sovits` 发参考实现的
  `{text, text_lang, ref_audio_path, prompt_text, …}` 并回流原始 PCM；`yovoice` 发
  `{text, modelId?, voiceId?, referenceText?}` 并回流 **WAV**（浏览器按 `RIFF` 头走
  `decodeAudioData`）。探活也分流：`gpt-sovits` 看 `/docs` 的 2xx，`yovoice` 看
  `GET /v1/status` 的 `ready === true`。`GET /fairy-voice/engine` 会把引擎的
  `/v1/models`、`/v1/voices` 拉回来给界面下拉补全。细节见 `docs/TTS.md`。

新增的宿主路由：`GET /fairy-voice/config`、`POST /fairy-voice/config/update`、
`POST /fairy-voice/reference`、`GET /dsh-fairy/persona`、`GET /dsh-fairy/persona/corpus`、
`GET /dsh-fairy/persona/corpus/file?id=`、`GET /dsh-fairy/persona/probe`。

## 开发

```powershell
pnpm install                     # 根目录（构建工具链）
node tools/build-all.mjs         # 只重建有 src/client 的包，其余保留上游预构建产物
node tools/verify-build.mjs      # 校验 bundle 形态、id、裸 require 白名单

# 隔离开发实例（独立 DSH_HOME，不碰 ~/.dsh）
node tools/dev-setup.mjs
$env:DSH_HOME='D:\Projects\dsh-fairy\.dsh-dev-home'; Remove-Item Env:DSH_PROFILE -ErrorAction SilentlyContinue
node node_modules\@deepseek-ai\dsh\lib\bin.js --profile fairy-dev --no-open --port 3400
# token 在 .dsh-dev-home\boot-NN.log 里：token=([A-Za-z0-9_\-]+)
```

注意：`dsh web` 子命令自带 profile 语义，直接 `dsh web` 会以 `web` profile 启动；
且 `--profile` 与 `DSH_PROFILE` 不能同时给。

## 验收工具（`tools/cdp/`）

浏览器不可用时靠宿主信标；有 Chromium 时用真实 CDP 做数值断言（本机
`%LOCALAPPDATA%\ms-playwright\chromium-1243\chrome-win64\chrome.exe`，
`--headless=new --remote-debugging-port=9222`）。

| 工具 | 用途 |
| --- | --- |
| `node tools/cdp/parity.mjs <refUrl> <candUrl>` | 34 个探针逐项 diff 参考实现与移植版（tokens / 属性 / 计数 / 网格 / 几何 / Hero clip） |
| `node tools/cdp/audit.mjs <url> [--scope=#root]` | 真实页面逐元素算 WCAG 对比度，列出 ratio < 3 的可读性问题 |
| `node tools/cdp/why.mjs <url> <selector> <prop>` | 查某属性到底被哪条规则命中（`CSS.getMatchedStylesForNode`） |
| `node tools/cdp/click.mjs <url> <selector\|label> [--probe=f.js]` | 用真实鼠标事件点控件（合成 click 会被 React 忽略） |
| `node tools/cdp/shoot.mjs` / `evaluate.mjs` | 截图 / 跑任意表达式 |
| `node tools/cdp/settings-audit.mjs`、`settings-toggles.mjs` | 走设置面板、逐项切换开关并记录状态 |
| `node tools/cdp/controller-state.mjs <url> [--switch]` | 读 `__dshFairyController.state`（activity / lifecycle / boundSessionId），并可用真实鼠标切会话对比 |
| `node tools/cdp/activity-inject.mjs <url>` | 注入桩 Session 走出货代码路径，验证 thinking / comforting / idle 三种投影 |
| `node tools/cdp/session-activity.mjs` / `session-transition.mjs` | 观察 `.dsh-hdd-session-transition` 帧与 `data-fairy-state` 变化 |
| `node tools/cdp/i18n-motion.mjs <url>` | 切到 `en` 后重测所有语义锚点；再模拟 `prefers-reduced-motion: reduce` 验证过渡被跳过 |
| `node tools/cdp/voice-e2e.mjs <url>` | `/fairy-voice/status` → `/tts` → 32 kHz 实际播放 → 音频控件几何 |
| `node tools/cdp/persona-check.mjs <url>` | 13 项只读不变量：人设合成、身份条款、语料清单/读取/路径穿越、**真实组装里是否存在 `fairy:persona`**、TTS 配置与状态 |
| `node tools/cdp/tts-auth-check.mjs <hostUrl> <mockAuthUrl>` | 15 项 API Key 不变量：落盘、**不回显明文**、掩码末四位、探活与合成是否带 `Authorization: Bearer`、无关保存保留 key、`clearApiKey` 清除后不再发头（临时把端点指向 mock，结束恢复原值） |
| `node tools/cdp/yovoice-check.mjs <hostUrl> <token> <mockUrl>` | 13 项 yovoice 协议不变量：配置含 `protocol`/`modelId`/`voiceId`、保存后 `protocol=yovoice`、`/v1/status` 的 `ready` 判定、`/fairy-voice/engine` 拉到 models+voices、合成返回 `RIFF` WAV（32 kHz/16-bit）、探活与合成两条都带 `Bearer`、请求体含 modelId/voiceId |
| `node tools/mock-tts.mjs --port=9881` | GPT-SoVITS 兼容的假 TTS，用来验证整条语音链；`GET /__auth` 回报最近一次收到的 `authorization` 头 |
| `node tools/parity*` 见上 | — |

## 一致性现状

对同一份参考实例（`127.0.0.1:3357`）逐项对账，主题层已 1:1：

- 色板 `--dsw-alias-bg-base #07101c` / `layer-1 #0a1828` / `layer-2 #0e243d` /
  `label-primary #e8f2fa` / `brand-primary #62d4ff`
- `.dsh-hdd-background-host` + `.dsh-hdd-fx` 48px 网格（opacity .7）+ 3 层辉光
- `.dsh-fairy-stage` `[280,56,1760,586]`、`#dsh-fairy-root` 432×432
- 侧栏板 `[0,0,280,1200]`、品牌锚点、电源开关、Hero `left:1160px / clip inset(0 0 -477px 140px)`
- composer 卡 `[280,1068,1760,132]`（dock 激活态）
- WCAG：`--scope=#root` 无低对比项，最低 6.02
- 61 个 `data-dsh-fairy-*` 标记、88 个 `.dsh-fairy-*` / `.dsh-hdd-*` class 与参考完全重合

差异均可归因于环境而非实现：

| 现象 | 原因 |
| --- | --- |
| 参考少 `data-dsh-fairy-composer-{command,mode,reasoning}-control` 三个标记 | 参考 profile 额外装了 `dsh-reasoning-effort`、模式选择器；本 dev profile 只有 base+web-app+fairy，控件不存在自然无标记 |
| 参考侧栏无「插件 / 自动化任务」行、设置行为「设置」42px | 参考实例的 profile 未启用这些面板；本实例走官方 panellist 布局（HDD 开/关均一致，非主题改动） |
| 余额卡 `unavailable` | 0.2.1 的 `.credentials.yaml` 是结构化 `records:` 格式，没有参考实现读取的扁平 `DEEPSEEK_API_KEY`；把结构里的平台 grant token 直接当 API key 请求 `api.deepseek.com/user/balance` 会 401（已实测），所以这是凭据形态问题，参考实例同样 unavailable |
| 朗读按钮存在但不出声 | 需要外部本地 TTS 与参考音色样本，仓库不提供；**链路本身已验证**（见 [docs/TTS.md](docs/TTS.md) 与 `tools/cdp/voice-e2e.mjs`） |
| 我们的模型控件是 46×28 图标，参考是 220×28 带模型名的控件 | 参考那个控件来自它 profile 里的 `dsh-reasoning-effort`（`re-model-root`）；0.2.1 官方的模型入口就是图标按钮（`_7KE1Ra_trigger`，DOM 里没有文字标签），布局带一致但宽度不可比 |

### 已验证的行为（真实浏览器 + 数值断言）

| 场景 | 结论 |
| --- | --- |
| 切换会话 | 出现 1 帧 `.dsh-hdd-session-transition`，`clip: inset(0 0 132px 280px)`，事后自清理（`overlaysLeftBehind: 0`） |
| 选择绑定 | `sessionId` 随点击在 `session-57ed9141…` / `session-8f2949bc…` 之间切换，`lifecycle` 从 `completed` 正确投影 |
| activity 三态 | 桩 Session 注入：`running` → `thinking`；含安慰语的最新用户消息 → `comforting`；`blank` → `lifecycle: idle` |
| 界面语言切英文 | `treeLabel` = `Sessions`、`newSessionLabel` = `New session`，舞台 / dock / 侧栏板 / 背景 host 几何与标记数不变 |
| `prefers-reduced-motion: reduce` | 静止与切换后过渡帧均为 0，glitch 动画不挂 |
| 语音链路（mock TTS） | `/fairy-voice/status` → `available:true`；`/tts` → `200 audio/pcm` 53 760 B；浏览器解码 0.6 s @32 kHz 实际出声 |
| 市场式安装（tarball） | 7 个 `pnpm pack` 产物装进全新 `DSH_HOME` 后：`--dump-config` 出现五行，五个 client bundle 全部进 roster，voice 宿主可用 |
| 市场式一键停/起 | 把锚包 patch 插入的五个 id 全部 `disabled: true` 后重启：roster 里不再有 `dsh-fairy-visual`，`/dsh-fairy/diag` 返回 **404**，日志无 fairy 相关 warning；去掉该层再启动即恢复（roster 命中、`diag.ok=true`） |
| 眼睛大小 / 动画速度滑条 | 真实拖拽后落盘（`mascotScale 0.73`），`#dsh-fairy-root` 上 `--dsh-fairy-mascot-scale: 0.76`、`data-dsh-fairy-animation-rate=1.5` |
| 选择模型 | 点击 → 「模型与推理等级」菜单 → 「模型」行 → 12 个 `menuitemradio`（两个 provider 组）→ 选中后按钮 `aria-label` 变为所选项 |
| 会话头部顺序与间距 | 2040/1680/1440/1280 四档一致：`统计 → H.D.D → 日间模式 → 用文件资源管理器打开 → 更多操作 → 打开右侧边栏`，间距 `8 | 8 | 0 | 8`（0 是官方两枚图标按钮的自身间距） |
| 空白会话（hero）兜底开关 | 与官方 `打开右侧边栏` 按钮 **overlap 0**（2040/1440/1280），兜底组停在 corner 按钮左侧 8px |
| 模型控件位置 | 右翼底行、发送按钮左侧 8px（`rel [1490,82,46,28]` vs `send rel [1544,82]`），与参考同一布局带 |
| 头部控件尺寸 | 仅缩尺寸、内容原样：`统计 52→40`、`H.D.D 68→58`、`日间模式 30→26`（宽），高度 26/28 与官方按钮一致；文字与参考新月画法未动 |
| 空白会话垂直对齐 | 兜底组与官方 corner 按钮顶端同为 **y=11、高 28**（此前偏上 2px），四档宽度一致 |
| 人设注入（真实组装） | `/dsh-fairy/persona/probe` 返回 8 个 section，`fairy:persona` 排第 3（紧跟 `deployment:persona-prefix`），注入 2213 字；改成自定义文本后立即变为 61 字（含 44 字身份条款），无需重启 |
| 身份条款 | `ling` → 「当前「主人」是铃」；切自定义（执笔者 / 第二助手 Fairy / 家庭成员 小铃）后合成文本多出两行，并同样进入 `fairy:persona` |
| 参考语料 | 11 份语料清单可用、按 id 读取 200、`../package.json` 穿越请求 404；插入 `canon/fairy_canon.json` 后合成从 2213 → 15 493 字 |
| 设置页 TTS 区块 | 真实 UI 上传参考音频：`referencePresent:true`、`referenceBytes:64044`、文件名回显；「测试连接」→「连接正常」；「试听」→ `POST /fairy-voice/tts 200`、43 520 B PCM 并提示「已播放试听」 |
| 设置页人设区块 | textarea `maxLength = -1`（不限字数）；真实输入 17 字并点「保存人设」→ `/dsh-fairy/persona` 立刻报告 `source:custom`、`chars:61`，提示「已保存，下一条消息生效」 |
| TTS API Key | 真实 UI 输入并保存 → 宿主 `apiKeySet:true`、`apiKeyMask:••••••••7788`、响应正文无明文；mock 侧 `/__auth` 收到 `Bearer sk-…`（探活与合成两条都带）；点「清除 API Key」→ `apiKeySet:false`、请求不再带该头；15 项不变量由 `tools/cdp/tts-auth-check.mjs` 全绿 |
| TTS 双协议 | 协议下拉切 `yovoice` 后出现模型/音色字段、「读取引擎模型/音色」从 mock 拉到 `mock-index-tts2` + `mock-voice-001`；「试听」返回 `audio/wav`（38444 B），浏览器 `decodeAudioData` 解码 43 564 B 后 `createBufferSource` 播放并提示「已播放试听」；切回 `gpt-sovits` 后上传控件恢复、模型字段消失；13 项不变量由 `tools/cdp/yovoice-check.mjs` 全绿 |
| 真实 yovoice 引擎 | `GET /fairy-voice/engine` 从 `127.0.0.1:9880` 拉到 1 个模型（`index-2.5-f16`）+ 16 个导入音色（`卡芙卡 • …`、`Fairy • …`）；`/v1/status` 探活 `available:true`；生成时 502 且错误信息带上引擎原话（`语音生成失败：@yovoice.error.generateFailed`） |

### 设置面板的打开前提

`Ctrl + Alt + ,` 打开设置；**未登录时打开的是「开始使用」引导页而不是设置面板**
（`settings.section` 出口不会出现）。隔离实例要验收设置页，需要把
`~/.dsh/.credentials.yaml` 复制到 `.dsh-dev-home/`（该目录已在 `.gitignore` 里）。

已用真实鼠标事件逐项验收（`settings-mode-audit` 流程）：

| 控件 | 效果 |
| --- | --- |
| 启用 HDD 视觉 | `html[data-dsh-fairy-visual]` / `data-dsh-fairy-mode=hdd` 挂卸 |
| HDD 日间模式 | `theme=light`，`body` 背景 `rgb(247,250,252)`、`label-primary #172531`，与参考浅色配色一致 |
| 显示 Fairy 主视觉 | 舞台吉祥物显隐 |
| 低功耗模式 | `power-mode=low-power`，吉祥物 `[data-low-power]` 生效，装饰动画停 |
| Fairy 当前将我识别为 | 铃 / 哲 / 自定义（`fairy-identity` 命名空间持久化） |

## 打包与市场安装

`tools/pin-versions.mjs` 把包之间的 `link:` 依赖改写成版本范围（dev profile 仍走 `link:`，
本地迭代不受影响），`pnpm pack` 出产物后即可按市场的方式安装：

```powershell
node tools/pin-versions.mjs
# 每个包：pnpm pack --pack-destination .dsh-market-home/pkgs
```

两点打包前提（真实市场安装时由 registry 满足）：

- 七个包必须**一起发布**（内部互相依赖 `^0.1.0` 这类范围）；
- `dsh-fairy-voice` 还要装 `mdast-util-from-markdown` / `mdast-util-gfm` / `micromark-extension-gfm`
  —— 缺了它的**宿主半边**会 import 失败，表现为启动日志一行
  `warning: 1 entry did not activate`，其余插件与整页仍正常（0.2.1 对宿主侧失败是告警，
  客户端侧失败才会驻留启动页）。

## 待办

- [x] 会话切换 glitch（`dsh-hdd-session-transition`）在 0.2.1 的复验
- [x] Voice 端到端链路（mock TTS 已验证；换成真实模型只需改 `DSH_FAIRY_TTS_URL`）
- [x] 市场安装路径（tarball 装进全新 `DSH_HOME`，五个插件全部就位）
- [x] 中英 i18n 与 `prefers-reduced-motion` 的逐项回归
- [x] 三个 UI 缺陷：眼睛大小滑条不生效、输入框选不了模型、头部控件位置/间距
- [x] 市场式一键停/起（禁用锚包插入的五个 id → 全部下线；恢复后重新上线）
- [x] 语音服务配置界面（地址 / 参考音频上传 / 提示文本 / 测试连接 / 试听，落盘 + 界面优先于环境变量）
- [x] 身份设置真正生效（合成到人设末尾，随每次组装求值）
- [x] 人设配置项（不限字数）+ 参考项目语料全量搬入（11 份，按需插入）
- [ ] 接真实 TTS 引擎（GPT-SoVITS 零改动，或 IndexTTS2 + 适配器）——见 [docs/TTS.md](docs/TTS.md)
- [ ] 真正走一遍插件市场的 catalog 安装（当前用 tarball + patch 覆盖层等价验证）
- [ ] 参考语料的「按需切片」（当前只有整份插入；参考项目由 `fairy-core.runtime` 按场景抽样）
