import { defineStore } from "pinia"
import type { StoreDefinition } from "pinia"

interface LocalPrefs {
  chatGptApiKey: string
  primaryLang: string
  translationModel: string
  projects: Project[]
  selectedProject: Project | null
  lastTranslationDir: string
  lastTranslationGroupPrefix: string
  darkMode: boolean
}

export interface Project {
  key: string
  path: string
}

export const useLocalprefs: StoreDefinition<"localprefs"> = defineStore(
  "localprefs",
  {
    state: (): LocalPrefs => ({
      chatGptApiKey: localStorage.getItem('chatGptApiKey') || '',
      primaryLang: localStorage.getItem('primaryLang') || 'en',
      translationModel: localStorage.getItem('translationModel') || 'gpt-4o-mini',
      projects: [] as Project[],
      selectedProject: null as Project | null,
      lastTranslationDir: localStorage.getItem('lastTranslationDir') || '',
      lastTranslationGroupPrefix: localStorage.getItem('lastTranslationGroupPrefix') || '',
      darkMode: localStorage.getItem('darkMode') === 'true'
    }),

    actions: {
      removeProject(key: string) {
        this.projects = this.projects.filter((p) => p.key !== key)
        if (this.selectedProject?.key === key) {
          this.selectedProject = null
        }
      },

      setLastTranslationDir(path: string) {
        this.lastTranslationDir = path
        localStorage.setItem('lastTranslationDir', path)
      },

      setLastTranslationGroupPrefix(groupPrefix: string) {
        this.lastTranslationGroupPrefix = groupPrefix
        localStorage.setItem('lastTranslationGroupPrefix', groupPrefix)
      },

      setChatGptApiKey(key: string) {
        this.chatGptApiKey = key
        localStorage.setItem('chatGptApiKey', key)
      },

      setPrimaryLang(lang: string) {
        this.primaryLang = lang
        localStorage.setItem('primaryLang', lang)
      },

      setTranslationModel(model: string) {
        this.translationModel = model
        localStorage.setItem('translationModel', model)
      },

      setDarkMode(value: boolean) {
        this.darkMode = value
        localStorage.setItem('darkMode', String(value))
      }
    },

    persist: true,
  }
)

// Export the type for use in other components
export type { LocalPrefs }
