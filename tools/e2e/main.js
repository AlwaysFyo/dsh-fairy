// Headless Electron probe harness for the Fairy DSH dev instance.
// Usage: FAIRY_URL="http://127.0.0.1:3400/?token=..." electron.exe tools/e2e
// Prints one line: E2E_RESULT {json}
const { app, BrowserWindow } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.disableHardwareAcceleration();

const url = process.env.FAIRY_URL;
const logs = [];
let finished = false;

function emit(payload) {
  if (finished) return;
  finished = true;
  console.log('E2E_RESULT ' + JSON.stringify(payload));
  setTimeout(() => app.exit(0), 50);
}

const HARD_TIMEOUT = setTimeout(() => {
  emit({ timeout: true, logs: logs.slice(-30) });
}, 60000);

app.on('ready', async () => {
  if (!url) {
    emit({ error: 'FAIRY_URL not set' });
    return;
  }
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  const wc = win.webContents;
  wc.on('console-message', (_event, level, message) => {
    const text = String(message);
    if (text.includes('[fairy-probe]') || level >= 2) logs.push({ level, message: text.slice(0, 3000) });
  });
  wc.on('did-fail-load', (_e, code, desc, u) => {
    logs.push({ level: 'did-fail-load', message: `${code} ${desc} ${u}` });
  });

  const probe = async (js, name) => {
    try {
      return { name, ok: true, value: await wc.executeJavaScript(js, true) };
    } catch (error) {
      return { name, ok: false, error: String(error) };
    }
  };

  const results = [];
  try {
    await win.loadURL(url);
  } catch (error) {
    logs.push({ level: 'loadURL', message: String(error) });
  }

  results.push(await probe(`({
    boot: !!window.__DSH_BOOT__,
    entries: (window.__DSH_BOOT__ && window.__DSH_BOOT__.entries || []).length,
    hasFairyEntry: (window.__DSH_BOOT__ && window.__DSH_BOOT__.entries || []).some(e => e.id === 'dsh-fairy-visual'),
    loader: !!window.__ModuleLoader__,
    readyState: document.readyState
  })`, 'boot'));

  const deadline = Date.now() + 30000;
  let report = null;
  while (Date.now() < deadline) {
    report = await probe(`window.__DSH_FAIRY_PROBE__ ? JSON.parse(JSON.stringify(window.__DSH_FAIRY_PROBE__)) : null`, 'probe');
    if (report.ok && report.value) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  results.push(report || { name: 'probe', ok: false, error: 'timeout waiting for __DSH_FAIRY_PROBE__' });

  results.push(await probe(`({
    fairyRoot: document.querySelectorAll('#dsh-fairy-root').length,
    fairyStage: document.querySelectorAll('.dsh-fairy-stage').length,
    probePanel: document.querySelectorAll('[data-dsh-fairy-probe]').length,
    bodyChildren: Array.prototype.map.call(document.body.children, n => n.id || n.getAttribute('class') || n.tagName).slice(0, 12),
    rootChildren: (document.getElementById('root') ? document.getElementById('root').children.length : -1)
  })`, 'dom'));

  clearTimeout(HARD_TIMEOUT);
  emit({ results, logs: logs.slice(-40) });
});

app.on('window-all-closed', () => app.exit(0));
