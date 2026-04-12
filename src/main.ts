import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import './assets/fonts'       // self-hosted Fraunces + IBM Plex (CSP-safe)
import './assets/main.css'
import { initTheme } from './composables/useTheme'

// Initialize theme before mount to prevent flash of wrong theme
initTheme()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
