import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const stub = (file: string) => fileURLToPath(new URL(`./test/stubs/${file}`, import.meta.url));

export default defineConfig({
  resolve: {
    // Imports virtuels de Nuxt, indisponibles hors d'une application Nuxt
    alias: {
      '#app': stub('app.ts'),
    },
  },
  define: {
    // Les tests unitaires s'exécutent comme côté client (plugin bitcoinjs.client)
    'import.meta.client': true,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.{ts,js}'],
    globals: true,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/runtime/types/**'],
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      // Seuils minimaux : la CI échoue si la couverture régresse
      thresholds: { statements: 97, branches: 88, functions: 92, lines: 97 },
    },
  },
});
