import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/budget_model_network_explorer/',
  plugins: [react()],
})

