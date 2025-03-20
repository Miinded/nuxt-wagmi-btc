import type { Address, BitcoinProvider, InputToSign, SignPsbtResult, SignTransactionResponse} from "sats-connect";
import { AddressPurpose, BitcoinNetworkType, } from "sats-connect";
import { UserRejectedRequestError } from "viem";
import { createUnsecuredToken } from 'jsontokens';
import type { BitcoinAddress, WagmiBtcAddress } from "../../types/wagmi-btc";
import { convertPsbt, sendBtcTransaction, signMessage, signTransaction } from "./tools";
import { ref } from "vue";

const cardinalAddress = ref<BitcoinAddress>({address: '', publicKey: ''});
const ordinalAddress = ref<BitcoinAddress>({address: '', publicKey: ''});

export const magicEdenProvider = () => {
  let magicEdenProvider = null;
  if ('magicEden' in window) {
    const anyWindow: any = window;
    if (!anyWindow.magicEden.bitcoin || !anyWindow.magicEden.bitcoin.isMagicEden)
    {
      return;
    }
    const provider = anyWindow.magicEden.bitcoin;
    if (provider) {
      magicEdenProvider = provider;
    }else {
      window.open('https://wallet.magiceden.io', '_blank');
    }
  }

  return magicEdenProvider as {
    connect(jsonUnsecuredToken: string): { addresses: Address[] };
    on(key: string, callable: CallableFunction): Promise<void>;
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
    const result = await provider.connect(createUnsecuredToken({
      message: 'Connect Magic Eden',
      purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
      network: { type: BitcoinNetworkType.Mainnet}
    }));
    
    if (result.addresses && result.addresses.length > 0) {
      const cardinal = result.addresses.find((address: Address) => address.purpose === AddressPurpose.Payment)!;
      cardinalAddress.value = { address: cardinal.address || '', publicKey: cardinal.publicKey || ''};
      const ordinal = result.addresses.find((address: Address) => address.purpose === AddressPurpose.Ordinals)!;
      ordinalAddress.value = { address: ordinal.address || '', publicKey: ordinal.publicKey || ''};
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

export const magicEdenAddresses = async(): Promise<WagmiBtcAddress> => {
  if (cardinalAddress.value && ordinalAddress.value) {
    return {
      payment: cardinalAddress.value,
      ordinal: ordinalAddress.value,
    };
  } else {
    return await magicEdenConnect();
  }
};

export const magicEdenSignMessage = async (message: string| JSON): Promise<string> => {
  const provider = magicEdenProvider();
  const addresses = await magicEdenAddresses();
  const signature = await new Promise((resolve, reject) => { 
    signMessage({
      getProvider: async () => provider as unknown as BitcoinProvider,
      payload: {
        network: {
          type: BitcoinNetworkType.Mainnet,
        },
        address: addresses?.payment.address,
        message: JSON.stringify(message),
      },
      onFinish: (response) => {
        resolve(response)
      },
      onCancel: (error: Error) => {
        reject(error)
      },
      onError: (error: Error) => {
        reject(error)
      },
    });
  });
  return signature as string;
};

export const magicEdenSignPsbt = async (psbt: string, vIn: InputToSign[], broadcast: boolean): Promise<SignPsbtResult> => {
  const provider = magicEdenProvider();
  const signature = await new Promise((resolve, reject) => { 
    signTransaction({
      getProvider: async () => provider as unknown as BitcoinProvider,
      payload: {
        network: {
          type: BitcoinNetworkType.Mainnet,
        },
        psbtBase64: convertPsbt(psbt, 'base64'),
        broadcast, 
        message: '',
        inputsToSign: vIn,
      },
      onFinish: (response: SignTransactionResponse) => {
        resolve({
           psbt: response.psbtBase64,
           txid: response?.txId
        } as SignPsbtResult)
      },
      onCancel: (error: Error) => {
        reject(error)
      },
      onError: (error: Error) => {
        reject(error)
      },
    });
  });
  return signature as SignPsbtResult;
};

export const magicEdenSendBtc = async (recipients: {address: string; amount: number}[]): Promise<string> => {
  const tos = recipients.map(r => ({ 
    address: r.address, 
    amountSats: BigInt(r.amount)
  }));
  
  const provider = magicEdenProvider();
  const addresses = await magicEdenAddresses();

  const response = await new Promise((resolve, reject) => { 
    sendBtcTransaction({
      getProvider: async () => provider as unknown as BitcoinProvider,
      payload: {
        network: {
          type: BitcoinNetworkType.Mainnet,
        },
        senderAddress: addresses!.payment.address,
        recipients: tos
      },
      onFinish: (response) => {
        resolve(response)
      },
      onCancel: (error: Error) => {
        reject(error)
      },
      onError: (error: Error) => {
        reject(error)
      },
    });
  });

  return response as string;
};
