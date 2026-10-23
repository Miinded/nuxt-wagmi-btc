import { addImportsDir, addPlugin, createResolver, defineNuxtModule } from '@nuxt/kit';
import type { ModuleOptions } from './runtime/types/wagmi-btc';

export type {
  BitcoinAddress,
  BitcoinConnector,
  BitcoinProvider,
  BitcoinRecipient,
  ModuleOptions,
  WagmiBtcAddress,
} from './runtime/types/wagmi-btc';

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'wagmi-btc',
    configKey: 'wagmiBtc',
    compatibility: {
      nuxt: '>=4.0.0',
    },
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

    addPlugin(resolver.resolve('runtime/plugins/bitcoinjs.client'));

    addImportsDir(resolver.resolve('runtime/composables'));

    _nuxt.hook('nitro:config', async (nitroConfig) => {
      nitroConfig.publicAssets ||= [];
      nitroConfig.publicAssets.push({
        dir: resolver.resolve('runtime/public'),
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    });

    // `:iconPath` dans l'icône d'un connecteur est remplacé par l'option iconPath
    _options.connectors = _options.connectors.map((connector) => ({
      ...connector,
      icon: connector.icon?.replace(':iconPath', _options.iconPath),
    }));

    // Ajoutez les options de configuration au runtime config
    _nuxt.options.runtimeConfig.app.wagmiBtc = _options;
  },
});
