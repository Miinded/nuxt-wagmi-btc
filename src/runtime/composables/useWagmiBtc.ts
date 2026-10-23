import { useRuntimeConfig } from '#app';
import type { ModuleOptions } from '../types/wagmi-btc';

export const useWagmiBtc = () => {
  const config = useRuntimeConfig().app;
  return config.wagmiBtc as ModuleOptions;
};
