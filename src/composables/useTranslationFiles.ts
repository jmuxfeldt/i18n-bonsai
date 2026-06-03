import { ref, watch, nextTick } from 'vue'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { open as dialogOpen } from '@tauri-apps/plugin-dialog'
import { createDiscreteApi } from 'naive-ui'
import { useLocalprefs } from '@/stores/localprefs'

// Message API usable outside a setup() / provider context (e.g. on file load).
const { message: discreteMessage } = createDiscreteApi(['message'])

export interface I18nFile {
  name: string
  content: Record<string, string>
}

export interface TableRow {
  key: string
  context: string
  [key: string]: string
}

export const DEFAULT_GLOBAL_CONTEXT =
  'You are a skilled translator of translation strings for a computer application or online app. Use terse sentences or phrases where possible. ' +
  'Try to find translations without personal pronouns unless instructed otherwise. '

// ─── Singleton state shared across all component calls ────────────────
const i18nFiles = ref<I18nFile[]>([])
const contextFile = ref<I18nFile | null>(null)
const localeFiles = ref<string[]>([])
const locales = ref<string[]>([])
const tableData = ref<TableRow[]>([])
const isLoadingFiles = ref(false)
const isDirty = ref(false)
const lastSelectedDir = ref('')
const currentGroupPrefix = ref('')
export const globalContext = ref(DEFAULT_GLOBAL_CONTEXT)

let stateInitialized = false
let watcherInstalled = false
let initDone = false

// ─── Pure utilities ───────────────────────────────────────────────────
export const flattenObject = (obj: any, prefix = ''): Record<string, string> =>
  Object.keys(obj).reduce((acc: Record<string, string>, key: string) => {
    const pre = prefix.length ? `${prefix}.` : ''
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      Object.assign(acc, flattenObject(obj[key], pre + key))
    } else {
      acc[pre + key] = obj[key]
    }
    return acc
  }, {})

export const unflattenObject = (obj: Record<string, any>) => {
  const result: Record<string, any> = {}
  for (const key in obj) {
    const parts = key.split('.')
    let current = result
    const lastPart = parts.pop()!
    for (const part of parts) {
      current[part] = current[part] || {}
      current = current[part]
    }
    current[lastPart] = obj[key]
  }
  return result
}

const processFileContent = (file: I18nFile) => {
  const processObject = (obj: any) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/\\n/g, '\n')
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        processObject(obj[key])
      }
    }
  }
  processObject(file.content)
}

const extractGroupPrefix = (fileName: string): { groupPrefix: string; locale: string } => {
  const parts = fileName.replace('.json', '').split('.')
  if (parts.length >= 2) {
    return { locale: parts[parts.length - 1], groupPrefix: parts.slice(0, -1).join('.') }
  }
  return { groupPrefix: '', locale: parts[0] }
}

export { isTauri }

