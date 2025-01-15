import { addImports, createResolver, defineNuxtModule } from '@nuxt/kit';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { BitcoinConnector, WagmiBtcModuleOptions } from './types';

export default defineNuxtModule<WagmiBtcModuleOptions>({
  meta: {
    name: 'wagmi-btc',
    configKey: 'wagmiBtc',
  },
  // Default configuration options of the Nuxt module
  defaults: {
    iconPath: '/icon',
    connectors: [
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
    const { resolve } = createResolver(import.meta.url);

    _nuxt.hook('prepare:types', ({ references }) => {
      references.push({ types: 'wagmi-btc' });
    });

    const moduleAssetsDir = path.resolve(__dirname, 'assets');
    const nuxtStaticDir = path.resolve(_nuxt.options.rootDir, 'public');

    _nuxt.hook('build:before', async () => {
      try {
        const destPath = path.join(nuxtStaticDir, _options.iconPath ?? 'icon');
        try {
          // Créer le dossier récursivement si il n'existe pas
          await fs.mkdir(destPath, { recursive: true });
        } catch (err) {
          console.error('Erreur lors de la création du dossier:', err);
        }

        const assets = await fs.readdir(moduleAssetsDir);
        for (const asset of assets) {
          const src = path.join(moduleAssetsDir, asset);
          const dest = path.join(destPath, asset);
          try {
            await fs.stat(dest); // Vérifie si le fichier existe déjà
          } catch (err: any) {
            if (err.code === 'ENOENT') {
              // Si le fichier n'existe pas, le copier
              await fs.copyFile(src, dest);
              console.log(`File copied: ${dest}`);
            } else {
              // Si une autre erreur survient, la relancer
              throw err;
            }
          }
        }
      } catch (error) {
        console.error('Error copying assets:', error);
      }
    });

    const composables = resolve('./runtime/composables');
    const names = [
      //
      'unisatProvider',
      'unisatConnect',
      'unisatSignMessage',
      'xverseProvider',
      'xverseConnect',
      'xverseSignMessage',
      'phantomProvider',
      'phantomConnect',
      'phantomSignMessage',
      'leatherProvider',
      'leatherConnect',
      'leatherSignMessage',
      //
      'useWagmiBtc',
      'getConnectors',
      'getProvider',
    ];
    addImports(names.map((name) => ({ from: composables, name })));

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
