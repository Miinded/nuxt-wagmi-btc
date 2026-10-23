import type { InputToSign, SignPsbtResult } from 'sats-connect';
import type { BitcoinAddress, WagmiBtcAddress } from '../types/wagmi-btc';
import { convertPsbt } from './tools';

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
    signPsbt(psbtHex: string, options?: { autoFinalized: boolean; toSignInputs: any[] }): Promise<string>;
    pushPsbt(signPsbtHex: string): Promise<string>;
    sendBitcoin(toAddress: string, satoshis: number, options?: any): Promise<string>;
  };
};

export const unisatConnect = async (): Promise<WagmiBtcAddress> => {
  const provider = unisatProvider();
  const accounts = await provider.requestAccounts();
  const publicKey = await provider.getPublicKey();

  return {
    payment: { address: accounts[0], publicKey } as BitcoinAddress,
    ordinal: { address: accounts[0], publicKey } as BitcoinAddress,
  };
};

export const unisatAddresses = async (): Promise<WagmiBtcAddress> => {
  const provider = unisatProvider();
  const accounts = await provider.requestAccounts();
  const publicKey = await provider.getPublicKey();

  return {
    payment: { address: accounts[0], publicKey } as BitcoinAddress,
    ordinal: { address: accounts[0], publicKey } as BitcoinAddress,
  };
};

export const unisatSignMessage = async (message: string | JSON): Promise<string> => {
  const provider = unisatProvider();
  // const publicKey = await provider.getPublicKey();
  const res = await provider.signMessage(JSON.stringify(message), 'bip322-simple');
  return res;
};

export const unisatSignPsbt = async (psbt: string, vIn: InputToSign[], broadcast: boolean): Promise<SignPsbtResult> => {
  const provider = unisatProvider();
  const psbtHex = convertPsbt(psbt, 'hex', true);
  const toSignInputs: { index: number; address: string }[] = [];
  for (const v of vIn) {
    for (const i of v.signingIndexes) {
      toSignInputs.push({
        address: v.address,
        index: i,
      });
    }
  }
  toSignInputs.sort((a, b) => a.index - b.index);

  const resturnPsbtHex = await provider.signPsbt(psbtHex, {
    autoFinalized: broadcast,
    toSignInputs,
  });

  const response = {
    psbt: convertPsbt(resturnPsbtHex, 'base64', true),
  } as SignPsbtResult;

  if (broadcast) {
    response.txid = await provider.pushPsbt(resturnPsbtHex);
  }
  return response;
};

export const unisatSendBtc = async (recipients: { address: string; amount: number }[]): Promise<string> => {
  if (recipients.length > 1) {
    throw new Error("You can't define more thant 1 recipient with unisat provider");
  }
  const provider = unisatProvider();
  const recipient = recipients[0]!;
  const txId = await provider.sendBitcoin(recipient.address, recipient.amount);
  return txId;
};
