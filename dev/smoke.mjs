/**
 * Render smoke test for the browser half.
 *
 * Not a visual check: it materialises the module through a stubbed module
 * loader, stubbed React hooks and a stubbed directory store, then calls the
 * seat component in four states (provider view, search, pinned, recent) to
 * prove none of them throws and each renders the expected rows. Run with:
 *   node dev/smoke.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'client.js'), 'utf8')
const manifest = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'))

/* ------------------------------------------------------------------ stubs */

const memory = new Map()
const localStorageStub = {
  getItem: key => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)) },
  removeItem: key => { memory.delete(key) },
}

const documentStub = {
  head: { appendChild() {} },
  getElementById: () => null,
  createElement: () => ({ id: '', textContent: '', remove() {} }),
  addEventListener() {},
  removeEventListener() {},
}

const windowStub = {
  innerWidth: 1440,
  innerHeight: 900,
  addEventListener() {},
  removeEventListener() {},
  setTimeout,
  clearTimeout,
  localStorage: localStorageStub,
}

let loaded = null
windowStub.__ModuleLoader__ = { load: definition => { loaded = definition } }

/* React stub: state values come from an explicit seed so one call can render
 * the panel-open branch that a real browser reaches only after a click. */
let stateCursor = 0
let stateSeed = []

function buildElement(type, props, children) {
  const flat = []
  const push = value => {
    if (Array.isArray(value)) { value.forEach(push); return }
    if (value === null || value === undefined || value === false || value === true) return
    flat.push(value)
  }
  push(children)
  return { type, props: props || {}, children: flat }
}

const React = {
  Fragment: Symbol('Fragment'),
  Component: class {
    constructor(props) { this.props = props; this.state = {} }
    setState(update) {
      const patch = typeof update === 'function' ? update(this.state) : update
      this.state = Object.assign({}, this.state, patch)
    }
  },
  createElement(type, props, ...children) {
    if (type === React.Fragment) return buildElement('fragment', props, children)
    return buildElement(type, props, children)
  },
  useState(initial) {
    const index = stateCursor
    stateCursor += 1
    // Hook 0 is the directory resolver added ahead of the snapshot hook; the
    // seed maps below are written against the older numbering.
    const seeded = stateSeed[index - 1]
    return [seeded !== undefined ? seeded : (typeof initial === 'function' ? initial() : initial), () => {}]
  },
  useEffect() {},
  useRef(value) { return { current: value } },
  useCallback(fn) { return fn },
  useMemo(fn) { return fn() },
}

const requireStub = id => {
  if (id === 'react' || id === 'react/jsx-runtime') return React
  throw new Error('smoke: unexpected require(' + id + ')')
}

/** Expand a tree the way React would: run function and class components. */
function expand(node, depth = 0) {
  if (depth > 40 || !node || typeof node !== 'object') return node
  const type = node.type
  if (typeof type === 'function') {
    const isClass = Boolean(type.prototype && type.prototype.render)
    const child = isClass ? new type(node.props).render() : type(node.props)
    return expand(child, depth + 1)
  }
  node.children = (node.children || []).map(child => expand(child, depth + 1))
  return node
}

function renderComponent(component, props) {
  return expand({ type: component, props, children: [] })
}

/* --------------------------------------------------------------- fixtures */

function state() {
  const reasoning = { defaultEffort: 'high', efforts: [{ id: 'low', name: '低' }, { id: 'medium', name: '中' }, { id: 'high', name: '高' }] }
  return {
    current: { provider: 'deepseek', model: 'deepseek-v4-flash', reasoningEffort: 'high' },
    routable: true,
    groups: [
      {
        id: 'deepseek',
        name: 'DeepSeek',
        models: [
          { id: 'deepseek-v4-flash', name: 'deepseek-v4-flash', reasoning },
          { id: 'deepseek-v4-pro', name: 'deepseek-v4-pro' },
        ],
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        models: [
          { id: 'claude-sonnet', name: 'claude-sonnet', badge: { text: '新' } },
          { id: 'gemini-flash', name: 'gemini-flash' },
        ],
      },
      {
        id: 'openrouter',
        name: 'OpenRouter (duplicate snapshot)',
        models: [{ id: 'duplicate-model', name: 'duplicate-model' }],
      },
      {
        id: 'deepseek-account',
        name: 'DeepSeek Account',
        models: [{ id: 'chat-pro', name: 'chat-pro', reasoning }],
      },
    ],
    failures: [{ id: 'broken-vendor', name: 'Broken Vendor', message: '401 unauthorized' }],
    status: 'ready',
    pending: null,
    error: null,
  }
}

