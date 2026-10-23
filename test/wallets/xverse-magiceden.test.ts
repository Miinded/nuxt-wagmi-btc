// @vitest-environment happy-dom
import { UserRejectedRequestError } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PSBT_BASE64 = 'cHNidP8BAD0CAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////AegDAAAAAAAAAWoAAAAAAAAA';
const PAYMENT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const ORDINAL = 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';
const walletAddresses = [
  { address: PAYMENT, publicKey: 'pk-payment', purpose: 'payment' },
  { address: ORDINAL, publicKey: 'pk-ordinal', purpose: 'ordinals' },
];
const connected = {
  payment: { address: PAYMENT, publicKey: 'pk-payment' },
  ordinal: { address: ORDINAL, publicKey: 'pk-ordinal' },
};

const satsRequest = vi.fn();
const getProviderById = vi.fn(() => ({ request: vi.fn() }));
// écouteurs Xverse : on garde les callbacks pour simuler un changement de compte
const listeners = new Map<string, () => void>();
const unsubscribe = vi.fn();
const addListener = vi.fn((event: string, cb: () => void) => {
  listeners.set(event, cb);
  return unsubscribe;
});
vi.mock('sats-connect', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sats-connect')>()),
  request: satsRequest,
  getProviderById,
  addListener,
}));

const win = window as unknown as Record<string, unknown>;

describe('Xverse', () => {
  let xverse: typeof import('../../src/runtime/composables/xverse');

  beforeEach(async () => {
    vi.resetModules();
    satsRequest.mockReset();
    unsubscribe.mockReset();
    listeners.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    xverse = await import('../../src/runtime/composables/xverse');
  });

  it('récupère le provider Xverse par son identifiant', () => {
    xverse.xverseProvider();
    expect(getProviderById).toHaveBeenCalledWith('XverseProviders.BitcoinProvider');
  });

  it('se connecte une seule fois puis réutilise les adresses', async () => {
    satsRequest.mockResolvedValue({ status: 'success', result: { addresses: walletAddresses } });

    await expect(xverse.xverseConnect()).resolves.toEqual(connected);
    await expect(xverse.xverseAddresses()).resolves.toEqual(connected);
    expect(satsRequest).toHaveBeenCalledTimes(1);
    expect(satsRequest.mock.calls[0]![0]).toBe('wallet_connect');
  });

  it('se connecte quand on demande les adresses sans connexion préalable', async () => {
    satsRequest.mockResolvedValue({ status: 'success', result: { addresses: walletAddresses } });
    await expect(xverse.xverseAddresses()).resolves.toEqual(connected);
  });

  it('demande le réseau configuré à la connexion', async () => {
    const { wagmiBtcOptions } = await import('../stubs/app');
    wagmiBtcOptions.network = 'signet';
    satsRequest.mockResolvedValue({ status: 'success', result: { addresses: walletAddresses } });

    await xverse.xverseConnect();

    expect(satsRequest.mock.calls[0]![1]).toMatchObject({ network: 'Signet' });
  });

  it('oublie les adresses quand le compte ou le réseau change, ou à la déconnexion', async () => {
    satsRequest.mockResolvedValue({ status: 'success', result: { addresses: walletAddresses } });
    await xverse.xverseConnect();
    expect([...listeners.keys()].sort()).toEqual(['accountChange', 'networkChange']);

    listeners.get('accountChange')!();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
    await xverse.xverseConnect();
    expect(satsRequest).toHaveBeenCalledTimes(2);

    xverse.xverseDisconnect();
    await xverse.xverseAddresses();
    expect(satsRequest).toHaveBeenCalledTimes(3);
  });

  it('propage le refus de l’utilisateur et les erreurs du portefeuille', async () => {
    satsRequest.mockResolvedValueOnce({ status: 'error', error: { code: -32000, message: 'rejected' } });
    await expect(xverse.xverseConnect()).rejects.toBeInstanceOf(UserRejectedRequestError);

    const walletError = { code: -32603, message: 'internal' };
    satsRequest.mockResolvedValueOnce({ status: 'error', error: walletError });
    await expect(xverse.xverseConnect()).rejects.toBe(walletError);
  });

  it('signe avec l’adresse de paiement, signe une PSBT et envoie des BTC', async () => {
    satsRequest.mockImplementation(async (method: string) => {
      switch (method) {
        case 'wallet_connect':
          return { status: 'success', result: { addresses: walletAddresses } };
        case 'signMessage':
          return { status: 'success', result: { signature: 'sig' } };
        case 'signPsbt':
          return { status: 'success', result: { psbt: PSBT_BASE64, txid: 'txid' } };
        case 'sendTransfer':
          return { status: 'success', result: { txid: 'txid-send' } };
      }
    });

    await expect(xverse.xverseSignMessage({ a: 1 } as never)).resolves.toBe('sig');
    expect(satsRequest).toHaveBeenCalledWith(
      'signMessage',
      { address: PAYMENT, message: '{"a":1}' },
      'XverseProviders.BitcoinProvider',
    );

    await expect(
      xverse.xverseSignPsbt(PSBT_BASE64, [{ address: PAYMENT, signingIndexes: [0] }], false),
    ).resolves.toEqual({
      psbt: PSBT_BASE64,
      txid: 'txid',
    });
    expect(satsRequest).toHaveBeenCalledWith(
      'signPsbt',
      { psbt: PSBT_BASE64, broadcast: false, signInputs: { [PAYMENT]: [0] } },
      'XverseProviders.BitcoinProvider',
    );

    await expect(xverse.xverseSendBtc([{ address: ORDINAL, amount: 1500 }])).resolves.toBe('txid-send');
  });
});

