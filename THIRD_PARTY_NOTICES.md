# Third-party notices

本仓库不复制第三方源码。以下依赖由包管理器或 DSH 宿主安装；它们不在本仓库
Apache-2.0 许可范围内，发布时必须继续保留各自的许可证、版权与 NOTICE 要求。

| 包 | 版本 / 来源 | 许可证 | 版权 / 来源 |
| --- | --- | --- | --- |
| `mdast-util-from-markdown` | 随 `packages/dsh-fairy-voice` 安装 | MIT | syntax-tree 贡献者 |
| `mdast-util-gfm` | 同上 | MIT | syntax-tree 贡献者 |
| `micromark-extension-gfm` | 同上 | MIT | syntax-tree 贡献者 |
| `@playwright/mcp` | 可选，由 `dsh-browser-dock/proxy.cjs` 在运行期解析 | Apache-2.0 | Microsoft；随包附带声明 |
| `rollup`、`@rollup/plugin-commonjs`、`@rollup/plugin-node-resolve` | 构建期 devDependency | MIT | Rollup 贡献者 |
| `ws` | 开发期 CDP 客户端依赖 | MIT | websockets/ws contributors |

## 宿主提供的 DSH 包

`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、`@deepseek-ai/dsh-client-*`
等由 DSH CLI/profile 宿主提供，不随本仓库 vendoring，也不由本项目重新授权。
使用者应按 DSH 发行包中的许可证与版权文件处理。

## 上游衍生代码

`packages/*` 下的插件源码衍生自 Fairy-DSH（Apache-2.0，Copyright 2026
Chengzhibense）。保留上游版权声明与修改说明的义务见根目录 `NOTICE`；上游
许可证全文见 `LICENSE`。

## 发布新版本时

应从最终 lockfile 重新核对版本、来源和许可证，把新增的第三方依赖补入本表；
不能因为依赖被锁定就把它们当作本项目原创内容。