let selectCalls = []
let loadCalls = 0
const directoryLoadArgs = []
const propLoadArgs = []
function makeDirectory() {
  return {
    store: {
      getSnapshot: () => state(),
      subscribe: () => () => {},
    },
    load: force => { loadCalls += 1; directoryLoadArgs.push(force); return Promise.resolve(state()) },
    select: selection => { selectCalls.push(selection); return Promise.resolve({ ok: true, value: undefined }) },
  }
}

/* ---------------------------------------------------------------- harness */

localStorageStub.setItem('dsh.model-quick-switch.v1', JSON.stringify({
  providerOrder: [],
  modelOrder: {},
  favorites: ['openrouter/claude-sonnet', 'deepseek/deepseek-v4-pro'],
  recent: ['deepseek/deepseek-v4-pro'],
}))

function collect(node, out, depth = 0) {
  if (depth > 80) return out
  if (typeof node === 'string') { out.push(node); return out }
  if (!node || typeof node !== 'object') return out
  const className = node.props && node.props.className
  if (typeof className === 'string') out.push(className)
  for (const child of node.children || []) collect(child, out, depth + 1)
  return out
}

function textOf(tree) { return collect(tree, []).join(' | ') }

function runScenario(name, seed, extra) {
  const directory = makeDirectory()
  stateCursor = 0
  stateSeed = seed
  const injected = extra.inject({
    available: true,
    copy: extra.copy,
    directory: directory.store,
    load: force => { propLoadArgs.push(force); return directory.load(force) },
    select: selection => directory.select(selection),
  })
  stateCursor = 0
  stateSeed = seed
  let tree
  try {
    tree = renderComponent(extra.Component, Object.assign(
      { sessionId: 'session-1', locked: false },
      injected,
      { resolveDirectory: () => directory, directory: directory.store },
      extra.props || {},
    ))
  } catch (error) {
    console.error('FAIL', name, '—', error && error.stack ? error.stack : error)
    process.exitCode = 1
    return
  }
  const text = textOf(tree)
  const checks = extra.expect || []
  const missing = checks.filter(needle => !text.includes(needle))
  if (missing.length > 0) {
    console.error('FAIL', name, '— missing:', missing.join(', '), '\nrendered:', text)
    process.exitCode = 1
    return
  }
  console.log('ok  ', name)
}

/* ------------------------------------------------------------------- main */

new Function('window', 'document', 'require', source)(windowStub, documentStub, requireStub)
if (!loaded) throw new Error('smoke: module loader did not capture the definition')
if (loaded.id !== manifest.name) {
  throw new Error(`smoke: the client module id must equal the package name (module "${loaded.id}", package "${manifest.name}")`)
}
const module = loaded.factory(requireStub)

let registration = null
const scope = {
  slots: {
    inject(key, callback) { callback() },
    register(options, component) { registration = { options, component }; return () => {} },
  },
  modelDirectories: { directoryFor: () => makeDirectory() },
  sessions: { subagentAddress: () => undefined },
  locale: { getLocale: () => ({ active: 'zh', locales: [], revision: 0 }) },
}
let requestedDeps = null
const ctx = {
  effect(callback) { callback() },
  inject(deps, callback) { requestedDeps = deps; callback(scope) },
}
module.apply(ctx)
if (!registration) throw new Error('smoke: seat was not registered')
if (registration.options.name !== 'conversation.input.model') throw new Error('smoke: unexpected seat ' + registration.options.name)

