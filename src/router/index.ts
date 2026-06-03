import { createRouter, createWebHashHistory } from 'vue-router'
import TranslationEditor from '@/components/TranslationEditor.vue'
import SettingsForm from '@/components/SettingsForm.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: TranslationEditor,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsForm,
    },
  ],
})

export default router
