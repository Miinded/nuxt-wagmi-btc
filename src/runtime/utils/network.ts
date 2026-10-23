import { BitcoinNetworkType } from 'sats-connect';
import type { WagmiBtcNetwork } from '../types/wagmi-btc';
import { useWagmiBtc } from '../composables/useWagmiBtc';

const MEMPOOL_API: Record<WagmiBtcNetwork, string> = {
  mainnet: 'https://mempool.space/api',
  testnet: 'https://mempool.space/testnet/api',
  testnet4: 'https://mempool.space/testnet4/api',
  signet: 'https://mempool.space/signet/api',
};

const SATS_CONNECT: Record<WagmiBtcNetwork, BitcoinNetworkType> = {
  mainnet: BitcoinNetworkType.Mainnet,
  testnet: BitcoinNetworkType.Testnet,
  testnet4: BitcoinNetworkType.Testnet4,
  signet: BitcoinNetworkType.Signet,
};

const UNISAT_CHAIN: Record<WagmiBtcNetwork, string> = {
  mainnet: 'BITCOIN_MAINNET',
  testnet: 'BITCOIN_TESTNET',
  testnet4: 'BITCOIN_TESTNET4',
  signet: 'BITCOIN_SIGNET',
};

/** Réseau configuré (`wagmiBtc.network`) décliné pour chaque API qui en a besoin */
export const useBitcoinNetwork = () => {
  const options = useWagmiBtc();
  const network: WagmiBtcNetwork = options.network ?? 'mainnet';
  return {
    network,
    isMainnet: network === 'mainnet',
    mempoolApiUrl: (options.mempoolApiUrl ?? MEMPOOL_API[network]).replace(/\/$/, ''),
    satsConnect: SATS_CONNECT[network],
    unisatChain: UNISAT_CHAIN[network],
    // Leather ne distingue pas testnet3 et testnet4
    leather: network === 'testnet4' ? 'testnet' : network,
  };
};

/** Paramètres réseau bitcoinjs-lib : testnet, testnet4 et signet partagent les préfixes tb1 / m / n / 2 */
export const bitcoinjsNetwork = <T>(bitcoin: { networks: { bitcoin: T; testnet: T } }, network: WagmiBtcNetwork): T =>
  network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
