/**
 * React surfaces the theme contributes: the HDD toggle and the settings page.
 * Both read/write the same store, so the toggle, the settings page and the
 * document attributes never disagree.
 */
import * as React from 'react'

const h = React.createElement

const buttonStyle = (active) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 26,
  padding: '0 10px',
  borderRadius: 13,
  font: '11px/1 -apple-system, "Segoe UI", system-ui, sans-serif',
  letterSpacing: '0.08em',
  cursor: 'pointer',
  color: active ? '#04121a' : 'var(--dsw-alias-label-secondary, #a9c2d2)',
  background: active ? 'var(--dsh-fairy-accent, #61d7ff)' : 'transparent',
  border: `1px solid ${active ? 'var(--dsh-fairy-accent, #61d7ff)' : 'rgba(97,215,255,0.35)'}`,
  transition: 'background 160ms ease, color 160ms ease',
})

const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }
const labelStyle = { minWidth: 120, fontSize: 13, opacity: 0.85 }
const hintStyle = { fontSize: 11, opacity: 0.55, marginTop: 4, lineHeight: 1.5 }

export function HddToggle({ store, variant = 'header' }) {
  const settings = store.useSettings()
  const on = settings.enabled
  return h(
    'button',
    {
      type: 'button',
      'data-dsh-fairy-hdd-toggle': variant,
      'aria-pressed': on,
      title: on ? '切换回标准界面' : '切换到 HDD 界面',
      onClick: () => store.set({ enabled: !on }),
      style: variant === 'overlay' ? { ...buttonStyle(on), position: 'fixed', right: 20, top: 16, zIndex: 20 } : buttonStyle(on),
    },
    h('span', { 'aria-hidden': 'true', style: { fontSize: 12, lineHeight: 1 } }, on ? '◉' : '◎'),
    h('span', null, 'HDD'),
  )
}

export function SettingsSection({ store }) {
  const settings = store.useSettings()
  return h(
    'div',
    { 'data-dsh-fairy-settings': '', style: { padding: '4px 2px 24px', font: '13px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif' } },
    h('h2', { style: { fontSize: 15, fontWeight: 600, margin: '0 0 4px' } }, 'Fairy 界面'),
    h(
      'p',
      { style: { ...hintStyle, margin: '0 0 12px' } },
      '绝区零风格的 HDD 主题。关闭后所有样式、背景层与舞台都会完整撤回，不残留任何节点或属性。',
    ),

    h(
      'div',
      { style: { ...rowStyle, borderTop: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.2))' } },
      h('div', { style: labelStyle }, 'HDD 界面'),
      h('input', {
        type: 'checkbox',
        checked: settings.enabled,
        onChange: (event) => store.set({ enabled: event.target.checked }),
      }),
      h('div', { style: { ...hintStyle, margin: 0 } }, settings.enabled ? '已启用' : '已关闭'),
    ),

    h(
      'div',
      { style: rowStyle },
      h('div', { style: labelStyle }, 'Fairy 舞台'),
      h('input', {
        type: 'checkbox',
        checked: settings.mascotVisible,
        onChange: (event) => store.set({ mascotVisible: event.target.checked }),
      }),
      h('div', { style: { ...hintStyle, margin: 0 } }, '右下角的悬浮眼睛；关闭后仍保留 HDD 背景。'),
    ),

    h(
      'div',
      { style: rowStyle },
      h('div', { style: labelStyle }, '功耗模式'),
      h(
        'select',
        {
          value: settings.powerMode,
          onChange: (event) => store.set({ powerMode: event.target.value }),
          style: { fontSize: 12, padding: '4px 6px' },
        },
        h('option', { value: 'normal' }, 'normal'),
        h('option', { value: 'low-power' }, 'low-power（关闭装饰动画）'),
      ),
      h('div', { style: { ...hintStyle, margin: 0 } }, 'low-power 会停掉自转环与呼吸光晕。'),
    ),

    h(
      'div',
      { style: rowStyle },
      h('div', { style: labelStyle }, '共存策略'),
      h(
        'select',
        {
          value: settings.coexistence,
          onChange: (event) => store.set({ coexistence: event.target.value }),
          style: { fontSize: 12, padding: '4px 6px' },
        },
        h('option', { value: 'auto' }, 'auto'),
        h('option', { value: 'coexist' }, 'coexist（与其它皮肤叠加）'),
        h('option', { value: 'yield' }, 'yield（检测到其它皮肤时让位）'),
      ),
    ),

    h(
      'div',
      { style: rowStyle },
      h('div', { style: labelStyle }, '诊断'),
      h('input', {
        type: 'checkbox',
        checked: settings.diagnostics,
        onChange: (event) => store.set({ diagnostics: event.target.checked }),
      }),
      h('div', { style: { ...hintStyle, margin: 0 } }, '显示探针面板与运行时诊断信息。'),
    ),

    h(
      'div',
      { style: { ...rowStyle, opacity: 0.5 } },
      h('div', { style: labelStyle }, '版本'),
      h('div', { style: { fontSize: 12 } }, `schema ${settings.version} · ${settings.theme || 'dark'}`),
    ),
  )
}