// Cordis instantiates modelDirectories inside the accessing scope, and its own
// directory resolver reads ctx.remote.session, so the scope must declare it.
check('scope declares remote.session for the directory service', Array.isArray(requestedDeps) && requestedDeps.includes('remote.session'), true)
check('module declares the same injections', Array.isArray(module.inject) && module.inject.includes('remote.session'), true)

const seedBase = {}
function seedWith(overrides) {
  const seed = Object.assign({}, seedBase, overrides)
  return seed
}
const box = { left: 40, top: 40, width: 560, height: 396 }

// Hook slots: 0 = directory snapshot, 1 = preferences, 2 = open, 3 = query,
// 4 = active rail key, 5 = cursor, 6 = panel box, 7 = busy.
const base = { 6: box }

runScenario('trigger only (closed)', seedWith({}), {
  inject: registration.options.inject,
  copy: registration.options.inject('s').copy,
  Component: registration.component,
  expect: ['deepseek-v4-flash'],
})

runScenario('provider view', seedWith(Object.assign({ 2: true }, base)), {
  inject: registration.options.inject,
  copy: registration.options.inject('s').copy,
  Component: registration.component,
  expect: ['OpenRouter', 'DeepSeek', 'deepseek-v4-pro', 'dqms-panel'],
})

runScenario('search across providers', seedWith(Object.assign({ 2: true, 3: 'clau' }, base)), {
  inject: registration.options.inject,
  copy: registration.options.inject('s').copy,
  Component: registration.component,
  expect: ['claude-sonnet', 'OpenRouter'],
})

runScenario('pinned view', seedWith(Object.assign({ 2: true, 4: 'favorites' }, base)), {
  inject: registration.options.inject,
  copy: registration.options.inject('s').copy,
  Component: registration.component,
  expect: ['claude-sonnet', 'deepseek-v4-pro', 'dqms-star'],
})

runScenario('recent view', seedWith(Object.assign({ 2: true, 4: 'recent' }, base)), {
  inject: registration.options.inject,
  copy: registration.options.inject('s').copy,
  Component: registration.component,
  expect: ['deepseek-v4-pro'],
})

runScenario('failed provider', seedWith(Object.assign({ 2: true, 4: 'broken-vendor' }, base)), {
  inject: registration.options.inject,
  copy: registration.options.inject('s').copy,
  Component: registration.component,
  expect: ['401 unauthorized'],
})

console.log(process.exitCode ? 'smoke: FAILED' : 'smoke: all scenarios rendered')

/* ------------------------------------------------------------- behaviour */

function findAll(node, predicate, out = [], depth = 0) {
  if (depth > 80 || !node || typeof node !== 'object') return out
  if (predicate(node)) out.push(node)
  for (const child of node.children || []) findAll(child, predicate, out, depth + 1)
  return out
}

function mount(seed) {
  const directory = makeDirectory()
  stateCursor = 0
  stateSeed = seed
  const injected = registration.options.inject('session-1')
  stateCursor = 0
  stateSeed = seed
  const tree = renderComponent(registration.component, Object.assign(
    { sessionId: 'session-1', locked: false },
    injected,
    { resolveDirectory: () => directory, directory: directory.store },
  ))
  return { tree, directory }
}

function check(name, actual, expected) {
  const got = JSON.stringify(actual)
  const want = JSON.stringify(expected)
  if (got === want) { console.log('ok  ', name); return }
  console.error('FAIL', name, '\n  got     ', got, '\n  expected', want)
  process.exitCode = 1
}

const openSeed = Object.assign({ 2: true }, base)
selectCalls = []
memory.delete('dsh.model-quick-switch.v1')
localStorageStub.setItem('dsh.model-quick-switch.v1', JSON.stringify({
  providerOrder: [], modelOrder: {}, favorites: [], recent: [],
}))

