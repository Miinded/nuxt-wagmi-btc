import { UserRejectedRequestError } from 'viem';

export const phantomProvider = () => {
  let localProvider = null;
  if ('phantom' in window) {
    const anyWindow = window;
    const provider = (anyWindow.phantom as any)?.bitcoin;
    if (provider) {
      localProvider = provider;
    }
  }

  return localProvider as {
    requestAccounts(): Promise<
      {
        address: string;
        publicKey: string;
        addressType: string;
        purpose: string;
      }[]
    >;
    signMessage(
      address: string,
      message: Uint8Array,
    ): Promise<{
      signature: Uint8Array;
    }>;
    on(key: string, callable: CallableFunction): Promise<void>;
  };
};

export const phantomConnect = async () => {
  try {
    const provider = phantomProvider();
    if (!provider) {
      window.open('https://docs.phantom.com/bitcoin/integrating-phantom', '_blank');
      return;
    }
    const accounts = await provider.requestAccounts();
    const cardinalAddress = accounts?.find((address: any) => address?.purpose === 'payment')?.address || '';
    const ordinalAddress = accounts?.find((address: any) => address?.purpose === 'ordinals')?.address || '';
    return {
      payment: cardinalAddress,
      ordinal: ordinalAddress,
    };
  } catch (e) {
    console.log(e);
    throw new UserRejectedRequestError(new Error('User rejected the request'));
  }
};

export const phantomSignMessage = async (message: any, address?: string) => {
  const provider = phantomProvider();
  const messageEncoder = new TextEncoder().encode(JSON.stringify(message));
  const { signature } = await provider.signMessage(address!, messageEncoder);
  return btoa(String.fromCodePoint(...signature));
};
