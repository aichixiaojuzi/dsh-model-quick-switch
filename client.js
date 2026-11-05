/**
 * Quick Model Switch — browser half.
 *
 * Takes over the composer's `conversation.input.model` seat and renders a
 * provider-first panel: every provider is visible in the left rail, the right
 * pane lists that provider's models. Providers, models, favourites and the
 * recent list can all be reordered by dragging (or Alt+Arrow). Every switch
 * goes through the shipped `ctx.modelDirectories` service, so the /model popup
 * and this seat never disagree, and a Host rejection surfaces inline.
 */
window.__ModuleLoader__.load({
  id: '@aichixiaojuzi/dsh-model-quick-switch',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const { useCallback, useEffect, useRef, useState } = React
    const h = React.createElement

    /* ------------------------------------------------------------------ copy */

    const COPY = {
      en: {
        title: 'Model',
        selectModel: 'Select model',
        searchPlaceholder: 'Search models or providers…',
        clear: 'Clear search',
        favorites: 'Pinned',
        recent: 'Recent',
        results: 'Results',
        emptyFavorites: 'No pinned models yet. Use the star on any model.',
        emptyRecent: 'No recent switches yet.',
        searching: 'No model matches that search.',
        loading: 'Loading catalog…',
        failed: 'This provider failed to load',
        hint: 'Drag rows or press Alt+↑/↓ to reorder',
        reset: 'Reset order',
        star: 'Pin this model',
        unstar: 'Unpin this model',
        effort: 'Reasoning effort',
        account: 'DeepSeek Account',
        unavailable: 'Not in catalog',
        retry: 'Retry',
        menuRename: 'Rename',
        menuDefaultOn: 'Open the panel here',
        menuDefaultOff: 'Stop opening here',
        menuPin: 'Move to top',
        menuUp: 'Move up',
        menuDown: 'Move down',
        menuResetModels: 'Reset this group’s model order',
        menuFavoriteAll: 'Pin all its models',
        menuClearFavorites: 'Unpin all its models',
        menuReload: 'Refresh providers and models',
        menuDelete: 'Delete from this panel',
        menuDeleteHint: 'Removes the provider from this panel only — restore it from the rail. Your profile configuration is not touched.',
        menuUnrename: 'Reset to catalog name',
        reloadModels: 'Reload providers and models',
        reloading: 'Reloading…',
        hiddenRow: n => `${n} removed`,
        hiddenAll: 'Every provider has been removed from this panel.',
        restore: 'Restore',
        menuHint: 'Right-click for rename, order and pin actions',
        rowHint: 'Right-click a model to rename or pin it',
        broken: 'The model switcher hit an error.',
        emptyCatalog: 'No providers are available in this session yet.',
        renamePlaceholder: 'Display name',
        renameHint: 'Enter saves · Esc cancels · empty restores the catalog name',
        count: n => `${n}`,
      },
      zh: {
        title: '模型',
        selectModel: '选择模型',
        searchPlaceholder: '搜索模型或供应商…',
        clear: '清除搜索',
        favorites: '收藏',
        recent: '最近',
        results: '搜索结果',
        emptyFavorites: '还没有收藏。点模型右侧的星标即可收藏。',
        emptyRecent: '还没有切换记录。',
        searching: '没有匹配的模型。',
        loading: '正在加载模型目录…',
        failed: '该供应商加载失败',
        hint: '拖拽可排序，或按 Alt+↑/↓ 移动',
        reset: '重置排序',
        star: '收藏该模型',
        unstar: '取消收藏',
        effort: '推理强度',
        account: 'DeepSeek 账号',
        unavailable: '不在目录中',
        retry: '重试',
        menuRename: '重命名',
        menuDefaultOn: '打开面板时默认选它',
        menuDefaultOff: '取消默认打开',
        menuPin: '置顶',
        menuUp: '上移',
        menuDown: '下移',
        menuResetModels: '重置该组模型顺序',
        menuFavoriteAll: '全部加入收藏',
        menuClearFavorites: '清空该组收藏',
        menuReload: '刷新供应商与模型',
        menuDelete: '从面板删除',
        menuDeleteHint: '只从这个面板移除，随时可从左栏底部恢复；不会删除 profile 里的供应商配置',
        menuUnrename: '恢复原名',
        reloadModels: '重新加载供应商与模型',
        reloading: '正在重新加载…',
        hiddenRow: n => `已删除 ${n} 个`,
        hiddenAll: '所有供应商都已从这个面板删除。',
        restore: '恢复',
        menuHint: '右键可重命名、排序、收藏',
        rowHint: '右键模型可重命名或收藏',
        broken: '模型选择器出错了。',
        emptyCatalog: '这个会话暂时没有可用的供应商。',
        renamePlaceholder: '显示名称',
        renameHint: '回车保存 · Esc 取消 · 留空恢复原名',
        count: n => `${n}`,
      },
    }

    function pickCopy(localeId) {
      const id = String(localeId || '').toLowerCase()
      return id.startsWith('zh') ? COPY.zh : COPY.en
    }

    function localeCandidates(service) {
      const found = []
      const push = value => {
        if (typeof value === 'string' && value.trim() !== '') found.push(value)
      }
      try {
        const snapshot = service && typeof service.getLocale === 'function' ? service.getLocale() : null
        if (typeof snapshot === 'string') {
          push(snapshot)
        } else if (snapshot) {
          // LocaleSnapshot.active is the authoritative field; the rest are
          // tolerated spellings so a future snapshot shape cannot silently
          // starve this plugin of its translation.
          push(snapshot.active)
          push(snapshot.id)
          push(snapshot.localeId)
          push(snapshot.language)
        }
      } catch (error) { /* locale service unavailable */ }
      try { push(document.documentElement.lang) } catch (error) { /* no document */ }
      try { push(navigator.language) } catch (error) { /* no navigator */ }
      return found
    }

    function pickCopy(service) {
      for (const candidate of localeCandidates(service)) {
        const id = candidate.toLowerCase()
        if (id.startsWith('zh')) return COPY.zh
        if (id.startsWith('en')) return COPY.en
      }
      return COPY.en
    }

    /* ------------------------------------------------------------ preferences */

    const PREFS_KEY = 'dsh.model-quick-switch.v1'
    const EMPTY_PREFS = {
      providerOrder: [],
      modelOrder: {},
      favorites: [],
      recent: [],
      aliases: {},
      modelAliases: {},
      hiddenProviders: [],
      defaultProvider: '',
    }
    const prefsListeners = new Set()
    let prefsCache

    function stringArray(value) {
      return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
    }

    /** Aliases are display-only: trimmed, capped, empty ones dropped. */
    function readAliasMap(raw, into) {
      if (!raw || typeof raw !== 'object') return
      for (const key of Object.keys(raw)) {
        const value = raw[key]
        if (typeof value === 'string' && value.trim() !== '') into[key] = value.trim().slice(0, 40)
      }
    }

    function sanitizePrefs(raw) {
      const next = {
        providerOrder: [],
        modelOrder: {},
        favorites: [],
        recent: [],
        aliases: {},
        modelAliases: {},
        hiddenProviders: [],
        defaultProvider: '',
      }
      if (!raw || typeof raw !== 'object') return next
      next.providerOrder = stringArray(raw.providerOrder)
      next.favorites = stringArray(raw.favorites)
      next.recent = stringArray(raw.recent).slice(0, 12)
      next.hiddenProviders = stringArray(raw.hiddenProviders)
      next.defaultProvider = typeof raw.defaultProvider === 'string' ? raw.defaultProvider : ''
      if (raw.modelOrder && typeof raw.modelOrder === 'object') {
        for (const key of Object.keys(raw.modelOrder)) {
          const list = stringArray(raw.modelOrder[key])
          if (list.length > 0) next.modelOrder[key] = list
        }
      }
      readAliasMap(raw.aliases, next.aliases)
      readAliasMap(raw.modelAliases, next.modelAliases)
      return next
    }

    function readPrefs() {
      if (prefsCache !== undefined) return prefsCache
      let raw = null
      try {
        const text = window.localStorage.getItem(PREFS_KEY)
        if (text) raw = JSON.parse(text)
      } catch (error) { raw = null }
      prefsCache = sanitizePrefs(raw)
      return prefsCache
    }

    function writePrefs(next) {
      prefsCache = sanitizePrefs(next)
      try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefsCache)) } catch (error) { /* private mode */ }
      for (const listener of prefsListeners) {
        try { listener() } catch (error) { /* one bad subscriber must not block others */ }
      }
    }

    function updatePrefs(mutate) {
      const base = readPrefs()
      const next = {
        providerOrder: base.providerOrder.slice(),
        modelOrder: Object.assign({}, base.modelOrder),
        favorites: base.favorites.slice(),
        recent: base.recent.slice(),
        aliases: Object.assign({}, base.aliases),
        modelAliases: Object.assign({}, base.modelAliases),
        hiddenProviders: base.hiddenProviders.slice(),
        defaultProvider: base.defaultProvider,
      }
      mutate(next)
      writePrefs(next)
    }

    function usePrefs() {
      const [, bump] = useState(0)
      useEffect(() => {
        const listener = () => bump(value => value + 1)
        prefsListeners.add(listener)
        return () => { prefsListeners.delete(listener) }
      }, [])
      return readPrefs()
    }

    /* --------------------------------------------------------------- helpers */

    function readSnapshot(store) {
      try {
        return store && typeof store.getSnapshot === 'function' ? store.getSnapshot() : undefined
      } catch (error) { return undefined }
    }

    function useSnapshot(store) {
      const [snapshot, setSnapshot] = useState(() => readSnapshot(store))
      useEffect(() => {
        setSnapshot(readSnapshot(store))
        if (!store || typeof store.subscribe !== 'function') return undefined
        const unsubscribe = store.subscribe(() => setSnapshot(readSnapshot(store)))
        return typeof unsubscribe === 'function' ? unsubscribe : undefined
      }, [store])
      return snapshot
    }

    function keyOf(providerId, modelId) { return providerId + '/' + modelId }

    function splitKey(key) {
      const at = key.indexOf('/')
      return at < 0 ? null : { provider: key.slice(0, at), model: key.slice(at + 1) }
    }

    /** Keep saved ids in their saved order, then append ids the user has never seen. */
    function orderIds(saved, ids) {
      const known = new Set(ids)
      const seen = new Set()
      const head = []
      for (const id of saved || []) {
        if (!known.has(id) || seen.has(id)) continue
        head.push(id)
        seen.add(id)
      }
      for (const id of ids) if (!seen.has(id)) head.push(id)
      return head
    }

    function moveItem(list, from, to) {
      if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
      const next = list.slice()
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    }

    /** Official provider order: the account route, then the API-key route, then catalog order. */
    function officialProviderOrder(groups) {
      return groups
        .map((group, index) => ({
          id: group.id,
          rank: group.id === 'deepseek-account' ? -2 : group.id === 'deepseek' ? -1 : index,
        }))
        .sort((a, b) => a.rank - b.rank)
        .map(entry => entry.id)
    }

    /** Loose, forgiving match: subsequence over name/provider, case-insensitive. */
    function looseMatch(query, text) {
      const haystack = String(text || '').toLowerCase()
      let cursor = 0
      for (const char of query) {
        cursor = haystack.indexOf(char, cursor)
        if (cursor < 0) return false
        cursor += 1
      }
      return true
    }

    /** Resolve the catalog badge text, tolerating both localized and plain values. */
    function badgeLabel(model, resolveText) {
      const badge = model && model.badge
      if (!badge || badge.text === undefined || badge.text === null) return ''
      try {
        const text = typeof resolveText === 'function' ? resolveText(badge.text) : badge.text
        return typeof text === 'string' ? text.trim() : ''
      } catch (error) {
        return typeof badge.text === 'string' ? badge.text : ''
      }
    }

    /* ----------------------------------------------------------------- icons */

    function lineIcon(paths, size) {
      const width = size || 14
      return h('svg', {
        viewBox: '0 0 16 16',
        width,
        height: width,
        'aria-hidden': 'true',
        focusable: 'false',
        style: { flex: 'none' },
      }, paths.map((d, index) => h('path', {
        key: index,
        d,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      })))
    }

    const iconModels = () => lineIcon(['M3 4.5h10', 'M3 8h10', 'M3 11.5h6'])
    const iconChevron = () => lineIcon(['M4.5 6.5L8 10l3.5-3.5'], 12)
    const iconSearch = () => lineIcon(['M11 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z', 'M10.2 10.2L14 14'])
    const iconCheck = () => lineIcon(['M3.5 8.5l3 3 6-6'], 12)
    const iconClose = () => lineIcon(['M4 4l8 8', 'M12 4l-8 8'], 12)
    const iconClock = () => lineIcon(['M8 4.2v4l2.6 1.6', 'M14 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z'], 12)
    const iconWarn = () => lineIcon(['M8 2.6l5.6 10.4H2.4L8 2.6Z', 'M8 6.6v3'], 12)
    const iconReload = () => lineIcon(['M13 8a5 5 0 1 1-1.7-3.75', 'M13.1 2.4v3.1H10'], 12)

    function starIcon(filled) {
      return h('svg', {
        viewBox: '0 0 16 16', width: 13, height: 13, 'aria-hidden': 'true', focusable: 'false', style: { flex: 'none' },
      }, h('path', {
        d: 'M8 1.9l1.86 3.82 4.2.6-3.03 2.96.72 4.2L8 11.5l-3.75 1.98.72-4.2L1.94 6.32l4.2-.6L8 1.9Z',
        fill: filled ? 'currentColor' : 'none',
        stroke: 'currentColor',
        strokeWidth: filled ? 0.8 : 1.3,
        strokeLinejoin: 'round',
      }))
    }

    function spinner() {
      return h('span', { className: 'dqms-spin', 'aria-hidden': 'true' })
    }

    /* ----------------------------------------------------------------- styles */

    const STYLE_ID = 'dsh-model-quick-switch-styles'
    const CSS = `
.dqms-seat{display:inline-flex;align-items:center;min-width:0}
.dqms-trigger{display:inline-flex;align-items:center;gap:6px;min-width:0;height:28px;max-width:230px;padding:0 8px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1;cursor:pointer}
.dqms-trigger:hover{background:var(--dsw-alias-bg-layer-2)}
.dqms-trigger[data-open="true"]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.dqms-trigger:disabled{opacity:.55;cursor:not-allowed}
.dqms-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dqms-trigger[data-fallback="true"]{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-border-l1)}
.dqms-trigger-icon{display:var(--dsh-composer-model-icon-display,inline-flex);color:var(--dsw-alias-label-secondary)}
.dqms-trigger-text{display:var(--dsh-composer-model-text-display,inline);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dqms-chevron{display:inline-flex;color:var(--dsw-alias-label-secondary)}
.dqms-spin{width:12px;height:12px;border-radius:50%;border:1.6px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);animation:dqms-rotate .7s linear infinite;flex:none}
@keyframes dqms-rotate{to{transform:rotate(360deg)}}
.dqms-panel{box-sizing:border-box;position:fixed;z-index:2147482000;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:0 18px 48px rgba(0,0,0,.32);font-size:13px}
.dqms-search{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
.dqms-search input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:var(--dsw-alias-label-primary);font:inherit}
.dqms-search input::placeholder{color:var(--dsw-alias-label-secondary)}
.dqms-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dqms-icon-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dqms-body{display:flex;min-height:0;flex:1}
.dqms-rail{width:184px;flex:none;display:flex;flex-direction:column;gap:1px;padding:6px;overflow:auto;border-right:1px solid var(--dsw-alias-border-l1)}
.dqms-rail-sep{height:1px;margin:5px 6px;background:var(--dsw-alias-border-l1)}
.dqms-rail-item{display:flex;align-items:center;gap:7px;width:100%;padding:7px 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer}
.dqms-rail-item:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dqms-rail-item[data-active="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
.dqms-rail-item[data-failed="true"]{color:var(--dsw-alias-state-error-primary)}
.dqms-rail-icon{display:inline-flex;color:var(--dsw-alias-label-secondary)}
.dqms-rail-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dqms-rail-count{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.85}
.dqms-rail-item[data-drop="true"]{outline:2px dashed var(--dsw-alias-brand-primary);outline-offset:-2px}
.dqms-list-wrap{display:flex;flex-direction:column;min-width:0;flex:1}
.dqms-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px 6px;color:var(--dsw-alias-label-secondary);font-size:11px;letter-spacing:.02em}
.dqms-list-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dqms-list-count{flex:none;opacity:.8}
.dqms-list{flex:1;min-height:0;overflow:auto;padding:2px 6px 8px;outline:0}
.dqms-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px 8px;border-radius:8px;cursor:pointer;color:var(--dsw-alias-label-primary)}
.dqms-row:hover{background:var(--dsw-alias-bg-layer-2)}
.dqms-row[data-cursor="true"]{background:var(--dsw-alias-bg-layer-2)}
.dqms-row[data-current="true"]{background:var(--dsw-alias-bg-layer-2);box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
.dqms-row[data-dragging="true"]{opacity:.45}
.dqms-row[data-editing="true"]{background:var(--dsw-alias-bg-layer-2);cursor:default}
.dqms-row-main{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
.dqms-row-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dqms-row-prov{flex:none;font-size:11px;padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1)}
.dqms-row-check{display:inline-flex;color:var(--dsw-alias-brand-primary)}
.dqms-star{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:.55}
.dqms-row:hover .dqms-star,.dqms-star[aria-pressed="true"]{opacity:1}
.dqms-star[aria-pressed="true"]{color:var(--dsw-alias-brand-primary)}
.dqms-efforts{display:flex;flex-wrap:wrap;gap:4px;width:100%;padding:2px 0 2px 2px}
.dqms-effort{padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer}
.dqms-effort:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.dqms-effort[aria-pressed="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.dqms-empty{display:flex;align-items:center;justify-content:center;height:100%;min-height:120px;padding:0 18px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}
.dqms-empty-catalog{flex-direction:column;align-items:flex-start;gap:6px;text-align:left}
.dqms-empty-detail{color:var(--dsw-alias-label-secondary);font-size:11px;word-break:break-word;opacity:.75}
.dqms-fail{display:flex;gap:8px;margin:8px;padding:10px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}
.dqms-fail svg{color:var(--dsw-alias-state-error-primary)}
.dqms-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 10px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:11px}
.dqms-foot-hint{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dqms-link{padding:2px 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;flex:none}
.dqms-link:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dqms-error{padding:6px 10px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:1.5;word-break:break-word}
.dqms-rail-dot{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-brand-primary);flex:none}
.dqms-rail-restore{width:100%;margin-top:2px;padding:5px 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;text-align:left;cursor:pointer;opacity:.8}
.dqms-rail-restore:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);opacity:1}
.dqms-rail-editing{padding:3px 4px;cursor:default}
.dqms-rail-input{width:100%;padding:4px 6px;border-radius:6px;border:1px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:0}
.dqms-row-input{flex:1;min-width:0}
.dqms-list-head-right{display:flex;align-items:center;gap:6px;flex:none}
.dqms-rail-item[data-menu="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dqms-menu{position:fixed;z-index:2147482100;display:flex;flex-direction:column;padding:4px;border-radius:10px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 14px 38px rgba(0,0,0,.34);max-height:70vh;overflow:auto}
.dqms-menu-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;cursor:pointer;white-space:nowrap}
.dqms-menu-item:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.dqms-menu-item:disabled{opacity:.42;cursor:default}
.dqms-menu-item[data-checked="true"]::before{content:'✓';color:var(--dsw-alias-brand-primary);font-size:11px}
.dqms-menu-item[data-danger="true"]{color:var(--dsw-alias-state-error-primary)}
.dqms-menu-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1)}
.dqms-badge{flex:none;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:10px;letter-spacing:.02em}
.dqms-fail-body{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0}
@media (max-width:520px){.dqms-rail{width:132px}}
`

    function installStyles() {
      if (typeof document === 'undefined') return () => {}
      if (document.getElementById(STYLE_ID)) return () => {}
      const element = document.createElement('style')
      element.id = STYLE_ID
      element.textContent = CSS
      document.head.appendChild(element)
      return () => { element.remove() }
    }

    /* -------------------------------------------------------------- component */

    function QuickSwitch(props) {
      const copy = props.copy || COPY.en
      // A brand-new session has no model directory yet, and an unretained
      // session (another workspace) can throw instead of returning one. Resolve
      // lazily and retry, so the seat never renders empty and the official
      // button never disappears behind us.
      const resolveDirectory = typeof props.resolveDirectory === 'function' ? props.resolveDirectory : null
      const [directory, setDirectory] = useState(() => {
        try { return resolveDirectory ? resolveDirectory() : null } catch (error) { return null }
      })
      const state = useSnapshot(directory ? directory.store : props.directory)
      const prefs = usePrefs()

      const [open, setOpen] = useState(false)
      const [query, setQuery] = useState('')
      const [activeKey, setActiveKey] = useState(null)
      const [cursor, setCursor] = useState(0)
      const [box, setBox] = useState(null)
      const [busy, setBusy] = useState(false)
      // Keyboard cursor visibility: the row highlight is a keyboard affordance,
      // so pointer movement clears it instead of leaving a stale band behind.
      const [keyboard, setKeyboard] = useState(false)
      const [menu, setMenu] = useState(null)
      const [renaming, setRenaming] = useState(null)
      const [refreshTick, setRefreshTick] = useState(0)
      const [reloading, setReloading] = useState(false)

      const triggerRef = useRef(null)
      const panelRef = useRef(null)
      const searchRef = useRef(null)
      const listRef = useRef(null)
      const menuRef = useRef(null)
      const railDrag = useRef(null)
      const rowDrag = useRef(-1)
      const cancelRename = useRef(false)
      const renamingRef = useRef(null)

      const rawGroups = state && Array.isArray(state.groups) ? state.groups : []
      // A provider id is the stable identity used by selections and local
      // preferences. Keep the first catalog record when a stale/duplicated
      // snapshot contains the same id more than once.
      const groups = []
      const groupIds = new Set()
      for (const group of rawGroups) {
        if (!group || typeof group.id !== 'string' || groupIds.has(group.id)) continue
        groupIds.add(group.id)
        groups.push(group)
      }
      const failures = state && Array.isArray(state.failures) ? state.failures : []
      const current = state && state.current ? state.current : null
      const pending = state && state.pending ? state.pending : null
      const status = state ? state.status : 'idle'
      const error = state ? state.error : null

      const providerById = new Map()
      for (const group of groups) providerById.set(group.id, group)

      const modelIndex = new Map()
      for (const group of groups) {
        for (const model of Array.isArray(group.models) ? group.models : []) {
          modelIndex.set(keyOf(group.id, model.id), { group, model })
        }
      }

      const providerOrder = orderIds(prefs.providerOrder, officialProviderOrder(groups))
      // Removing a provider is a panel-local decision: the row leaves the rail,
      // the search, the pinned list and the recent list, but the catalog and the
      // profile configuration keep it. `restoreProviders` puts all of them back.
      const hiddenProviders = prefs.hiddenProviders
      const hiddenSet = new Set(hiddenProviders)
      const visibleOrder = providerOrder.filter(id => !hiddenSet.has(id))
      const providerName = group => (group && group.id === 'deepseek-account' ? copy.account : (group && group.name) || '')
      // The catalog name is the fallback; a local alias only changes what this
      // browser shows and what search matches. The provider id never moves.
      const providerLabel = group => {
        if (!group) return ''
        const alias = prefs.aliases[group.id]
        return typeof alias === 'string' && alias !== '' ? alias : providerName(group)
      }

      /** A model's row label: local alias first, then the catalog name. */
      const modelLabel = (group, model) => {
        if (!group || !model) return ''
        const alias = prefs.modelAliases[keyOf(group.id, model.id)]
        if (typeof alias === 'string' && alias !== '') return alias
        return model.name || model.id
      }

      function modelsOf(group) {
        if (!group) return []
        const models = Array.isArray(group.models) ? group.models : []
        const order = orderIds(prefs.modelOrder[group.id] || [], models.map(model => model.id))
        const byId = new Map(models.map(model => [model.id, model]))
        return order.map(id => byId.get(id)).filter(Boolean)
      }

      const visible = entry => entry && !hiddenSet.has(entry.group.id)
      const favoriteRows = prefs.favorites.map(key => modelIndex.get(key)).filter(visible)
      const recentRows = prefs.recent.map(key => modelIndex.get(key)).filter(visible)

      const knownViews = new Set(visibleOrder)
      const failureIds = new Set(failures.map(entry => entry.id))
      // An explicit "open here" preference beats the selected model, so the
      // panel reliably lands on the provider the user works in.
      const preferredView = prefs.defaultProvider && knownViews.has(prefs.defaultProvider) ? prefs.defaultProvider : null
      const fallbackView = preferredView
        || (current && knownViews.has(current.provider) ? current.provider : visibleOrder[0])
      const view = activeKey === 'favorites' || activeKey === 'recent'
        ? activeKey
        : knownViews.has(activeKey) || failureIds.has(activeKey)
          ? activeKey
          : fallbackView

      const searching = query.trim().length > 0
      const needle = query.trim().toLowerCase()

      let rows = []
      let headTitle = ''
      let listKey = view || 'none'

      if (searching) {
        headTitle = copy.results
        for (const providerId of visibleOrder) {
          const group = providerById.get(providerId)
          for (const model of modelsOf(group)) {
            const haystack = `${model.name || ''} ${modelLabel(group, model)} ${providerLabel(group)} ${providerId} ${model.id || ''}`
            if (looseMatch(needle, haystack)) rows.push({ group, model })
          }
        }
      } else if (view === 'favorites') {
        headTitle = copy.favorites
        rows = favoriteRows
      } else if (view === 'recent') {
        headTitle = copy.recent
        rows = recentRows
      } else if (view) {
        const group = providerById.get(view)
        headTitle = group ? providerLabel(group) : ''
        rows = modelsOf(group).map(model => ({ group, model }))
      }

      let failed = null
      if (!searching && view && !knownViews.has(view) && view !== 'favorites' && view !== 'recent') {
        failed = failures.find(entry => entry.id === view) || null
      }

      // Failed providers stay in the directory state so the selected provider
      // can show its error and retry action, but they do not become fake
      // provider rows in the left rail. The rail represents usable providers.
      const railItems = visibleOrder.map(id => ({ kind: 'provider', id, group: providerById.get(id) }))

      const currentEntry = current ? modelIndex.get(keyOf(current.provider, current.model)) : undefined
      const triggerLabel = currentEntry ? modelLabel(currentEntry.group, currentEntry.model) : copy.selectModel
      const triggerTitle = currentEntry
        ? `${providerLabel(currentEntry.group)} · ${modelLabel(currentEntry.group, currentEntry.model)}`
        : copy.selectModel

      /* --- geometry --- */

      const place = useCallback(() => {
        const element = triggerRef.current
        if (!element) return
        const rect = element.getBoundingClientRect()
        const width = Math.max(1, Math.min(560, window.innerWidth - 24))
        const height = Math.max(1, Math.min(396, window.innerHeight - 24))
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
        const above = rect.top > height + 24
        const preferredTop = above ? rect.top - 8 - height : rect.bottom + 8
        const top = Math.max(12, Math.min(preferredTop, window.innerHeight - height - 12))
        setBox({ left, top, width, height })
      }, [])

      useEffect(() => {
        if (!open) return undefined
        place()
        const onPointerDown = event => {
          const panel = panelRef.current
          const trigger = triggerRef.current
          if (panel && panel.contains(event.target)) return
          if (menuRef.current && menuRef.current.contains(event.target)) return
          if (trigger && trigger.contains(event.target)) return
          setOpen(false)
        }
        const onKeyDown = event => {
          if (event.key !== 'Escape') return
          // An open inline rename owns Escape: cancel the edit, keep the panel.
          if (renamingRef.current) return
          event.stopPropagation()
          setOpen(false)
        }
        const onReflow = () => place()
        document.addEventListener('mousedown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        window.addEventListener('resize', onReflow)
        window.addEventListener('scroll', onReflow, true)
        return () => {
          document.removeEventListener('mousedown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
          window.removeEventListener('resize', onReflow)
          window.removeEventListener('scroll', onReflow, true)
        }
      }, [open, place])

      useEffect(() => {
        if (!open) return undefined
        const timer = window.setTimeout(() => {
          if (searchRef.current) searchRef.current.focus({ preventScroll: true })
          // Opening the picker refreshes the current session's catalog so
          // provider/model changes made in Settings are reflected immediately.
          if (typeof props.load === 'function') {
            try { props.load(true) } catch (error) { /* surfaced on the directory store */ }
          }
        }, 0)
        return () => { window.clearTimeout(timer) }
      }, [open, props.load])

      useEffect(() => {
        if (typeof props.load === 'function') {
          try { props.load() } catch (error) { /* surfaced on the directory store */ }
        }
      }, [props.load, directory])

      // Revalidate even when we already have a directory: workspace/session
      // retention can replace its binding while this component stays mounted.
      // Never keep displaying a released store just because it has groups.
      useEffect(() => {
        if (!resolveDirectory) return undefined
        let attempts = 0
        let timer = null
        const tick = () => {
          let next = null
          try { next = resolveDirectory() } catch (error) { next = null }
          if (next !== directory) setDirectory(next)
          if (next) return
          attempts += 1
          if (attempts < 240) timer = window.setTimeout(tick, 250)
        }
        tick()
        return () => { if (timer !== null) window.clearTimeout(timer) }
      }, [directory, resolveDirectory, open])

      useEffect(() => {
        setCursor(0)
        setKeyboard(false)
      }, [query, view])

      useEffect(() => {
        const list = listRef.current
        if (!list || !open) return
        if (!keyboard) return
        const element = list.querySelector('[data-cursor="true"]')
        if (!element) return
        // scrollIntoView also scrolls the composer's overflow ancestors. Only
        // move our own list; the host conversation must never be scrolled here.
        const viewport = list.getBoundingClientRect()
        const row = element.getBoundingClientRect()
        const top = viewport.top + list.clientTop
        const bottom = top + list.clientHeight
        if (row.top < top) list.scrollTop += row.top - top
        else if (row.bottom > bottom) list.scrollTop += row.bottom - bottom
      }, [cursor, open, rows.length, keyboard])

      // The capture-phase Escape listener needs the latest rename state without
      // re-subscribing on every keystroke.
      useEffect(() => { renamingRef.current = renaming }, [renaming])

      /* --- actions --- */

      const remember = useCallback((provider, model) => {
        const key = keyOf(provider, model)
        updatePrefs(next => {
          next.recent = [key].concat(next.recent.filter(item => item !== key)).slice(0, 12)
        })
      }, [])

      const pick = useCallback((row, effort) => {
        if (!row || typeof props.select !== 'function') return
        const { group, model } = row
        const sameRoute = current !== null && current.provider === group.id && current.model === model.id
        const selection = { provider: group.id, model: model.id }
        const effortId = effort !== undefined
          ? effort
          : sameRoute && current.reasoningEffort !== undefined
            ? current.reasoningEffort
            : model.reasoning && model.reasoning.defaultEffort
        if (effortId !== undefined && effortId !== null) selection.reasoningEffort = effortId
        setBusy(true)
        let result
        try {
          result = props.select(selection)
        } catch (failure) {
          setBusy(false)
          return
        }
        Promise.resolve(result).then(outcome => {
          setBusy(false)
          if (!outcome || outcome.ok) {
            remember(group.id, model.id)
            setOpen(false)
          }
        }).catch(() => { setBusy(false) })
      }, [props, current, remember])

      const toggleFavorite = useCallback((provider, model) => {
        const key = keyOf(provider, model)
        updatePrefs(next => {
          next.favorites = next.favorites.includes(key)
            ? next.favorites.filter(item => item !== key)
            : next.favorites.concat(key)
        })
      }, [])

      // Ordering acts on what the user can see: a provider removed from the
      // panel never occupies a slot, so index math stays honest. Removed ids
      // simply fall back to their official rank whenever they are restored.
      const visibleOrderOf = useCallback(next => orderIds(next.providerOrder, officialProviderOrder(groups))
        .filter(id => !next.hiddenProviders.includes(id)), [groups])

      const moveProvider = useCallback((from, to) => {
        updatePrefs(next => {
          next.providerOrder = moveItem(visibleOrderOf(next), from, to)
        })
      }, [visibleOrderOf])

      const moveModel = useCallback((group, from, to) => {
        if (!group) return
        const ids = (Array.isArray(group.models) ? group.models : []).map(model => model.id)
        updatePrefs(next => {
          const order = orderIds(next.modelOrder[group.id] || [], ids)
          next.modelOrder[group.id] = moveItem(order, from, to)
        })
      }, [])

      // Reorder two pinned models by their keys: the stored list may also hold
      // keys whose provider is temporarily missing from the catalog, so plain
      // visible indices would move the wrong entry.
      const moveFavorite = useCallback((fromKey, toKey) => {
        updatePrefs(next => {
          const from = next.favorites.indexOf(fromKey)
          const to = next.favorites.indexOf(toKey)
          if (from < 0 || to < 0) return
          next.favorites = moveItem(next.favorites, from, to)
        })
      }, [])

      const reorderRows = useCallback((from, to) => {
        if (searching) return
        const fromRow = rows[from]
        const toRow = rows[to]
        if (!fromRow || !toRow) return
        if (view === 'favorites') {
          moveFavorite(keyOf(fromRow.group.id, fromRow.model.id), keyOf(toRow.group.id, toRow.model.id))
          return
        }
        if (view === 'recent') return
        moveModel(providerById.get(view), from, to)
      }, [searching, rows, view, moveFavorite, moveModel, providerById])

      const resetOrder = useCallback(() => {
        updatePrefs(next => { next.providerOrder = []; next.modelOrder = {} })
      }, [])

      /* --- context menus (provider rail and model rows) --- */

      const closeMenu = useCallback(() => setMenu(null), [])

      const openMenu = useCallback((event, target) => {
        event.preventDefault()
        event.stopPropagation()
        const width = 226
        const left = Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8))
        // Grow upward near the bottom edge so the menu never leaves the viewport.
        const flip = event.clientY > window.innerHeight / 2
        setMenu(Object.assign({}, target, {
          width,
          left,
          top: flip ? undefined : Math.max(8, event.clientY),
          bottom: flip ? Math.max(8, window.innerHeight - event.clientY) : undefined,
        }))
      }, [])

      const openProviderMenu = useCallback((event, id) => openMenu(event, { kind: 'provider', id }), [openMenu])
      const openModelMenu = useCallback((event, group, model) => {
        openMenu(event, { kind: 'model', key: keyOf(group.id, model.id), provider: group.id })
      }, [openMenu])

      const startRename = useCallback(id => {
        const group = providerById.get(id)
        setRenaming({ kind: 'provider', id, value: providerLabel(group) })
        closeMenu()
      }, [providerById, prefs, closeMenu])

      const startModelRename = useCallback(key => {
        const entry = modelIndex.get(key)
        setRenaming({ kind: 'model', key, value: entry ? modelLabel(entry.group, entry.model) : key })
        closeMenu()
      }, [modelIndex, prefs, closeMenu])

      const commitRename = useCallback(() => {
        const target = renamingRef.current
        setRenaming(null)
        if (!target) return
        if (cancelRename.current) {
          cancelRename.current = false
          return
        }
        const value = target.value.trim()
        const modelRename = target.kind === 'model'
        updatePrefs(next => {
          // An alias equal to the catalog name is not an alias: drop it so the
          // label keeps following the catalog (including language switches).
          if (modelRename) {
            const entry = modelIndex.get(target.key)
            const base = entry ? (entry.model.name || entry.model.id) : ''
            const aliases = Object.assign({}, next.modelAliases)
            if (value === '' || value === base) delete aliases[target.key]
            else aliases[target.key] = value
            next.modelAliases = aliases
            return
          }
          const group = providerById.get(target.id)
          const base = group ? providerName(group) : ''
          const aliases = Object.assign({}, next.aliases)
          if (value === '' || value === base) delete aliases[target.id]
          else aliases[target.id] = value
          next.aliases = aliases
        })
      }, [providerById, modelIndex])

      const resetModelAlias = useCallback(key => {
        updatePrefs(next => {
          const aliases = Object.assign({}, next.modelAliases)
          delete aliases[key]
          next.modelAliases = aliases
        })
        closeMenu()
      }, [closeMenu])

      /** Remove a provider from this panel only; see `restoreProviders`. */
      const hideProvider = useCallback(id => {
        updatePrefs(next => {
          if (!next.hiddenProviders.includes(id)) next.hiddenProviders = next.hiddenProviders.concat(id)
          // A default-opens-here pointer to a hidden provider would be dead.
          if (next.defaultProvider === id) next.defaultProvider = ''
        })
        closeMenu()
      }, [closeMenu])

      const restoreProviders = useCallback(() => {
        updatePrefs(next => { next.hiddenProviders = [] })
        closeMenu()
      }, [closeMenu])

      const toggleDefaultProvider = useCallback(id => {
        updatePrefs(next => { next.defaultProvider = next.defaultProvider === id ? '' : id })
        closeMenu()
      }, [closeMenu])

      const pinProvider = useCallback(id => {
        updatePrefs(next => {
          const order = visibleOrderOf(next)
          const from = order.indexOf(id)
          if (from < 0) return
          next.providerOrder = moveItem(order, from, 0)
        })
        closeMenu()
      }, [visibleOrderOf, closeMenu])

      const shiftProvider = useCallback((id, delta) => {
        updatePrefs(next => {
          const order = visibleOrderOf(next)
          const from = order.indexOf(id)
          const to = from + delta
          if (from < 0 || to < 0 || to >= order.length) return
          next.providerOrder = moveItem(order, from, to)
        })
        closeMenu()
      }, [groups, closeMenu])

      const resetProviderModels = useCallback(id => {
        updatePrefs(next => {
          const modelOrder = Object.assign({}, next.modelOrder)
          delete modelOrder[id]
          next.modelOrder = modelOrder
        })
        closeMenu()
      }, [closeMenu])

      const favoriteProvider = useCallback((id, on) => {
        const group = providerById.get(id)
        const models = group && Array.isArray(group.models) ? group.models : []
        const keys = models.map(model => keyOf(id, model.id))
        updatePrefs(next => {
          const kept = next.favorites.filter(key => !keys.includes(key))
          next.favorites = on ? kept.concat(keys) : kept
        })
        closeMenu()
      }, [providerById, closeMenu])

      const reloadCatalog = useCallback(() => {
        closeMenu()
        setReloading(true)
        // Force the current session's directory to resolve from the latest
        // configured providers before loading its model catalog.
        let pendingLoad = null
        if (typeof props.load === 'function') {
          try { pendingLoad = props.load(true) } catch (error) { pendingLoad = null }
        }
        if (resolveDirectory) {
          let next = null
          try { next = resolveDirectory() } catch (error) { next = null }
          if (next) setDirectory(next)
        }
        const settle = () => setReloading(false)
        if (pendingLoad && typeof pendingLoad.then === 'function') pendingLoad.then(settle, settle)
        else window.setTimeout(settle, 500)
        setRefreshTick(value => value + 1)
      }, [props, closeMenu, resolveDirectory])

      // The catalog cannot always be loaded the first time: a session that was
      // just created, or one the host has not retained yet, rejects the load.
      // Nothing else retries it, so the panel would stay empty until the user
      // opened the shipped /model popup once. Keep trying while it is open.
      useEffect(() => {
        if (!open) return undefined
        const ready = state && Array.isArray(state.groups) && state.groups.length > 0
        if (ready || refreshTick > 40) return undefined
        const timer = window.setTimeout(() => {
          if (resolveDirectory) {
            let next = null
            try { next = resolveDirectory(true) } catch (error) { next = null }
            if (next && next !== directory) setDirectory(next)
          }
          if (typeof props.load === 'function') {
            try { props.load(true) } catch (error) { /* store carries it */ }
          }
          setRefreshTick(value => value + 1)
        }, 350)
        return () => { window.clearTimeout(timer) }
      }, [open, state, refreshTick, props.load, resolveDirectory, directory])

      const onListKeyDown = event => {
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          if (searching) return
          event.preventDefault()
          setKeyboard(true)
          const to = event.key === 'ArrowUp' ? cursor - 1 : cursor + 1
          if (to < 0 || to >= rows.length) return
          reorderRows(cursor, to)
          setCursor(to)
          return
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setKeyboard(true)
          setCursor(value => Math.min(rows.length - 1, value + 1))
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setKeyboard(true)
          setCursor(value => Math.max(0, value - 1))
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          const row = rows[cursor]
          if (row) pick(row)
        }
      }

      /* --- render --- */

      if (props.available === false || props.subagent === true) return null

      const trigger = h('div', { className: 'dqms-seat' },
        h('button', {
          ref: triggerRef,
          type: 'button',
          className: 'dqms-trigger',
          'data-open': open ? 'true' : 'false',
          disabled: props.locked === true,
          title: triggerTitle,
          'aria-haspopup': 'dialog',
          'aria-expanded': open ? 'true' : 'false',
          // Keep the composer focus stable until click is dispatched. Blank
          // session/workspace transitions can otherwise replace this control
          // between mousedown and click (the shipped picker does this too).
          onMouseDown: event => event.preventDefault(),
          onClick: () => setOpen(value => !value),
        },
          h('span', { className: 'dqms-trigger-icon' }, iconModels()),
          h('span', { className: 'dqms-trigger-text' }, triggerLabel),
          busy || status === 'selecting' ? spinner() : h('span', { className: 'dqms-chevron' }, iconChevron()),
        ),
      )

      if (!open) return trigger

      const railRow = (id, label, count, icon, failedFlag) => h('button', {
        key: 'rail-' + id,
        type: 'button',
        role: 'tab',
        className: 'dqms-rail-item',
        'data-active': view === id ? 'true' : 'false',
        'data-failed': failedFlag ? 'true' : 'false',
        'aria-selected': view === id ? 'true' : 'false',
        draggable: false,
        onClick: () => { setActiveKey(id); setQuery('') },
      },
        icon ? h('span', { className: 'dqms-rail-icon' }, icon) : null,
        h('span', { className: 'dqms-rail-name' }, label),
        count === null || count === undefined ? null : h('span', { className: 'dqms-rail-count' }, copy.count(count)),
      )

      const providerRail = railItems.map(item => {
        if (item.kind === 'failure') {
          return railRow(item.id, item.failure && item.failure.name ? item.failure.name : item.id, null, iconWarn(), true)
        }
        const group = item.group
        const count = Array.isArray(group.models) ? group.models.length : 0
        if (renaming && renaming.id === item.id) {
          return h('div', { key: 'rail-rename-' + item.id, className: 'dqms-rail-item dqms-rail-editing' },
            h('input', {
              className: 'dqms-rail-input',
              value: renaming.value,
              autoFocus: true,
              spellCheck: false,
              placeholder: copy.renamePlaceholder,
              'aria-label': copy.menuRename,
              title: copy.renameHint,
              onChange: event => setRenaming({ kind: 'provider', id: item.id, value: event.target.value }),
              onKeyDown: event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitRename()
                  return
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  cancelRename.current = true
                  setRenaming(null)
                }
              },
              onBlur: () => commitRename(),
            }),
          )
        }
        return h('button', {
          key: 'rail-' + item.id,
          type: 'button',
          role: 'tab',
          className: 'dqms-rail-item',
          'data-active': view === item.id ? 'true' : 'false',
          'data-menu': menu && menu.kind === 'provider' && menu.id === item.id ? 'true' : 'false',
          'aria-selected': view === item.id ? 'true' : 'false',
          title: copy.menuHint,
          draggable: !searching,
          onDragStart: event => {
            railDrag.current = item.id
            try {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', item.id)
            } catch (failure) { /* some browsers refuse custom payloads */ }
          },
          onDragOver: event => {
            const source = railDrag.current
            if (!source || source === item.id) return
            const from = visibleOrder.indexOf(source)
            const to = visibleOrder.indexOf(item.id)
            if (from < 0 || to < 0 || from === to) return
            event.preventDefault()
            moveProvider(from, to)
          },
          onDragEnd: () => { railDrag.current = null },
          onContextMenu: event => openProviderMenu(event, item.id),
          onClick: () => { setActiveKey(item.id); setQuery(''); closeMenu() },
        },
          h('span', { className: 'dqms-rail-name' }, providerLabel(group)),
          prefs.defaultProvider === item.id ? h('span', { className: 'dqms-rail-dot', title: copy.menuDefaultOff }) : null,
          h('span', { className: 'dqms-rail-count' }, copy.count(count)),
        )
      })

      // Removing a provider stays reversible: the rail carries the way back,
      // and it only appears once something has actually been removed.
      const restoreRow = hiddenProviders.length > 0
        ? h('button', {
          key: 'rail-restore',
          type: 'button',
          className: 'dqms-rail-restore',
          title: copy.menuDeleteHint,
          onClick: restoreProviders,
        }, `${copy.hiddenRow(hiddenProviders.length)} · ${copy.restore}`)
        : null

      const renderRow = (row, index) => {
        const group = row.group
        const model = row.model
        const key = keyOf(group.id, model.id)
        const isCurrent = current !== null && current.provider === group.id && current.model === model.id
        const isPending = pending !== null && pending.provider === group.id && pending.model === model.id
        const isFavorite = prefs.favorites.includes(key)
        const efforts = model.reasoning && Array.isArray(model.reasoning.efforts) ? model.reasoning.efforts : []
        const showEfforts = isCurrent && efforts.length > 1 && !searching
        const badgeText = badgeLabel(model, props.resolveText)
        // A row can be renaming in place: the click and drag affordances step
        // aside so typing never picks the model or starts a reorder.
        const editing = renaming !== null && renaming.kind === 'model' && renaming.key === key
        return h('div', {
          key: key + '@' + group.id,
          className: 'dqms-row',
          role: 'option',
          'data-current': isCurrent ? 'true' : 'false',
          'data-cursor': keyboard && index === cursor ? 'true' : 'false',
          'data-editing': editing ? 'true' : 'false',
          'aria-selected': isCurrent ? 'true' : 'false',
          draggable: !searching && view !== 'recent' && !editing,
          onDragStart: event => {
            rowDrag.current = index
            try {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', key)
            } catch (failure) { /* ignore */ }
            event.currentTarget.dataset.dragging = 'true'
          },
          onDragOver: event => {
            if (rowDrag.current < 0 || rowDrag.current === index) return
            event.preventDefault()
            reorderRows(rowDrag.current, index)
            rowDrag.current = index
          },
          onDragEnd: event => {
            rowDrag.current = -1
            delete event.currentTarget.dataset.dragging
          },
          onContextMenu: event => openModelMenu(event, group, model),
          onMouseEnter: () => { if (keyboard) setCursor(index) },
          onClick: () => { if (!isCurrent && !editing) pick(row) },
        },
          h('div', { className: 'dqms-row-main' },
            editing
              ? h('input', {
                className: 'dqms-rail-input dqms-row-input',
                value: renaming.value,
                autoFocus: true,
                spellCheck: false,
                placeholder: copy.renamePlaceholder,
                'aria-label': copy.menuRename,
                title: copy.renameHint,
                onClick: event => event.stopPropagation(),
                onChange: event => setRenaming({ kind: 'model', key, value: event.target.value }),
                onKeyDown: event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitRename()
                    return
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    cancelRename.current = true
                    setRenaming(null)
                  }
                },
                onBlur: () => commitRename(),
              })
              : h('span', { className: 'dqms-row-name', title: copy.rowHint }, modelLabel(group, model)),
            badgeText ? h('span', { className: 'dqms-badge' }, badgeText) : null,
            searching ? h('span', { className: 'dqms-row-prov' }, providerLabel(group)) : null,
            isCurrent && !isPending ? h('span', { className: 'dqms-row-check' }, iconCheck()) : null,
            isPending ? spinner() : null,
          ),
          h('button', {
            type: 'button',
            className: 'dqms-star',
            'aria-pressed': isFavorite ? 'true' : 'false',
            'aria-label': isFavorite ? copy.unstar : copy.star,
            title: isFavorite ? copy.unstar : copy.star,
            onClick: event => { event.stopPropagation(); toggleFavorite(group.id, model.id) },
          }, starIcon(isFavorite)),
          showEfforts
            ? h('div', { className: 'dqms-efforts' }, efforts.map(effort => h('button', {
              key: effort.id,
              type: 'button',
              className: 'dqms-effort',
              'aria-pressed': current.reasoningEffort === effort.id ? 'true' : 'false',
              onClick: event => { event.stopPropagation(); pick(row, effort.id) },
            }, effort.name || effort.id)))
            : null,
        )
      }

      let body
      // A failing directory lookup used to be swallowed and shown as an empty
      // panel; surface the host's own message instead.
      const lookupError = typeof props.lookupError === 'function' ? props.lookupError() : null
      if (failed) {
        body = h('div', { className: 'dqms-fail' }, iconWarn(),
          h('div', { className: 'dqms-fail-body' },
            h('span', null, `${failed.name || failed.id}: ${failed.message || copy.failed}`),
            h('button', {
              type: 'button',
              className: 'dqms-link',
              disabled: status === 'loading',
              onClick: reloadCatalog,
            }, status === 'loading' ? copy.loading : copy.retry),
          ))
      } else if (rows.length > 0) {
        body = rows.map(renderRow)
      } else {
        if (searching) {
          body = h('div', { className: 'dqms-empty' }, copy.searching)
        } else if (view === 'favorites') {
          body = h('div', { className: 'dqms-empty' }, copy.emptyFavorites)
        } else if (view === 'recent') {
          body = h('div', { className: 'dqms-empty' }, copy.emptyRecent)
        } else if (groups.length > 0 && visibleOrder.length === 0) {
          // Every provider was removed from the panel; the way back is here.
          body = h('div', { className: 'dqms-empty dqms-empty-catalog' },
            h('span', null, copy.hiddenAll),
            h('button', { type: 'button', className: 'dqms-link', onClick: restoreProviders }, copy.restore),
          )
        } else if (groups.length === 0) {
          body = h('div', { className: 'dqms-empty dqms-empty-catalog' },
            h('span', null, status === 'loading' || status === 'idle' ? copy.loading : copy.emptyCatalog),
            lookupError ? h('span', { className: 'dqms-empty-detail' }, lookupError) : null,
            h('button', { type: 'button', className: 'dqms-link', onClick: reloadCatalog }, copy.retry),
          )
        } else {
          body = h('div', { className: 'dqms-empty' }, copy.searching)
        }
      }

      const providerMenu = menu && menu.kind !== 'model' ? menu : null
      const menuGroup = providerMenu ? providerById.get(providerMenu.id) : undefined
      const menuIndex = providerMenu ? visibleOrder.indexOf(providerMenu.id) : -1
      const menuKeys = menuGroup && Array.isArray(menuGroup.models) ? menuGroup.models.map(model => keyOf(menuGroup.id, model.id)) : []
      const allPinned = menuKeys.length > 0 && menuKeys.every(key => prefs.favorites.includes(key))
      const somePinned = menuKeys.some(key => prefs.favorites.includes(key))
      const isDefaultProvider = providerMenu !== null && prefs.defaultProvider === providerMenu.id

      const modelMenu = menu && menu.kind === 'model' ? menu : null
      const modelMenuEntry = modelMenu ? modelIndex.get(modelMenu.key) : undefined
      const modelMenuAliased = modelMenu ? Boolean(prefs.modelAliases[modelMenu.key]) : false
      const modelMenuPinned = modelMenu ? prefs.favorites.includes(modelMenu.key) : false

      const menuItem = (id, label, action, options) => h('button', {
        key: 'mi-' + id,
        type: 'button',
        role: 'menuitem',
        className: 'dqms-menu-item',
        title: options && options.title ? options.title : undefined,
        'data-checked': options && options.checked ? 'true' : 'false',
        'data-danger': options && options.danger ? 'true' : 'false',
        disabled: Boolean(options && options.disabled),
        onClick: event => { event.stopPropagation(); action() },
      }, label)

      const menuNode = menu ? h('div', {
        ref: menuRef,
        className: 'dqms-menu',
        role: 'menu',
        'aria-label': copy.title,
        style: {
          left: menu.left + 'px',
          width: menu.width + 'px',
          top: menu.top === undefined ? 'auto' : menu.top + 'px',
          bottom: menu.bottom === undefined ? 'auto' : menu.bottom + 'px',
        },
        onClick: event => event.stopPropagation(),
        onContextMenu: event => event.preventDefault(),
      },
        modelMenu
          ? [
            menuItem('rename-model', copy.menuRename, () => startModelRename(modelMenu.key)),
            menuItem('unrename-model', copy.menuUnrename, () => resetModelAlias(modelMenu.key),
              { disabled: !modelMenuAliased }),
            h('div', { className: 'dqms-menu-sep', key: 'menu-sep-model' }),
            menuItem('pin-model', modelMenuPinned ? copy.unstar : copy.star, () => {
              if (!modelMenuEntry) return
              toggleFavorite(modelMenuEntry.group.id, modelMenuEntry.model.id)
              closeMenu()
            }, { checked: modelMenuPinned }),
          ]
          : [
            menuItem('rename', copy.menuRename, () => startRename(menu.id)),
            menuItem('default', isDefaultProvider ? copy.menuDefaultOff : copy.menuDefaultOn,
              () => toggleDefaultProvider(menu.id), { checked: isDefaultProvider }),
            h('div', { className: 'dqms-menu-sep', key: 'menu-sep-1' }),
            menuItem('pin', copy.menuPin, () => pinProvider(menu.id), { disabled: menuIndex <= 0 }),
            menuItem('up', copy.menuUp, () => shiftProvider(menu.id, -1), { disabled: menuIndex <= 0 }),
            menuItem('down', copy.menuDown, () => shiftProvider(menu.id, 1),
              { disabled: menuIndex < 0 || menuIndex >= visibleOrder.length - 1 }),
            h('div', { className: 'dqms-menu-sep', key: 'menu-sep-2' }),
            menuItem('reset-models', copy.menuResetModels, () => resetProviderModels(menu.id),
              { disabled: !prefs.modelOrder[menu.id] }),
            menuItem('pin-all', copy.menuFavoriteAll, () => favoriteProvider(menu.id, true),
              { disabled: allPinned || menuKeys.length === 0 }),
            menuItem('unpin-all', copy.menuClearFavorites, () => favoriteProvider(menu.id, false),
              { disabled: !somePinned, danger: true }),
            h('div', { className: 'dqms-menu-sep', key: 'menu-sep-3' }),
            menuItem('reload', copy.menuReload, reloadCatalog),
            h('div', { className: 'dqms-menu-sep', key: 'menu-sep-4' }),
            menuItem('delete', copy.menuDelete, () => hideProvider(menu.id),
              { danger: true, title: copy.menuDeleteHint }),
          ],
      ) : null

      return h(React.Fragment, null,
        trigger,
        // Viewport coordinates require a viewport-level DOM parent. Composer
        // ancestors may establish fixed containing blocks or clip overflow.
        createPortal(h(React.Fragment, null, h('div', {
          ref: panelRef,
          className: 'dqms-panel',
          role: 'dialog',
          'aria-label': copy.title,
          'aria-busy': busy ? 'true' : 'false',
          onClick: event => {
            if (!menu) return
            const node = menuRef.current
            if (node && node.contains(event.target)) return
            setMenu(null)
          },
          style: box
            ? { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' }
            : { left: '-9999px', top: '-9999px', width: '560px', height: '396px', visibility: 'hidden' },
        },
          h('div', { className: 'dqms-search' },
            iconSearch(),
            h('input', {
              ref: searchRef,
              type: 'text',
              value: query,
              spellCheck: false,
              placeholder: copy.searchPlaceholder,
              'aria-label': copy.searchPlaceholder,
              onChange: event => setQuery(event.target.value),
              onKeyDown: event => {
                if (event.key === 'ArrowDown' && listRef.current) {
                  event.preventDefault()
                  listRef.current.focus({ preventScroll: true })
                  return
                }
                if (event.key === 'Enter') {
                  const row = rows[cursor]
                  if (row) { event.preventDefault(); pick(row) }
                }
              },
            }),
            query
              ? h('button', {
                type: 'button',
                className: 'dqms-icon-btn',
                'aria-label': copy.clear,
                title: copy.clear,
                onClick: () => {
                  setQuery('')
                  if (searchRef.current) searchRef.current.focus({ preventScroll: true })
                },
              }, iconClose())
              : null,
          ),
          h('div', { className: 'dqms-body' },
            h('div', { className: 'dqms-rail', role: 'tablist', 'aria-orientation': 'vertical' },
              railRow('favorites', copy.favorites, favoriteRows.length, starIcon(false)),
              railRow('recent', copy.recent, recentRows.length, iconClock()),
              h('div', { className: 'dqms-rail-sep', key: 'rail-sep' }),
              providerRail,
              restoreRow,
            ),
            h('div', { className: 'dqms-list-wrap' },
              h('div', { className: 'dqms-list-head' },
                h('span', { className: 'dqms-list-title' }, headTitle),
                h('span', { className: 'dqms-list-head-right' },
                  h('span', { className: 'dqms-list-count' }, copy.count(rows.length)),
                ),
              ),
              h('div', {
                ref: listRef,
                className: 'dqms-list',
                role: 'listbox',
                tabIndex: 0,
                'aria-label': headTitle,
                onKeyDown: onListKeyDown,
                onMouseMove: () => { if (keyboard) setKeyboard(false) },
                style: { minHeight: 0 },
              }, body),
            ),
          ),
          h('div', { className: 'dqms-foot' },
            h('span', { className: 'dqms-foot-hint' }, copy.hint),
            h('button', { type: 'button', className: 'dqms-link', onClick: resetOrder }, copy.reset),
          ),
          error ? h('div', { className: 'dqms-error', role: 'alert' }, error) : null,
        ), menuNode), document.body),
      )
    }

    /* --------------------------------------------------------- error boundary */

    /**
     * Last line of defence. This occupant shadows the shipped selector, so an
     * uncaught render error would leave the composer with no model control at
     * all. The boundary keeps a visible button in that case.
     */
    class SeatBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false, epoch: 0 }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      render() {
        if (this.state.failed) {
          const copy = this.props.copy || COPY.en
          return h('div', { className: 'dqms-seat' },
            h('button', {
              type: 'button',
              className: 'dqms-trigger',
              'data-fallback': 'true',
              title: `${copy.broken} ${copy.retry}`,
              onClick: () => this.setState(state => ({ failed: false, epoch: state.epoch + 1 })),
            },
              h('span', { className: 'dqms-trigger-icon' }, iconModels()),
              h('span', { className: 'dqms-trigger-text' }, copy.selectModel),
            ),
          )
        }
        return h(React.Fragment, { key: `${this.props.sessionId}:${this.state.epoch}` }, h(QuickSwitch, this.props))
      }
    }

    /* ------------------------------------------------------------------ apply */

    return {
      inject: ['slots', 'sessions', 'remote', 'remote.session', 'modelDirectories', 'locale'],
      apply(ctx) {
        ctx.effect(() => installStyles(), 'model-quick-switch: styles')
        // The scope must declare everything `modelDirectories` itself needs:
        // Cordis instantiates the service inside the accessing scope, and its
        // directory resolver reads `this.ctx.remote.session`. Declaring only
        // the service produced "cannot get property \"remote.session\" without
        // inject" on every lookup.
        ctx.inject(
          ['slots', 'sessions', 'remote', 'remote.session', 'modelDirectories', 'locale'],
          scope => {
          const models = scope.modelDirectories
          const sessions = scope.sessions
          const locale = scope.locale

          // The shipped resolver owns caching by retained session binding, not
          // session id. A workspace switch can release that binding; keeping a
          // second cache here would return a disposed, permanently stale store.
          // Resolve lazily in each occupant so lookup failures are session-local.

          const isSubagent = sessionId => {
            try {
              if (!sessions || typeof sessions.subagentAddress !== 'function') return false
              return sessions.subagentAddress(sessionId) !== undefined
            } catch (error) { return false }
          }

          scope.slots.inject('conversation.input.model', () => scope.slots.register({
            name: 'conversation.input.model',
            priority: -1,
            inject: sessionId => {
              const copy = pickCopy(locale)
              let lookupError = null
              const directoryFor = () => {
                try {
                  const directory = models.directoryFor(sessionId)
                  lookupError = null
                  return directory && directory.store ? directory : null
                } catch (error) {
                  lookupError = error && error.message ? error.message : String(error)
                  return null
                }
              }
              return {
                copy,
                subagent: isSubagent(sessionId),
                resolveDirectory: () => directoryFor(),
                lookupError: () => lookupError,
                load: force => {
                  const directory = directoryFor()
                  if (!directory) return undefined
                  // Tolerate both shapes: the directory loading itself, or its
                  // snapshot store doing the load.
                  const run = typeof directory.load === 'function'
                    ? () => directory.load(force === true)
                    : directory.store && typeof directory.store.load === 'function'
                      ? () => directory.store.load(force === true)
                      : null
                  if (!run) return undefined
                  try {
                    // Returning the promise lets the reload button show progress
                    // instead of spinning for a fixed guess.
                    const result = run()
                    if (result && typeof result.catch === 'function') result.catch(() => {})
                    return result
                  } catch (error) { return undefined /* store carries it */ }
                },
                resolveText: text => {
                  if (typeof text === 'string') return text
                  try {
                    if (locale && typeof locale.resolveText === 'function') return locale.resolveText(text)
                  } catch (error) { /* fall through to English */ }
                  return (text && typeof text === 'object' && text.en) || ''
                },
                select: selection => {
                  const directory = directoryFor()
                  if (!directory || typeof directory.select !== 'function') return Promise.resolve(undefined)
                  try { return directory.select(selection) } catch (error) { return Promise.resolve(undefined) }
                },
              }
            },
          }, SeatBoundary))
        })
      },
    }
  },
})
