import {
  getProviderOrThrow,
  type Recipient,
  type SerializedRecipient,
  type SerializedSendBtcTransactionPayload,
} from 'sats-connect';
import { createUnsecuredToken, type Json } from 'jsontokens';
import type {
  BitcoinAddress,
  SendBtcTransactionOptions,
  SignMessageOptions,
  SignTransactionOptions,
} from '../types/wagmi-btc';
import { useNuxtApp } from '#app';
import { bitcoinjsNetwork, useBitcoinNetwork } from '../utils/network';

export const isHex = (str: string): boolean => {
  return /^[0-9a-f]*$/i.test(str) && str.length % 2 === 0;
};

export const isBase64 = (str: string): boolean => {
  return /^[A-Z0-9+/]*={0,2}$/i.test(str);
};

/**
 * Convertit une PSBT en hexadécimal ou en base64, quel que soit son format d'entrée.
 * Le format est détecté sur le contenu : toute chaîne hexadécimale est traitée comme de l'hex (une PSBT en
 * base64 commence par « cHNidP » et n'est donc jamais purement hexadécimale).
 * @param _force conservé pour compatibilité, sans effet depuis la 2.0
 */
export const convertPsbt = (psbt: string, format: 'base64' | 'hex', _force = false): string => {
  if (format === 'hex') {
    return isHex(psbt) ? psbt : Buffer.from(psbt, 'base64').toString('hex');
  }
  return isHex(psbt) ? Buffer.from(psbt, 'hex').toString('base64') : psbt;
};

