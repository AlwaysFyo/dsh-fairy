import { readFileSync } from 'node:fs';
import { openPage } from './client.mjs';

/**
 * Verifies the two-segment voice pill: the volume range must stay draggable
 * even when the speech engine is unreachable, persist to localStorage, and the
 * group must expose the engine state plus the reason.
 *
 *   node tools/cdp/volume-check.mjs <hostUrl> <token>
 */
const host = process.argv[2];
const token = process.argv[3] || readFileSync('.dsh-dev-home/token.txt', 'utf8').trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cdp = await openPage();
// The voice pill lives in the composer's bottom-right corner; pin the viewport
// so the drag coordinates do not depend on how the attached browser was resized.
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 2040, height: 1200, deviceScaleFactor: 1, mobile: false });
let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`);
};

try {
  await cdp.navigate(`${host.replace(/\/$/, '')}/${host.includes('token=') ? '' : `?token=${token}`}`);
  await cdp.waitFor(`!!document.querySelector('[data-dsh-fairy-volume-input]')`, 25000);
  await sleep(800);

  const before = await cdp.evaluate(`(() => {
    const group = document.querySelector('.dsh-fairy-voice-controls');
    const input = document.querySelector('[data-dsh-fairy-volume-input]');
    return {
      ready: group?.getAttribute('data-dsh-fairy-engine-ready'),
      title: group?.getAttribute('title'),
      volume: input?.value,
      disabled: input?.disabled === true,
      autoDisabled: document.querySelector('[data-dsh-fairy-auto-control]')?.disabled === true,
      bars: document.querySelectorAll('[data-dsh-fairy-wave-bar][data-active="true"]').length,
      stored: localStorage.getItem('dsh.fairyVoice.volume'),
    };
  })()`);
  check('volume slider is enabled', before.disabled === false, before.disabled);
  check('engine state is exposed', before.ready === 'true' || before.ready === 'false', before.ready);
  if (before.ready === 'false') check('unavailable reason is attached', typeof before.title === 'string' && before.title.length > 0, before.title);

  const rect = await cdp.evaluate(`(() => { const r = document.querySelector('[data-dsh-fairy-volume-input]').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`);
  const y = rect[1] + rect[3] / 2;
  const fromX = rect[0] + rect[2] * 0.98;
  const toX = rect[0] + rect[2] * 0.35;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: fromX, y, button: 'none' });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: fromX, y, button: 'left', clickCount: 1 });
  for (let step = 1; step <= 5; step += 1) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: fromX + ((toX - fromX) * step) / 5, y, button: 'left' });
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: toX, y, button: 'left', clickCount: 1 });
  await sleep(400);

  const after = await cdp.evaluate(`(() => {
    const input = document.querySelector('[data-dsh-fairy-volume-input]');
    return {
      volume: input?.value,
      cssVar: input?.style.getPropertyValue('--dsh-fairy-volume'),
      bars: document.querySelectorAll('[data-dsh-fairy-wave-bar][data-active="true"]').length,
      stored: localStorage.getItem('dsh.fairyVoice.volume'),
    };
  })()`);
  check('dragging changes the volume', after.volume !== before.volume, { from: before.volume, to: after.volume });
  check('waveform follows the volume', after.bars !== before.bars || after.volume === '1', { from: before.bars, to: after.bars });
  check('volume is persisted', after.stored === after.volume, { stored: after.stored, volume: after.volume });

  await cdp.navigate(`${host.replace(/\/$/, '')}/${host.includes('token=') ? '' : `?token=${token}`}`);
  await cdp.waitFor(`!!document.querySelector('[data-dsh-fairy-volume-input]')`, 25000);
  await sleep(1200);
  const reloaded = await cdp.evaluate(`document.querySelector('[data-dsh-fairy-volume-input]').value`);
  check('volume survives a reload', reloaded === after.volume, { reloaded });

  console.log(failures === 0 ? 'ok volume invariants hold' : `${failures} volume invariant(s) failed`);
  process.exitCode = failures === 0 ? 0 : 1;
} finally {
  cdp.close();
}
