// @vitest-environment happy-dom
import { UserRejectedRequestError } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PSBT_BASE64 = 'cHNidP8BAD0CAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////AegDAAAAAAAAAWoAAAAAAAAA';
const PSBT_HEX =
  '70736274ff01003d020000000100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff01e803000000000000016a00000000000000';
const PAYMENT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const ORDINAL = 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';

const win = window as unknown as Record<string, unknown>;

afterEach(() => {
  delete win.unisat;
  delete win.LeatherProvider;
});

describe('Unisat', () => {
  const fake = () => ({
    requestAccounts: vi.fn().mockResolvedValue([PAYMENT]),
    getPublicKey: vi.fn().mockResolvedValue('02pubkey'),
    signMessage: vi.fn().mockResolvedValue('signature'),
    signPsbt: vi.fn().mockResolvedValue(PSBT_HEX),
    pushPsbt: vi.fn().mockResolvedValue('txid'),
    sendBitcoin: vi.fn().mockResolvedValue('txid-send'),
  });
  let unisat: typeof import('../../src/runtime/composables/unisat');
  let provider: ReturnType<typeof fake>;

  beforeEach(async () => {
    vi.resetModules();
    unisat = await import('../../src/runtime/composables/unisat');
    provider = fake();
    win.unisat = provider;
  });

  it('renvoie null quand l’extension est absente', () => {
    delete win.unisat;
    expect(unisat.unisatProvider()).toBeNull();
  });

  it('utilise le même compte pour le paiement et les ordinals', async () => {
    const expected = { address: PAYMENT, publicKey: '02pubkey' };
    await expect(unisat.unisatConnect()).resolves.toEqual({ payment: expected, ordinal: expected });
    await expect(unisat.unisatAddresses()).resolves.toEqual({ payment: expected, ordinal: expected });
  });

  it('signe le message sérialisé en BIP-322', async () => {
    await expect(unisat.unisatSignMessage({ nonce: 1 } as never)).resolves.toBe('signature');
    expect(provider.signMessage).toHaveBeenCalledWith('{"nonce":1}', 'bip322-simple');
  });

  it('signe une PSBT en hex, trie les entrées et diffuse si demandé', async () => {
    const vIn = [
      { address: PAYMENT, signingIndexes: [2, 0] },
      { address: ORDINAL, signingIndexes: [1] },
    ];

    await expect(unisat.unisatSignPsbt(PSBT_BASE64, vIn, false)).resolves.toEqual({ psbt: PSBT_BASE64 });
    expect(provider.signPsbt).toHaveBeenCalledWith(PSBT_HEX, {
      autoFinalized: false,
      toSignInputs: [
        { address: PAYMENT, index: 0 },
        { address: ORDINAL, index: 1 },
        { address: PAYMENT, index: 2 },
      ],
    });
    expect(provider.pushPsbt).not.toHaveBeenCalled();

    await expect(unisat.unisatSignPsbt(PSBT_BASE64, vIn, true)).resolves.toEqual({ psbt: PSBT_BASE64, txid: 'txid' });
    expect(provider.pushPsbt).toHaveBeenCalledWith(PSBT_HEX);
  });

  it('envoie à un seul destinataire sans modifier la liste reçue', async () => {
    const recipients = [{ address: ORDINAL, amount: 1500 }];
    await expect(unisat.unisatSendBtc(recipients)).resolves.toBe('txid-send');
    expect(provider.sendBitcoin).toHaveBeenCalledWith(ORDINAL, 1500);
    expect(recipients).toHaveLength(1);

    await expect(unisat.unisatSendBtc([...recipients, ...recipients])).rejects.toThrow('more thant 1 recipient');
  });
});

describe('Leather', () => {
  const addresses = [
    { symbol: 'BTC', type: 'p2wpkh', address: PAYMENT, publicKey: 'pk-payment', derivationPath: '' },
    { symbol: 'BTC', type: 'p2tr', address: ORDINAL, publicKey: 'pk-ordinal', derivationPath: '' },
  ];
  let leather: typeof import('../../src/runtime/composables/leather');
  let request: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    leather = await import('../../src/runtime/composables/leather');
    request = vi.fn(async (action: string) => {
      switch (action) {
        case 'getAddresses':
          return { result: { addresses } };
        case 'signMessage':
          return { result: { signature: 'sig' } };
        case 'signPsbt':
          return { result: { hex: PSBT_HEX, txid: 'txid' } };
        case 'sendTransfer':
          return { result: { txid: 'txid-send' } };
      }
    });
    win.LeatherProvider = { request };
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('renvoie null quand l’extension est absente', () => {
    delete win.LeatherProvider;
    expect(leather.leatherProvider()).toBeNull();
  });

  it('connecte le portefeuille une seule fois et garde les adresses', async () => {
    const expected = {
      payment: { address: PAYMENT, publicKey: 'pk-payment' },
      ordinal: { address: ORDINAL, publicKey: 'pk-ordinal' },
    };
    await expect(leather.leatherConnect()).resolves.toEqual(expected);
    await expect(leather.leatherConnect()).resolves.toEqual(expected);
    await expect(leather.leatherAddresses()).resolves.toEqual(expected);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('se connecte quand on demande les adresses sans connexion préalable', async () => {
    await expect(leather.leatherAddresses()).resolves.toMatchObject({ payment: { address: PAYMENT } });
    expect(request).toHaveBeenCalledWith('getAddresses');
  });

  it('laisse vide une adresse absente du portefeuille au lieu de planter', async () => {
    request.mockResolvedValueOnce({ result: { addresses: [addresses[0]] } });
    await expect(leather.leatherConnect()).resolves.toEqual({
      payment: { address: PAYMENT, publicKey: 'pk-payment' },
      ordinal: { address: '', publicKey: '' },
    });
  });

  it('traduit un refus en UserRejectedRequestError', async () => {
    request.mockRejectedValueOnce(new Error('cancel'));
    await expect(leather.leatherConnect()).rejects.toBeInstanceOf(UserRejectedRequestError);
  });

  it('signe, signe une PSBT et envoie des BTC', async () => {
    await expect(leather.leatherSignMessage('hello' as never)).resolves.toBe('sig');
    expect(request).toHaveBeenCalledWith('signMessage', { message: '"hello"' });

    await expect(
      leather.leatherSignPsbt(PSBT_BASE64, [{ address: PAYMENT, signingIndexes: [0, 1] }], true),
    ).resolves.toEqual({ psbt: PSBT_BASE64, txid: 'txid' });
    expect(request).toHaveBeenCalledWith('signPsbt', {
      hex: PSBT_HEX,
      broadcast: true,
      signInputs: { [PAYMENT]: [0, 1] },
    });

    await expect(leather.leatherSendBtc([{ address: ORDINAL, amount: 1500 }])).resolves.toBe('txid-send');
    expect(request).toHaveBeenCalledWith('sendTransfer', {
      network: 'mainnet',
      recipients: [{ address: ORDINAL, amount: '1500' }],
    });
  });
});
