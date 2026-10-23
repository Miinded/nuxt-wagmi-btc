import { defineNuxtPlugin, useHead } from '#app';

export default defineNuxtPlugin(async (nuxtApp) => {
  if (import.meta.client) {
    useHead({
      script: [
        {
          innerHTML: 'exports = {};',
          type: 'text/javascript',
        },
      ],
    });
    const bitcoinModule = await import('bitcoinjs-lib');
    const bitcoin = bitcoinModule.default || bitcoinModule; // Assure la compatibilité
    // Bibliothèque ECC requise par Taproot (adresses bc1p / tb1p) : implémentation JS pure, sans WASM
    const eccModule = await import('@bitcoinerlab/secp256k1');
    bitcoin.initEccLib(eccModule.default || eccModule);
    nuxtApp.provide('bitcoin', bitcoin);
  }
});
