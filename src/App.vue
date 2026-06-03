// @ts-nocheck
<template lang="pug">
NConfigProvider(
  :theme="isDark ? darkTheme : undefined"
  :theme-overrides="isDark ? darkThemeOverrides : lightThemeOverrides"
)
  NMessageProvider
    .app-wrapper
      header.app-bar
        img(src="/logo.svg" height="46" width="46" style="margin-left:8px")
        .app-title-group
          .app-title i18n Bonsai
          .app-subtitle ... tending your i18n files
        .header-spacer
        .nav-actions
          NButton(
            quaternary
            circle
            :class="{ 'nav-active': route.name === 'editor' }"
            title="Editor"
            @click="router.push('/')"
          )
            template(#icon)
              i.mdi.mdi-translate
          NButton(
            quaternary
            circle
            :class="{ 'nav-active': route.name === 'settings' }"
            title="Settings"
            @click="router.push('/settings')"
          )
            template(#icon)
              i.mdi.mdi-cog
          NButton(
            quaternary
            circle
            title="Toggle dark mode"
            style="margin-right:8px"
            @click="toggleDark"
          )
            template(#icon)
              i.mdi.mdi-theme-light-dark
      main.app-main
        RouterView
      footer.app-footer
        span © 2026&nbsp;
          a(href="https://www.glyph.de" target="_blank" @click.prevent="openLink('https://www.glyph.de')") Jost Muxfeldt
        span.sep ·
        a(href="https://github.com/jmuxfeldt/i18n-bonsai" target="_blank" @click.prevent="openLink('https://github.com/jmuxfeldt/i18n-bonsai')") GitHub
        span.sep ·
        a(href="https://github.com/jmuxfeldt/i18n-bonsai/issues" target="_blank" @click.prevent="openLink('https://github.com/jmuxfeldt/i18n-bonsai/issues')") Report an issue
        span.sep ·
        a(href="https://jmuxfeldt.github.io/i18n-bonsai" target="_blank" @click.prevent="openLink('https://jmuxfeldt.github.io/i18n-bonsai')") Help
        span.sep ·
        a.donate-link(href="https://liberapay.com/jmuxf/donate" target="_blank" title="Support i18n Bonsai" @click.prevent="openLink('https://liberapay.com/jmuxf/donate')")
          i.mdi.mdi-heart-outline
          |  Donate
        span.sep ·
        a(href="#" @click.prevent="showLicense = true") MIT License
  LicenseModal(v-model:show="showLicense")
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NConfigProvider,
  NMessageProvider,
  NButton,
  darkTheme,
  type GlobalThemeOverrides,
} from 'naive-ui'
import { isTauri } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useLocalprefs } from './stores/localprefs'
import LicenseModal from './components/LicenseModal.vue'

const localprefs = useLocalprefs()
const router = useRouter()
const route = useRoute()

const isDark = computed(() => localprefs.darkMode)

const inputFontSizes = {
  Input: {
    fontSizeMedium: '15px',
    fontSizeSmall: '13px',
  },
}

const lightThemeOverrides: GlobalThemeOverrides = {
  ...inputFontSizes,
  Card: { borderRadius: '10px' },
  common: {
    fontSize: '16px',
    primaryColor: '#2D6A4F',
    primaryColorHover: '#52B788',
    primaryColorPressed: '#1B4332',
    primaryColorSuppl: '#52B788',
    successColor: '#4CAF50',
    successColorHover: '#66BB6A',
    successColorPressed: '#388E3C',
    successColorSuppl: '#66BB6A',
    errorColor: '#B00020',
    errorColorHover: '#CF2038',
    errorColorPressed: '#8B0016',
    errorColorSuppl: '#CF2038',
    warningColor: '#FB8C00',
    warningColorHover: '#FFA726',
    warningColorPressed: '#E65100',
    warningColorSuppl: '#FFA726',
    infoColor: '#2196F3',
    infoColorHover: '#42A5F5',
    infoColorPressed: '#1565C0',
    infoColorSuppl: '#42A5F5',
  },
}

const darkThemeOverrides: GlobalThemeOverrides = {
  ...inputFontSizes,
  Card: { borderRadius: '10px' },
  common: {
    fontSize: '16px',
    primaryColor: '#52B788',
    primaryColorHover: '#95D5B2',
    primaryColorPressed: '#2D6A4F',
    primaryColorSuppl: '#95D5B2',
    successColor: '#81C784',
    successColorHover: '#A5D6A7',
    successColorPressed: '#4CAF50',
    successColorSuppl: '#A5D6A7',
    errorColor: '#CF6679',
    errorColorHover: '#E57373',
    errorColorPressed: '#B00020',
    errorColorSuppl: '#E57373',
    warningColor: '#FFB74D',
    warningColorHover: '#FFCC80',
    warningColorPressed: '#FB8C00',
    warningColorSuppl: '#FFCC80',
    infoColor: '#64B5F6',
    infoColorHover: '#90CAF9',
    infoColorPressed: '#2196F3',
    infoColorSuppl: '#90CAF9',
  },
}

watch(
  isDark,
  (val) => {
    document.documentElement.classList.toggle('dark', val)
  },
  { immediate: true },
)

const toggleDark = () => {
  localprefs.setDarkMode(!isDark.value)
}

const showLicense = ref(false)

const openLink = async (url: string) => {
  if (isTauri()) {
    try {
      await openUrl(url)
    } catch (e) {
      console.error('openUrl failed:', e)
    }
  } else {
    window.open(url, '_blank')
  }
}
</script>

<style scoped lang="sass">
.app-wrapper
  display: flex
  flex-direction: column
  height: 100vh
  overflow: hidden
  background-color: var(--color-surface)

.app-bar
  display: flex
  align-items: center
  height: 56px
  flex-shrink: 0
  //box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12)
  padding-left: 5px
  border-top: 1px solid #cccccc66
.dark .app-bar
  border-top: 1px solid #cccccc33
.app-title-group
  margin-left: 8px

.app-title
  font-size: 1.15rem
  font-weight: 600
  line-height: 1.2

.app-subtitle
  font-size: 0.7rem
  color: var(--color-text-muted)
  font-style: italic
  line-height: 1.2

.header-spacer
  flex: 1

.nav-actions
  display: flex
  align-items: center
  gap: 4px

.nav-active
  opacity: 0.4 !important

.app-main
  flex: 1
  overflow: auto
  padding: 16px

.app-footer
  flex-shrink: 0
  display: flex
  align-items: center
  justify-content: center
  gap: 8px
  height: 64px
  font-size: 0.75rem
  color: var(--color-text-muted)
  border-top: 1px solid var(--color-border)

  a
    color: var(--color-text-muted)
    text-decoration: none
    &:hover
      color: var(--color-primary)

  .sep
    opacity: 0.4

  .donate-link
    color: var(--color-primary)
    font-weight: 600

    .mdi
      font-size: 1.05em
      vertical-align: -1px
</style>
