import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin(async (nuxtApp) => {
    if (import.meta.client) {
        const bitcoin = await import('bitcoinjs-lib').then(m => m.default || m); // ✅ Force l'usage d'ESM
        nuxtApp.provide('bitcoin', bitcoin);
    }
  });