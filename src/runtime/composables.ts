import { useRuntimeConfig } from '#app';
import type { BitcoinConnector, WagmiBtcModuleOptions } from '../types';
import {
  //
  leatherConnect,
  leatherProvider,
  leatherSignMessage,
  unisatConnect,
  unisatProvider,
  unisatSignMessage,
  phantomConnect,
  phantomProvider,
  phantomSignMessage,
  xverseConnect,
  xverseProvider,
  xverseSignMessage,
} from './composables';
export { unisatProvider, unisatConnect, unisatSignMessage } from '../composables/unisat';
export { xverseProvider, xverseConnect, xverseSignMessage } from '../composables/xverse';
export { phantomProvider, phantomConnect, phantomSignMessage } from '../composables/phantom';
export { leatherProvider, leatherConnect, leatherSignMessage } from '../composables/leather';

export const useWagmiBtc = () => {
  const config = useRuntimeConfig().app;
  return config.wagmiBtc as WagmiBtcModuleOptions;
};

export const getConnectors = () => {
  return useWagmiBtc().connectors;
};
export const getProviders = () => {
  return [
    {
      id: 'leather',
      provider: leatherProvider,
      connect: leatherConnect,
      signature: leatherSignMessage,
    },
    {
      id: 'xverse',
      provider: xverseProvider,
      connect: xverseConnect,
      signature: xverseSignMessage,
    },
    {
      id: 'phantom',
      provider: phantomProvider,
      connect: phantomConnect,
      signature: phantomSignMessage,
    },
    {
      id: 'unisat',
      provider: unisatProvider,
      connect: unisatConnect,
      signature: unisatSignMessage,
    },
  ];
};

export const getProvider = (connector: BitcoinConnector) => {
  return getProviders().find((c) => c.id === connector.id)!;
};
