// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat';

// Run `npx @eslint/config-inspector` to inspect the resolved config interactively
export default createConfigForNuxt({
  features: {
    // Rules for module authors
    tooling: true,
    // Rules for formatting
    stylistic: false,
  },
  dirs: {
    src: ['./playground'],
  },
}).overrideRules({
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^(_|e)', varsIgnorePattern: '^(_|e)' }],
  'vue/multi-word-component-names': 'off',
  'vue/html-self-closing': 'off',
  'vue/no-v-html': 'off',
});
