import { ref } from 'vue'
import { useLocalprefs } from '@/stores/localprefs'
import { useTranslationFiles, globalContext, type TableRow } from './useTranslationFiles'

export const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
]

// Only these models support response_format: { type: 'json_object' }
const JSON_MODE_MODELS = new Set(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'])

export function useTranslation() {
  const localprefs = useLocalprefs()
  const { tableData, locales } = useTranslationFiles()

  const translationInProgress = ref(false)
  const translationCancelled = ref(false)
  const translationProgress = ref({ current: 0, total: 0, locale: '' })

  const translate = async (key: string, targetLang: string, item: Record<string, string>) => {
    const primaryValue = item[localprefs.primaryLang]
    if (!primaryValue) return

    try {
      let prompt = `Please translate the following text from ${localprefs.primaryLang} to ${targetLang}. The translation should be as short as possible.`
      if (globalContext.value) prompt += `\nGlobal Context: ${globalContext.value}`
      if (item.context) prompt += `\nContext: ${item.context}`
      prompt += `\nText: "${primaryValue}"\nTranslation:`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localprefs.chatGptApiKey}` },
        body: JSON.stringify({
          model: localprefs.translationModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      let translation = data.choices[0].message.content.trim()

      const hasOuterQuotes =
        (primaryValue.startsWith('"') && primaryValue.endsWith('"')) ||
        (primaryValue.startsWith("'") && primaryValue.endsWith("'"))
      if (hasOuterQuotes) {
        translation = translation.replace(/^["']|["']$/g, '')
        const quoteType = primaryValue.startsWith('"') ? '"' : "'"
        translation = `${quoteType}${translation}${quoteType}`
      } else {
        translation = translation.replace(/^["']|["']$/g, '')
      }

      item[targetLang] = translation
    } catch (error) {
      console.error('Translation error:', error)
      item[targetLang] = `Error: ${error instanceof Error ? error.message : 'Translation failed'}`
    }
  }

  const translateBatch = async (
    input: Record<string, { text: string; context?: string }>,
    sourceLang: string,
    targetLang: string
  ): Promise<Record<string, string>> => {
    const model = localprefs.translationModel
    let systemPrompt = `You are a professional translator. Translate all values in the provided JSON object from ${sourceLang} to ${targetLang}. Return ONLY a valid JSON object with the same keys and translated string values. Keep translations as short as possible.`
    if (globalContext.value) systemPrompt += `\nGlobal context: ${globalContext.value}`

    const contextHints = Object.entries(input)
      .filter(([, v]) => v.context)
      .map(([k, v]) => `- ${k}: ${v.context}`)
      .join('\n')
    if (contextHints) systemPrompt += `\nContext hints for specific keys:\n${contextHints}`

    const plainInput: Record<string, string> = {}
    for (const [key, val] of Object.entries(input)) plainInput[key] = val.text

    const requestBody: Record<string, any> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(plainInput) }
      ],
      temperature: 0.3
    }
    if (JSON_MODE_MODELS.has(model)) {
      requestBody.response_format = { type: 'json_object' }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localprefs.chatGptApiKey}` },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return JSON.parse(data.choices[0].message.content)
  }

  const translateColumn = async (targetLang: string) => {
    if (targetLang === localprefs.primaryLang) return

    const rowsToTranslate = tableData.value.filter(row =>
      !row[targetLang]?.trim() && !!row[localprefs.primaryLang]?.trim()
    )
    if (rowsToTranslate.length === 0) return

    translationProgress.value = { current: 0, total: rowsToTranslate.length, locale: targetLang }
    translationInProgress.value = true
    translationCancelled.value = false

    const CHUNK_SIZE = 50
    for (let i = 0; i < rowsToTranslate.length; i += CHUNK_SIZE) {
      if (translationCancelled.value) break
      const chunk = rowsToTranslate.slice(i, i + CHUNK_SIZE)
      const inputObj: Record<string, { text: string; context?: string }> = {}
      for (const row of chunk) {
        inputObj[row.key] = { text: row[localprefs.primaryLang] }
        if (row.context) inputObj[row.key].context = row.context
      }
      try {
        const result = await translateBatch(inputObj, localprefs.primaryLang, targetLang)
        for (const row of chunk) {
          if (result[row.key]) row[targetLang] = result[row.key]
        }
      } catch (err) {
        console.error('Batch translation error for chunk at index', i, err)
      }
      translationProgress.value.current = Math.min(i + CHUNK_SIZE, rowsToTranslate.length)
    }

    translationInProgress.value = false
  }

  const retranslateRow = async (item: TableRow) => {
    if (!item[localprefs.primaryLang]) return
    for (const locale of locales.value) {
      if (locale !== localprefs.primaryLang) {
        try {
          await translate(item.key, locale, item)
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          console.error(`Error translating key ${item.key} to ${locale}:`, error)
        }
      }
    }
  }

  return {
    translationInProgress,
    translationCancelled,
    translationProgress,
    translate,
    translateColumn,
    retranslateRow,
  }
}
