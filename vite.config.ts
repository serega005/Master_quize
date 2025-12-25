
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Загружаем переменные окружения из текущей директории
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Приоритет: системная переменная (Vercel) -> переменная из .env -> пустота
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || "")
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: './index.html',
        },
      },
    },
    server: {
      port: 3000,
    },
  };
});