const first = mount(openSeed)
const rows = findAll(first.tree, node => node.props && node.props.className === 'dqms-row')
const proRow = rows.find(node => textOf(node).includes('deepseek-v4-pro'))
if (!proRow) {
  console.error('FAIL click wiring — row not found')
  process.exitCode = 1
} else {
  proRow.props.onClick()
  check('click wiring', selectCalls, [{ provider: 'deepseek', model: 'deepseek-v4-pro' }])
}

const flashRow = rows.find(node => textOf(node).includes('deepseek-v4-flash'))
const starButtons = findAll(flashRow, node => node.props && node.props.className === 'dqms-star')
if (starButtons.length !== 1) {
  console.error('FAIL pin wiring — star not found')
  process.exitCode = 1
} else {
  starButtons[0].props.onClick({ stopPropagation() {} })
  const stored = JSON.parse(localStorageStub.getItem('dsh.model-quick-switch.v1'))
  check('pin appends to favourites', stored.favorites.slice(-1), ['deepseek/deepseek-v4-flash'])
}

// Provider drag: move the second rail row onto the first and read the saved order.
const railRows = findAll(first.tree, node => node.props && node.props.className === 'dqms-rail-item')
const providers = railRows.filter(node => node.props.draggable === true)
if (providers.length < 2) {
  console.error('FAIL provider drag — fewer than two draggable providers')
  process.exitCode = 1
} else {
  const event = { preventDefault() {}, dataTransfer: { setData() {}, effectAllowed: '' }, currentTarget: { dataset: {} } }
  providers[1].props.onDragStart(event)
  providers[0].props.onDragOver(event)
  providers[0].props.onDragEnd(event)
  const stored = JSON.parse(localStorageStub.getItem('dsh.model-quick-switch.v1'))
  check('provider drag saves order', stored.providerOrder, ['deepseek', 'deepseek-account', 'openrouter'])
}

// Model drag inside one provider.
const modelRows = findAll(first.tree, node => node.props && node.props.className === 'dqms-row' && node.props.draggable === true)
if (modelRows.length >= 2) {
  const event = { preventDefault() {}, dataTransfer: { setData() {}, effectAllowed: '' }, currentTarget: { dataset: {} } }
  modelRows[1].props.onDragStart(event)
  modelRows[0].props.onDragOver(event)
  modelRows[0].props.onDragEnd(event)
  const stored = JSON.parse(localStorageStub.getItem('dsh.model-quick-switch.v1'))
  check('model drag saves order', stored.modelOrder.deepseek, ['deepseek-v4-pro', 'deepseek-v4-flash'])
} else {
  console.error('FAIL model drag — fewer than two draggable rows')
  process.exitCode = 1
}

console.log(process.exitCode ? 'smoke: FAILED' : 'smoke: behaviour checks passed')

/* ------------------------------------------------- highlight and language */

function cursorRows(tree) {
  return findAll(tree, node => node.props && node.props['data-cursor'] === 'true')
}

// Hook slot 8 is the keyboard-cursor flag. Pointer-only interaction must not
// leave a highlight behind, so nothing is marked until a key moves the cursor.
const pointerOnly = mount(Object.assign({ 2: true, 8: false }, base))
check('no highlight before keyboard navigation', cursorRows(pointerOnly.tree).length, 0)

const keyboardOn = mount(Object.assign({ 2: true, 5: 1, 8: true }, base))
check('one highlight once keyboard navigation starts', cursorRows(keyboardOn.tree).length, 1)

function copyFor(localeSnapshot) {
  let registered = null
  const localeScope = {
    slots: { inject(key, callback) { callback() }, register(options) { registered = options; return () => {} } },
    modelDirectories: { directoryFor: () => makeDirectory() },
    sessions: { subagentAddress: () => undefined },
    locale: { getLocale: () => localeSnapshot },
  }
  module.apply({ effect(callback) { callback() }, inject(deps, callback) { callback(localeScope) } })
  return registered.inject('session-1').copy
}

const zhCopy = copyFor({ active: 'zh', locales: [], revision: 0 })
check('zh placeholder', zhCopy.searchPlaceholder, '搜索模型或供应商…')
check('zh rail labels', [zhCopy.favorites, zhCopy.recent], ['收藏', '最近'])

