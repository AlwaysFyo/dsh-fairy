/**
 * Minimal Chrome DevTools Protocol client.
 *
 * Why this exists: the file sandbox denies `child_process.spawn` with piped
 * stdio (EPERM), so Playwright/Puppeteer — which launch the browser through
 * pipes — cannot run here. Instead the harness starts Chromium itself and this
 * module only talks CDP over a WebSocket, which needs no child process.
 */
import WebSocket from 'ws'

const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9222)

export const listTargets = async () => {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
  if (!response.ok) throw new Error(`CDP /json/list failed: ${response.status}`)
  return response.json()
}

export const waitForBrowser = async ({ timeoutMs = 20000 } = {}) => {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const targets = await listTargets()
      const page = targets.find((target) => target.type === 'page')
      if (page) return page
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`no CDP page target within ${timeoutMs}ms${lastError ? `: ${lastError.message}` : ''}`)
}

export class CdpSession {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    this.listeners = []
    socket.on('message', (raw) => {
      let message
      try {
        message = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`))
        else resolve(message.result)
        return
      }
      if (message.method) for (const listener of this.listeners) listener(message)
    })
  }

  static async open(wsUrl) {
    const socket = new WebSocket(wsUrl, { perMessageDeflate: false })
    await new Promise((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    return new CdpSession(socket)
  }

  send(method, params = {}) {
    const id = this.nextId++
    this.socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`CDP timeout: ${method}`))
        }
      }, 30000)
    })
  }

  on(listener) {
    this.listeners.push(listener)
  }

  async evaluate(expression, { awaitPromise = true } = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
      userGesture: true,
    })
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails
      throw new Error(`evaluate threw: ${detail.exception?.description ?? detail.text}`)
    }
    return result.result?.value
  }

  async navigate(url) {
    await this.send('Page.enable')
    await this.send('Page.navigate', { url })
  }

  async waitFor(expression, { timeoutMs = 30000, intervalMs = 250 } = {}) {
    const deadline = Date.now() + timeoutMs
    let last
    while (Date.now() < deadline) {
      try {
        const value = await this.evaluate(`(() => { try { return !!(${expression}) } catch (e) { return false } })()`)
        if (value) return true
        last = value
      } catch (error) {
        last = error.message
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    throw new Error(`waitFor timed out: ${expression} (last=${String(last)})`)
  }

  close() {
    try {
      this.socket.close()
    } catch {
      /* already closed */
    }
  }
}

export const openPage = async (options) => {
  const page = await waitForBrowser(options)
  return CdpSession.open(page.webSocketDebuggerUrl)
}
