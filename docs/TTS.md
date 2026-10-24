# 给 Fairy 挑一个本地 TTS

Fairy 的语音走的是**参考项目原有的协议**：宿主把文本 POST 到
`http://127.0.0.1:9880/tts`（可用 `DSH_FAIRY_TTS_URL` 覆盖），请求体是
**GPT-SoVITS 的 `/tts` 形状**：

```json
{
  "text": "要说的话",
  "text_lang": "zh",
  "ref_audio_path": "…/fairy_ref.wav",
  "prompt_text": "参考音频对应的文字",
  "prompt_lang": "zh",
  "text_split_method": "cut5"
}
```

响应体被当作 **32 kHz / 16-bit / 单声道 PCM** 直接流回浏览器播放。
所以「接得上」的判据只有两条：**端点形状对**、**返回裸 PCM**。
（`GET {DSH_FAIRY_DOCS_URL}`——默认 `http://127.0.0.1:9880/docs`——返回 2xx
即视为可用；否则语音控件静默降级，不影响其它功能。）

## 需要鉴权的端点

设置 →「Fairy 控制台」→「语音服务（TTS）」里的 **API Key** 字段（也可用
`DSH_FAIRY_TTS_APIKEY` 给默认值）用于托管式或加锁的引擎：

- 设置后**探活与合成的请求都带** `Authorization: Bearer <key>`；未设置则不带任何认证头，
  所以本地不加鉴权的 GPT-SoVITS 完全不受影响。
- Key 只写不读：`GET /fairy-voice/config` 只回 `apiKeySet` 与末四位掩码，正文永远不含明文；
  留空提交表示「保持不变」，要清掉必须点「清除 API Key」（`POST /fairy-voice/config/update`
  带 `{"clearApiKey":true}`）。
- 明文存在 `$DSH_HOME/fairy-voice/tts-config.json`（和 `voice-brain.json` 同一类本机凭据文件）。
- 自检：`node tools/cdp/tts-auth-check.mjs http://127.0.0.1:3400 http://127.0.0.1:9881/__auth`
  —— 15 项不变量，含「探活/合成是否真的带上了 Bearer」「清除后是否不再发头」。

## 结论先说

| 选择 | 改动量 | 中文表现 | 克隆 | 备注 |
|---|---|---|---|---|
| **GPT-SoVITS v2/v3 `api_v2.py`** | **零** | 好 | 零样本 | 协议原生匹配，最省事 |
| **IndexTTS2（你机器上已有权重）** | 一个 ~40 行适配器 | **最好（情感/停顿最像人）** | 零样本 | 已经在 yovoice 里跑着 |
| CosyVoice2/3 | 适配器 | 很好 | 零样本 | 需要它的 WebSocket/HTTP 网关 |
| ChatTTS | 适配器 | 一般（口语感强，朗读腔弱） | 不支持 | 便宜、快 |
| edge-tts | 适配器 | 好 | 不支持 | **云端**，免费但依赖网络 |
| 商业云（火山/阿里/Azure） | 适配器 | 很好 | 部分支持 | 要 key，按字符计费 |

**给你的建议**：先用 **GPT-SoVITS 的 `api_v2.py`** 把链路跑通（一行环境变量都不用改），
然后把 **IndexTTS2** 接成第二个 provider——它就在你机器上（`E:\Models\Yovoice\index-tts2_5-f16.gguf`，
CUDA 后端），音色和情感是这批开源模型里最接近「人说话」的。

## 为什么不是直接复用 yovoice 的服务

你本机 `127.0.0.1:9880` 现在被 `yovoice-service.exe`（PID 8164，`D:\Public\Applications\yovoice`）占着：