// ─── Composable ───────────────────────────────────────────────────────
export function useTranslationFiles() {
  const localprefs = useLocalprefs()

  // Initialize localprefs-dependent state once
  if (!stateInitialized) {
    stateInitialized = true
    lastSelectedDir.value = localprefs.lastTranslationDir || ''
    currentGroupPrefix.value = localprefs.lastTranslationGroupPrefix || ''
  }

  // Reset the dirty flag after a (re)load. The deep watcher below flags the
  // data dirty when load mutates tableData, so wait a tick before clearing.
  const markClean = async () => {
    await nextTick()
    isDirty.value = false
  }

  const createTableData = () => {
    const primaryFileName = currentGroupPrefix.value === ''
      ? `${localprefs.primaryLang}.json`
      : `${currentGroupPrefix.value}.${localprefs.primaryLang}.json`

    const primaryFile = i18nFiles.value.find(f => f.name === primaryFileName)
    if (!primaryFile) {
      console.error(`Primary file not found: ${primaryFileName}`, i18nFiles.value.map(f => f.name))
      return
    }

    const contextFileName = currentGroupPrefix.value === ''
      ? 'context.json'
      : `${currentGroupPrefix.value}.context.json`
    contextFile.value = i18nFiles.value.find(f => f.name === contextFileName) || null

    locales.value = i18nFiles.value
      .filter(f => f.name !== contextFileName && f.name.endsWith('.json'))
      .map(f => currentGroupPrefix.value === ''
        ? f.name.replace('.json', '')
        : f.name.replace(`${currentGroupPrefix.value}.`, '').replace('.json', '')
      )
      .sort((a, b) => {
        if (a === localprefs.primaryLang) return -1
        if (b === localprefs.primaryLang) return 1
        return a.localeCompare(b)
      })

    const primaryFlat = flattenObject(primaryFile.content)
    const contextFlat = contextFile.value ? flattenObject(contextFile.value.content) : {}

    if (contextFlat['global-context']) globalContext.value = contextFlat['global-context']

    if ('global-context' in primaryFlat) {
      discreteMessage.warning('"global-context" is a reserved key and cannot be used in translation files. It will be ignored.')
    }

    // Flatten each locale file once up front rather than per-key (was
    // O(keys × locales × filesize); locale files can be large).
    const localeFlat = new Map<string, Record<string, string>>()
    locales.value.forEach(locale => {
      const fileName = currentGroupPrefix.value === ''
        ? `${locale}.json`
        : `${currentGroupPrefix.value}.${locale}.json`
      const file = i18nFiles.value.find(f => f.name === fileName)
      localeFlat.set(locale, file ? flattenObject(file.content) : {})
    })

    tableData.value = Object.entries(primaryFlat)
      .filter(([key]) => !key.startsWith('_') && key !== 'global-context')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key]) => {
        const row: TableRow = { key, context: contextFlat[key] || '' }
        locales.value.forEach(locale => {
          row[locale] = localeFlat.get(locale)?.[key] || ''
        })
        return row
      })
  }

  const applyGroupResult = async (groupResult: any) => {
    i18nFiles.value = []
    for (const file of groupResult.jsonFiles) {
      if (!file.content || typeof file.content !== 'object') {
        file.content = {}
      } else {
        processFileContent(file)
      }
      i18nFiles.value.push(file)
    }

    // Re-scan directory to recover empty files Rust silently dropped
    if (isTauri() && groupResult.dirPath) {
      try {
        const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs')
        const entries = await readDir(groupResult.dirPath)
        const loadedNames = new Set(i18nFiles.value.map((f: I18nFile) => f.name))
        const gp: string = groupResult.groupPrefix
        for (const entry of entries) {
          if (!entry.name?.endsWith('.json')) continue
          const isContext = gp === '' ? entry.name === 'context.json' : entry.name === `${gp}.context.json`
          const isMatch = gp === ''
            ? entry.name.replace('.json', '').split('.').length === 1
            : entry.name.startsWith(`${gp}.`) && !isContext
          if ((isMatch || isContext) && !loadedNames.has(entry.name)) {
            try {
              const text = await readTextFile(`${groupResult.dirPath}/${entry.name}`)
              if (!text.trim()) i18nFiles.value.push({ name: entry.name, content: {} })
            } catch (err) { console.error(`Could not read ${entry.name}:`, err) }
          }
        }
      } catch (err) {
        console.error('Error scanning directory for excluded files:', err)
      }
    }

    const primaryFileName = currentGroupPrefix.value === ''
      ? `${localprefs.primaryLang}.json`
      : `${currentGroupPrefix.value}.${localprefs.primaryLang}.json`
    const primaryFile = i18nFiles.value.find((f: I18nFile) => f.name === primaryFileName)
    if (!primaryFile) {
      i18nFiles.value.push({ name: primaryFileName, content: { 'itemKey': 'dummy source text' } })
    } else if (!primaryFile.content || typeof primaryFile.content !== 'object' || Object.keys(primaryFile.content).length === 0) {
      primaryFile.content = { 'itemKey': 'dummy source text' }
    }

    localeFiles.value = i18nFiles.value.map((f: I18nFile) => f.name)
    createTableData()
    await markClean()
  }

  const loadFilesFromGroup = async (dirPath: string, groupPrefix: string) => {
    const fileName = groupPrefix === ''
      ? `${localprefs.primaryLang}.json`
      : `${groupPrefix}.${localprefs.primaryLang}.json`
    const groupResult = await invoke<any>('read_translation_group', {
      selectedFilePath: `${dirPath}/${fileName}`,
    })
    if (!groupResult || groupResult.jsonFiles.length === 0) return null
    return groupResult
  }

  const loadSavedDirectory = async () => {
    if (!lastSelectedDir.value || !isTauri()) return
    isLoadingFiles.value = true
    try {
      const groupResult = await loadFilesFromGroup(lastSelectedDir.value, currentGroupPrefix.value)
      if (!groupResult) {
        lastSelectedDir.value = ''
        currentGroupPrefix.value = ''
        localprefs.setLastTranslationDir('')
        localprefs.setLastTranslationGroupPrefix('')
        return
      }
      await applyGroupResult(groupResult)
    } catch (err) {
      console.error('Error loading saved translation group:', err)
      lastSelectedDir.value = ''
      currentGroupPrefix.value = ''
      localprefs.setLastTranslationDir('')
      localprefs.setLastTranslationGroupPrefix('')
    } finally {
      isLoadingFiles.value = false
    }
  }

  const readLocaleFiles = async () => {
    isLoadingFiles.value = true
    tableData.value = []
    try {
      if (isTauri()) {
        const selected = await dialogOpen({
          multiple: false,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        })
        if (!selected) return
        const selectedPath = typeof selected === 'string' ? selected : selected[0]
        const selectedFileName = selectedPath.split(/[\\/]/).pop() ?? ''
        const { locale: selectedLocale } = extractGroupPrefix(selectedFileName)
        const groupResult = await invoke<any>('read_translation_group', {
          selectedFilePath: selectedPath,
        })
        if (!groupResult || groupResult.jsonFiles.length === 0) {
          throw new Error('No translation files found for the selected group')
        }
        currentGroupPrefix.value = groupResult.groupPrefix
        lastSelectedDir.value = groupResult.dirPath
        localprefs.setLastTranslationDir(groupResult.dirPath)
        localprefs.setLastTranslationGroupPrefix(groupResult.groupPrefix)
        if (selectedLocale) localprefs.setPrimaryLang(selectedLocale)
        await applyGroupResult(groupResult)
      } else {
        if (!('showOpenFilePicker' in window)) {
          throw new Error('Your browser does not support the File System Access API')
        }
        const fileHandles = await (window as any).showOpenFilePicker({
          types: [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }],
          multiple: false
        })
        if (!fileHandles || fileHandles.length === 0) return
        const selectedFile = await fileHandles[0].getFile()
        const { groupPrefix, locale: selectedLocale } = extractGroupPrefix(selectedFile.name)
        currentGroupPrefix.value = groupPrefix
        if (selectedLocale) localprefs.setPrimaryLang(selectedLocale)
        const dirHandle = await fileHandles[0].getParent()
        i18nFiles.value = []
        for await (const entry of dirHandle.values()) {
          if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
          const isContextFile = groupPrefix === ''
            ? entry.name === 'context.json'
            : entry.name === `${groupPrefix}.context.json`
          const isGroupMatch = groupPrefix === ''
            ? entry.name.replace('.json', '').split('.').length === 1
            : entry.name.startsWith(`${groupPrefix}.`) && !isContextFile
          if (isGroupMatch || isContextFile) {
            const fileText = await (await entry.getFile()).text()
            let content: Record<string, any>
            if (!fileText.trim()) {
              content = {}
            } else {
              content = JSON.parse(fileText)
            }
            const fileObj: I18nFile = { name: entry.name, content }
            processFileContent(fileObj)
            i18nFiles.value.push(fileObj)
          }
        }
        localeFiles.value = i18nFiles.value.map(f => f.name)
        createTableData()
        await markClean()
      }
    } catch (err) {
      console.error('Error reading translation files:', err)
      localeFiles.value = []
      i18nFiles.value = []
      tableData.value = []
    } finally {
      isLoadingFiles.value = false
    }
  }

  const reloadTranslationFiles = async () => {
    if (!lastSelectedDir.value) return
    isLoadingFiles.value = true
    tableData.value = []
    try {
      if (isTauri()) {
        const groupResult = await loadFilesFromGroup(lastSelectedDir.value, currentGroupPrefix.value)
        if (!groupResult) throw new Error('No translation files found for the current group')
        await applyGroupResult(groupResult)
      } else {
        await readLocaleFiles()
      }
    } catch (err) {
      console.error('Error reloading translation files:', err)
    } finally {
      isLoadingFiles.value = false
    }
  }

  const clearSavedDirectory = () => {
    lastSelectedDir.value = ''
    currentGroupPrefix.value = ''
    localprefs.setLastTranslationDir('')
    localprefs.setLastTranslationGroupPrefix('')
    i18nFiles.value = []
    localeFiles.value = []
    tableData.value = []
    void markClean()
  }

  const loadDevTestData = async () => {
    const modules = import.meta.glob('../testData/*.json')
    i18nFiles.value = []
    for (const path in modules) {
      const mod = await modules[path]() as { default: Record<string, string> }
      const fileName = path.split('/').pop()!
      const fileObj: I18nFile = { name: fileName, content: { ...mod.default } }
      processFileContent(fileObj)
      i18nFiles.value.push(fileObj)
    }
    currentGroupPrefix.value = ''
    lastSelectedDir.value = 'src/testData (dev)'
    localeFiles.value = i18nFiles.value.map(f => f.name)
    createTableData()
    await markClean()
  }

  const addLocale = async (localeName: string): Promise<boolean> => {
    const fileName = currentGroupPrefix.value === ''
      ? `${localeName}.json`
      : `${currentGroupPrefix.value}.${localeName}.json`

    try {
      if (isTauri()) {
        await invoke('translation_write_file', {
          filePath: `${lastSelectedDir.value}/${fileName}`,
          content: '{}',
        })
      }
      // Browser: no stored dirHandle — silently add to in-memory state only
    } catch (err) {
      console.error('Error creating locale file:', err)
      return false
    }

    const newFile: I18nFile = { name: fileName, content: {} }
    i18nFiles.value.push(newFile)
    locales.value = [...locales.value, localeName].sort((a, b) => {
      if (a === localprefs.primaryLang) return -1
      if (b === localprefs.primaryLang) return 1
      return a.localeCompare(b)
    })
    tableData.value.forEach(row => { row[localeName] = '' })
    return true
  }

  const init = async () => {
    if (initDone) return
    initDone = true
    if (lastSelectedDir.value && isTauri()) {
      await loadSavedDirectory()
    } else if (import.meta.env.DEV && !isTauri()) {
      await loadDevTestData()
    }
  }

  if (!watcherInstalled) {
    watcherInstalled = true
    watch(() => localprefs.primaryLang, () => {
      if (lastSelectedDir.value) reloadTranslationFiles()
    })
    // Any edit to the table or global context marks the session dirty.
    watch([tableData, globalContext], () => { isDirty.value = true }, { deep: true })
  }

  return {
    i18nFiles,
    contextFile,
    localeFiles,
    locales,
    tableData,
    lastSelectedDir,
    currentGroupPrefix,
    isLoadingFiles,
    isDirty,
    markClean,
    isTauri,
    unflattenObject,
    init,
    readLocaleFiles,
    reloadTranslationFiles,
    clearSavedDirectory,
    addLocale,
  }
}
