import { vi } from 'vitest';
import type { ModuleOptions } from '../../src/runtime/types/wagmi-btc';

// Remplace l'import virtuel `#app` de Nuxt dans les tests unitaires (cf. vitest.config.ts)
export const wagmiBtcOptions: ModuleOptions = {
  iconPath: '/icon',
  connectors: [
    { id: 'xverse', name: 'Xverse', icon: '/icon/xverse-icon.png' },
    { id: 'unisat', name: 'Unisat', icon: '/icon/unisat-icon.png' },
  ],
};
export const useRuntimeConfig = vi.fn(() => ({ app: { wagmiBtc: wagmiBtcOptions } }));

/** `$bitcoin` est fourni par le plugin bitcoinjs.client ; les tests y placent bitcoinjs-lib ou un double */
export const nuxtApp: { $bitcoin?: unknown; provide: ReturnType<typeof vi.fn> } = { provide: vi.fn() };
export const useNuxtApp = vi.fn(() => nuxtApp);

export const useHead = vi.fn();
// Un plugin Nuxt est une simple fonction (nuxtApp) => void
export const defineNuxtPlugin = <T>(plugin: T): T => plugin;
