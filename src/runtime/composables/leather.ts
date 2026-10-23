import type { InputToSign, SendTransferResult, SignPsbtResult } from 'sats-connect';
import { UserRejectedRequestError } from 'viem';
import type { BitcoinAddress, WagmiBtcAddress } from '../types/wagmi-btc';
import { ref } from 'vue';
import { convertPsbt } from './tools';

const cardinalAddress = ref<BitcoinAddress>({ address: '', publicKey: '' });
const ordinalAddress = ref<BitcoinAddress>({ address: '', publicKey: '' });

export const leatherProvider = () => {
  let leatherProvider = null;
  if ('LeatherProvider' in window) {
    const anyWindow = window;
    const provider = anyWindow.LeatherProvider;
    if (provider) {
      leatherProvider = provider;
    }
  }
  return leatherProvider as {
    request<T>(
      action?: string,
      params?: any,
    ): Promise<{
      jsonrpc: string;
      id: string;
      result: T;
    }>;
  };
};

export const leatherConnect = async (): Promise<WagmiBtcAddress> => {
  if (cardinalAddress.value.address !== '' && ordinalAddress.value.address !== '') {
    return {
      payment: cardinalAddress.value,
      ordinal: ordinalAddress.value,
    };
  }

  try {
    const provider = leatherProvider();
    const userAddresses = await provider.request<{
      addresses: {
        symbol: string;
        type: 'p2wpkh' | 'p2tr';
        address: string;
        publicKey: string;
        derivationPath: string;
      }[];
    }>('getAddresses');

    if (userAddresses.result.addresses && userAddresses.result.addresses.length > 0) {
      const addresses = userAddresses.result.addresses;
      const cardinal = addresses.find((a) => a.type === 'p2wpkh') as BitcoinAddress | undefined;
      const ordinal = addresses.find((a) => a.type === 'p2tr') as BitcoinAddress | undefined;

      cardinalAddress.value = { address: cardinal?.address || '', publicKey: cardinal?.publicKey || '' };
      ordinalAddress.value = { address: ordinal?.address || '', publicKey: ordinal?.publicKey || '' };
    }
    return {
      payment: cardinalAddress.value,
      ordinal: ordinalAddress.value,
    };
  } catch (e) {
    console.log(e);
    throw new UserRejectedRequestError(new Error('User rejected the request'));
  }
};

// Peut être utile pour récupérer les addresses sans relancer la connexion.
export const leatherAddresses = async (): Promise<WagmiBtcAddress> => {
  if (cardinalAddress.value.address !== '' && ordinalAddress.value.address !== '') {
    return {
      payment: cardinalAddress.value,
      ordinal: ordinalAddress.value,
    };
  } else {
    return await leatherConnect();
  }
};

export const leatherSignMessage = async (message: string | JSON): Promise<string> => {
  const provider = leatherProvider();
  const result = await provider.request<{
    signature: string;
    address: string;
    message: string;
  }>('signMessage', {
    message: JSON.stringify(message),
  });
  return result.result.signature;
};

export const leatherSignPsbt = async (
  psbt: string,
  vIn: InputToSign[],
  broadcast: boolean,
): Promise<SignPsbtResult> => {
  const provider = leatherProvider();

  const inputs: Record<string, number[]> = {};
  for (const v of vIn) {
    inputs[v.address] = v.signingIndexes;
  }
  const response = await provider.request('signPsbt', {
    hex: convertPsbt(psbt, 'hex', true),
    broadcast: broadcast,
    signInputs: inputs,
  });

  const result = response.result as { hex: string; txid: string };

  return {
    psbt: convertPsbt(result.hex, 'base64', true),
    txid: result.txid,
  };

  // return (
  //   response.result as {
  //     status: string;
  //     result: SignPsbtResult;
  //   }
  // ).result;
};

export const leatherSendBtc = async (recipients: { address: string; amount: number }[]): Promise<string> => {
  const provider = leatherProvider();

  const response = await provider.request<SendTransferResult>('sendTransfer', {
    network: 'mainnet',
    recipients: recipients.map((r) => ({
      address: r.address,
      amount: r.amount.toString(),
    })),
  });

  return response.result.txid;
};
