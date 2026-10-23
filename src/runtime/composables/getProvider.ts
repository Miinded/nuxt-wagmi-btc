import type { BitcoinConnector } from '../types/wagmi-btc';
import { getProviders } from './getProviders';

export const getProvider = (connector: BitcoinConnector) => {
  return getProviders().find((c) => c.id === connector.id)!;
};
