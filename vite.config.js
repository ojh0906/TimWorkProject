import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  // [추가] public 폴더를 명시적으로 지정
  publicDir: 'public',
  server: {
    fs: { strict: false },
    // [추가] 정적 파일에 대해 강제로 404를 내뱉게 하여 index.html 리다이렉션 방지
    hmr: { overlay: true }
  },
  // [추가] 미디어 파일 확장자 명시
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.PNG', '**/*.JPG'],
  appType: 'spa'
})