const enCopy = copyFor({ active: 'en', locales: [], revision: 0 })
check('en placeholder', enCopy.searchPlaceholder, 'Search models or providers…')
check('en rail labels', [enCopy.favorites, enCopy.recent], ['Pinned', 'Recent'])

// A snapshot spelling we did not expect must still find Chinese through the
// document language, so a shape change cannot silently starve translations.
documentStub.documentElement = { lang: 'zh-CN' }
const viaDocument = copyFor({})
check('document language fallback', viaDocument.favorites, '收藏')
delete documentStub.documentElement

console.log(process.exitCode ? 'smoke: FAILED' : 'smoke: highlight and language checks passed')

/* ------------------------------------------- provider menu and preferences */

const PREFS_STORAGE = 'dsh.model-quick-switch.v1'

function resetPrefs(overrides) {
  localStorageStub.setItem(PREFS_STORAGE, JSON.stringify(Object.assign({
    providerOrder: [], modelOrder: {}, favorites: [], recent: [], aliases: {}, defaultProvider: '',
  }, overrides)))
}

// Each fresh module instance re-reads storage, so per-test preferences do not
// leak into the next case.
function freshRegistration(localeSnapshot) {
  new Function('window', 'document', 'require', source)(windowStub, documentStub, requireStub)
  const mod = loaded.factory(requireStub)
  let registered = null
  const localeScope = {
    slots: { inject(key, callback) { callback() }, register(options, component) { registered = { options, component }; return () => {} } },
    modelDirectories: { directoryFor: () => makeDirectory() },
    sessions: { subagentAddress: () => undefined },
    locale: { getLocale: () => localeSnapshot || { active: 'zh', locales: [], revision: 0 } },
  }
  mod.apply({ effect(callback) { callback() }, inject(deps, callback) { callback(localeScope) } })
  return registered
}

function mountWith(reg, seed) {
  const directory = makeDirectory()
  stateCursor = 0
  stateSeed = seed
  const injected = reg.options.inject('session-1')
  stateCursor = 0
  stateSeed = seed
  const tree = renderComponent(reg.component, Object.assign(
    { sessionId: 'session-1', locked: false },
    injected,
    { resolveDirectory: () => directory, directory: directory.store },
  ))
  return { tree, directory }
}

// Hook slots: 9 = context menu, 10 = inline rename, 11 = reload tick,
// 12 = reload-in-flight flag.
resetPrefs()
const menuTree = mountWith(freshRegistration(), Object.assign({ 2: true }, base, {
  9: { kind: 'provider', id: 'deepseek', left: 120, top: 200, width: 226 },
})).tree
const menuItems = findAll(menuTree, node => node.props && node.props.className === 'dqms-menu-item')
check('context menu item count', menuItems.length, 10)
check('context menu starts with rename', textOf(menuItems[0]).includes('重命名'), true)
check('context menu has provider refresh', menuItems.some(item => textOf(item).includes('刷新供应商与模型')), true)
check('context menu ends with delete', textOf(menuItems[menuItems.length - 1]).includes('从面板删除'), true)

const renameTree = mountWith(freshRegistration(), Object.assign({ 2: true }, base, {
  10: { id: 'deepseek', value: '主号' },
})).tree
const renameInput = findAll(renameTree, node => node.props && node.props.className === 'dqms-rail-input')
check('inline rename input rendered', renameInput.length, 1)
check('inline rename keeps the typed value', renameInput[0].props.value, '主号')

resetPrefs({ aliases: { openrouter: '主号渠道' } })
const aliasTree = mountWith(freshRegistration(), Object.assign({ 2: true }, base)).tree
check('alias replaces the rail label', textOf(aliasTree).includes('主号渠道'), true)
const aliasSearch = mountWith(freshRegistration(), Object.assign({ 2: true, 3: '主号' }, base)).tree
check('alias participates in search', textOf(aliasSearch).includes('claude-sonnet'), true)

