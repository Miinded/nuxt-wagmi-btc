import type {
  Address,
  InputToSign,
  RequestPayload,
  BitcoinProvider as SatsBitcoinProvider,
  SendBtcTransactionPayload,
  SendBtcTransactionResponse,
  SignMessagePayload,
  SignMessageResponse,
  SignPsbtResult,
  SignTransactionPayload,
  SignTransactionResponse,
} from 'sats-connect';

/** Portefeuille proposé à l'utilisateur (configuré dans `wagmiBtc.connectors`) */
export interface BitcoinConnector {
  /** Identifiant du portefeuille : magicEden, leather, xverse, phantom ou unisat */
  id: string;
  name: string;
  /** URL de l'icône ; `:iconPath` est remplacé par l'option `iconPath` */
  icon?: string;
}

/** Destinataire d'un envoi de BTC (montant en satoshis) */
export type BitcoinRecipient = { address: string; amount: number };

/** API commune à tous les portefeuilles */
export interface BitcoinProvider {
  id: string;
  /** Objet injecté par l'extension du portefeuille (null s'il n'est pas installé) */
  provider: () => any;
  connect: () => Promise<WagmiBtcAddress>;
  /** Signe un message (sérialisé en JSON) avec l'adresse de paiement */
  signature: (message: any) => Promise<string>;
  signaturePsbt: (psbt: string, vIn: InputToSign[], broadcast: boolean) => Promise<SignPsbtResult>;
  /** Envoie des BTC et renvoie l'identifiant de la transaction */
  sendBtc: (recipients: BitcoinRecipient[]) => Promise<string>;
  getAddresses: () => Promise<WagmiBtcAddress>;
  /** Oublie les adresses mémorisées : le prochain connect() redemande le compte au portefeuille */
  disconnect: () => void;
}

/** Réseau Bitcoin utilisé par les portefeuilles, bitcoinjs-lib et mempool.space */
export type WagmiBtcNetwork = 'mainnet' | 'testnet' | 'testnet4' | 'signet';

export interface ModuleOptions {
  /** Préfixe public des icônes servies par le module */
  iconPath: string;
  connectors: BitcoinConnector[];
  /** Réseau Bitcoin (défaut : mainnet) */
  network: WagmiBtcNetwork;
  /** API mempool.space (UTXO, frais, diffusion) ; défaut : celle du réseau choisi */
  mempoolApiUrl?: string;
}

export type BitcoinAddress = Pick<Address, 'address' | 'publicKey'>;

/** Adresse de paiement (BTC) et adresse ordinals (inscriptions) du portefeuille connecté */
export type WagmiBtcAddress = {
  payment: BitcoinAddress;
  ordinal: BitcoinAddress;
};

export interface CustomRequestOptions<Payload extends RequestPayload, Response> {
  onFinish: (response: Response) => void;
  onCancel: (error: Error) => void;
  onError: (error: Error) => void;
  payload: Payload;
  getProvider?: () => Promise<SatsBitcoinProvider | undefined>;
}

export type SendBtcTransactionOptions = CustomRequestOptions<SendBtcTransactionPayload, SendBtcTransactionResponse>;
export type SignTransactionOptions = CustomRequestOptions<SignTransactionPayload, SignTransactionResponse>;
export type SignMessageOptions = CustomRequestOptions<SignMessagePayload, SignMessageResponse>;
