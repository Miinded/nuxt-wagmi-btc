import type { BitcoinProvider } from '../types/wagmi-btc';
import {
  leatherAddresses,
  leatherConnect,
  leatherDisconnect,
  leatherProvider,
  leatherSendBtc,
  leatherSignMessage,
  leatherSignPsbt,
} from './leather';
import {
  magicEdenAddresses,
  magicEdenConnect,
  magicEdenDisconnect,
  magicEdenProvider,
  magicEdenSendBtc,
  magicEdenSignMessage,
  magicEdenSignPsbt,
} from './magicEden';
import {
  phantomAddresses,
  phantomConnect,
  phantomProvider,
  phantomSendBtc,
  phantomSignMessage,
  phantomSignPsbt,
} from './phantom';
import {
  unisatAddresses,
  unisatConnect,
  unisatProvider,
  unisatSendBtc,
  unisatSignMessage,
  unisatSignPsbt,
} from './unisat';
import {
  xverseAddresses,
  xverseConnect,
  xverseDisconnect,
  xverseProvider,
  xverseSendBtc,
  xverseSignMessage,
  xverseSignPsbt,
} from './xverse';

export const getProviders = (): BitcoinProvider[] => {
  return [
    {
      id: 'magicEden',
      provider: magicEdenProvider,
      connect: magicEdenConnect,
      signature: magicEdenSignMessage,
      signaturePsbt: magicEdenSignPsbt,
      sendBtc: magicEdenSendBtc,
      getAddresses: magicEdenAddresses,
      disconnect: magicEdenDisconnect,
    },
    {
      id: 'leather',
      provider: leatherProvider,
      connect: leatherConnect,
      signature: leatherSignMessage,
      signaturePsbt: leatherSignPsbt,
      sendBtc: leatherSendBtc,
      getAddresses: leatherAddresses,
      disconnect: leatherDisconnect,
    },
    {
      id: 'xverse',
      provider: xverseProvider,
      connect: xverseConnect,
      signature: xverseSignMessage,
      signaturePsbt: xverseSignPsbt,
      sendBtc: xverseSendBtc,
      getAddresses: xverseAddresses,
      disconnect: xverseDisconnect,
    },
    {
      id: 'phantom',
      provider: phantomProvider,
      connect: phantomConnect,
      signature: phantomSignMessage,
      signaturePsbt: phantomSignPsbt,
      sendBtc: phantomSendBtc,
      getAddresses: phantomAddresses,
      // pas d'adresses mémorisées : chaque appel interroge le portefeuille
      disconnect: () => {},
    },
    {
      id: 'unisat',
      provider: unisatProvider,
      connect: unisatConnect,
      signature: unisatSignMessage,
      signaturePsbt: unisatSignPsbt,
      sendBtc: unisatSendBtc,
      getAddresses: unisatAddresses,
      // pas d'adresses mémorisées : chaque appel interroge le portefeuille
      disconnect: () => {},
    },
  ];
};
