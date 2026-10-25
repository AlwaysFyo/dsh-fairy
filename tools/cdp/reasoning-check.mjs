import { readFileSync } from 'node:fs';
import { openPage } from './client.mjs';

/**
 * Verifies the reasoning-effort model seat (`@ayanehana/dsh-reasoning-effort`)
 * once it is wired into the Fairy composer: the trigger keeps its text, the
 * popup exposes the 模型与推理强度 menu, the effort slider moves the level, and
 * every label keeps a readable contrast ratio.
 *
 *   node tools/cdp/reasoning-check.mjs <hostUrl> <token>
 */
const host = process.argv[2];
const token = process.argv[3] || readFileSync('.dsh-dev-home/token.txt', 'utf8').trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cdp = await openPage();
let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`);
};

const clickAt = async (x, y) => {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};

const dragTo = async (box, fromRatio, toRatio) => {
  const [x, y, w, h] = box;
  const mid = Math.round(y + h / 2);
  const from = Math.round(x + w * fromRatio);
  const to = Math.round(x + w * toRatio);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from, y: mid, button: 'none' });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from, y: mid, button: 'left', clickCount: 1 });
  for (let step = 1; step <= 6; step += 1) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(from + ((to - from) * step) / 6), y: mid, button: 'left' });
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to, y: mid, button: 'left', clickCount: 1 });
  await sleep(350);
};

const escape = async () => {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(350);
};

const CONTRAST = `
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg && bg.a > 0.35) return bg;
      n = n.parentElement;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor);
    return body && body.a > 0.35 ? body : { r: 255, g: 255, b: 255, a: 1 };
  };
