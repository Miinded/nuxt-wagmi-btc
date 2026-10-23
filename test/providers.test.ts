import * as bitcoinjs from 'bitcoinjs-lib';
import { describe, expect, it } from 'vitest';
import { getConnectors } from '../src/runtime/composables/getConnectors';
import { getProvider } from '../src/runtime/composables/getProvider';
import { getProviders } from '../src/runtime/composables/getProviders';
import { useWagmiBtc } from '../src/runtime/composables/useWagmiBtc';
import plugin from '../src/runtime/plugins/bitcoinjs.client';
import { nuxtApp, useHead, wagmiBtcOptions } from './stubs/app';

describe('portefeuilles', () => {
  it('expose les cinq portefeuilles avec la même API', () => {
    const providers = getProviders();

    expect(providers.map((p) => p.id)).toEqual(['magicEden', 'leather', 'xverse', 'phantom', 'unisat']);
    for (const provider of providers) {
      for (const method of ['provider', 'connect', 'signature', 'signaturePsbt', 'sendBtc', 'getAddresses'] as const) {
        expect(typeof provider[method]).toBe('function');
      }
    }
  });

  it('retrouve le portefeuille d’un connecteur', () => {
    expect(getProvider({ id: 'unisat', name: 'Unisat' }).id).toBe('unisat');
    expect(getProvider({ id: 'inconnu', name: '?' })).toBeUndefined();
  });

  it('lit les connecteurs configurés dans le runtime config', () => {
    expect(useWagmiBtc()).toBe(wagmiBtcOptions);
    expect(getConnectors()).toBe(wagmiBtcOptions.connectors);
  });
});

describe('plugin bitcoinjs.client', () => {
  it('fournit bitcoinjs-lib comme $bitcoin côté client', async () => {
    await (plugin as unknown as (app: typeof nuxtApp) => Promise<void>)(nuxtApp);

    expect(useHead).toHaveBeenCalledWith({
      script: [{ innerHTML: 'exports = {};', type: 'text/javascript' }],
    });
    const [name, provided] = nuxtApp.provide.mock.calls[0]!;
    expect(name).toBe('bitcoin');
    expect((provided as typeof bitcoinjs).Psbt).toBe(bitcoinjs.Psbt);
  });
});
