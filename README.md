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
| `packages/dsh-fairy-voice` | 朗读控制与波形；依赖外部本地 TTS（`http://127.0.0.1:9880/tts`），不可用时静默降级 |
| `packages/dsh-browser-dock` | 浏览器 dock，配合 `@playwright/mcp` 的 stdio 代理 |
| `packages/dsh-fairy-contracts` | 跨包只读契约：设置命名空间与版本、DOM 锚点、activity/lifecycle 词汇、诊断边界 |

## 与 0.1.1 的三处必要适配

1. **`ctx.settingsScope` 在 0.2.1 已不存在** → `dsh-fairy-visual/src/client/scope-shim.js`
   用宿主路由 `GET/PUT /dsh-fairy/settings?ns=<namespace>` 复刻
   `getSnapshot()/subscribe()/set()` 三个方法，数据落在 `$DSH_HOME/fairy-visual/settings.json`
   与 `$DSH_HOME/fairy-identity/identity.json`（原子写）。
2. **DOM 漂移** → `dom-adapter.js` 同时接受 `[data-slot="main.conversation"]` 与
   `[data-composer-input]`（0.2.1 的输入是 contenteditable div，不是 textarea）；
   `[data-phase="plain"]` **不能**当成 active，那是 composer 自己的词表。
3. **`sessions.clear()` 不存在** → `dsh-fairy-startup` 降级为「能清就清」，
   否则 0.2.1「任一 entry 失败即整体失败」会让整页白屏。

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
| 余额卡 `unavailable` | 0.2.1 的 `.credentials.yaml` 是结构化 `records:` 格式，没有参考实现读取的扁平 `DEEPSEEK_API_KEY`；参考实例同样显示 unavailable |
| 朗读按钮存在但不出声 | 需要外部本地 TTS（`127.0.0.1:9880`）与参考音色样本，仓库不提供 |

## 待办

- [ ] 设置面板「HDD 视觉与 Fairy 身份」分节的人工确认（自动化点开面板尚不稳定）
- [ ] 会话切换 glitch（`dsh-hdd-session-transition`）在 0.2.1 的复验
- [ ] Voice 端到端（接上 TTS 后验证波形、自动朗读、音色）
- [ ] 市场安装路径：把锚包打进 catalog 并在真实 profile 上验证「一键停/起」
- [ ] 中英 i18n 与 `prefers-reduced-motion` 的逐项回归
