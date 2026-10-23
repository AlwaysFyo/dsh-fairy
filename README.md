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
| `node tools/mock-tts.mjs --port=9881` | GPT-SoVITS 兼容的假 TTS，用来验证整条语音链 |
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
- [ ] 接真实 TTS（GPT-SoVITS 零改动，或 IndexTTS2 + 适配器）——见 [docs/TTS.md](docs/TTS.md)
- [ ] 真实 profile 上的「市场一键停/起」验证（需要把包装进 catalog）
