import * as ecc from '@bitcoinerlab/secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPsbt, estimateTxVsize, getAddressType } from '../src/runtime/composables/tools';
import plugin from '../src/runtime/plugins/bitcoinjs.client';
import type { WagmiBtcNetwork } from '../src/runtime/types/wagmi-btc';
import { nuxtApp, wagmiBtcOptions } from './stubs/app';

const ECPair = ECPairFactory(ecc);
// Clés de test déterministes (jamais utilisées sur un réseau réel)
const senderKey = ECPair.fromPrivateKey(Buffer.alloc(32, 1));
const recipientKey = ECPair.fromPrivateKey(Buffer.alloc(32, 2));
const xOnly = (pubkey: Buffer) => pubkey.subarray(1, 33);

const MEMPOOL: Record<WagmiBtcNetwork, string> = {
  mainnet: 'https://mempool.space/api',
  testnet: 'https://mempool.space/testnet/api',
  testnet4: 'https://mempool.space/testnet4/api',
  signet: 'https://mempool.space/signet/api',
};
const FEE_RATE = 7;

type SenderType = 'P2WPKH' | 'P2TR' | 'P2SH' | 'P2PKH';
const addressOf = (type: SenderType | 'P2TR-recipient', network: bitcoin.Network) => {
  switch (type) {
    case 'P2WPKH':
      return bitcoin.payments.p2wpkh({ pubkey: senderKey.publicKey, network }).address!;
    case 'P2TR':
      return bitcoin.payments.p2tr({ internalPubkey: xOnly(senderKey.publicKey), network }).address!;
    case 'P2SH':
      return bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ pubkey: senderKey.publicKey, network }),
        network,
      }).address!;
    case 'P2PKH':
      return bitcoin.payments.p2pkh({ pubkey: senderKey.publicKey, network }).address!;
    case 'P2TR-recipient':
      return bitcoin.payments.p2tr({ internalPubkey: xOnly(recipientKey.publicKey), network }).address!;
  }
};

/** Transaction précédente réelle qui paie `value` à `address` : sert d'UTXO (et de nonWitnessUtxo en legacy) */
const previousTx = (address: string, value: number, network: bitcoin.Network) => {
  const tx = new bitcoin.Transaction();
  tx.version = 2;
  tx.addInput(Buffer.alloc(32, 9), 0);
  tx.addOutput(bitcoin.address.toOutputScript(address, network), value);
  return tx;
};

const fetchMock = vi.fn();
const mockMempool = (network: WagmiBtcNetwork, address: string, txs: bitcoin.Transaction[]) => {
  fetchMock.mockImplementation(async (url: string) => {
    const base = MEMPOOL[network];
    if (url === `${base}/v1/fees/recommended`) return { ok: true, json: async () => ({ fastestFee: FEE_RATE }) };
    if (url === `${base}/address/${address}/utxo`) {
      return { ok: true, json: async () => txs.map((tx) => ({ txid: tx.getId(), vout: 0, value: tx.outs[0]!.value })) };
    }
    const tx = txs.find((t) => url === `${base}/tx/${t.getId()}/hex`);
    if (tx) return { ok: true, text: async () => tx.toHex() };
    throw new Error(`unexpected mempool call: ${url}`);
  });
};

const validator = (pubkey: Buffer, msghash: Buffer, signature: Buffer) =>
  // clé x-only (32 octets) : signature Schnorr (Taproot) ; sinon ECDSA
  pubkey.length === 32
    ? ecc.verifySchnorr(msghash, pubkey, signature)
    : ECPair.fromPublicKey(pubkey).verify(msghash, signature);

