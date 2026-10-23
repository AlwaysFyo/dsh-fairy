/**
 * "Why does this element look like that" — dumps the CSS rules that set a
 * property on an element and on its ancestors.
 *
 * Usage: node tools/cdp/why.mjs <url> <selector> <propertyFrag> [--no-hdd]
 */
import { openPage } from './client.mjs'

const [, , url, selector, propertyFrag = 'background', ...flags] = process.argv
const wantHdd = !flags.includes('--no-hdd')

if (!url || !selector) {
  console.error('usage: node tools/cdp/why.mjs <url> <selector> <propertyFrag>')
  process.exit(1)
}

const session = await openPage({ timeoutMs: 30000 })
await session.send('Page.enable')
await session.send('Runtime.enable')
await session.send('DOM.enable')
await session.send('CSS.enable')
await session.send('Emulation.setDeviceMetricsOverride', {
  width: 2040,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false,
})

await session.navigate(url)
await session.waitFor("document.querySelector('#root') && document.querySelector('[data-composer-card]')", {
  timeoutMs: 60000,
})
await new Promise((resolve) => setTimeout(resolve, 2500))
await session.evaluate(`(() => {
  const wantHdd = ${wantHdd}
  const on = document.documentElement.hasAttribute('data-dsh-fairy-visual')
  if (on !== wantHdd) document.querySelector('[data-dsh-fairy-hdd-toggle]')?.click()
  return true
})()`)
await new Promise((resolve) => setTimeout(resolve, 1000))

const { root } = await session.send('DOM.getDocument', { depth: 0 })
const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector })
if (!nodeId) {
  console.log(JSON.stringify({ error: `selector not found: ${selector}` }))
  process.exit(0)
}

const facts = await session.evaluate(`(() => {
  const node = document.querySelector(${JSON.stringify(selector)})
  const style = getComputedStyle(node)
  const vars = {}
  for (const name of style) {
    if (!name.startsWith('--dsw-alias')) continue
    const value = style.getPropertyValue(name).trim()
    if (value && /#|rgb|color|white/.test(value)) vars[name] = value
  }
  return {
    tag: node.tagName.toLowerCase(),
    cls: String(node.className || ''),
    computed: {
      backgroundColor: style.backgroundColor,
      color: style.color,
      backgroundImage: style.backgroundImage.slice(0, 60),
    },
    vars,
  }
})()`)

const collect = (rules, inheritedDepth) => {
  const out = []
  for (const entry of rules || []) {
    const rule = entry.rule ?? entry
    const props = rule?.style?.cssProperties ?? []
    const hits = props.filter((prop) => prop.disabled !== true && String(prop.name).includes(propertyFrag))
    if (!hits.length) continue
    out.push({
      depth: inheritedDepth,
      selector: rule.selectorList?.text ?? rule.selectorList?.selectors?.map((s) => s.text).join(', '),
      origin: entry.origin ?? null,
      properties: hits.map((prop) => `${prop.name}: ${prop.value}${prop.important ? ' !important' : ''}`),
    })
  }
  return out
}

const matched = await session.send('CSS.getMatchedStylesForNode', { nodeId })
const report = {
  element: facts,
  ownRules: collect(matched.matchedCSSRules, 0),
  inline: collect(matched.inlineStyle ? [{ rule: { style: matched.inlineStyle, selectorList: { text: '(inline)' } } }] : [], 0),
  inherited: (matched.inherited ?? []).map((layer, index) => ({
    from: layer.matchedCSSRules?.[0]?.rule?.selectorList?.text ?? '(unknown ancestor)',
    depth: index + 1,
    rules: collect(layer.matchedCSSRules, index + 1),
  })),
}

session.close()
console.log(JSON.stringify(report, null, 2))
