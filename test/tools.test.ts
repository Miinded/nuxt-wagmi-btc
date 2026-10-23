import * as bitcoin from 'bitcoinjs-lib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  base64ToUint8Array,
  broadcastTx,
  convertPsbt,
  createPsbt,
  estimateTxSize,
  finalizeAndExtractTx,
  getAddressType,
  getFeeRate,
  getUtxos,
  isBase64,
  isHex,
  sendBtcTransaction,
  signMessage,
  signTransaction,
  Uint8ArrayToBase64,
} from '../src/runtime/composables/tools';
import { nuxtApp } from './stubs/app';

// PSBT minimale (1 entrée, 1 sortie OP_RETURN) dans ses deux encodages
const PSBT_BASE64 = 'cHNidP8BAD0CAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////AegDAAAAAAAAAWoAAAAAAAAA';
const PSBT_HEX =
  '70736274ff01003d020000000100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff01e803000000000000016a00000000000000';

const P2WPKH = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const P2TR = 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';
const OTHER_P2WPKH = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

const fetchMock = vi.fn();
const response = (body: unknown, ok = true) => ({
  ok,
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

describe('encodages', () => {
  it('reconnaît l’hexadécimal et le base64', () => {
    expect(isHex('0aff')).toBe(true);
    expect(isHex('0af')).toBe(false);
    expect(isHex('zz')).toBe(false);
    expect(isBase64(PSBT_BASE64)).toBe(true);
    expect(isBase64('pas du base64 !')).toBe(false);
  });

  it('convertit une PSBT dans les deux sens, quel que soit le format d’entrée', () => {
    expect(convertPsbt(PSBT_BASE64, 'hex')).toBe(PSBT_HEX);
    expect(convertPsbt(PSBT_HEX, 'hex')).toBe(PSBT_HEX);
    expect(convertPsbt(PSBT_HEX, 'base64')).toBe(PSBT_BASE64);
    expect(convertPsbt(PSBT_BASE64, 'base64')).toBe(PSBT_BASE64);
    // `force` n'a plus d'effet : une PSBT déjà au bon format n'est pas corrompue
    expect(convertPsbt(PSBT_HEX, 'hex', true)).toBe(PSBT_HEX);
    expect(convertPsbt(PSBT_BASE64, 'base64', true)).toBe(PSBT_BASE64);
  });

  it('fait l’aller-retour Uint8Array ↔ base64', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(base64ToUint8Array(Uint8ArrayToBase64(bytes))).toEqual(bytes);
  });
});

describe('adresses et taille de transaction', () => {
  it.each([
    ['1BoatSLRHtKNngkdXEeobR76b53LETtpyT', 'P2PKH'],
    ['3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'P2SH'],
    [P2WPKH, 'P2WPKH'],
    ['bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', 'P2WSH'],
    [P2TR, 'P2TR'],
  ])('%s est une adresse %s', (address, type) => {
    expect(getAddressType(address)).toBe(type);
  });

  it('rejette un format inconnu', () => {
    expect(() => getAddressType('tb1qtestnet')).toThrow('Invalide address format');
  });

  it('estime la taille selon le type et le nombre d’entrées/sorties', () => {
    expect(estimateTxSize('P2WPKH', 2, 2)).toBe(2 * 68 + 2 * 31 + 10);
    expect(estimateTxSize('P2PKH', 1, 1, 'P2TR')).toBe(148 + 26 + 10);
    expect(estimateTxSize('INCONNU', 1, 1, 'INCONNU')).toBe(10);
  });
});

describe('mempool.space', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lit le fee rate le plus rapide', async () => {
    fetchMock.mockResolvedValue(response({ fastestFee: 21, halfHourFee: 12 }));
    await expect(getFeeRate()).resolves.toBe(21);
  });

  it('récupère les UTXO d’une adresse', async () => {
    fetchMock.mockResolvedValue(response([{ txid: 'aa', vout: 1, value: 5000, status: { confirmed: true } }]));
    await expect(getUtxos(P2WPKH)).resolves.toEqual([{ txid: 'aa', vout: 1, value: 5000 }]);
    expect(fetchMock).toHaveBeenCalledWith(`https://mempool.space/api/address/${P2WPKH}/utxo`);
  });

  it('remonte les erreurs de l’API', async () => {
    fetchMock.mockResolvedValue(response('Invalid Bitcoin address', false));
    await expect(getUtxos('x')).rejects.toThrow('Invalid Bitcoin address');
    await expect(broadcastTx('00')).rejects.toThrow('Erreur de broadcast: Invalid Bitcoin address');
  });

  it('diffuse une transaction et renvoie son txid', async () => {
    fetchMock.mockResolvedValue(response('txid123'));
    await expect(broadcastTx('0200')).resolves.toBe('txid123');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST', body: '0200' });
  });

  describe('createPsbt', () => {
    beforeEach(() => {
      nuxtApp.$bitcoin = bitcoin;
      fetchMock.mockResolvedValue(response({ fastestFee: 2 }));
    });

    it('ajoute les entrées, les destinataires et la monnaie rendue', async () => {
      const utxos = [{ txid: 'ab'.repeat(32), vout: 0, value: 100_000 }];
      // destinataire P2WPKH : une sortie Taproot exige initEccLib, que le module n'appelle pas
      const base64 = await createPsbt(
        { address: P2WPKH, publicKey: '' },
        [{ address: OTHER_P2WPKH, amount: 30_000 }],
        utxos,
      );

      const psbt = bitcoin.Psbt.fromBase64(base64);
      const fee = estimateTxSize('P2WPKH', 1, 2) * 2;
      expect(psbt.txInputs).toHaveLength(1);
      expect(psbt.txOutputs.map((o) => [o.address, o.value])).toEqual([
        [OTHER_P2WPKH, 30_000],
        [P2WPKH, 100_000 - 30_000 - fee],
      ]);
    });

    it('refuse un envoi supérieur au solde frais compris', async () => {
      const utxos = [{ txid: 'ab'.repeat(32), vout: 0, value: 1_000 }];
      await expect(
        createPsbt({ address: P2WPKH, publicKey: '' }, [{ address: P2TR, amount: 1_000 }], utxos),
      ).rejects.toThrow('insufficient funds');
    });
  });
});

