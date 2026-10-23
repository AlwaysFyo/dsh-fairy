/**
 * The Fairy eye. Pure SVG + CSS animation, no bitmap assets, no canvas.
 *
 * Activity drives the presentation: `idle` breathes, `thinking` spins the outer
 * ring faster and pulses the pupil, `comforting` warms the halo. All animation
 * is CSS-only so `prefers-reduced-motion` can switch it off wholesale.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

const svg = (h, props, children) => h('svg', props, children)

const ring = (h, key, radius, className, strokeWidth, opacity) =>
  h('circle', {
    key,
    className,
    cx: 60,
    cy: 60,
    r: radius,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeOpacity: opacity,
    strokeDasharray: `${radius * 0.9} ${radius * 0.55}`,
    strokeLinecap: 'round',
  })

export function createEye(h) {
  return svg(
    h,
    {
      className: 'dsh-fairy-eye',
      viewBox: '0 0 120 120',
      width: 132,
      height: 132,
      role: 'img',
      'aria-label': 'Fairy',
      style: { color: 'var(--dsh-fairy-accent)' },
    },
    [
      h('defs', { key: 'defs' }, [
        h(
          'radialGradient',
          { key: 'core', id: 'dsh-fairy-core', cx: '50%', cy: '50%', r: '50%' },
          [
            h('stop', { key: 'a', offset: '0%', stopColor: '#eafcff', stopOpacity: 0.98 }),
            h('stop', { key: 'b', offset: '55%', stopColor: '#61d7ff', stopOpacity: 0.85 }),
            h('stop', { key: 'c', offset: '100%', stopColor: '#0d5f7a', stopOpacity: 0.15 }),
          ],
        ),
      ]),
      h('g', { key: 'rings', className: 'dsh-fairy-eye-ring' }, [
        ring(h, 'r1', 55, undefined, 1.1, 0.5),
        ring(h, 'r2', 47, undefined, 0.8, 0.32),
        ring(h, 'r3', 39, undefined, 0.6, 0.22),
      ]),
      h('g', { key: 'rings2', className: 'dsh-fairy-eye-ring-rev' }, [
        ring(h, 'r4', 51, undefined, 0.7, 0.26),
        h('circle', {
          key: 'tick',
          cx: 60,
          cy: 60,
          r: 43,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeOpacity: 0.5,
          strokeDasharray: '2 26',
          strokeLinecap: 'round',
        }),
      ]),
      h('g', { key: 'pupil', className: 'dsh-fairy-pupil' }, [
        h('circle', { key: 'iris', cx: 60, cy: 60, r: 27, fill: 'url(#dsh-fairy-core)' }),
        h('circle', { key: 'hole', cx: 60, cy: 60, r: 12.5, fill: '#04121a', fillOpacity: 0.92 }),
        h('circle', { key: 'glint', cx: 53, cy: 52, r: 4.2, fill: '#ffffff', fillOpacity: 0.85 }),
        h('circle', { key: 'glint2', cx: 68, cy: 70, r: 2.1, fill: '#ffffff', fillOpacity: 0.4 }),
      ]),
    ],
  )
}

/**
 * @param {{ activity: 'normal'|'thinking'|'comforting', visible: boolean }} props
 */
export function createStage(h) {
  return function FairyStage({ activity = 'normal', visible = true }) {
    return h(
      'div',
      {
        className: 'dsh-fairy-stage',
        'data-dsh-fairy-stage': '',
        'data-activity': activity,
        'data-hidden': visible ? 'false' : 'true',
        'aria-hidden': 'true',
      },
      [
        h('div', { key: 'halo', className: 'dsh-fairy-halo' }),
        createEye(h),
        h('div', { key: 'glitch', className: 'dsh-fairy-glitch' }),
      ],
    )
  }
}

export { SVG_NS }
