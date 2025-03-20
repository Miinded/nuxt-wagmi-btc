import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin(async (nuxtApp) => {
    if (import.meta.client) {
        const bitcoinModule = await import('bitcoinjs-lib');
        const bitcoin = bitcoinModule.default || bitcoinModule; // Assure la compatibilité
        nuxtApp.provide('bitcoin', bitcoin);
    }
  });