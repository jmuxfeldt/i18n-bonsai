<template lang="pug">
.editor
  .toolbar
    NButton(text @click="onSelectSource" :disabled="isLoadingFiles") Select Source
    NButton(
      v-if="tableData.length > 0"
      text
      type="success"
      title="Save all locales back to their files"
      @click="requestSave"
    ) Save All Locales
    NButton(
      v-if="lastSelectedDir"
      text
      type="info"
      :disabled="isLoadingFiles"
      title="Reload files from disk — unsaved changes will be lost"
      @click="onReload"
    ) Reload
    NButton.addLocale(
      v-if="lastSelectedDir && !isLoadingFiles"
      text
      type="secondary"
      title="Add a new locale column"
      @click="openAddLocaleDialog"
     ) Add Locale
    .current-dir(v-if="lastSelectedDir")
      span.dir-label
        | Directory: {{ lastSelectedDir }}
        //span(v-if="currentGroupPrefix") &nbsp;| Group: {{ currentGroupPrefix || 'default' }}
      NButton(
        circle
        quaternary
        size="small"
        style="margin-left:8px"
        title="Clear saved directory"
        @click="onClearDir"
      )
        template(#icon)
          i.mdi.mdi-close

    .toolbar-right
      NButton(
        circle
        quaternary
        size="small"
        :type="showUntranslatedOnly ? 'warning' : 'default'"
        :title="showUntranslatedOnly ? 'Show all rows' : 'Show untranslated only'"
        @click="showUntranslatedOnly = !showUntranslatedOnly"
      )
        template(#icon)
          i.mdi.mdi-translate-off
      NInput(
        ref="searchField"
        v-model:value="searchString"
        placeholder="Search translations..."
        size="small"
        clearable
        class="search-input"
        @clear="searchString = ''"
      )
      span.search-hint(v-if="showSearchHint") min 3 chars

  .spinner-container(v-if="isLoadingFiles")
    .css-spinner

  .translation-grid(
    v-else-if="tableData.length > 0"
    :style="{ '--locale-count': locales.length }"
  )
    .translation-grid-header
      .grid-cell.actions-column Actions
      .grid-cell.key-column Key / Context
      .grid-cell(v-for="locale in locales" :key="locale")
        .locale-header
          .locale-name {{ locale }}
          .locale-actions
            NButton(
              v-if="locale !== localprefs.primaryLang"
              text
              size="small"
              type="primary"
              title="Translate missing items in this column"
              @click="guardedTranslateColumn(locale)"
            )
              template(#icon)
                i.mdi.mdi-translate.col-trans
    VList.translation-grid-scroll(
      :data="filteredTableData"
      style="height: calc(100vh - 276px)"
    )
      template(#default="{ item }")
        .translation-grid-row
          .grid-cell.actions-column
            NButton(
              circle
              quaternary
              size="small"
              style="margin-right:16px"
              @click="addRow(item)"
            )
              template(#icon)
                i.mdi.mdi-plus
            NButton(
              circle
              quaternary
              size="small"
              type="primary"
              title="Retranslate all locales for this row"
              :loading="busyRows.has(item.key)"
              :disabled="busyRows.has(item.key)"
              @click="guardedRetranslateRow(item)"
            )
              template(#icon)
                i.mdi.mdi-translate
            NButton(
              circle
              quaternary
              size="small"
              type="error"
              style="margin-right:16px"
              @click="deleteRow(item)"
            )
              template(#icon)
                i.mdi.mdi-delete-outline
          .grid-cell.key-column
            .key-field
              input.text-field-key(
                v-model="item.key"
                :class="{ 'key-invalid': isKeyInvalid(item.key) }"
              )
            .context-field
              textarea.text-field-context(
                v-autogrow
                v-model="item.context"
                placeholder="Add context..."
              )
          .grid-cell(v-for="locale in locales" :key="locale")
            .locale-cell
              textarea.translation-textarea(
                v-autogrow
                v-model="item[locale]"
                spellcheck="false"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
              )
              NButton(
                v-if="locale !== localprefs.primaryLang"
                circle
                quaternary
                size="small"
                style="margin-left:4px;margin-top:8px;flex-shrink:0"
                title="Retranslate this item"
                :loading="busyCells.has(cellId(item.key, locale))"
                :disabled="busyCells.has(cellId(item.key, locale))"
                @click="guardedTranslate(item.key, locale, item)"
              )
                template(#icon)
                  i.mdi.mdi-translate

  NModal(v-model:show="translationInProgress" :mask-closable="false")
    NCard(style="width:400px" :bordered="false" size="small")
      template(#header) Translating {{ translationProgress.locale }}
      .modal-content
        p.mb-small {{ translationProgress.current }} / {{ translationProgress.total }} keys translated
        NProgress(
          type="line"
          :percentage="translationProgress.total ? (translationProgress.current / translationProgress.total) * 100 : 0"
          :height="8"
          :border-radius="4"
          :show-indicator="false"
        )
      template(#footer)
        .dialog-footer
          NButton(type="error" @click="translationCancelled = true") Cancel

  NModal(v-model:show="showSaveConfirmDialog" :mask-closable="true" @keydown.enter="confirmSave")
    NCard(style="width:400px" :bordered="false" size="small")
      template(#header) Overwrite files?
      p This will overwrite and sort all existing translation files in the current directory. This cannot be undone.
      template(#footer)
        .dialog-footer
          NButton(@click="showSaveConfirmDialog = false") Cancel
          NButton(type="success" @click="confirmSave") Save

  NModal(v-model:show="showAddLocaleDialog" :mask-closable="true")
    NCard(style="width:360px" :bordered="false" size="small")
      template(#header) Add Locale
      .modal-content
        NInput(
          v-model:value="newLocaleName"
          autofocus
          placeholder="e.g. de, zh-CN, pt-BR"
          @input="newLocaleError = ''"
          @keydown.enter="confirmAddLocale"
        )
        p.error-text(v-if="newLocaleError") {{ newLocaleError }}
      template(#footer)
        .dialog-footer
          NButton(@click="showAddLocaleDialog = false") Cancel
          NButton(type="primary" @click="confirmAddLocale") Add

  NModal(v-model:show="showDiscardDialog" :mask-closable="true" @keydown.enter="confirmDiscard")
    NCard(style="width:400px" :bordered="false" size="small")
      template(#header) Unsaved changes
      p You have unsaved changes that will be lost. Continue?
      template(#footer)
        .dialog-footer
          NButton(@click="cancelDiscard") Cancel
          NButton(type="warning" @click="confirmDiscard") Discard changes
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

type AutogrowEl = HTMLTextAreaElement & { _agResize?: () => void }

const vAutogrow = {
  mounted(el: AutogrowEl) {
    const resize = () => {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
    el._agResize = resize
    el.addEventListener('input', resize)
    nextTick(resize)
  },
  updated(el: AutogrowEl) {
    if (el._agResize) nextTick(el._agResize)
  },
  unmounted(el: AutogrowEl) {
    if (el._agResize) el.removeEventListener('input', el._agResize)
  },
}
import {
  NInput,
  NButton,
  NModal,
  NCard,
  NProgress,
  useMessage,
  type InputInst,
} from 'naive-ui'
import { VList } from 'virtua/vue'
import { invoke } from '@tauri-apps/api/core'
import { listen, emit } from '@tauri-apps/api/event'
import { open as dialogOpen } from '@tauri-apps/plugin-dialog'
import { useLocalprefs } from '@/stores/localprefs'
import { useTranslationFiles, isTauri, globalContext, type TableRow } from '@/composables/useTranslationFiles'
import { useTranslation } from '@/composables/useTranslation'

const message = useMessage()

const localprefs = useLocalprefs()
const {
  locales,
  tableData,
  lastSelectedDir,
  currentGroupPrefix,
  isLoadingFiles,
  isDirty,
  unflattenObject,
  init,
  readLocaleFiles,
  reloadTranslationFiles,
  clearSavedDirectory,
  addLocale,
} = useTranslationFiles()

const showSaveConfirmDialog = ref(false)
const showAddLocaleDialog = ref(false)
const newLocaleName = ref('')
const newLocaleError = ref('')

// ─── Unsaved-changes guard ─────────────────────────────────────────────
const showDiscardDialog = ref(false)
let pendingDiscardAction: (() => void) | null = null

const confirmIfDirty = (action: () => void) => {
  if (!isDirty.value) {
    action()
    return
  }
  pendingDiscardAction = action
  showDiscardDialog.value = true
}
const confirmDiscard = () => {
  showDiscardDialog.value = false
  const action = pendingDiscardAction
  pendingDiscardAction = null
  action?.()
}
const cancelDiscard = () => {
  showDiscardDialog.value = false
  pendingDiscardAction = null
}
const onSelectSource = () => confirmIfDirty(readLocaleFiles)
const onReload = () => confirmIfDirty(reloadTranslationFiles)
const onClearDir = () => confirmIfDirty(clearSavedDirectory)

// ─── Per-cell / per-row translate busy state ───────────────────────────
const busyCells = ref<Set<string>>(new Set())
const busyRows = ref<Set<string>>(new Set())
const cellId = (key: string, locale: string) => `${key} ${locale}`

// ─── Key validation (block save on empty / duplicate keys) ─────────────
const duplicateKeys = computed(() => {
  const counts = new Map<string, number>()
  for (const row of tableData.value) {
    const k = row.key.trim()
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k))
})
const emptyKeyCount = computed(() => tableData.value.filter((r) => !r.key.trim()).length)
const isKeyInvalid = (key: string) => !key.trim() || duplicateKeys.value.has(key.trim())

const requestSave = () => {
  if (emptyKeyCount.value > 0) {
    message.error(`Cannot save: ${emptyKeyCount.value} row(s) have an empty key.`)
    return
  }
  if (duplicateKeys.value.size > 0) {
    const dupes = [...duplicateKeys.value]
    message.error(
      `Cannot save: duplicate key(s): ${dupes.slice(0, 5).join(', ')}${dupes.length > 5 ? '…' : ''}`,
    )
    return
  }
  showSaveConfirmDialog.value = true
}

const LOCALE_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/

const openAddLocaleDialog = () => {
  newLocaleName.value = ''
  newLocaleError.value = ''
  showAddLocaleDialog.value = true
}

const confirmAddLocale = async () => {
  const name = newLocaleName.value.trim()
  if (!name) {
    newLocaleError.value = 'Locale code is required'
    return
  }
  if (!LOCALE_RE.test(name)) {
    newLocaleError.value = 'Invalid locale format (e.g. de, zh-CN, pt-BR)'
    return
  }
  if (locales.value.includes(name)) {
    newLocaleError.value = `Locale "${name}" already exists`
    return
  }
  const ok = await addLocale(name)
  if (ok) showAddLocaleDialog.value = false
  else newLocaleError.value = 'Failed to create locale file'
}

const {
  translationInProgress,
  translationCancelled,
  translationProgress,
  translate,
  translateColumn,
  retranslateRow,
} = useTranslation()

watch(
  () => tableData.value.map((r) => r.key),
  (keys, prevKeys) => {
    const idx = keys.indexOf('global-context')
    if (idx !== -1) {
      message.warning('"global-context" is a reserved key and cannot be used.')
      tableData.value[idx].key = prevKeys?.[idx] ?? ''
    }
  },
)

const searchString = ref('')
const searchField = ref<InputInst | null>(null)
const showUntranslatedOnly = ref(false)
const showSearchHint = computed(
  () => searchString.value.length > 0 && searchString.value.length < 3,
)

const requireApiKey = () => {
  if (localprefs.chatGptApiKey) return true
  message.error('No API key set — add one in Settings.', { duration: 3000 })
  return false
}

const guardedTranslateColumn = (locale: string) => {
  if (requireApiKey()) translateColumn(locale)
}
const guardedRetranslateRow = async (item: TableRow) => {
  if (!requireApiKey()) return
  const k = item.key
  busyRows.value = new Set(busyRows.value).add(k)
  try {
    await retranslateRow(item)
  } finally {
    const s = new Set(busyRows.value)
    s.delete(k)
    busyRows.value = s
  }
}
const guardedTranslate = async (key: string, locale: string, item: TableRow) => {
  if (!requireApiKey()) return
  const id = cellId(key, locale)
  busyCells.value = new Set(busyCells.value).add(id)
  try {
    await translate(key, locale, item)
  } finally {
    const s = new Set(busyCells.value)
    s.delete(id)
    busyCells.value = s
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
    event.preventDefault()
    searchField.value?.focus()
  }
}

let unlistenClose: (() => void) | undefined

onMounted(async () => {
  await init()
  if (!localprefs.chatGptApiKey) message.error('No API key set — add one in Settings.', { duration: 3000 })
  window.addEventListener('keydown', handleKeyDown)
  if (isTauri()) {
    // Rust intercepts window close (Cmd-W) and app quit (Cmd-Q) and asks us
    // first. Pass straight through when clean; otherwise confirm the discard.
    unlistenClose = await listen('app-close-requested', () => {
      if (showDiscardDialog.value) return
      if (!isDirty.value) {
        void emit('confirm-exit')
        return
      }
      pendingDiscardAction = () => {
        void emit('confirm-exit')
      }
      showDiscardDialog.value = true
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  unlistenClose?.()
})

const addRow = (item: TableRow) => {
  const absIdx = tableData.value.indexOf(item)
  if (absIdx === -1) return
  const keyParts = item.key.split('.')
  keyParts[keyParts.length - 1] = 'NEW_KEY'
  const base = keyParts.join('.')
  // Avoid duplicate keys (which would silently collide on save).
  const existing = new Set(tableData.value.map((r) => r.key))
  let key = base
  let n = 2
  while (existing.has(key)) key = `${base}_${n++}`
  const newRow: TableRow = { key, context: '' }
  locales.value.forEach((locale) => {
    newRow[locale] = ''
  })
  tableData.value.splice(absIdx + 1, 0, newRow)
}

const deleteRow = (item: TableRow) => {
  const absIdx = tableData.value.indexOf(item)
  if (absIdx !== -1) tableData.value.splice(absIdx, 1)
}

const confirmSave = () => {
  showSaveConfirmDialog.value = false
  saveAllLocales()
}

// Serialize a flat key→value map to pretty JSON, normalizing escaped
// newlines to a single `\n` (used for both context and locale files so they
// round-trip identically).
const serialize = (data: Record<string, string>) =>
  JSON.stringify(unflattenObject(data), null, 2).replace(/\\\\n/g, '\\n')

const buildFileDataArray = (dirPath: string) => {
  const contextFileName =
    currentGroupPrefix.value === ''
      ? 'context.json'
      : `${currentGroupPrefix.value}.context.json`
  const contextData = tableData.value.reduce(
    (acc, row) => {
      if (row.context) acc[row.key] = row.context.replace(/\n/g, '\\n')
      return acc
    },
    { 'global-context': globalContext.value } as Record<string, string>,
  )
  return [
    {
      locale: 'context',
      filePath: `${dirPath}/${contextFileName}`,
      content: serialize(contextData),
    },
    ...locales.value.map((locale) => {
      const localeData: Record<string, string> = {}
      tableData.value.forEach((row) => {
        if (row[locale]) localeData[row.key] = row[locale].replace(/\n/g, '\\n')
      })
      const localeFileName =
        currentGroupPrefix.value === ''
          ? `${locale}.json`
          : `${currentGroupPrefix.value}.${locale}.json`
      return { locale, filePath: `${dirPath}/${localeFileName}`, content: serialize(localeData) }
    }),
  ]
}

const saveAllLocales = async () => {
  try {
    if (isTauri()) {
      let dirPath = lastSelectedDir.value
      if (!dirPath) {
        const selected = await dialogOpen({ directory: true })
        if (!selected) return
        dirPath = typeof selected === 'string' ? selected : selected[0]
        lastSelectedDir.value = dirPath
        localprefs.setLastTranslationDir(dirPath)
      }
      const fileDataArray = buildFileDataArray(dirPath)
      const saveResults = await invoke<{ success: number; total: number }>('translation_write_files', {
        fileDataArray,
      })
      if (saveResults.success < saveResults.total) {
        message.warning(`Saved ${saveResults.success}/${saveResults.total} files — some failed.`)
      } else {
        message.success(`Saved ${saveResults.total} file${saveResults.total === 1 ? '' : 's'}.`)
        isDirty.value = false
      }
    } else {
      const files = buildFileDataArray('')
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
      for (const item of files) {
        const fileName = item.filePath.split(/[\\/]/).pop()!
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(item.content)
        await writable.close()
      }
      message.success(`Saved ${files.length} file${files.length === 1 ? '' : 's'}.`)
      isDirty.value = false
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    console.error('Error saving all locales:', err)
    message.error(`Save failed: ${err instanceof Error ? err.message : 'unknown error'}`)
  }
}

const filteredTableData = computed(() => {
  let rows = tableData.value
  if (showUntranslatedOnly.value)
    rows = rows.filter((item) => locales.value.some((locale) => !item[locale]?.trim()))
  if (searchString.value.length < 3) return rows
  const q = searchString.value.toLowerCase()
  return rows.filter((item) => {
    if (item.key.toLowerCase().includes(q)) return true
    return locales.value.some((locale) => item[locale]?.toLowerCase().includes(q))
  })
})
</script>

<style scoped lang="sass">
.editor
  display: flex
  flex-direction: column

.editor-title
  margin: 0 0 12px

.toolbar
  display: flex
  align-items: center
  flex-wrap: wrap
  gap: 4px 24px
  margin-bottom: 12px

.toolbar-right
  display: flex
  align-items: center
  gap: 8px
  margin-left: auto

.current-dir
  display: flex
  align-items: center
  flex-wrap: wrap
  gap: 4px

.dir-label
  font-size: 0.8em
  color: var(--color-text-muted)
  font-weight: 600
  margin-right: -15px

.search-input
  width: 260px

.search-hint
  font-size: 0.7em
  color: var(--color-text-muted)
  white-space: nowrap

.text-field-key.key-invalid
  box-shadow: inset 0 0 0 1px #B00020
  border-radius: 4px

.spinner-container
  display: flex
  justify-content: center
  align-items: center
  padding: 80px 0

.translation-grid
  margin-top: 0.5rem
  border: 1px solid var(--color-border)
  border-radius: 4px
  overflow: hidden

.translation-grid-header,
.translation-grid-row
  display: grid
  grid-template-columns: 100px 250px repeat(var(--locale-count), minmax(200px, 1fr))
  border-bottom: 1px solid var(--color-border)

  .grid-cell
    padding: 5px 4px 2px
    text-align: left
    vertical-align: top
    overflow: hidden

.translation-grid-header
  background-color: var(--color-bg-subtle)
  position: sticky
  top: 0
  z-index: 2
  padding-right: 14px
  font-weight: bold

  .grid-cell
    white-space: nowrap
    padding-left: 10px

  .grid-cell.actions-column, .grid-cell.key-column
    height: 30px
    margin: 5px 0

  .locale-header
    height: 30px

.translation-grid-scroll
  background-color: var(--color-surface)

.translation-grid-row

  .grid-cell.actions-column
    padding-top: 10px

  .grid-cell.key-column
    padding-top: 10px

.key-column
  width: 250px
  min-width: 250px
  padding: 4px

  .key-field, .context-field
    margin-bottom: 4px

    &:last-child
      margin-bottom: 0

.text-field-key
  display: block
  width: 100%
  border: none
  outline: none
  background: transparent
  font-family: inherit
  font-size: 15px
  color: inherit
  padding: 2px 5px
  box-sizing: border-box
  min-height: 24px

  &:focus
    background-color: var(--color-bg-focus)
    border-radius: 4px

.text-field-context,
.translation-textarea
  display: block
  width: 100%
  border: none
  outline: none
  background: transparent
  resize: none
  font-family: inherit
  font-size: 15px
  color: inherit
  padding: 2px 5px
  box-sizing: border-box
  overflow: hidden
  line-height: 1.5

  &:focus
    background-color: var(--color-bg-focus)
    border-radius: 4px

.translation-textarea
  flex: 1
  min-height: 48px

.locale-cell
  display: flex
  align-items: flex-start

.locale-header
  display: flex
  flex-direction: row
  align-items: center
  justify-content: space-between
  gap: 8px

  .locale-name
    font-weight: bold
    white-space: nowrap

  .locale-actions
    display: flex
    gap: 4px
    flex-shrink: 0

.actions-column
  width: 100px
  min-width: 100px

.modal-content
  padding-top: 12px

.mb-small
  margin-bottom: 12px

.dialog-footer
  display: flex
  justify-content: flex-end
  gap: 8px

.error-text
  color: #B00020
  font-size: 0.85em
  margin-top: 6px
  margin-bottom: 0

.css-spinner
  width: 52px
  height: 52px
  border-radius: 50%
  border: 4px solid var(--color-primary-faint)
  border-top-color: var(--color-primary)
  animation: css-spin 0.8s linear infinite
.col-trans
  position: relative
  margin-right: 15px
  font-weight: bold
  &:after
    font-weight: normal
    font-size: 70%
    display: block
    position: absolute
    content: "↓"
    bottom: 0
    left: -10px
@keyframes css-spin
  to
    transform: rotate(360deg)
</style>
