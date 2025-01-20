import { leatherConnect, leatherProvider, leatherSignMessage } from './leather';
import { phantomConnect, phantomProvider, phantomSignMessage } from './phantom';
import { unisatConnect, unisatProvider, unisatSignMessage } from './unisat';
import { xverseConnect, xverseProvider, xverseSignMessage } from './xverse';

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
