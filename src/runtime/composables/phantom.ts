import { AddressPurpose, type InputToSign, type SignPsbtResult } from 'sats-connect';
import { UserRejectedRequestError } from 'viem';
import type { BitcoinAddress, WagmiBtcAddress } from '../../types/wagmi-btc';
import { broadcastTx, convertPsbt, createPsbt, finalizeAndExtractTx, getUtxos, Uint8ArrayToBase64 } from './tools';

export const phantomProvider = () => {
  let localProvider = null;
  if ('phantom' in window) {
    const anyWindow = window;
    const provider = (anyWindow.phantom as any)?.bitcoin;
    if (provider) {
      localProvider = provider;
    }
    else  {
      window.open('https://docs.phantom.com/bitcoin/integrating-phantom', '_blank');
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
    signPSBT(
      psbt: Uint8Array,
      options: {inputsToSign: {sigHash?: number | undefined, address: string, signingIndexes: number[]}[]}
  ): Promise<Uint8Array>;
  };
};

export const phantomConnect = async (): Promise<WagmiBtcAddress> => {
  try {
    return await phantomAddresses();

  } catch (e) {
    console.log(e);
    throw new UserRejectedRequestError(new Error('User rejected the request'));
  }
};

export const phantomAddresses = async(): Promise<WagmiBtcAddress> => {
  const provider = phantomProvider();
  const accounts = await provider.requestAccounts();

    let cardinalAddress: BitcoinAddress = {address: '', publicKey: ''}
    let ordinalAddress: BitcoinAddress = {address : '', publicKey: ''};

    if (accounts && accounts.length > 0) {
      const cardinal = accounts.find((address: any) => address.purpose === AddressPurpose.Payment) as BitcoinAddress;
      cardinalAddress = { address: cardinal.address || '', publicKey: cardinal.publicKey || ''};
      const ordinal = accounts.find((address: any) => address.purpose === AddressPurpose.Ordinals) as BitcoinAddress;
      ordinalAddress = { address: ordinal.address || '', publicKey: ordinal.publicKey || ''};
    }

    return {
      payment: cardinalAddress,
      ordinal: ordinalAddress,
    };
}

export const phantomSignMessage = async (message: string| JSON): Promise<string> => {
  const provider = phantomProvider();
  const addresses = await phantomAddresses();
  const messageEncoder = new TextEncoder().encode(JSON.stringify(message));
  const { signature } = await provider.signMessage(addresses.payment.address, messageEncoder);
  return Uint8ArrayToBase64(signature);
};

export const phantomSignPsbt = async (psbt: string, vIn: InputToSign[], broadcast: boolean): Promise<SignPsbtResult> => {
  const provider = phantomProvider();
  const psbtHex = convertPsbt(psbt, 'hex', true);

  const fromHexString = (hexString: string) =>{
    const m = hexString.match(/.{1,2}/g);
    return Uint8Array.from(m!.map((byte) => Number.parseInt(byte, 16)))
  };

  const psbtUint8Array = await provider.signPSBT(fromHexString(psbtHex), {
    inputsToSign: vIn
  });

  const response =  {
    psbt: Uint8ArrayToBase64(psbtUint8Array),
  } as SignPsbtResult;

  if(broadcast){
    // Finaliser la transaction et récupérer le hex
    const txHex = finalizeAndExtractTx(response.psbt);
    // Broadcast la transaction
    response.txid = await broadcastTx(txHex);
  }
  return response;
};

export const phantomSendBtc = async (recipients: {address: string; amount: number}[]): Promise<string> => {
    const addresses = await phantomAddresses();
    const sender = addresses.payment.address;

    // 1️⃣ Récupérer les UTXOs de l'adresse du sender
    const utxos = await getUtxos(sender);
    if(!utxos || utxos.length === 0){
      throw new Error("You don't have enough UTXOs")
    }

    // 2️⃣ Construire la PSBT
    const psbtBase64 = await createPsbt(addresses.payment, recipients, utxos);
    const result =  await phantomSignPsbt(psbtBase64, [
      {
        address: sender,
        signingIndexes: Array.from({ length: utxos.length }, (_, index) => index) // Il n'y a que des uxtos de l'utilisateur en cours.
      }
    ] , true);

    return result.txid!;
};
