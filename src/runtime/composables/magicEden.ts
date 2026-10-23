import type { Address, BitcoinProvider, InputToSign, SignPsbtResult, SignTransactionResponse } from 'sats-connect';
import { AddressPurpose } from 'sats-connect';
import { UserRejectedRequestError } from 'viem';
import { createUnsecuredToken } from 'jsontokens';
import type { BitcoinAddress, WagmiBtcAddress } from '../types/wagmi-btc';
import { convertPsbt, sendBtcTransaction, signMessage, signTransaction } from './tools';
import { ref } from 'vue';
import { useBitcoinNetwork } from '../utils/network';

const cardinalAddress = ref<BitcoinAddress>({ address: '', publicKey: '' });
const ordinalAddress = ref<BitcoinAddress>({ address: '', publicKey: '' });

/** Oublie les adresses mémorisées (changement de compte, déconnexion) */
export const magicEdenDisconnect = () => {
  cardinalAddress.value = { address: '', publicKey: '' };
  ordinalAddress.value = { address: '', publicKey: '' };
};

let watching = false;

export const magicEdenProvider = () => {
  // window.magicEden peut exister sans le portefeuille Bitcoin (extension EVM / Solana seule)
  const bitcoin = 'magicEden' in window ? (window as any).magicEden?.bitcoin : undefined;
  const magicEdenProvider = bitcoin?.isMagicEden ? bitcoin : null;

  return magicEdenProvider as {
    connect(jsonUnsecuredToken: string): { addresses: Address[] };
    on?(key: string, callable: CallableFunction): Promise<void>;
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

export const magicEdenConnect = async (): Promise<WagmiBtcAddress> => {
  if (cardinalAddress.value.address !== '' && ordinalAddress.value.address !== '') {
    return {
      payment: cardinalAddress.value,
      ordinal: ordinalAddress.value,
    };
  }

  const provider = magicEdenProvider()!;
  try {
    const result = await provider.connect(
      createUnsecuredToken({
        message: 'Connect Magic Eden',
        purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
        network: { type: useBitcoinNetwork().satsConnect },
      }),
    );

    if (result.addresses && result.addresses.length > 0) {
      const cardinal = result.addresses.find((address: Address) => address.purpose === AddressPurpose.Payment);
      cardinalAddress.value = { address: cardinal?.address || '', publicKey: cardinal?.publicKey || '' };
      const ordinal = result.addresses.find((address: Address) => address.purpose === AddressPurpose.Ordinals);
      ordinalAddress.value = { address: ordinal?.address || '', publicKey: ordinal?.publicKey || '' };
    }
    // un changement de compte dans Magic Eden invalide les adresses mémorisées
    if (!watching && provider.on) {
      watching = true;
      void provider.on('accountsChanged', magicEdenDisconnect);
    }
  } catch (e) {
    console.error(e);
    if ((e as any).code === 4001) {
      throw new UserRejectedRequestError(new Error('User rejected the request'));
    } else {
      // handle error
      throw e;
    }
  }
  return {
    payment: cardinalAddress.value,
    ordinal: ordinalAddress.value,
  };
};

export const magicEdenAddresses = async (): Promise<WagmiBtcAddress> => {
  if (cardinalAddress.value.address !== '' && ordinalAddress.value.address !== '') {
    return {
      payment: cardinalAddress.value,
      ordinal: ordinalAddress.value,
    };
  } else {
    return await magicEdenConnect();
  }
};

export const magicEdenSignMessage = async (message: string | JSON): Promise<string> => {
  const provider = magicEdenProvider();
  const addresses = await magicEdenAddresses();
  const signature = await new Promise((resolve, reject) => {
    signMessage({
      getProvider: async () => provider as unknown as BitcoinProvider,
      payload: {
        network: {
          type: useBitcoinNetwork().satsConnect,
        },
        address: addresses?.payment.address,
        message: JSON.stringify(message),
      },
      onFinish: (response) => {
        resolve(response);
      },
      onCancel: (error: Error) => {
        reject(error);
      },
      onError: (error: Error) => {
        reject(error);
      },
    });
  });
  return signature as string;
};

export const magicEdenSignPsbt = async (
  psbt: string,
  vIn: InputToSign[],
  broadcast: boolean,
): Promise<SignPsbtResult> => {
  const provider = magicEdenProvider();
  const signature = await new Promise((resolve, reject) => {
    signTransaction({
      getProvider: async () => provider as unknown as BitcoinProvider,
      payload: {
        network: {
          type: useBitcoinNetwork().satsConnect,
        },
        psbtBase64: convertPsbt(psbt, 'base64'),
        broadcast,
        message: '',
        inputsToSign: vIn,
      },
      onFinish: (response: SignTransactionResponse) => {
        resolve({
          psbt: response.psbtBase64,
          txid: response?.txId,
        } as SignPsbtResult);
      },
      onCancel: (error: Error) => {
        reject(error);
      },
      onError: (error: Error) => {
        reject(error);
      },
    });
  });
  return signature as SignPsbtResult;
};

export const magicEdenSendBtc = async (recipients: { address: string; amount: number }[]): Promise<string> => {
  const tos = recipients.map((r) => ({
    address: r.address,
    amountSats: BigInt(r.amount),
  }));

  const provider = magicEdenProvider();
  const addresses = await magicEdenAddresses();

  const response = await new Promise((resolve, reject) => {
    sendBtcTransaction({
      getProvider: async () => provider as unknown as BitcoinProvider,
      payload: {
        network: {
          type: useBitcoinNetwork().satsConnect,
        },
        senderAddress: addresses!.payment.address,
        recipients: tos,
      },
      onFinish: (response) => {
        resolve(response);
      },
      onCancel: (error: Error) => {
        reject(error);
      },
      onError: (error: Error) => {
        reject(error);
      },
    });
  });

  return response as string;
};