- `GET /docs` → 200，是 Swagger UI（标题「yovoice API」）；
- `GET /openapi.json`、`GET /health`、`POST /tts` → 全部 **401**，且 `WWW-Authenticate` 为空，
  密钥不在任何可读配置里（`E:\Models\Yovoice\.yovoice\` 下只有 `server.json` / `*.db` / `preferences`）；
- 它的引擎在 **7332**（`runtime/server.json` → `backend: cuda`、`models: [{family: index_tts2, path: …index-tts2_5-f16.gguf}]`）。

也就是说：**引擎能力你有，但它的 HTTP 面不是 GPT-SoVITS 形状，而且带鉴权**。
两条路都可以，取决于你想不想让我改代码去适配它：

1. **保持 0 改动**：换一个 GPT-SoVITS 兼容端点（下面第二节），Fairy 立刻可用；
2. **接 yovoice**：我需要它的 API key（或在 yovoice 里开一个免鉴权的本地端点），
   我再写 `lib/server/local-tts-proxy.js` 的 provider 分支把字段映射过去。

## 一、最省事：GPT-SoVITS 自带 api 服务

```bash
# GPT-SoVITS 仓库根目录
python api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml
```

- 默认就监听 `9880`，`/tts` 的字段与 Fairy 期望的完全一致 → **不需要任何改动**。
- 显存：v2 约 4 GB（推理 8 bit 可更低），首次加载 20–60 s，之后每句 0.3–1.5 s（视 GPU）。
- 参考音色：`~/.dsh/fairy-voice/runtime/reference/fairy_ref.wav`（10–15 s 干净中文独白，
  44.1 kHz 单声道即可）+ 同名 `.txt` 写这段音频的原文；两个文件都在就自动使用，
  缺了会回落到固定提示语并打 `reference.prompt.load` 失败日志（不影响其它功能）。
- 用 `DSH_HOME` 隔离实例时，这两个文件读的是 `$DSH_HOME/fairy-voice/runtime/reference/`。

## 二、想用你已有的 IndexTTS2

IndexTTS2 的输出质量明显高于 GPT-SoVITS v2（韵律、情感、长短停顿都更自然），
而且你已经有权重和 CUDA 环境。需要一层薄适配器：

```
Fairy 宿主 ──▶ /fairy-voice/tts ──▶ adapter（新，~40 行）──▶ yovoice / IndexTTS2
```

适配器要做的事只有三件：

1. 把 `{text, text_lang, ref_audio_path, prompt_text, text_split_method}` 映射成
   IndexTTS2 的输入（`spk_audio_prompt` + `text` + 情感向量/强度）；
2. 把返回的 wav 去掉 44 字节头 → 裸 PCM（或让适配器直接 `ffmpeg -f s16le` 转一次）；
3. 采样率对齐到 **32000 Hz**（`PCM_SAMPLE_RATE` 是硬编码常量；改成 24 kHz 需要同时改
   `lib/client.js` 里的解码常量）。

如果你愿意给出 yovoice 的 key，或允许我在 yovoice 里加一个免鉴权的
`POST /local/gpt-sovits-compat` 端点，这层我可以直接写进 `dsh-fairy-voice`，
用 `DSH_FAIRY_TTS_PROVIDER=yovoice` 切换。

## 三、验证链路（不需要真模型也能跑）

仓库自带一个 GPT-SoVITS 兼容的假服务，用来验证「浏览器 → 宿主 → TTS → 播放」整条链：

```powershell
node tools/mock-tts.mjs --port=9881
$env:DSH_FAIRY_TTS_URL='http://127.0.0.1:9881/tts'
$env:DSH_FAIRY_DOCS_URL='http://127.0.0.1:9881/docs'
# 用这个环境起隔离实例，然后：
node tools/cdp/voice-e2e.mjs http://127.0.0.1:3400/?token=…
```

已实测通过的结果（Chromium + CDP）：

- `GET /fairy-voice/status` → `{"available":true,"reason":null}`
- `POST /fairy-voice/tts` → `200`，`Content-Type: audio/pcm`，53 760 字节
- 浏览器侧解码：38 400 字节 → 19 200 样本 → 32 kHz 下 0.6 s，峰值 0.459，**实际出声**
- 音频控件：`[aria-label="Fairy 朗读控制"]` = `[1876,1077,152,28]`，波形 30 根条

换成真实 GPT-SoVITS 时，只需把 `DSH_FAIRY_TTS_URL` 去掉（默认就是 `127.0.0.1:9880/tts`）。

## 四、选型细节（如果你要自己挑）

- **中文朗读自然度**：IndexTTS2 ≳ CosyVoice3 > CosyVoice2 > GPT-SoVITS v2 > ChatTTS > edge-tts。
- **零样本克隆还原度**：CosyVoice3 ≈ IndexTTS2 > GPT-SoVITS v2（短参考音频时 GPT-SoVITS 更挑音频质量）。
- **首包延迟（RTX 4060 级）**：ChatTTS ~0.1 s/句、edge-tts ~0.3 s（网络）、
  GPT-SoVITS ~0.5 s、IndexTTS2 ~0.8–1.2 s（情感建模更重）。
- **显存**：ChatTTS ~2 GB、GPT-SoVITS v2 ~4 GB、CosyVoice2 ~6 GB、IndexTTS2 ~8 GB（f16）。
- **Fairy 场景的加分项**：需要「有点冷淡、带情绪、偶尔提醒」的语气。
  IndexTTS2 的情感控制（emo vector / emo text）最贴合；GPT-SoVITS 只能靠参考音频本身带情绪。
- **许可证**：GPT-SoVITS MIT、IndexTTS2 Apache-2.0（权重另有条款，见其 model-license）、
  CosyVoice Apache-2.0、edge-tts 走微软服务条款。
