# @miinded/nuxt-wagmi-btc

[![npm version](https://img.shields.io/npm/v/@miinded/nuxt-wagmi-btc.svg)](https://www.npmjs.com/package/@miinded/nuxt-wagmi-btc)
[![license](https://img.shields.io/npm/l/@miinded/nuxt-wagmi-btc.svg)](./LICENSE)
[![Quality](https://github.com/Miinded/nuxt-wagmi-btc/actions/workflows/quality.yml/badge.svg)](https://github.com/Miinded/nuxt-wagmi-btc/actions/workflows/quality.yml)
[![codecov](https://codecov.io/gh/Miinded/nuxt-wagmi-btc/graph/badge.svg)](https://codecov.io/gh/Miinded/nuxt-wagmi-btc)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt.js)](https://nuxt.com)

A [Nuxt](https://nuxt.com) module that connects **Bitcoin wallets** behind a single, wagmi-like API. Your app talks to
one `BitcoinProvider` interface; the module handles the differences between Xverse, Leather, Magic Eden, Phantom and
Unisat.

## Features

- Five wallets out of the box: **Xverse**, **Leather**, **Magic Eden**, **Phantom** and **Unisat**.
- One interface per wallet: connect, payment and ordinals addresses, message signing, PSBT signing (with optional
  broadcast) and BTC transfers.
- Configurable list of connectors, with wallet icons served by the module.
- `bitcoinjs-lib` provided to the client as `$bitcoin`.
- PSBT helpers that accept hex or base64 input.

## Requirements

| Package | Version |
| ------- | ------- |
| Node.js | `>= 24` |
| Nuxt    | `4`     |
| Vue     | `3.5`   |

Wallets run in the browser: call the composables from client-side code only (event handlers, `onMounted`, `.client`
components).

## Installation

```bash
pnpm add @miinded/nuxt-wagmi-btc
pnpm add -D vite-plugin-node-polyfills
```

Wallet libraries rely on Node globals such as `Buffer`, so the app needs browser polyfills (the module itself defines
the CommonJS `exports` global they also expect):

```ts
// nuxt.config.ts
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineNuxtConfig({
  modules: ['@miinded/nuxt-wagmi-btc'],
  vite: {
    optimizeDeps: {
      include: ['buffer', 'jsontokens', 'bitcoinjs-lib'],
    },
    plugins: [nodePolyfills()],
  },
  wagmiBtc: {
    // optional — defaults shown
    iconPath: '/icon',
    connectors: [
      { id: 'magicEden', name: 'Magic Eden', icon: ':iconPath/magiceden-icon.png' },
      { id: 'leather', name: 'Leather', icon: ':iconPath/leather-icon.png' },
      { id: 'xverse', name: 'Xverse', icon: ':iconPath/xverse-icon.png' },
      { id: 'phantom', name: 'Phantom', icon: ':iconPath/phantom-icon.png' },
      { id: 'unisat', name: 'Unisat', icon: ':iconPath/unisat-icon.png' },
    ],
  },
});
```

`:iconPath` in a connector icon is replaced by `iconPath`. The module serves its icons under `/icon/`.

## Usage

```vue
<script setup lang="ts">
import type { BitcoinConnector, BitcoinProvider, WagmiBtcAddress } from '@miinded/nuxt-wagmi-btc';

const connectors = getConnectors();
const wallet = shallowRef<BitcoinProvider>();
const account = ref<WagmiBtcAddress>();

const connect = async (connector: BitcoinConnector) => {
  wallet.value = getProvider(connector);
  account.value = await wallet.value.connect(); // throws viem's UserRejectedRequestError on refusal
};

const signIn = () => wallet.value!.signature({ domain: location.host, nonce: '42' });
const pay = () => wallet.value!.sendBtc([{ address: 'bc1q…', amount: 15_000 }]); // satoshis, returns the txid
</script>

<template>
  <button v-for="connector in connectors" :key="connector.id" @click="connect(connector)">
    <img :src="connector.icon" :alt="connector.name" /> {{ connector.name }}
  </button>
  <p v-if="account">Payment: {{ account.payment.address }} — Ordinals: {{ account.ordinal.address }}</p>
</template>
```

### Signing a PSBT

```ts
const result = await wallet.value!.signaturePsbt(
  psbtBase64OrHex,
  [{ address: account.value!.payment.address, signingIndexes: [0, 1] }],
  true, // broadcast once signed
);
result.psbt; // signed PSBT (base64)
result.txid; // set when broadcast
```

## API

### Composables (auto-imported)

| Composable                  | Returns              | Description                                                         |
| --------------------------- | -------------------- | ------------------------------------------------------------------- |
| `getConnectors()`           | `BitcoinConnector[]` | Connectors configured in `wagmiBtc.connectors`                      |
| `getProvider(connector)`    | `BitcoinProvider`    | Wallet implementation of a connector                                |
| `getProviders()`            | `BitcoinProvider[]`  | All supported wallets                                               |
| `useWagmiBtc()`             | `ModuleOptions`      | Resolved module options                                             |
| `convertPsbt(psbt, format)` | `string`             | Converts a PSBT to `'hex'` or `'base64'`, whatever its input format |

### `BitcoinProvider`

| Member                                   | Description                                                         |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `id`                                     | `magicEden`, `leather`, `xverse`, `phantom` or `unisat`             |
| `provider()`                             | Object injected by the wallet extension (`null` when not installed) |
| `connect()`                              | Asks the user to connect; resolves `{ payment, ordinal }` addresses |
| `getAddresses()`                         | Connected addresses (connects first if needed)                      |
| `signature(message)`                     | Signs `JSON.stringify(message)` with the payment address            |
| `signaturePsbt(psbt, inputs, broadcast)` | Signs a PSBT; `inputs` lists `{ address, signingIndexes }`          |
| `sendBtc(recipients)`                    | Sends BTC (`{ address, amount }` in satoshis) and returns the txid  |

Unisat sends to a single recipient; Phantom builds the transaction itself from the payment address UTXOs
(mempool.space).

### Types

`BitcoinAddress`, `BitcoinConnector`, `BitcoinProvider`, `BitcoinRecipient`, `ModuleOptions` and `WagmiBtcAddress` are
exported from `@miinded/nuxt-wagmi-btc`.

## Limitations

- **Mainnet only**: networks are hard-coded to Bitcoin mainnet and mempool.space mainnet.
- **Phantom transfers to Taproot (`bc1p…`) addresses** fail: `bitcoinjs-lib` needs an ECC library that the module does
  not initialise.

## Migrating from 0.x

- Nuxt 4 is required; `nuxt` and `vue` are now **peer dependencies**.
- `vite-plugin-node-polyfills` is no longer installed by the module: add it to your app (see Installation).
- Types moved to `runtime/types`; import them from the package root (`@miinded/nuxt-wagmi-btc`).
- `xverse.connect()` now rejects when the user refuses or the wallet fails (it used to resolve with empty addresses).
- `getAddresses()` of Xverse, Leather and Magic Eden connects when no address is known yet (it used to return empty
  addresses).
- `convertPsbt` detects the input format; its third argument (`force`) is ignored.
- Published on npm: remove the GitLab registry lines (`@miinded:registry=…`) from your `.npmrc`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
