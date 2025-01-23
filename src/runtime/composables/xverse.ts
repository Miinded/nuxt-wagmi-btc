import { UserRejectedRequestError } from 'viem';

export const xverseProvider = () => {};
export const xverseConnect = async () => {
  if (!import.meta.client) {
    return;
  }
  const Wallet = (await import('sats-connect')).default;
  const setDefaultProvider = (await import('sats-connect')).setDefaultProvider;
  setDefaultProvider('XverseProviders.BitcoinProvider');
  let cardinalAddress = '';
  let ordinalAddress = '';

  try {
    const response = await Wallet.request('wallet_connect', {
      message: 'Connect Xverse',
      // purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
    });
    if (response.status === 'success') {
      const result = response.result;
      if (result.addresses && result.addresses.length > 0) {
        cardinalAddress = result.addresses.find((address) => address.purpose === 'payment')?.address || '';
        ordinalAddress = result.addresses.find((address) => address.purpose === 'ordinals')?.address || '';
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
  }
  return {
    payment: cardinalAddress,
    ordinal: ordinalAddress,
  };
};

export const xverseSignMessage = async (message: any, address?: string) => {
  if (!import.meta.client) {
    return;
  }
  const Wallet = (await import('sats-connect')).default;
  const response = await Wallet.request('signMessage', {
    address: address!,
    message: JSON.stringify(message),
  });

  return (
    response as {
      status: string;
      result: {
        address: string;
        messageHash: string;
        signature: string;
      };
    }
  ).result.signature;
};
