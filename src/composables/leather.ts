import { UserRejectedRequestError } from 'viem';

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

export const leatherConnect = async () => {
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

    const cardinalAddress = userAddresses.result?.addresses.find((a) => a.type === 'p2wpkh')?.address || '';
    const ordinalAddress = userAddresses.result?.addresses.find((a) => a.type === 'p2tr')?.address || '';
    // this.setUserWalletSession(cardinalAddress, ordinalAddress, 'hiro');
    // this.getOrders(this.userOrdAddress, false);
    // this.showNotif({ type: 'success', text: this.$t('mint.notifs.connectSuccess.hiro') });
    // this.popup = '';
    return {
      payment: cardinalAddress,
      ordinal: ordinalAddress,
    };
  } catch (e) {
    console.log(e);
    throw new UserRejectedRequestError(new Error('User rejected the request'));
  }
};
export const leatherSignMessage = async (message: any, _address?: string) => {
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
