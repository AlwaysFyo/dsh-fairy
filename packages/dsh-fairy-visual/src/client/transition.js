/**
 * Mode transition: three lazy full-frame glitch slices.
 *
 * The frame only exists for the duration of the flash. It is clipped, fully
 * pointer-transparent, paints nothing after the animation ends and is removed
 * by its own timer, so the "transition frame count" invariant (0 after settle)
 * stays true.
 */
export const TRANSITION_CLASS = 'dsh-hdd-mode-transition'
export const TRANSITION_ATTR = 'data-dsh-transition-background'

const SLICES = 3

export function runTransition(doc, duration = 460) {
  if (!doc || !doc.body) return () => {}

  for (const stale of [...doc.querySelectorAll(`.${TRANSITION_CLASS}`)]) stale.remove()

  const frame = doc.createElement('div')
  frame.className = TRANSITION_CLASS
  frame.setAttribute(TRANSITION_ATTR, '')
  frame.setAttribute('aria-hidden', 'true')

  for (let index = 0; index < SLICES; index += 1) {
    const slice = doc.createElement('span')
    slice.className = `${TRANSITION_CLASS}__slice`
    slice.style.top = `${Math.round((100 / SLICES) * index)}%`
    slice.style.animationDelay = `${index * 40}ms`
    frame.appendChild(slice)
  }

  doc.body.appendChild(frame)

  let timer = setTimeout(() => {
    timer = 0
    frame.remove()
  }, duration)

  return () => {
    if (timer) clearTimeout(timer)
    timer = 0
    frame.remove()
  }
}
