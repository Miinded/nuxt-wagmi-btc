
import { getProviderOrThrow, type Recipient, type SerializedRecipient, type SerializedSendBtcTransactionPayload } from 'sats-connect';
import { createUnsecuredToken, type Json } from 'jsontokens';
import type { BitcoinAddress, SendBtcTransactionOptions, SignMessageOptions, SignTransactionOptions } from '../../types/wagmi-btc';
import { useNuxtApp } from '#app';

export const isHex = (str: string): boolean => {
  return /^[0-9a-f]*$/i.test(str) && str.length % 2 === 0;
};

export const isBase64 = (str: string): boolean => {
  return /^[A-Z0-9+/]*={0,2}$/i.test(str);
};

export const convertPsbt = (psbt: string, format: 'base64' | 'hex'): string => {
  if (format === "hex") {
    return isHex(psbt) ? psbt: (Buffer.from(psbt, 'base64')).toString('hex');
  }
  return isBase64(psbt) ? psbt: (Buffer.from(psbt, 'hex')).toString('base64');
}

export const broadcastTx = async (txHex: string) => {
  const response = await fetch('https://mempool.space/api/tx', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: txHex
  });

  if (!response.ok) {
    throw new Error(`Erreur de broadcast: ${await response.text()}`);
  }

  return await response.text();
};

export  const finalizeAndExtractTx = (signedPsbtBase64: string): string => {
  const { $bitcoin } = useNuxtApp();
  const psbt = ($bitcoin as any).Psbt.fromBase64(convertPsbt(signedPsbtBase64, 'base64'));
  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
};

export const getUtxos = async (address: string) => {
  const response = await fetch(`https://mempool.space/api/address/${address}/utxo`);

  if (!response.ok) {
    throw new Error(`Erreur lors de la récupération des UTXOs: ${await response.text()}`);
  }

  const utxos = await response.json();
  return utxos.map((utxo: {
    txid: string;
    vout: number;
    value: number;
  }) => ({
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.value, // Montant en satoshis
  })) as {
    txid: string;
    vout: number;
    value: number;
  }[];
};

export const createPsbt = async (sender: BitcoinAddress, recipients: { address: string; amount: number }[], utxos: { txid: string; vout: number; value: number; }[]): Promise<string> => {
  const { $bitcoin } = useNuxtApp();
  const psbt = new ($bitcoin as any).Psbt({ network: ($bitcoin as any).networks.bitcoin });

  // Récupérer le fee rate en sat/vByte
  const feeRate = await getFeeRate();

  // Calcul du total des inputs et outputs
  const totalInput = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
  const totalOutput = recipients.reduce((sum, r) => sum + r.amount, 0);

  // Estimer la taille de la transaction
  const estimatedSize = estimateTxSize(getAddressType(sender.address), utxos.length, recipients.length + 1);

  // Calculer les frais exacts
  const fee = estimatedSize * feeRate;

  // Vérifier si le solde est suffisant
  if (totalInput < totalOutput + fee) {
    throw new Error("There are insufficient funds to complete the transfer");
  }

  // Ajouter les inputs (UTXOs du sender)
  utxos.forEach((utxo) => {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
    });
  });

  // Ajouter les outputs (destinataires)
  recipients.forEach(({ address, amount }) => {
    psbt.addOutput({ address, value: amount });
  });

  // Calculer le change restant
  const change = totalInput - totalOutput - fee;

  if (change > 0) {
    psbt.addOutput({ address: sender.address, value: change });
  }

  const e = psbt.toBase64(); // Retourne la PSBT en base64;
  return e;
};


export const getAddressType = (address: string): string => {
  if (address.startsWith("1")) return "P2PKH"; // (Legacy)
  if (address.startsWith("3")) return "P2SH";// (Wrapped SegWit ou multisig)
  if (address.startsWith("bc1q")) return address.length === 42 ? "P2WPKH" : "P2WSH";  // 42 caractères = P2WPKH, sinon P2WSH (multisig)
  if (address.startsWith("bc1p")) return "P2TR"; // (Taproot - Bech32m)
  throw new Error("Invalide address format");
};

export const estimateTxSize = (inputType: string, numInputs: number, numOutputs: number, outputType = "P2WPKH"): number => {
  const inputSizes: { [key: string]: number } = {
    "P2PKH": 148,
    "P2SH-P2WPKH": 90,
    "P2WPKH": 68,
    "P2WSH": 100,
    "P2TR": 34
  };

  const outputSizes: { [key: string]: number } = {
    "P2PKH": 34,
    "P2SH": 34,
    "P2WPKH": 31,
    "P2WSH": 31,
    "P2TR": 26
  };

  const inputSize = inputSizes[inputType] || 0;
  const outputSize = outputSizes[outputType] || 0;

  return numInputs * inputSize + numOutputs * outputSize + 10; // +10 pour les données fixes de la transaction
};

export const getFeeRate = async (): Promise<number> => {
  const response = await fetch("https://mempool.space/api/v1/fees/recommended");
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
  if (
    recipients.some(
      (item: any) => typeof item.address !== 'string' || typeof item.amountSats !== 'bigint'
    )
  ) {
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
    const anyError = (error as unknown as Error);
    if(anyError.name){
      if(["UserDeclinedError"].includes(anyError.name)){
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
  }
  catch (error) {
    const anyError = (error as unknown as any);
    if(anyError.name){
      if(["UserDeclinedError"].includes(anyError.name)){
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
    const anyError = (error as unknown as any);
    if(anyError.name){
      if(["UserDeclinedError"].includes(anyError.name)){
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
}

export const Uint8ArrayToBase64 = (binary: Uint8Array): string => {
  return btoa(String.fromCharCode(...binary));
}
