import { addImportsDir, addPlugin, createResolver, defineNuxtModule } from '@nuxt/kit';
import type { BitcoinConnector, ModuleOptions } from './types/wagmi-btc';
export type { BitcoinConnector, BitcoinProvider, ModuleOptions } from './types/wagmi-btc';

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'wagmi-btc',
    configKey: 'wagmiBtc',
  },
  // Default configuration options of the Nuxt module
  defaults: {
    iconPath: '/icon',
    connectors: [
      {
        id: 'magicEden',
        name: 'Magic Eden',
        icon: ':iconPath/magiceden-icon.png',
      },
      {
        id: 'leather',
        name: 'Leather',
        icon: ':iconPath/leather-icon.png',
      },
      {
        id: 'xverse',
        name: 'Xverse',
        icon: ':iconPath/xverse-icon.png',
      },
      {
        id: 'phantom',
        name: 'Phantom',
        icon: ':iconPath/phantom-icon.png',
      },
      {
        id: 'unisat',
        name: 'Unisat',
        icon: ':iconPath/unisat-icon.png',
      },
    ],
  },
  setup(_options, _nuxt) {
    const resolver = createResolver(import.meta.url);

    _nuxt.hook('prepare:types', ({ references }) => {
      references.push({ types: 'wagmi-btc' });
    });

    addPlugin(resolver.resolve('runtime/plugins/bitcoinjs.client'));


    addImportsDir(resolver.resolve('runtime/composables'));

    _nuxt.hook('nitro:config', async (nitroConfig) => {
      nitroConfig.publicAssets ||= [];
      nitroConfig.publicAssets.push({
        dir: resolver.resolve('runtime/public'),
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    });

    for (const index in _options.connectors) {
      const provider = _options.connectors[index] as BitcoinConnector;
      if (provider.icon) {
        const icon = provider.icon.replace(':iconPath', _options.iconPath);
        if (provider.icon !== icon) {
          _options.connectors[index].icon = icon;
        }
      }
    }

    // Ajoutez les options de configuration au runtime config
    _nuxt.options.runtimeConfig.app.wagmiBtc = _options;
  },
});
