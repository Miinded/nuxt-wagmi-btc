import type { BitcoinProvider } from '../types/wagmi-btc';
import {
  leatherAddresses,
  leatherConnect,
  leatherProvider,
  leatherSendBtc,
  leatherSignMessage,
  leatherSignPsbt,
} from './leather';
import {
  magicEdenAddresses,
  magicEdenConnect,
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
    },
    {
      id: 'leather',
      provider: leatherProvider,
      connect: leatherConnect,
      signature: leatherSignMessage,
      signaturePsbt: leatherSignPsbt,
      sendBtc: leatherSendBtc,
      getAddresses: leatherAddresses,
    },
    {
      id: 'xverse',
      provider: xverseProvider,
      connect: xverseConnect,
      signature: xverseSignMessage,
      signaturePsbt: xverseSignPsbt,
      sendBtc: xverseSendBtc,
      getAddresses: xverseAddresses,
    },
    {
      id: 'phantom',
      provider: phantomProvider,
      connect: phantomConnect,
      signature: phantomSignMessage,
      signaturePsbt: phantomSignPsbt,
      sendBtc: phantomSendBtc,
      getAddresses: phantomAddresses,
    },
    {
      id: 'unisat',
      provider: unisatProvider,
      connect: unisatConnect,
      signature: unisatSignMessage,
      signaturePsbt: unisatSignPsbt,
      sendBtc: unisatSendBtc,
      getAddresses: unisatAddresses,
    },
  ];
};
