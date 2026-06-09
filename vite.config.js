import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // transformers.js imports from 'onnxruntime-web/webgpu' which crashes
      // on systems without a WebGPU adapter. Redirect to the WASM-only bundle.
      'onnxruntime-web/webgpu': fileURLToPath(
        new URL('./node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs', import.meta.url)
      ),
    },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers']
  },
  build: {
    target: 'es2022'
  }
})
