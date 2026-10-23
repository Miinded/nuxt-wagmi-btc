import type { Address, InputToSign, SendTransferResult, SignMessageResult, SignPsbtResult } from 'sats-connect';
import { AddressPurpose, getProviderById, request } from 'sats-connect';
import { UserRejectedRequestError } from 'viem';
import type { BitcoinAddress, WagmiBtcAddress } from '../types/wagmi-btc';
import { ref } from 'vue';

const cardinalAddress = ref<BitcoinAddress>({ address: '', publicKey: '' });
const ordinalAddress = ref<BitcoinAddress>({ address: '', publicKey: '' });
const PROVIDER_ID = 'XverseProviders.BitcoinProvider';

export const xverseProvider = () => {
  // if (!import.meta.client) {
  //   return;
  // }
  return getProviderById(PROVIDER_ID) as {
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

export const xverseConnect = async (): Promise<WagmiBtcAddress> => {
  if (cardinalAddress.value.address !== '' && ordinalAddress.value.address !== '') {
    return {
      payment: cardinalAddress.value,
      ordinal: ordinalAddress.value,
    };
  }

  try {
    const response = await request(
      'wallet_connect',
      { message: 'Connect Xverse', addresses: [AddressPurpose.Payment, AddressPurpose.Ordinals] },
      PROVIDER_ID,
    );
    if (response.status === 'success') {
      const result = response.result;
      if (result.addresses && result.addresses.length > 0) {
        const cardinal = result.addresses.find((address: Address) => address.purpose === AddressPurpose.Payment);
        cardinalAddress.value = { address: cardinal?.address || '', publicKey: cardinal?.publicKey || '' };
        const ordinal = result.addresses.find((address: Address) => address.purpose === AddressPurpose.Ordinals);
        ordinalAddress.value = { address: ordinal?.address || '', publicKey: ordinal?.publicKey || '' };
      }
    } else {
      if (response.error.code === -32000) {
        throw new UserRejectedRequestError(new Error('User rejected the request'));
      } else {
        // handle error
        throw response.error;
      }
    }
  } catch (e) {
    console.error(e);
    // refus de l'utilisateur ou erreur du portefeuille : l'appelant doit le savoir
    throw e;
  }
  return {
    payment: cardinalAddress.value,
    ordinal: ordinalAddress.value,
  };
};

// Peut être utile pour récupérer les addresses sans relancer la connexion.
export const xverseAddresses = async (): Promise<WagmiBtcAddress> => {
  if (cardinalAddress.value.address !== '' && ordinalAddress.value.address !== '') {
    return {
      payment: cardinalAddress.value,
      ordinal: ordinalAddress.value,
    };
  } else {
    return await xverseConnect();
  }
};

export const xverseSignMessage = async (message: string | JSON) => {
  // if (!import.meta.client) {
  //   return;
  // }
  const addresses = await xverseAddresses();

  const response = await request(
    'signMessage',
    {
      address: addresses!.payment.address,
      message: JSON.stringify(message),
    },
    PROVIDER_ID,
  );

  return (
    response as {
      status: string;
      result: SignMessageResult;
    }
  ).result.signature;
};

export const xverseSignPsbt = async (psbt: string, vIn: InputToSign[], broadcast: boolean): Promise<SignPsbtResult> => {
  // if (!import.meta.client) {
  //   return;
  // }
  const inputs: Record<string, number[]> = {};
  for (const v of vIn) {
    inputs[v.address] = v.signingIndexes;
  }
  const response = await request(
    'signPsbt',
    {
      psbt,
      broadcast: broadcast,
      signInputs: inputs,
    },
    PROVIDER_ID,
  );

  return (
    response as {
      status: string;
      result: SignPsbtResult;
    }
  ).result;
};

export const xverseSendBtc = async (recipients: { address: string; amount: number }[]): Promise<string> => {
  const response = await request(
    'sendTransfer',
    {
      recipients: recipients.map((r) => ({
        address: r.address,
        amount: r.amount,
      })),
    },
    PROVIDER_ID,
  );

  return (
    response as {
      status: string;
      result: SendTransferResult;
    }
  ).result.txid;
};