export const broadcastTx = async (txHex: string) => {
  const response = await fetch(`${useBitcoinNetwork().mempoolApiUrl}/tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: txHex,
  });

  if (!response.ok) {
    throw new Error(`Erreur de broadcast: ${await response.text()}`);
  }

  return await response.text();
};

export const finalizeAndExtractTx = (signedPsbtBase64: string): string => {
  const { $bitcoin } = useNuxtApp();
  const psbt = ($bitcoin as any).Psbt.fromBase64(convertPsbt(signedPsbtBase64, 'base64'));
  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
};

export type Utxo = { txid: string; vout: number; value: number };

export const getUtxos = async (address: string): Promise<Utxo[]> => {
  const response = await fetch(`${useBitcoinNetwork().mempoolApiUrl}/address/${address}/utxo`);

  if (!response.ok) {
    throw new Error(`Erreur lors de la récupération des UTXOs: ${await response.text()}`);
  }

  const utxos: Utxo[] = await response.json();
  return utxos.map(({ txid, vout, value }) => ({ txid, vout, value })); // value en satoshis
};

/** Transaction brute (hex) : requise par les entrées legacy (nonWitnessUtxo) */
export const getTxHex = async (txid: string): Promise<string> => {
  const response = await fetch(`${useBitcoinNetwork().mempoolApiUrl}/tx/${txid}/hex`);
  if (!response.ok) {
    throw new Error(`Erreur lors de la récupération de la transaction ${txid}: ${await response.text()}`);
  }
  return await response.text();
};

/** Clé publique x-only (32 octets) attendue par Taproot, à partir d'une clé compressée ou déjà x-only */
const toXOnly = (publicKeyHex: string): Buffer => {
  const key = Buffer.from(publicKeyHex, 'hex');
  return key.length === 33 ? key.subarray(1, 33) : key;
};

const DUST_LIMIT = 546;

export const createPsbt = async (
  sender: BitcoinAddress,
  recipients: { address: string; amount: number }[],
  utxos: Utxo[],
): Promise<string> => {
  const { $bitcoin } = useNuxtApp();
  const bitcoin = $bitcoin as any;
  const network = bitcoinjsNetwork(bitcoin, useBitcoinNetwork().network);
  const psbt = new bitcoin.Psbt({ network });

  const senderType = getAddressType(sender.address);
  if (senderType === 'P2WSH') {
    throw new Error('P2WSH sender addresses are not supported (the witness script is unknown)');
  }
  if (senderType === 'P2SH' && !sender.publicKey) {
    throw new Error('The public key of a P2SH-P2WPKH sender is required to build its redeem script');
  }

  // Récupérer le fee rate en sat/vByte
  const feeRate = await getFeeRate();

  const totalInput = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
  const totalOutput = recipients.reduce((sum, r) => sum + r.amount, 0);

  // Taille virtuelle : une sortie par destinataire + la monnaie rendue à l'émetteur
  const outputTypes = [...recipients.map((r) => getAddressType(r.address)), senderType];
  const fee = Math.ceil(estimateTxVsize(senderType, utxos.length, outputTypes) * feeRate);

  if (totalInput < totalOutput + fee) {
    throw new Error('There are insufficient funds to complete the transfer');
  }

  // Les entrées décrivent la sortie dépensée : indispensable pour que le portefeuille puisse signer
  const senderScript = bitcoin.address.toOutputScript(sender.address, network);
  for (const utxo of utxos) {
    const input: Record<string, unknown> = { hash: utxo.txid, index: utxo.vout };
    switch (senderType) {
      case 'P2WPKH':
        input.witnessUtxo = { script: senderScript, value: utxo.value };
        break;
      case 'P2TR':
        input.witnessUtxo = { script: senderScript, value: utxo.value };
        if (sender.publicKey) {
          input.tapInternalKey = toXOnly(sender.publicKey);
        }
        break;
      case 'P2SH':
        // adresse de paiement « 3… / 2… » des portefeuilles : P2WPKH imbriqué dans du P2SH
        input.witnessUtxo = { script: senderScript, value: utxo.value };
        input.redeemScript = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(sender.publicKey, 'hex'), network }).output;
        break;
      case 'P2PKH':
        input.nonWitnessUtxo = Buffer.from(await getTxHex(utxo.txid), 'hex');
        break;
    }
    psbt.addInput(input);
  }

  for (const { address, amount } of recipients) {
    psbt.addOutput({ address, value: amount });
  }

  // Monnaie rendue, sauf si elle est sous le seuil de poussière (elle part alors en frais)
  const change = totalInput - totalOutput - fee;
  if (change >= DUST_LIMIT) {
    psbt.addOutput({ address: sender.address, value: change });
  }

  return psbt.toBase64();
};

export type BitcoinAddressType = 'P2PKH' | 'P2SH' | 'P2WPKH' | 'P2WSH' | 'P2TR';

/** Type d'une adresse mainnet (1, 3, bc1), testnet / signet (m, n, 2, tb1) ou regtest (bcrt1) */
export const getAddressType = (address: string): BitcoinAddressType => {
  const segwit = /^(bc|tb|bcrt)1([qp])/i.exec(address);
  if (segwit) {
    if (segwit[2]!.toLowerCase() === 'p') return 'P2TR'; // Taproot (Bech32m)
    // programme témoin de 20 octets (P2WPKH) : « 1 » + version + 32 caractères + 6 de somme de contrôle
    return address.length === segwit[1]!.length + 40 ? 'P2WPKH' : 'P2WSH';
  }
  if (/^[1mn]/.test(address)) return 'P2PKH'; // Legacy
  if (/^[23]/.test(address)) return 'P2SH'; // Wrapped SegWit ou multisig
  throw new Error('Invalide address format');
};

// Tailles virtuelles (vbytes) : entrée avec sa signature, sortie avec son script
const INPUT_VSIZE: Record<string, number> = {
  P2PKH: 148,
  P2SH: 91, // P2SH-P2WPKH
  'P2SH-P2WPKH': 91,
  P2WPKH: 68,
  P2TR: 57.5,
};
const OUTPUT_VSIZE: Record<string, number> = {
  P2PKH: 34,
  P2SH: 32,
  P2WPKH: 31,
  P2WSH: 43,
  P2TR: 43,
};

/**
 * Taille virtuelle d'une transaction dont toutes les entrées sont du même type.
 * En-tête : 10 vbytes, plus 0,5 (marqueur et drapeau segwit) si l'entrée est segwit.
 */
export const estimateTxVsize = (inputType: string, numInputs: number, outputTypes: string[]): number => {
  const inputSize = INPUT_VSIZE[inputType];
  if (inputSize === undefined) {
    throw new Error(`Unsupported input type: ${inputType}`);
  }
  const outputs = outputTypes.reduce((sum, type) => {
    const size = OUTPUT_VSIZE[type];
    if (size === undefined) {
      throw new Error(`Unsupported output type: ${type}`);
    }
    return sum + size;
  }, 0);
  const overhead = inputType === 'P2PKH' ? 10 : 10.5;
  return Math.ceil(overhead + numInputs * inputSize + outputs);
};

/** @deprecated utiliser estimateTxVsize, qui accepte un type par sortie */
export const estimateTxSize = (
  inputType: string,
  numInputs: number,
  numOutputs: number,
  outputType = 'P2WPKH',
): number =>
  estimateTxVsize(
    inputType,
    numInputs,
    Array.from({ length: numOutputs }, () => outputType),
  );

export const getFeeRate = async (): Promise<number> => {
  const response = await fetch(`${useBitcoinNetwork().mempoolApiUrl}/v1/fees/recommended`);
  const data = await response.json();
  return data.fastestFee; // Ex: 20 sat/vByte
};

const serializer = (recipient: Recipient[]): SerializedRecipient[] => {
  return recipient.map((value) => {
    const { address, amountSats } = value;
    return {
      address,
      amountSats: amountSats.toString(),
    };
  });
};

export const sendBtcTransaction = async (options: SendBtcTransactionOptions) => {
  const provider = await getProviderOrThrow(options.getProvider);
  const { recipients, senderAddress, network, message } = options.payload;
  if (!recipients || recipients.length === 0) {
    throw new Error('At least one recipient is required');
  }
  if (recipients.some((item: any) => typeof item.address !== 'string' || typeof item.amountSats !== 'bigint')) {
    throw new Error('Incorrect recipient format');
  }
  if (!senderAddress) {
    throw new Error('The sender address is required');
  }

  try {
    const serializedRecipients: SerializedRecipient[] = serializer(recipients);
    const serializedPayload: SerializedSendBtcTransactionPayload = {
      network,
      senderAddress,
      message,
      recipients: serializedRecipients,
    };
    const request = createUnsecuredToken(serializedPayload as unknown as Json);
    const response = await provider.sendBtcTransaction(request);
    options.onFinish?.(response);
  } catch (error) {
    const anyError = error as unknown as Error;
    if (anyError.name) {
      if (['UserDeclinedError'].includes(anyError.name)) {
        options.onCancel?.(anyError);
        return;
      }
    }

    console.error('[Connect] Error during send BTC transaction request', anyError);
    options.onError?.(anyError);
  }
};

export const signTransaction = async (options: SignTransactionOptions) => {
  const provider = await getProviderOrThrow(options.getProvider);

  const { psbtBase64, inputsToSign } = options.payload;
  if (!psbtBase64) {
    throw new Error('A value for psbtBase64 representing the tx hash is required');
  }
  if (!inputsToSign) {
    throw new Error('An array specifying the inputs to be signed by the wallet is required');
  }

  try {
    const request = createUnsecuredToken(options.payload as unknown as Json);
    const response = await provider.signTransaction(request);
    options.onFinish?.(response);
  } catch (error) {
    const anyError = error as unknown as any;
    if (anyError.name) {
      if (['UserDeclinedError'].includes(anyError.name)) {
        options.onCancel?.(anyError);
        return;
      }
    }

    console.error('[Connect] Error during sign transaction request', anyError);
    options.onError?.(anyError);
  }
};

export const signMessage = async (options: SignMessageOptions) => {
  const provider = await getProviderOrThrow(options.getProvider);

  const { address, message } = options.payload;
  if (!address) {
    throw new Error('An address is required to sign a message');
  }
  if (!message) {
    throw new Error('A message to be signed is required');
  }

  try {
    const request = createUnsecuredToken(options.payload as unknown as Json);
    const response = await provider.signMessage(request);
    options.onFinish?.(response);
  } catch (error) {
    const anyError = error as unknown as any;
    if (anyError.name) {
      if (['UserDeclinedError'].includes(anyError.name)) {
        options.onCancel?.(anyError);
        return;
      }
    }

    console.error('[Connect] Error during sign message request', anyError);
    options.onError?.(anyError);
  }
};

export const base64ToUint8Array = (base64: string): Uint8Array => {
  // Décoder la chaîne Base64 en une chaîne binaire
  const binaryString = atob(base64);

  // Créer un Uint8Array à partir de la chaîne binaire
  const uint8Array = new Uint8Array(binaryString.length);

  // Remplir le Uint8Array avec les valeurs des octets
  for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }

  return uint8Array;
};

export const Uint8ArrayToBase64 = (binary: Uint8Array): string => {
  return btoa(String.fromCharCode(...binary));
};
