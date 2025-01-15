import { AddressPurpose, request, RpcErrorCode } from 'sats-connect';
import { UserRejectedRequestError } from 'viem';

export const xverseProvider = () => {};
export const xverseConnect = async () => {
  let cardinalAddress = '';
  let ordinalAddress = '';

  try {
    const response = await request('wallet_connect', {
      message: 'Connect Xverse',
      // purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
    });
    if (response.status === 'success') {
      const result = response.result;
      if (result.addresses && result.addresses.length > 0) {
        cardinalAddress = result.addresses.find((address) => address.purpose === AddressPurpose.Payment)?.address || '';
        ordinalAddress = result.addresses.find((address) => address.purpose === AddressPurpose.Ordinals)?.address || '';
      }
    } else {
      if (response.error.code === RpcErrorCode.USER_REJECTION) {
        throw new UserRejectedRequestError(new Error('User rejected the request'));
      } else {
        // handle error
        throw response.error;
      }
    }
  } catch (e) {
    console.log(e);
  }
  return {
    payment: cardinalAddress,
    ordinal: ordinalAddress,
  };
};

export const xverseSignMessage = async (message: any, address?: string) => {
  const response = (await request('signMessage', {
    address: address!,
    message: JSON.stringify(message),
  })) as {
    status: string;
    result: {
      address: string;
      messageHash: string;
      signature: string;
    };
  };

  return response.result.signature;
};
