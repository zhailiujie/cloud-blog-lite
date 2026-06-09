import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { NButton, NConfigProvider, NDialogProvider, NEmpty, NInput, NMessageProvider, NSpace } from 'naive-ui'
import App from './App.vue'
import router from './router'
import './styles/main.css'

const app = createApp(App)

app.component('NButton', NButton)
app.component('NConfigProvider', NConfigProvider)
app.component('NDialogProvider', NDialogProvider)
app.component('NEmpty', NEmpty)
app.component('NInput', NInput)
app.component('NMessageProvider', NMessageProvider)
app.component('NSpace', NSpace)

app.use(createPinia())
app.use(router)
app.mount('#app')
