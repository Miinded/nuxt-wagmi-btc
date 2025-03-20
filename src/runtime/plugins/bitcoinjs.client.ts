import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin(async (nuxtApp) => {
    if (import.meta.client) {
        const bitcoin = await import('bitcoinjs-lib');
        nuxtApp.provide('bitcoin', bitcoin);
    }
  });