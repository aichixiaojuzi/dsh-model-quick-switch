/** Executable hook lifecycle tests; NOT a real DOM/browser/layout test.
 * node dev/lifecycle.mjs
 * LIFECYCLE_SOURCE=/path/to/old-client.js node dev/lifecycle.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(process.env.LIFECYCLE_SOURCE || new URL('../client.js', import.meta.url), 'utf8')

function harness() {
  let active
  let registration
  let timerId = 0
  let now = 0
  const timers = new Map()
  const listeners = new Set()
  const styles = new Map()
  const memory = new Map()
  const bindings = new Map()
  const resources = []
  const eventTarget = prefix => ({
    addEventListener(type, fn) { listeners.add({ prefix, type, fn }) },
    removeEventListener(type, fn) { for (const item of listeners) if (item.prefix === prefix && item.type === type && item.fn === fn) listeners.delete(item) },
  })
  const document = {
    ...eventTarget('document'), documentElement: { lang: 'en' }, body: {},
    head: { appendChild(node) { styles.set(node.id, node) } },
    getElementById: id => styles.get(id),
    createElement() { return { remove() { styles.delete(this.id) } } },
  }
  const window = {
    ...eventTarget('window'), innerWidth: 1440, innerHeight: 900,
    localStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) },
    setTimeout(fn, delay = 0) { const id = ++timerId; timers.set(id, { at: now + delay, fn }); return id },
    clearTimeout(id) { timers.delete(id) },
    __ModuleLoader__: { load(definition) { window.definition = definition } },
  }
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const React = {
    Fragment: Symbol('Fragment'),
    Component: class { constructor(props) { this.props = props; this.state = {} } },
    createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false) } },
    useState(initial) {
      const runtime = active
      const index = runtime.cursor++
      if (!runtime.hooks[index]) {
        const slot = { value: typeof initial === 'function' ? initial() : initial }
        slot.set = update => {
          assert.equal(runtime.mounted, true, 'setter after unmount')
          const value = typeof update === 'function' ? update(slot.value) : update
          if (!Object.is(value, slot.value)) { slot.value = value; runtime.dirty = true }
        }
        runtime.hooks[index] = slot
      }
      const slot = runtime.hooks[index]
      return [slot.value, slot.set]
    },
    useRef(value) {
      const index = active.cursor++
      return (active.hooks[index] ||= { current: value })
    },
    useCallback(fn, deps) {
      const index = active.cursor++
      const previous = active.hooks[index]
      if (!previous || !sameDeps(previous.deps, deps)) active.hooks[index] = { value: fn, deps }
      return active.hooks[index].value
    },
    useEffect(fn, deps) {
      const index = active.cursor++
      const previous = active.hooks[index]
      if (!previous || !sameDeps(previous.deps, deps)) {
        const slot = { deps, cleanup: previous?.cleanup }
        active.hooks[index] = slot
        active.effects.push(() => { slot.cleanup?.(); slot.cleanup = fn() })
      }
    },
  }
  React.useMemo = (fn, deps) => React.useCallback(fn, deps)()
  React.useLayoutEffect = React.useEffect
  const require = id => {
    if (id === 'react') return React
    if (id === 'react-dom') return { createPortal: (node, container) => ({ type: 'portal', props: { container }, children: [node] }) }
    throw new Error(`unexpected require: ${id}`)
  }
  new Function('window', 'document', 'navigator', source)(window, document, { language: 'en' })
  const module = window.definition.factory(require)
  const scope = {
    modelDirectories: { directoryFor(id) { const value = bindings.get(id); if (value instanceof Error) throw value; return value || null } },
    sessions: { subagentAddress() {} }, locale: { getLocale: () => ({ active: 'en' }) },
    slots: { inject(name, fn) { fn() }, register(options, component) { registration = { options, component }; return () => {} } },
  }
  module.apply({ effect(fn) { resources.push(fn()) }, inject(deps, fn) { fn(scope) } })
  function directory(name) {
    const subscribers = new Set()
    const value = {
      current: { provider: name, model: 'one' }, pending: null, failures: [], status: 'ready', error: null,
      groups: [{ id: name, name, models: [{ id: 'one', name: `${name}-one` }, { id: 'two', name: `${name}-two` }] }],
    }
    const result = {
      name, subscribers, loads: [], selections: [], unsubscribed: 0,
      store: { getSnapshot: () => value, subscribe(fn) { subscribers.add(fn); return () => { subscribers.delete(fn); result.unsubscribed++ } } },
      load(force) { result.loads.push(force); return Promise.resolve(value) },
      select(selection) { result.selections.push(selection); return Promise.resolve({ ok: true }) },
    }
    return result
  }
  const nodes = tree => {
    const result = []
    function visit(node) { if (!node || typeof node !== 'object') return; result.push(node); for (const child of node.children || []) visit(child) }
    visit(tree)
    return result
  }
  function mount(id, extra = {}) {
    const props = { sessionId: id, locked: false, ...registration.options.inject(id), ...extra }
    const boundary = new registration.component(props)
    const inner = boundary.render()
    const Component = inner.children[0].type
    const runtime = {
      hooks: [], cursor: 0, effects: [], dirty: true, mounted: true, props, tree: null,
      flush() {
        for (let pass = 0; this.dirty; pass++) {
          assert.ok(pass < 60, 'render/effect update loop')
          this.dirty = false; this.cursor = 0; this.effects = []; active = this
          this.tree = Component(this.props)
          active = null
          for (const node of nodes(this.tree)) {
            if (node.props.ref) node.props.ref.current = {
              getBoundingClientRect: () => ({ left: 100, top: 650, bottom: 678 }),
              contains: target => target === node,
              focus(options) { runtime.focused = node; runtime.focusOptions = options },
              querySelector: () => runtime.cursorRow || null,
              clientTop: 0, clientHeight: 100, scrollTop: runtime.listScrollTop || 0,
            }
          }
          for (const effect of this.effects) effect()
        }
      },
      update(next) { this.props = { ...this.props, ...next }; this.dirty = true; this.flush() },
      find(className) { return nodes(this.tree).find(node => node.props.className === className) },
      clickOpen() { this.find('dqms-trigger').props.onClick(); this.flush() },
      unmount() { for (const hook of this.hooks) hook?.cleanup?.(); this.mounted = false },
    }
    runtime.flush()
    return runtime
  }
  function advance(runtime, delta) {
    now += delta
    let count = 0
    while (true) {
      const due = [...timers].find(([, item]) => item.at <= now)
      if (!due) break
      assert.ok(count++ < 100, 'timer loop')
      timers.delete(due[0]); due[1].fn(); runtime.flush()
    }
  }
  return { document, window, bindings, directory, mount, advance, registration, timers, listeners, nodes, cleanup() { for (const fn of resources) if (typeof fn === 'function') fn() } }
}

let passed = 0
let failed = 0
async function test(name, fn) {
  const h = harness()
  try { await fn(h); passed++; console.log(`ok ${name}`) }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`) }
  finally { h.cleanup() }
}

await test('closed -> mousedown preventDefault -> click -> open with both columns', h => {
  h.bindings.set('a', h.directory('alpha'))
  const r = h.mount('a')
  assert.equal(r.find('dqms-panel'), undefined)
  let prevented = false
  const trigger = r.find('dqms-trigger')
  assert.equal(typeof trigger.props.onMouseDown, 'function', 'trigger must guard browser mousedown focus')
  trigger.props.onMouseDown({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  r.clickOpen()
  assert.equal(r.find('dqms-trigger').props['aria-expanded'], 'true')
  assert.ok(r.find('dqms-panel')); assert.ok(r.find('dqms-rail')); assert.ok(r.find('dqms-list-wrap'))
  h.advance(r, 0)
  assert.ok(r.focused, 'open effect focuses simulated search ref')
  r.unmount(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0)
})

await test('floating panel and menu portal to body; focus never scrolls host', h => {
  h.bindings.set('a', h.directory('alpha'))
  const r = h.mount('a')
  r.clickOpen(); h.advance(r, 0)
  const portal = h.nodes(r.tree).find(node => node.type === 'portal')
  assert.equal(portal?.props.container, h.document.body)
  assert.deepEqual(r.focusOptions, { preventScroll: true })
  const row = h.nodes(r.tree).find(node => node.props.className === 'dqms-row')
  row.props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 400, clientY: 400 })
  r.flush()
  const floating = h.nodes(r.tree).find(node => node.type === 'portal')
  assert.ok(h.nodes(floating).some(node => node.props.className === 'dqms-menu'))
  assert.ok(!h.nodes(r.find('dqms-panel')).some(node => node.props.className === 'dqms-menu'), 'menu must escape panel clipping too')
  for (const listener of h.listeners) {
    if (listener.prefix === 'document' && listener.type === 'mousedown') listener.fn({ target: r.find('dqms-menu') })
  }
  r.flush()
  assert.ok(r.find('dqms-panel'), 'portal menu mousedown must not close the panel before click')
  r.unmount()
})

await test('keyboard visibility scrolls list only, never scrollIntoView ancestors', h => {
  h.bindings.set('a', h.directory('alpha'))
  const r = h.mount('a')
  let ancestorScrolls = 0
  r.cursorRow = {
    getBoundingClientRect: () => ({ top: 780, bottom: 810 }),
    scrollIntoView() { ancestorScrolls++ },
  }
  r.clickOpen()
  assert.equal(ancestorScrolls, 0, 'opening must not scroll an ancestor')
  r.find('dqms-list').props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
  r.flush()
  const list = r.find('dqms-list').props.ref.current
  assert.equal(list.scrollTop, 60, 'only adjust list by row overflow')
  assert.equal(ancestorScrolls, 0)
  r.unmount()
})

await test('panel fits short narrow viewport without minimum-height overflow', h => {
  h.window.innerWidth = 360; h.window.innerHeight = 240
  h.bindings.set('a', h.directory('alpha'))
  const r = h.mount('a'); r.clickOpen()
  const style = r.find('dqms-panel').props.style
  assert.equal(style.width, '336px'); assert.equal(style.height, '216px')
  assert.ok(parseFloat(style.top) >= 12)
  assert.ok(parseFloat(style.top) + parseFloat(style.height) <= 228)
  r.unmount()
})

await test('same mounted component + new injected resolver replaces directory subscription', h => {
  const old = h.directory('old'); const next = h.directory('next')
  h.bindings.set('a', old)
  const r = h.mount('a')
  assert.equal(old.subscribers.size, 1)
  h.bindings.set('a', next)
  r.update(h.registration.options.inject('a'))
  assert.equal(old.subscribers.size, 0, 'released directory must unsubscribe')
  assert.equal(next.subscribers.size, 1)
  assert.ok(old.unsubscribed > 0)
  assert.ok(h.nodes(r.tree).some(node => node.children.includes('next-one')))
  r.unmount(); assert.equal(next.subscribers.size, 0)
})

await test('opening revalidates unchanged resolver identity returning a new binding', h => {
  const old = h.directory('old'); const next = h.directory('next')
  h.bindings.set('a', old)
  const r = h.mount('a')
  const resolver = r.props.resolveDirectory
  h.bindings.set('a', next)
  r.clickOpen()
  assert.equal(r.props.resolveDirectory, resolver)
  assert.equal(old.subscribers.size, 0)
  assert.equal(next.subscribers.size, 1)
  r.unmount()
})

await test('null/unretained lookup retries, recovers and runs load/select on current session', async h => {
  h.bindings.set('a', new Error('unretained'))
  const r = h.mount('a')
  assert.ok(r.find('dqms-trigger'))
  r.clickOpen()
  assert.ok(r.find('dqms-panel'))
  const next = h.directory('restored')
  h.bindings.set('a', next)
  h.advance(r, 350)
  assert.equal(next.subscribers.size, 1)
  assert.ok(next.loads.length > 0)
  const row = h.nodes(r.tree).find(node => node.props.className === 'dqms-row' && node.props['data-current'] === 'false')
  assert.ok(row)
  row.props.onClick(); r.flush()
  await Promise.resolve(); r.flush()
  assert.deepEqual(next.selections, [{ provider: 'restored', model: 'two' }])
  assert.equal(r.find('dqms-trigger').props['aria-expanded'], 'false')
  r.unmount(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0)
})

await test('switch session props: load/select closures target replacement session', async h => {
  const a = h.directory('alpha'); const b = h.directory('beta')
  h.bindings.set('a', a); h.bindings.set('b', b)
  const r = h.mount('a')
  r.update({ sessionId: 'b', ...h.registration.options.inject('b') })
  assert.equal(a.subscribers.size, 0); assert.equal(b.subscribers.size, 1)
  r.clickOpen(); h.advance(r, 0)
  const row = h.nodes(r.tree).find(node => node.props.className === 'dqms-row' && node.props['data-current'] === 'false')
  row.props.onClick(); await Promise.resolve(); r.flush()
  assert.equal(a.selections.length, 0); assert.equal(b.selections[0].provider, 'beta')
  assert.ok(b.loads.length > 0)
  r.unmount()
})

await test('unmount cancels missing-directory retries, open timers and listeners', h => {
  const r = h.mount('missing')
  r.clickOpen()
  assert.ok(h.timers.size > 0); assert.ok(h.listeners.size > 0)
  r.unmount()
  assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0)
  h.advance(r, 100000)
})

await test('lookup errors are isolated between injected session occupants', h => {
  const good = h.directory('good')
  h.bindings.set('good', good); h.bindings.set('bad', new Error('bad session scope'))
  const a = h.registration.options.inject('good'); const b = h.registration.options.inject('bad')
  a.resolveDirectory(); b.resolveDirectory()
  assert.equal(a.lookupError(), null)
  assert.match(b.lookupError(), /bad session scope/)
})

await test('SeatBoundary fragment key includes session identity', h => {
  const Boundary = h.registration.component
  const a = new Boundary({ sessionId: 'a' }).render()
  const b = new Boundary({ sessionId: 'b' }).render()
  assert.notEqual(a.props.key, b.props.key)
})

console.log(`lifecycle: ${passed} passed, ${failed} failed; simulated hooks/refs only, not real DOM, CSS or browser event validation`)
process.exitCode = failed ? 1 : 0
