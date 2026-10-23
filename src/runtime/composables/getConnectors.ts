import { useWagmiBtc } from './useWagmiBtc';

export const getConnectors = () => {
  return useWagmiBtc().connectors;
};