describe('createPsbt — PSBT signables sur chaque réseau', () => {
  beforeAll(async () => {
    // le plugin client fournit $bitcoin avec la bibliothèque ECC initialisée (indispensable pour Taproot)
    await (plugin as unknown as (app: typeof nuxtApp) => Promise<void>)(nuxtApp);
  });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    wagmiBtcOptions.network = 'mainnet';
  });

  const cases: [WagmiBtcNetwork, bitcoin.Network][] = [
    ['mainnet', bitcoin.networks.bitcoin],
    ['testnet', bitcoin.networks.testnet],
    ['signet', bitcoin.networks.testnet],
  ];
  const senders: SenderType[] = ['P2WPKH', 'P2TR', 'P2SH', 'P2PKH'];

  for (const [networkName, network] of cases) {
    for (const senderType of senders) {
      it(`${networkName} : émetteur ${senderType} vers une adresse Taproot`, async () => {
        wagmiBtcOptions.network = networkName;
        const senderAddress = addressOf(senderType, network);
        const recipient = addressOf('P2TR-recipient', network);
        const utxos = [previousTx(senderAddress, 60_000, network), previousTx(senderAddress, 45_000, network)];
        mockMempool(networkName, senderAddress, utxos);

        const base64 = await createPsbt(
          { address: senderAddress, publicKey: senderKey.publicKey.toString('hex') },
          [{ address: recipient, amount: 80_000 }],
          utxos.map((tx) => ({ txid: tx.getId(), vout: 0, value: tx.outs[0]!.value })),
        );

        const psbt = bitcoin.Psbt.fromBase64(base64, { network });
        if (senderType === 'P2TR') {
          const tweaked = senderKey.tweak(bitcoin.crypto.taggedHash('TapTweak', xOnly(senderKey.publicKey)));
          psbt.signAllInputs(tweaked);
        } else {
          psbt.signAllInputs(senderKey);
        }
        expect(psbt.validateSignaturesOfAllInputs(validator)).toBe(true);
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();

        // les sorties : destinataire Taproot puis monnaie rendue à l'émetteur, sur le bon réseau
        expect(tx.outs.map((o) => bitcoin.address.fromOutputScript(o.script, network))).toEqual([
          recipient,
          senderAddress,
        ]);
        expect(tx.outs[0]!.value).toBe(80_000);

        // frais : au moins le fee rate demandé sur la taille réelle, sans surestimation notable
        const fee = 105_000 - tx.outs.reduce((sum, o) => sum + o.value, 0);
        const estimated = estimateTxVsize(senderType, 2, ['P2TR', senderType]);
        expect(fee).toBe(Math.ceil(estimated * FEE_RATE));
        expect(estimated).toBeGreaterThanOrEqual(tx.virtualSize());
        expect(estimated - tx.virtualSize()).toBeLessThanOrEqual(3);

        // chaque appel mempool.space vise l'API du réseau choisi
        for (const [url] of fetchMock.mock.calls) {
          expect(url).toMatch(new RegExp(`^${MEMPOOL[networkName]}/`));
        }
      });
    }
  }

  it('renseigne witnessUtxo, tapInternalKey, redeemScript ou nonWitnessUtxo selon le type', async () => {
    const network = bitcoin.networks.bitcoin;
    const inputOf = async (senderType: SenderType) => {
      const address = addressOf(senderType, network);
      const utxos = [previousTx(address, 50_000, network)];
      mockMempool('mainnet', address, utxos);
      const base64 = await createPsbt(
        { address, publicKey: senderKey.publicKey.toString('hex') },
        [{ address: addressOf('P2WPKH', network), amount: 10_000 }],
        [{ txid: utxos[0]!.getId(), vout: 0, value: 50_000 }],
      );
      return bitcoin.Psbt.fromBase64(base64).data.inputs[0]!;
    };

    expect((await inputOf('P2WPKH')).witnessUtxo?.value).toBe(50_000);
    const taproot = await inputOf('P2TR');
    expect(taproot.witnessUtxo?.value).toBe(50_000);
    expect(taproot.tapInternalKey).toEqual(xOnly(senderKey.publicKey));
    const nested = await inputOf('P2SH');
    expect(nested.redeemScript).toEqual(bitcoin.payments.p2wpkh({ pubkey: senderKey.publicKey }).output);
    const legacy = await inputOf('P2PKH');
    expect(legacy.nonWitnessUtxo).toBeDefined();
    expect(legacy.witnessUtxo).toBeUndefined();
  });

  it('accepte une clé Taproot déjà au format x-only (32 octets)', async () => {
    const network = bitcoin.networks.bitcoin;
    const address = addressOf('P2TR', network);
    const utxos = [previousTx(address, 50_000, network)];
    mockMempool('mainnet', address, utxos);
    const base64 = await createPsbt(
      { address, publicKey: xOnly(senderKey.publicKey).toString('hex') },
      [{ address: addressOf('P2WPKH', network), amount: 10_000 }],
      [{ txid: utxos[0]!.getId(), vout: 0, value: 50_000 }],
    );
    expect(bitcoin.Psbt.fromBase64(base64).data.inputs[0]!.tapInternalKey).toEqual(xOnly(senderKey.publicKey));
  });

  it('laisse la monnaie sous le seuil de poussière partir en frais', async () => {
    const network = bitcoin.networks.bitcoin;
    const address = addressOf('P2WPKH', network);
    const utxos = [previousTx(address, 12_000, network)];
    mockMempool('mainnet', address, utxos);
    const fee = Math.ceil(estimateTxVsize('P2WPKH', 1, ['P2WPKH', 'P2WPKH']) * FEE_RATE);

    const base64 = await createPsbt(
      { address, publicKey: '' },
      [{ address: addressOf('P2PKH', network), amount: 12_000 - fee - 100 }],
      [{ txid: utxos[0]!.getId(), vout: 0, value: 12_000 }],
    );

    expect(bitcoin.Psbt.fromBase64(base64).txOutputs).toHaveLength(1);
  });

  it('refuse un émetteur P2WSH et un P2SH sans clé publique', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ fastestFee: 1 }) });
    const p2wsh = bitcoin.payments.p2wsh({ redeem: bitcoin.payments.p2pk({ pubkey: senderKey.publicKey }) }).address!;
    const utxo = [{ txid: '00'.repeat(32), vout: 0, value: 50_000 }];
    const to = [{ address: addressOf('P2WPKH', bitcoin.networks.bitcoin), amount: 1_000 }];

    await expect(createPsbt({ address: p2wsh, publicKey: '' }, to, utxo)).rejects.toThrow('P2WSH sender');
    await expect(
      createPsbt({ address: addressOf('P2SH', bitcoin.networks.bitcoin), publicKey: '' }, to, utxo),
    ).rejects.toThrow('public key of a P2SH-P2WPKH sender');
  });

  it('reconnaît le type de chaque adresse réelle, sur chaque réseau', () => {
    for (const network of [bitcoin.networks.bitcoin, bitcoin.networks.testnet, bitcoin.networks.regtest]) {
      expect(getAddressType(addressOf('P2WPKH', network))).toBe('P2WPKH');
      expect(getAddressType(addressOf('P2TR', network))).toBe('P2TR');
      expect(getAddressType(addressOf('P2SH', network))).toBe('P2SH');
      expect(getAddressType(addressOf('P2PKH', network))).toBe('P2PKH');
      const p2wsh = bitcoin.payments.p2wsh({
        redeem: bitcoin.payments.p2pk({ pubkey: senderKey.publicKey, network }),
        network,
      });
      expect(getAddressType(p2wsh.address!)).toBe('P2WSH');
    }
  });
});
