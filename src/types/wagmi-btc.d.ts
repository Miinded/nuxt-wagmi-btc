import type { Address, InputToSign, RequestPayload, BitcoinProvider as SatBitcoinProvider, SignPsbtResult, SignTransactionPayload, SignTransactionResponse } from "sats-connect";

export interface BitcoinConnector {
  id: string;
  name: string;
  icon?: string;
}

export interface BitcoinProvider {
  id: string;
  provider: () => any;
  connect: () => Promise<WagmiBtcAddress>;
  signature: (message: any) => Promise<string>;
  signaturePsbt: (psbt: string, vIn: InputToSign[], broadcast: boolean) => Promise<SignPsbtResult>;
  sendBtc: (recipients: {address: string; amount: number}[]) => Promise<string>;
  getAddresses: () => Promise<WagmiBtcAddress>;
}

export interface ModuleOptions {
  iconPath: string;
  connectors: BitcoinConnector[];
}

export type BitcoinAddress = Pick<Address, 'address' | 'publicKey'>;

export type WagmiBtcAddress = {
  payment: BitcoinAddress;
  ordinal: BitcoinAddress;
}

export interface CustomRequestOptions<Payload extends RequestPayload, Response> {
  onFinish: (response: Response) => void;
  onCancel: (error: Error) => void;
  onError: (error: Error) => void;
  payload: Payload;
  getProvider?: () => Promise<SatBitcoinProvider | undefined>;
}

export type SendBtcTransactionOptions = CustomRequestOptions<SendBtcTransactionPayload, SendBtcTransactionResponse>;
export type SignTransactionOptions = CustomRequestOptions<SignTransactionPayload, SignTransactionResponse>;
export type SignMessageOptions = CustomRequestOptions<SignMessagePayload, SignMessageResponse>;