describe('Magic Eden', () => {
  let magicEden: typeof import('../../src/runtime/composables/magicEden');
  let provider: Record<string, ReturnType<typeof vi.fn> | boolean>;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    magicEden = await import('../../src/runtime/composables/magicEden');
    provider = {
      isMagicEden: true,
      connect: vi.fn().mockResolvedValue({ addresses: walletAddresses }),
      signMessage: vi.fn().mockResolvedValue('sig'),
      signTransaction: vi.fn().mockResolvedValue({ psbtBase64: PSBT_BASE64, txId: 'txid' }),
      sendBtcTransaction: vi.fn().mockResolvedValue('txid-send'),
    };
    win.magicEden = { bitcoin: provider };
  });

  afterEach(() => {
    delete win.magicEden;
  });

  it('renvoie null sans portefeuille Bitcoin Magic Eden, sans ouvrir de fenêtre', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    win.magicEden = { bitcoin: { isMagicEden: false } };
    expect(magicEden.magicEdenProvider()).toBeNull();
    win.magicEden = {};
    expect(magicEden.magicEdenProvider()).toBeNull();
    delete win.magicEden;
    expect(magicEden.magicEdenProvider()).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('transmet le réseau configuré au portefeuille', async () => {
    const { wagmiBtcOptions } = await import('../stubs/app');
    wagmiBtcOptions.network = 'testnet';
    const decode = (token: string) => JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());

    await magicEden.magicEdenConnect();
    await magicEden.magicEdenSignMessage('x' as never);

    expect(decode((provider.connect as ReturnType<typeof vi.fn>).mock.calls[0]![0]).network).toEqual({
      type: 'Testnet',
    });
    expect(decode((provider.signMessage as ReturnType<typeof vi.fn>).mock.calls[0]![0]).network).toEqual({
      type: 'Testnet',
    });
  });

  it('oublie les adresses quand le compte change, ou à la déconnexion', async () => {
    const on = vi.fn();
    provider.on = on;
    await magicEden.magicEdenConnect();
    expect(on).toHaveBeenCalledWith('accountsChanged', magicEden.magicEdenDisconnect);

    on.mock.calls[0]![1]();
    await magicEden.magicEdenConnect();
    expect(provider.connect).toHaveBeenCalledTimes(2);
    expect(on).toHaveBeenCalledTimes(1);

    magicEden.magicEdenDisconnect();
    await magicEden.magicEdenAddresses();
    expect(provider.connect).toHaveBeenCalledTimes(3);
  });

  it('se connecte une seule fois via un jeton non signé', async () => {
    await expect(magicEden.magicEdenConnect()).resolves.toEqual(connected);
    await expect(magicEden.magicEdenAddresses()).resolves.toEqual(connected);
    expect(provider.connect).toHaveBeenCalledTimes(1);
    const token = (provider.connect as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString())).toMatchObject({
      purposes: ['payment', 'ordinals'],
    });
  });

  it('traduit le code 4001 en refus et propage les autres erreurs', async () => {
    (provider.connect as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ code: 4001 });
    await expect(magicEden.magicEdenConnect()).rejects.toBeInstanceOf(UserRejectedRequestError);

    const failure = new Error('locked');
    (provider.connect as ReturnType<typeof vi.fn>).mockRejectedValueOnce(failure);
    await expect(magicEden.magicEdenConnect()).rejects.toBe(failure);
  });

  it('signe un message, signe une PSBT et envoie des BTC', async () => {
    await expect(magicEden.magicEdenSignMessage('hello' as never)).resolves.toBe('sig');
    await expect(
      magicEden.magicEdenSignPsbt(PSBT_BASE64, [{ address: PAYMENT, signingIndexes: [0] }], true),
    ).resolves.toEqual({
      psbt: PSBT_BASE64,
      txid: 'txid',
    });
    await expect(magicEden.magicEdenSendBtc([{ address: ORDINAL, amount: 1500 }])).resolves.toBe('txid-send');
  });

  it('rejette quand le portefeuille refuse ou échoue', async () => {
    (provider.signTransaction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error('declined'), { name: 'UserDeclinedError' }),
    );
    await expect(magicEden.magicEdenSignPsbt(PSBT_BASE64, [], false)).rejects.toThrow('declined');

    (provider.signMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    await expect(magicEden.magicEdenSignMessage('x' as never)).rejects.toThrow('boom');

    (provider.sendBtcTransaction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    await expect(magicEden.magicEdenSendBtc([{ address: ORDINAL, amount: 1 }])).rejects.toThrow('boom');
  });
});
