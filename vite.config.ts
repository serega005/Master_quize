
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Загружаем переменные из .env файлов и системного окружения
  const env = loadEnv(mode, process.cwd(), '');
  
  // Ищем ключ во всех возможных источниках (API_KEY, VITE_API_KEY или системный process.env)
  const apiKey = env.API_KEY || env.VITE_API_KEY || process.env.API_KEY || "";
  
  console.log('Build: API_KEY detected:', apiKey ? 'YES (Starts with ' + apiKey.substring(0, 4) + ')' : 'NO');

  return {
    plugins: [react()],
    define: {
      // Прямая замена строки process.env.API_KEY в коде приложения
      'process.env.API_KEY': JSON.stringify(apiKey)
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
