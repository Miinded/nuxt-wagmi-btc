<script setup lang="ts">
import type { BitcoinConnector, BitcoinProvider } from '../src/runtime/types/wagmi-btc';

const a = getConnectors();
const provider = ref<BitcoinProvider>();

const connectToBtcProvider = async (x: BitcoinConnector) => {
  try {
    console.log(x);
    provider.value = getProvider(x)!;

    const account = await provider.value.connect();
    console.log(account);
  } catch (e: any) {
    let description = e.message;
    switch (e.code) {
      case -32002:
        description = `Connect request already pending!`;
        break;
      case 4001:
        description = `You rejected the transaction.`;
        break;
    }
    // toast({
    //   variant: 'destructive',
    //   title: 'Error',
    //   description,
    // });
    console.log(description);
  }
};

const getAddresses = async () => {
  console.log(await provider.value!.getAddresses());
};

const sign = async () => {
  const r = await provider.value!.signature({ test: '123456' });
  console.log(r);
};

const sendBtc = async () => {
  const addresses = await provider.value!.getAddresses();
  const r = await provider.value!.sendBtc([{ address: addresses.payment.address, amount: 100000000 }]);
  console.log(r);
};
</script>
<template>
  <div>
    Nuxt module playground!

    <button
      v-for="x in a"
      :key="x.name"
      type="button"
      class="flex justify-start h-auto px-1 py-1"
      @click="connectToBtcProvider(x)"
    >
      <img :src="x.icon" alt="sd" />
      {{ x.name }}
    </button>
    <br />
    <button @click="getAddresses">Adresses</button>
    <button @click="sign">Sign message</button>
    <button @click="sendBtc">sendBtc</button>
  </div>
</template>
