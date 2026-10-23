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
- **Mainnet, testnet, testnet4 and signet**, propagated to the wallets, `bitcoinjs-lib` and mempool.space.
- `bitcoinjs-lib` provided to the client as `$bitcoin`, with a pure JavaScript ECC library initialised for Taproot.
- Transactions built with complete inputs (`witnessUtxo`, `tapInternalKey`, `redeemScript` or `nonWitnessUtxo`) and fees
  computed from the virtual size of each input and output type.
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
    network: 'mainnet', // 'mainnet' | 'testnet' | 'testnet4' | 'signet'
    // mempoolApiUrl: 'https://mempool.example.com/signet/api', // defaults to mempool.space for the network
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

### Networks

`network` selects the Bitcoin network for the whole module:

| `network`  | Wallets (sats-connect / Leather / Unisat)   | `bitcoinjs-lib`    | mempool.space API                    |
| ---------- | ------------------------------------------- | ------------------ | ------------------------------------ |
| `mainnet`  | `Mainnet` / `mainnet` / `BITCOIN_MAINNET`   | `networks.bitcoin` | `https://mempool.space/api`          |
| `testnet`  | `Testnet` / `testnet` / `BITCOIN_TESTNET`   | `networks.testnet` | `https://mempool.space/testnet/api`  |
| `testnet4` | `Testnet4` / `testnet` / `BITCOIN_TESTNET4` | `networks.testnet` | `https://mempool.space/testnet4/api` |
| `signet`   | `Signet` / `signet` / `BITCOIN_SIGNET`      | `networks.testnet` | `https://mempool.space/signet/api`   |

Xverse and Magic Eden receive the network in their requests, Unisat is switched to it on `connect()`, Leather receives
it when signing and sending. Phantom only supports mainnet: its methods reject on any other network.

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
| `disconnect()`                           | Forgets the remembered addresses; the next `connect()` asks again   |

Unisat sends to a single recipient. Phantom builds the transaction itself from the payment address UTXOs
(mempool.space): native SegWit, Taproot, nested SegWit (`3…` / `2…`, public key required) and legacy senders are
supported, P2WSH senders are not. The fee is `ceil(vsize × fastestFee)`, where `vsize` counts 148 / 91 / 68 / 57.5 vbytes
per P2PKH / P2SH-P2WPKH / P2WPKH / P2TR input and 34 / 32 / 31 / 43 / 43 per P2PKH / P2SH / P2WPKH / P2WSH / P2TR
output; change under 546 sats is left to the fee.

Xverse, Leather and Magic Eden remember the connected addresses; they are forgotten on `disconnect()`, when Xverse
reports an account or network change, and when Magic Eden reports an account change.

### Types

`BitcoinAddress`, `BitcoinConnector`, `BitcoinProvider`, `BitcoinRecipient`, `ModuleOptions`, `WagmiBtcAddress` and
`WagmiBtcNetwork` are exported from `@miinded/nuxt-wagmi-btc`.

## Limitations

- **Phantom** is mainnet only (a wallet limitation).
- **Leather** does not report account changes: call `disconnect()` when the user switches accounts.
- The module injects a global `exports = {}` script on the client: some CommonJS dependencies of the wallet libraries
  expect it in the browser.

## Migrating from 0.x

- Nuxt 4 is required; `nuxt` and `vue` are now **peer dependencies**.
- `vite-plugin-node-polyfills` is no longer installed by the module: add it to your app (see Installation).
- Types moved to `runtime/types`; import them from the package root (`@miinded/nuxt-wagmi-btc`).
- `xverse.connect()` now rejects when the user refuses or the wallet fails (it used to resolve with empty addresses).
- `getAddresses()` of Xverse, Leather and Magic Eden connects when no address is known yet (it used to return empty
  addresses).
- `convertPsbt` detects the input format; its third argument (`force`) is ignored.
- `estimateTxSize` uses corrected virtual sizes and throws on unknown types; prefer `estimateTxVsize`, which takes one
  type per output.
- `phantomProvider()` no longer opens the Phantom documentation when Bitcoin is not enabled
  (`PHANTOM_BITCOIN_DOC_URL` is exported for apps that want to).
- `magicEdenProvider()` returns `null` (not `undefined`) when the Magic Eden Bitcoin wallet is unavailable.
- Published on npm: remove the GitLab registry lines (`@miinded:registry=…`) from your `.npmrc`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