resetPrefs({ defaultProvider: 'openrouter' })
const defaultTree = mountWith(freshRegistration(), Object.assign({ 2: true }, base)).tree
check('default provider opens its own pane', textOf(defaultTree).includes('gemini-flash'), true)
check('default provider is marked once', findAll(defaultTree, node => node.props && node.props.className === 'dqms-rail-dot').length, 1)

resetPrefs()
// No provider filter input any more: the rail starts straight with the pinned
// and recent views, whatever the provider count is.
const railNames = findAll(mountWith(freshRegistration(), Object.assign({ 2: true }, base)).tree,
  node => node.props && node.props.className === 'dqms-rail-name')
  .map(node => textOf(node).replace('dqms-rail-name | ', ''))
check('rail lists usable providers, no filter box', railNames,
  ['收藏', '最近', 'DeepSeek 账号', 'DeepSeek', 'OpenRouter'])
check('failed providers stay out of the rail', railNames.includes('Broken Vendor'), false)
check('duplicate provider id is removed', textOf(mountWith(freshRegistration(), Object.assign({ 2: true }, base)).tree)
  .includes('duplicate-model'), false)
const railFilters = findAll(mountWith(freshRegistration(), Object.assign({ 2: true }, base)).tree,
  node => node.props && node.props.className === 'dqms-rail-filter')
check('provider filter box is gone', railFilters.length, 0)

/* --- model rename (right-click a row) ------------------------------------ */

resetPrefs()
const modelMenuTree = mountWith(freshRegistration(), Object.assign({ 2: true }, base, {
  9: { kind: 'model', key: 'deepseek/deepseek-v4-pro', provider: 'deepseek', left: 300, top: 200, width: 226 },
})).tree
const modelMenuItems = findAll(modelMenuTree, node => node.props && node.props.className === 'dqms-menu-item')
check('model menu item count', modelMenuItems.length, 3)
check('model menu starts with rename', textOf(modelMenuItems[0]).includes('重命名'), true)
check('model menu offers the alias reset', textOf(modelMenuItems[1]).includes('恢复原名'), true)

const modelRenameTree = mountWith(freshRegistration(), Object.assign({ 2: true }, base, {
  10: { kind: 'model', key: 'deepseek/deepseek-v4-pro', value: '代码模型' },
})).tree
const modelRenameInput = findAll(modelRenameTree, node => node.props && node.props.className === 'dqms-rail-input dqms-row-input')
check('model rename input rendered', modelRenameInput.length, 1)
check('model rename keeps the typed value', modelRenameInput[0].props.value, '代码模型')

resetPrefs({ modelAliases: { 'deepseek/deepseek-v4-pro': '代码模型' } })
check('model alias replaces the row label',
  textOf(mountWith(freshRegistration(), Object.assign({ 2: true }, base)).tree).includes('代码模型'), true)
check('model alias participates in search',
  textOf(mountWith(freshRegistration(), Object.assign({ 2: true, 3: '代码' }, base)).tree).includes('代码模型'), true)

/* --- delete a provider from the panel, then restore it -------------------- */

resetPrefs()
const deleteItems = findAll(mountWith(freshRegistration(), Object.assign({ 2: true }, base, {
  9: { kind: 'provider', id: 'deepseek', left: 120, top: 200, width: 226 },
})).tree, node => node.props && node.props.className === 'dqms-menu-item')
const deleteItem = deleteItems.find(node => textOf(node).includes('从面板删除'))
deleteItem.props.onClick({ stopPropagation() {} })
check('delete writes the hidden list', JSON.parse(localStorageStub.getItem(PREFS_STORAGE)).hiddenProviders, ['deepseek'])

const hiddenTree = mountWith(freshRegistration(), Object.assign({ 2: true, 4: 'favorites' }, base)).tree
const hiddenNames = findAll(hiddenTree, node => node.props && node.props.className === 'dqms-rail-name')
  .map(node => textOf(node).replace('dqms-rail-name | ', ''))
check('deleted provider leaves usable providers in the rail', hiddenNames,
  ['收藏', '最近', 'DeepSeek 账号', 'OpenRouter'])
