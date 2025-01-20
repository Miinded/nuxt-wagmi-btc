export const unisatProvider = () => {
  let unisatProvider = null;
  if ('unisat' in window) {
    const anyWindow = window;
    const provider = anyWindow.unisat;
    if (provider) {
      unisatProvider = provider;
    }
  }

  return unisatProvider as {
    requestAccounts(): Promise<string[]>;
    getPublicKey(): Promise<string>;
    signMessage(msg: string, type?: 'ecdsa' | 'bip322-simple'): Promise<string>;
  };
};

export const unisatConnect = async () => {
  const provider = unisatProvider();
  const accounts = await provider.requestAccounts();
  return {
    payment: accounts[0],
    ordinal: accounts[0],
  };
};

export const unisatSignMessage = async (message: any, _address?: string) => {
  const provider = unisatProvider();
  // const publicKey = await provider.getPublicKey();
  const res = await provider.signMessage(JSON.stringify(message), 'bip322-simple');
  return res;
};
