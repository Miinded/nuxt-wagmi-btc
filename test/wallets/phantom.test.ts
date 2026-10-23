// @vitest-environment happy-dom
import * as bitcoin from 'bitcoinjs-lib';
import { UserRejectedRequestError } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PSBT_BASE64 = 'cHNidP8BAD0CAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////AegDAAAAAAAAAWoAAAAAAAAA';
const PAYMENT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const ORDINAL = 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';
const RECIPIENT = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

const win = window as unknown as Record<string, unknown>;
const fetchMock = vi.fn();

describe('Phantom', () => {
  let phantom: typeof import('../../src/runtime/composables/phantom');
  let provider: Record<string, ReturnType<typeof vi.fn>>;
  // instance du stub `#app` vue par le module rechargé (vi.resetModules)
  let nuxtApp: (typeof import('../stubs/app'))['nuxtApp'];

  beforeEach(async () => {
    vi.resetModules();
    phantom = await import('../../src/runtime/composables/phantom');
    ({ nuxtApp } = await import('../stubs/app'));
    provider = {
      requestAccounts: vi.fn().mockResolvedValue([
        { address: PAYMENT, publicKey: 'pk-payment', addressType: 'p2wpkh', purpose: 'payment' },
        { address: ORDINAL, publicKey: 'pk-ordinal', addressType: 'p2tr', purpose: 'ordinals' },
      ]),
      signMessage: vi.fn().mockResolvedValue({ signature: new Uint8Array([1, 2, 3]) }),
      signPSBT: vi.fn().mockResolvedValue(new Uint8Array(Buffer.from(PSBT_BASE64, 'base64'))),
    };
    win.phantom = { bitcoin: provider };
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    delete win.phantom;
    vi.unstubAllGlobals();
  });

  it('renvoie null sans extension, et ouvre la documentation si Bitcoin n’est pas activé', () => {
    delete win.phantom;
    expect(phantom.phantomProvider()).toBeNull();

    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    win.phantom = {};
    expect(phantom.phantomProvider()).toBeNull();
    expect(open).toHaveBeenCalledWith('https://docs.phantom.com/bitcoin/integrating-phantom', '_blank');
  });

  it('associe les comptes selon leur usage (paiement, ordinals)', async () => {
    const expected = {
      payment: { address: PAYMENT, publicKey: 'pk-payment' },
      ordinal: { address: ORDINAL, publicKey: 'pk-ordinal' },
    };
    await expect(phantom.phantomConnect()).resolves.toEqual(expected);
    await expect(phantom.phantomAddresses()).resolves.toEqual(expected);
  });

  it('traduit un refus en UserRejectedRequestError', async () => {
    provider.requestAccounts!.mockRejectedValueOnce(new Error('rejected'));
    await expect(phantom.phantomConnect()).rejects.toBeInstanceOf(UserRejectedRequestError);
  });

  it('signe le message encodé et renvoie la signature en base64', async () => {
    await expect(phantom.phantomSignMessage({ a: 1 } as never)).resolves.toBe('AQID');
    const [address, bytes] = provider.signMessage!.mock.calls[0]!;
    expect(address).toBe(PAYMENT);
    expect(new TextDecoder().decode(bytes as Uint8Array)).toBe('{"a":1}');
  });

  it('signe une PSBT et la diffuse si demandé', async () => {
    const vIn = [{ address: PAYMENT, signingIndexes: [0] }];
    await expect(phantom.phantomSignPsbt(PSBT_BASE64, vIn, false)).resolves.toEqual({ psbt: PSBT_BASE64 });
    expect(provider.signPSBT!.mock.calls[0]![1]).toEqual({ inputsToSign: vIn });

    nuxtApp.$bitcoin = {
      Psbt: {
        fromBase64: () => ({ finalizeAllInputs: () => {}, extractTransaction: () => ({ toHex: () => '0200' }) }),
      },
    };
    fetchMock.mockResolvedValue({ ok: true, text: async () => 'txid' });
    await expect(phantom.phantomSignPsbt(PSBT_BASE64, vIn, true)).resolves.toEqual({ psbt: PSBT_BASE64, txid: 'txid' });
  });

  it('construit, signe et diffuse un envoi de BTC depuis l’adresse de paiement', async () => {
    const utxos = [
      { txid: 'ab'.repeat(32), vout: 0, value: 60_000 },
      { txid: 'cd'.repeat(32), vout: 1, value: 40_000 },
    ];
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/utxo')) return { ok: true, json: async () => utxos };
      if (url.endsWith('/fees/recommended')) return { ok: true, json: async () => ({ fastestFee: 3 }) };
      return { ok: true, text: async () => 'txid-send' };
    });
    // createPsbt utilise le vrai bitcoinjs-lib ; la finalisation est simulée (PSBT non signée)
    nuxtApp.$bitcoin = {
      networks: bitcoin.networks,
      Psbt: Object.assign(
        function Psbt(options: object) {
          return new bitcoin.Psbt(options);
        },
        {
          fromBase64: () => ({ finalizeAllInputs: () => {}, extractTransaction: () => ({ toHex: () => '0200' }) }),
        },
      ),
    };

    await expect(phantom.phantomSendBtc([{ address: RECIPIENT, amount: 30_000 }])).resolves.toBe('txid-send');
    expect(provider.signPSBT!.mock.calls[0]![1]).toEqual({
      inputsToSign: [{ address: PAYMENT, signingIndexes: [0, 1] }],
    });
  });

  it('refuse un envoi sans UTXO disponible', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    await expect(phantom.phantomSendBtc([{ address: RECIPIENT, amount: 1 }])).rejects.toThrow('enough UTXOs');
  });
});