check('deleted provider leaves the pinned list', textOf(hiddenTree).includes('deepseek-v4-pro'), false)
check('deleted provider keeps a restore row',
  findAll(hiddenTree, node => node.props && node.props.className === 'dqms-rail-restore').length, 1)
check('restore row counts what was removed', textOf(hiddenTree).includes('已删除 1 个'), true)

const restoreButtons = findAll(hiddenTree, node => node.props && node.props.className === 'dqms-rail-restore')
restoreButtons[0].props.onClick()
check('restore clears the hidden list', JSON.parse(localStorageStub.getItem(PREFS_STORAGE)).hiddenProviders, [])

resetPrefs({ hiddenProviders: ['deepseek', 'openrouter', 'deepseek-account'] })
check('everything removed explains itself',
  textOf(mountWith(freshRegistration(), Object.assign({ 2: true }, base)).tree).includes('所有供应商都已从这个面板删除'), true)
check('everything removed still offers the way back',
  textOf(mountWith(freshRegistration(), Object.assign({ 2: true }, base)).tree).includes('恢复'), true)

/* --- provider-menu refresh ------------------------------------------------ */

resetPrefs()
loadCalls = 0
const providerRefreshMount = mountWith(freshRegistration(), Object.assign({ 2: true, 9: {
  kind: 'provider', id: 'deepseek', left: 120, top: 200, width: 226,
} }, base))
const providerRefreshItems = findAll(providerRefreshMount.tree,
  node => node.props && node.props.className === 'dqms-menu-item')
const providerRefreshItem = providerRefreshItems.find(item => textOf(item).includes('刷新供应商与模型'))
check('provider menu refreshes the catalog', Boolean(providerRefreshItem), true)
providerRefreshItem.props.onClick({ stopPropagation() {} })
check('provider menu refresh forces current-session sync', directoryLoadArgs[directoryLoadArgs.length - 1], true)

const failTree = mountWith(freshRegistration(), Object.assign({ 2: true, 4: 'broken-vendor' }, base)).tree
check('failed provider offers a retry', textOf(failTree).includes('重试'), true)

const searchBadge = mountWith(freshRegistration(), Object.assign({ 2: true, 3: 'claude' }, base)).tree
check('model badge renders', findAll(searchBadge, node => node.props && node.props.className === 'dqms-badge').length, 1)

/* --- seat resilience: the button must survive a missing directory --------- */

const noDirectoryProps = Object.assign(
  { sessionId: 'session-1', locked: false },
  registration.options.inject('session-1'),
  { resolveDirectory: () => null, directory: undefined },
)
const noDirectoryTree = renderComponent(registration.component, noDirectoryProps)
check('no directory yet: trigger still renders', textOf(noDirectoryTree).includes('dqms-trigger'), true)
check('no directory yet: label falls back to the placeholder', textOf(noDirectoryTree).includes('选择模型'), true)

const subagentTree = renderComponent(registration.component, Object.assign({}, noDirectoryProps, { subagent: true }))
check('subagent session: seat stays empty on purpose', textOf(subagentTree).includes('dqms-seat'), false)

/* An empty but loaded catalog must say so instead of looking like a search
 * that matched nothing, and must offer the retry that heals it. */
const emptyDirectory = {
  store: {
    getSnapshot: () => ({ current: null, routable: false, groups: [], failures: [], status: 'ready', pending: null, error: null }),
    subscribe: () => () => {},
  },
  load: () => Promise.resolve(),
  select: () => Promise.resolve({ ok: true }),
}
runScenario('empty catalog offers a retry', seedWith({ 2: true }), {
  inject: registration.options.inject,
  copy: registration.options.inject('s').copy,
  Component: registration.component,
  props: { resolveDirectory: () => emptyDirectory, directory: undefined },
  expect: ['这个会话暂时没有可用的供应商', '重试'],
})

console.log(process.exitCode ? 'smoke: FAILED' : 'smoke: provider menu and preference checks passed')