`;

try {
  await cdp.navigate(`${host.replace(/\/$/, '')}/${host.includes('token=') ? '' : `?token=${token}`}`);
  await cdp.waitFor(`!!document.querySelector('.re-model-root .re-model-trigger')`, 25000);
  await sleep(1200);

  const trigger = await cdp.evaluate(`(() => {
    const root = document.querySelector('.re-model-root');
    const name = root.querySelector('.re-model-name');
    const effort = root.querySelector('.re-model-effort');
    const icon = root.querySelector('.re-model-icon');
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
    return {
      text: root.querySelector('.re-model-trigger').innerText.replace(/\\n/g, ' ').trim(),
      aria: root.querySelector('.re-model-trigger').getAttribute('aria-label'),
      box: box(root),
      name: { text: name?.innerText, visible: (name?.getBoundingClientRect().width || 0) > 20 },
      effort: { text: effort?.innerText, visible: (effort?.getBoundingClientRect().width || 0) > 4 },
      iconVisible: (icon?.getBoundingClientRect().width || 0) > 0,
    };
  })()`);
  check('the model seat is the reasoning-effort trigger', Boolean(trigger.aria) && trigger.box[2] > 100, trigger);
  check('the model name is rendered (not compact icon mode)', trigger.name.visible && /\S/.test(trigger.name.text || ''), trigger.name);
  check('the effort level is rendered next to the name', trigger.effort.visible && /\S/.test(trigger.effort.text || ''), trigger.effort);
  check('the seat sits on composer-bottom row', trigger.box[3] <= 32 && trigger.box[1] > 1000, trigger.box);

  const readMenu = () => cdp.evaluate(`(() => {
    ${CONTRAST}
    const m = document.querySelector('.re-model-menu');
    if (!m) return { open: false };
    const r = m.getBoundingClientRect();
    const input = m.querySelector('.re-effort-input');
    const read = (sel) => {
      const el = m.querySelector(sel);
      if (!el) return null;
      return { text: el.innerText.trim().slice(0, 12), ratio: +ratio(parse(getComputedStyle(el).color), bgOf(el)).toFixed(2) };
    };
    return {
      open: true,
      aria: m.getAttribute('aria-label'),
      box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      hasAdvanced: Boolean(m.querySelector('.re-advanced')),
      unavailable: m.querySelector('.re-effort-unavailable')?.innerText.trim() || null,
      slider: input ? { value: input.value, max: input.max, valueText: input.getAttribute('aria-valuetext'), box: (() => { const b = input.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })() } : null,
      ticks: [...m.querySelectorAll('.re-effort-tick')].map((el) => +ratio(parse(getComputedStyle(el).color), bgOf(el)).toFixed(2)),
      labels: { effortName: read('.re-effort-name'), rowEffort: read('.re-model-row-effort') },
    };
  })()`);

  const centerOf = (selector) => cdp.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2), el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 40)];
  })()`);

  const openMenu = async () => {
    const c = await centerOf('.re-model-trigger');
    await clickAt(c[0], c[1]);
    await sleep(850);
    return readMenu();
  };

  const seat = [Math.round(trigger.box[0] + trigger.box[2] / 2), Math.round(trigger.box[1] + trigger.box[3] / 2)];
  await clickAt(seat[0], seat[1]);
  await sleep(900);
  let menu = await readMenu();
  if (!menu.open) menu = await openMenu();
  check('the popup is 模型与推理强度', menu.open && /模型与推理强度/.test(menu.aria || ''), menu.aria);

  const originalModel = trigger.name.text;
  if (menu.open && !menu.hasAdvanced) {
    check('a model without tiers explains why the slider is missing', /未提供推理强度|未支持/.test(menu.unavailable || ''), menu.unavailable);
    const row = await centerOf('.re-model-row');
    if (row) {
      await clickAt(row[0], row[1]);
      await sleep(700);
      const pick = await cdp.evaluate(`(() => {
        const el = [...document.querySelectorAll('.re-model-option')].find((n) => /V4-Pro|V4\\.1-Pro/.test(n.innerText));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2), el.innerText.trim().slice(0, 30)];
      })()`);
      if (pick) {
        await clickAt(pick[0], pick[1]);
        await sleep(900);
        menu = await readMenu();
        if (!menu.open) menu = await openMenu();
        console.log('     switched to a tiered model → ' + JSON.stringify(pick[2]));
      }
    }
  }

  check('the advanced effort panel is present', menu.hasAdvanced === true, menu.hasAdvanced);
  check('the effort slider offers four levels', menu.slider?.max === '3', menu.slider);

  const triggerEffort = await cdp.evaluate(`(() => {
    ${CONTRAST}
    const el = document.querySelector('.re-model-root .re-model-effort');
    return +ratio(parse(getComputedStyle(el).color), bgOf(el)).toFixed(2);
  })()`);
  check('trigger effort keeps a readable contrast', triggerEffort >= 4.5, triggerEffort);
  const ratios = [...(menu.ticks || []), menu.labels?.effortName?.ratio, menu.labels?.rowEffort?.ratio].filter((r) => typeof r === 'number');
  check('every menu label keeps a readable contrast', ratios.length > 0 && ratios.every((r) => r >= 4.5), { ticks: menu.ticks, labels: menu.labels });

  if (menu.slider) {
    await dragTo(menu.slider.box, 0.97, 0.04);
    const low = await cdp.evaluate(`(() => {
      const input = document.querySelector('.re-effort-input');
      return { value: Number(input.value), text: input.getAttribute('aria-valuetext'), aria: document.querySelector('.re-model-trigger').getAttribute('aria-label') };
    })()`);
    check('dragging the slider lowers the level', low.value < 3, low);
    check('the trigger reflects the new level', Boolean(low.text) && (low.aria || '').includes(low.text), low);

    await dragTo(menu.slider.box, 0.04, 0.99);
    const high = await cdp.evaluate(`(() => {
      const input = document.querySelector('.re-effort-input');
      return { value: Number(input.value), text: input.getAttribute('aria-valuetext'), aria: document.querySelector('.re-model-trigger').getAttribute('aria-label') };
    })()`);
    check('dragging back restores the top level', high.value === 3 && high.text === 'Max', high);
    check('the trigger shows Max again', /Max/.test(high.aria || ''), high.aria);
  }

  const row = await centerOf('.re-model-row');
  if (row) {
    await clickAt(row[0], row[1]);
    await sleep(700);
    const options = await cdp.evaluate("[...document.querySelectorAll('.re-model-option')].length");
    check('the model list lists every provider model', options >= 10, options);
    if (originalModel && menu.hasAdvanced) {
      const restore = await cdp.evaluate(`(() => {
        const el = [...document.querySelectorAll('.re-model-option')].find((n) => n.innerText.trim().includes(${JSON.stringify(originalModel)}));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
      })()`);
      if (restore) {
        await clickAt(restore[0], restore[1]);
        await sleep(800);
        console.log('     restored the original model → ' + originalModel);
      }
    }
  } else {
    check('the model row opens the model list', false, 'no .re-model-row');
  }

  const outside = await cdp.evaluate(`(() => {
    const m = document.querySelector('.re-model-menu');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    return [Math.round(Math.max(40, r.x - 80)), Math.round(Math.min(600, r.y + r.height / 2))];
  })()`);
  if (outside) await clickAt(outside[0], outside[1]);
  await escape();
  await sleep(400);
  const closed = await cdp.evaluate("!document.querySelector('.re-model-menu')");
  check('the popup closes again', closed === true, closed);

} catch (error) {
  failures += 1;
  console.log('FAIL ' + (error && error.message ? error.message : String(error)));
} finally {
  cdp.close();
}

console.log(failures === 0 ? 'ok reasoning-effort invariants hold' : `${failures} invariant(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;

