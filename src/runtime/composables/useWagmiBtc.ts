import { useRuntimeConfig } from '#app';
import type { WagmiBtcModuleOptions } from '../../types';

export const useWagmiBtc = () => {
  const config = useRuntimeConfig().app;
  return config.wagmiBtc as WagmiBtcModuleOptions;
};