describe('finalizeAndExtractTx', () => {
  it('finalise la PSBT signée et renvoie la transaction en hex', () => {
    const finalizeAllInputs = vi.fn();
    const fromBase64 = vi.fn(() => ({ finalizeAllInputs, extractTransaction: () => ({ toHex: () => '0200abcd' }) }));
    nuxtApp.$bitcoin = { Psbt: { fromBase64 } };

    expect(finalizeAndExtractTx(PSBT_HEX)).toBe('0200abcd');
    expect(fromBase64).toHaveBeenCalledWith(PSBT_BASE64);
    expect(finalizeAllInputs).toHaveBeenCalled();
  });
});

describe('requêtes sats-connect (signMessage, signTransaction, sendBtcTransaction)', () => {
  const handlers = () => ({ onFinish: vi.fn(), onCancel: vi.fn(), onError: vi.fn() });
  const declined = Object.assign(new Error('declined'), { name: 'UserDeclinedError' });
  const network = { type: 'Mainnet' } as never;

  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

  it('signMessage transmet la réponse, le refus ou l’erreur du portefeuille', async () => {
    const provider = { signMessage: vi.fn().mockResolvedValueOnce('sig') };
    let h = handlers();
    await signMessage({
      ...h,
      getProvider: async () => provider as never,
      payload: { network, address: P2WPKH, message: 'hi' },
    });
    expect(h.onFinish).toHaveBeenCalledWith('sig');

    provider.signMessage.mockRejectedValueOnce(declined);
    h = handlers();
    await signMessage({
      ...h,
      getProvider: async () => provider as never,
      payload: { network, address: P2WPKH, message: 'hi' },
    });
    expect(h.onCancel).toHaveBeenCalledWith(declined);

    provider.signMessage.mockRejectedValueOnce(new Error('boom'));
    h = handlers();
    await signMessage({
      ...h,
      getProvider: async () => provider as never,
      payload: { network, address: P2WPKH, message: 'hi' },
    });
    expect(h.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
  });

  it('signMessage exige une adresse et un message', async () => {
    const getProvider = async () => ({}) as never;
    await expect(
      signMessage({ ...handlers(), getProvider, payload: { network, address: '', message: 'x' } }),
    ).rejects.toThrow('An address is required');
    await expect(
      signMessage({ ...handlers(), getProvider, payload: { network, address: P2WPKH, message: '' } }),
    ).rejects.toThrow('A message to be signed is required');
  });

  it('signTransaction valide la PSBT et les entrées puis relaie la réponse', async () => {
    const getProvider = async () => provider as never;
    const provider = { signTransaction: vi.fn().mockResolvedValue({ psbtBase64: PSBT_BASE64 }) };
    const payload = {
      network,
      message: '',
      psbtBase64: PSBT_BASE64,
      inputsToSign: [{ address: P2WPKH, signingIndexes: [0] }],
    };

    const h = handlers();
    await signTransaction({ ...h, getProvider, payload });
    expect(h.onFinish).toHaveBeenCalledWith({ psbtBase64: PSBT_BASE64 });

    await expect(
      signTransaction({ ...handlers(), getProvider, payload: { ...payload, psbtBase64: '' } }),
    ).rejects.toThrow('psbtBase64');
    await expect(
      signTransaction({ ...handlers(), getProvider, payload: { ...payload, inputsToSign: undefined as never } }),
    ).rejects.toThrow('inputs to be signed');

    provider.signTransaction.mockRejectedValueOnce(declined);
    const cancelled = handlers();
    await signTransaction({ ...cancelled, getProvider, payload });
    expect(cancelled.onCancel).toHaveBeenCalled();

    provider.signTransaction.mockRejectedValueOnce(new Error('boom'));
    const failed = handlers();
    await signTransaction({ ...failed, getProvider, payload });
    expect(failed.onError).toHaveBeenCalled();
  });

  it('sendBtcTransaction sérialise les montants et valide la demande', async () => {
    const provider = { sendBtcTransaction: vi.fn().mockResolvedValue('txid') };
    const getProvider = async () => provider as never;
    const payload = { network, senderAddress: P2WPKH, recipients: [{ address: P2TR, amountSats: 1500n }] };

    const h = handlers();
    await sendBtcTransaction({ ...h, getProvider, payload });
    expect(h.onFinish).toHaveBeenCalledWith('txid');
    const token = provider.sendBtcTransaction.mock.calls[0]![0] as string;
    const decoded = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    expect(decoded.recipients).toEqual([{ address: P2TR, amountSats: '1500' }]);

    await expect(
      sendBtcTransaction({ ...handlers(), getProvider, payload: { ...payload, recipients: [] } }),
    ).rejects.toThrow('At least one recipient');
    await expect(
      sendBtcTransaction({
        ...handlers(),
        getProvider,
        payload: { ...payload, recipients: [{ address: P2TR, amountSats: 1 as never }] },
      }),
    ).rejects.toThrow('Incorrect recipient format');
    await expect(
      sendBtcTransaction({ ...handlers(), getProvider, payload: { ...payload, senderAddress: '' } }),
    ).rejects.toThrow('sender address');

    provider.sendBtcTransaction.mockRejectedValueOnce(declined);
    const cancelled = handlers();
    await sendBtcTransaction({ ...cancelled, getProvider, payload });
    expect(cancelled.onCancel).toHaveBeenCalled();

    provider.sendBtcTransaction.mockRejectedValueOnce(new Error('boom'));
    const failed = handlers();
    await sendBtcTransaction({ ...failed, getProvider, payload });
    expect(failed.onError).toHaveBeenCalled();
  });
});
