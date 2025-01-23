import { useRuntimeConfig } from '#app';
import type { ModuleOptions } from '~/src/module';

export const useWagmiBtc = () => {
  const config = useRuntimeConfig().app;
  return config.wagmiBtc as ModuleOptions;
};
