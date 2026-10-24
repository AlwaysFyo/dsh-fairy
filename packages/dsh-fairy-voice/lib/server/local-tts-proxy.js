/* Local TTS transport and PCM forwarding have no route or settings ownership. */
export function createPcmStreamHandler() {
  return {
    async pipe(response, res, signal) {
      if (!response.body) throw Object.assign(new Error('local synthesis returned no audio'), { code: 'local-service-failed' });
      try {
        for await (const chunk of response.body) {
          if (signal.aborted) break;
          if (!res.write(Buffer.from(chunk))) {
            await new Promise((resolve) => {
              let settled = false;
              const finish = () => {
                if (settled) return;
                settled = true;
                res.removeListener('drain', finish);
                res.removeListener('close', finish);
                signal.removeEventListener('abort', finish);
                resolve();
              };
              res.once('drain', finish);
              res.once('close', finish);
              signal.addEventListener('abort', finish, { once: true });
            });
          }
        }
      } finally {
        // Breaking an async iterator does not close every fetch implementation's
        // body immediately. Explicitly cancel an aborted stream so session
        // switches, reloads, and client disconnects release the socket now.
        if (signal.aborted && typeof response.body.cancel === 'function') {
          await response.body.cancel().catch((error) => {
            if (!signal.aborted && error?.name !== 'AbortError') throw error;
          });
        }
      }
    },
  };
}

async function localFetch(url, options, timeoutMs, parentSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onAbort = () => controller.abort(parentSignal?.reason || 'client-aborted');
  if (parentSignal?.aborted) onAbort();
  else parentSignal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw Object.assign(new Error(String(controller.signal.reason)), { code: controller.signal.reason });
    throw Object.assign(new Error('local service unavailable'), { code: 'local-service-unavailable' });
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onAbort);
  }
}

/* A streaming response is active after fetch() resolves, so release() owns
 * the parent abort bridge until its consumer has finished with the PCM body. */
function openLocalStream(url, options, timeoutMs, parentSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onAbort = () => controller.abort(parentSignal?.reason || 'client-aborted');
  if (parentSignal?.aborted) onAbort();
  else parentSignal?.addEventListener('abort', onAbort, { once: true });
  const release = () => {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onAbort);
  };
  return fetch(url, { ...options, signal: controller.signal }).catch((error) => {
    release();
    if (controller.signal.aborted) throw Object.assign(new Error(String(controller.signal.reason)), { code: controller.signal.reason });
    throw Object.assign(new Error('local service unavailable'), { code: 'local-service-unavailable' });
  }).then((response) => ({ response, release }));
}

export function createLocalTtsTransport({
  fetchImpl = fetch,
  ttsUrl,
  docsUrl,
  referenceAudioPath,
  referencePrompt,
  resolveConfig,
  ttsTimeoutMs,
  statusTimeoutMs,
} = {}) {
  /* The UI can repoint the bridge at another engine without a restart, so the
   * endpoint and reference clip are read per request when a resolver is given. */
  const current = () => (typeof resolveConfig === 'function'
    ? resolveConfig()
    : { ttsUrl, docsUrl, referenceAudioPath, referencePrompt });
  const fetchStatus = (url, options, timeoutMs, signal) => fetchImpl === fetch
    ? localFetch(url, options, timeoutMs, signal)
    : fetchImpl(url, options);
  const stream = (url, options, timeoutMs, signal) => fetchImpl === fetch
    ? openLocalStream(url, options, timeoutMs, signal)
    : fetchImpl(url, { ...options, signal }).then((response) => ({ response, release: null }));
  /* Engines that need a token get it as a Bearer header; unset means no header,
   * so a plain local GPT-SoVITS install keeps working unchanged. */
  const authHeaders = (config) => {
    const key = typeof config?.apiKey === 'string' ? config.apiKey.trim() : '';
    return key ? { authorization: `Bearer ${key}` } : {};
  };
  /* Two request shapes share one transport: the reference implementation's
   * GPT-SoVITS body, and the local yovoice engine (IndexTTS family), which
   * answers with a finished WAV instead of a raw PCM stream. */
  const isYovoice = (config) => config?.protocol === 'yovoice';
  const gptSovitsBody = (text, config) => ({ text, text_lang: 'zh', ref_audio_path: config.referenceAudioPath, prompt_text: config.referencePrompt, prompt_lang: 'zh', text_split_method: 'cut5', batch_size: 1, media_type: 'raw', streaming_mode: 1, fragment_interval: 0.14, parallel_infer: false });
  const yovoiceBody = (text, config) => {
    const body = { text };
    for (const [field, key] of [['modelId', 'modelId'], ['voiceId', 'voiceId'], ['referenceText', 'referenceText']]) {
      const value = typeof config?.[field] === 'string' ? config[field].trim() : '';
      if (value) body[key] = value;
    }
    return body;
  };
  const localTtsRequest = (text, config) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
    body: JSON.stringify(isYovoice(config) ? yovoiceBody(text, config) : gptSovitsBody(text, config)),
  });
  return {
    status(signal) {
      const config = current();
      return fetchStatus(config.docsUrl, { method: 'GET', headers: authHeaders(config) }, statusTimeoutMs, signal).then(async (response) => {
        if (!response.ok) throw new Error(`Fairy status returned ${response.status}`);
        /* yovoice reports engine health in the body: a 200 with ready:false means
         * the service is up but the engine cannot synthesize right now. */
        if (!isYovoice(config)) return { available: true, reason: null };
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          throw new Error('Fairy status returned a non-JSON body');
        }
        if (payload?.ready === true) return { available: true, reason: null };
        return { available: false, reason: `yovoice 未就绪（${payload?.activity?.errorCode || payload?.engineVersion || 'unknown'}）` };
      });
    },
    stream(text, signal) {
      const config = current();
      return stream(config.ttsUrl, localTtsRequest(text, config), ttsTimeoutMs, signal);
    },
  };
}
