import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: true },
  compatibilityDate: '2024-12-31',
  vite: {
    optimizeDeps: {
      include: ['buffer'],
    },
    plugins: [nodePolyfills()],
  },
});
