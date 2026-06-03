<template lang="pug">
.settings
  h3.settings-title Settings
  .settings-body
    .field-group
      .field-label Global Context
      NButton(
        text
        size="small"
        type="warning"
        style="margin-left:8px"
        @click="showResetDialog = true"
      ) Reset to default
    NInput(
      v-model:value="globalContext"
      type="textarea"
      :autosize="{ minRows: 3 }"
      placeholder="Add global context that will be applied to all translations..."
      class="global-context-input"
    )
    .field-label.mt ChatGPT API Key
    NInput(
      v-model:value="apiKey"
      :type="showPassword ? 'text' : 'password'"
      placeholder="Enter your API key"
      @blur="saveApiKey"
    )
      template(#suffix)
        NButton(text size="small" @click="showPassword = !showPassword")
          template(#icon)
            i.mdi(:class="showPassword ? 'mdi-eye-off' : 'mdi-eye'")
    .field-label.mt Translation Model
    NSelect(
      v-model:value="localprefs.translationModel"
      :options="modelItems"
      label-field="label"
      value-field="value"
      @update:value="localprefs.setTranslationModel"
    )
    NAlert.mt(type="warning" :show-icon="true")
      | API calls are billed to your OpenAI account at standard rates. Translating large files with many keys can incur costs, especially with GPT-4.

NModal(v-model:show="showResetDialog" :mask-closable="true" @keydown.enter="resetToDefault")
  NCard(style="width:420px" :bordered="false" size="small")
    template(#header) Reset global context?
    p This will replace your current global context with the built-in default. Any custom instructions will be lost.
    template(#footer)
      .dialog-footer
        NButton(@click="showResetDialog = false") Cancel
        NButton(type="warning" @click="resetToDefault") Reset
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NInput, NSelect, NAlert, NModal, NCard, NButton } from 'naive-ui'
import { useLocalprefs } from '@/stores/localprefs'
import { globalContext, DEFAULT_GLOBAL_CONTEXT } from '@/composables/useTranslationFiles'
import { OPENAI_MODELS } from '@/composables/useTranslation'

const localprefs = useLocalprefs()

const modelItems = OPENAI_MODELS
const showPassword = ref(false)
const apiKey = ref(localprefs.chatGptApiKey)
const showResetDialog = ref(false)

const saveApiKey = () => {
  localprefs.chatGptApiKey = apiKey.value
}

const resetToDefault = () => {
  globalContext.value = DEFAULT_GLOBAL_CONTEXT
  showResetDialog.value = false
}
</script>

<style scoped lang="sass">
.settings
  max-width: 640px

.settings-title
  margin: 0 0 16px

.settings-body
  display: flex
  flex-direction: column
  gap: 4px

.field-group
  display: flex
  align-items: center
  margin-bottom: 4px

.field-label
  font-size: 0.875rem
  font-weight: 500
  color: var(--color-text-muted)
  margin-bottom: 4px

.mt
  margin-top: 16px

.global-context-input
  width: 100%

.dialog-footer
  display: flex
  justify-content: flex-end
  gap: 8px
</style>
