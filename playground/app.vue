<script setup lang="ts">
import type { BitcoinConnector } from '../src/types/wagmi-btc';

const a = getConnectors();

const connectToBtcProvider = async (x: BitcoinConnector) => {
  try {
    console.log(x);
    const { connect } = getProvider(x);
    const account = await connect();
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
</script>
<template>
  <div>
    Nuxt module playground!

    <button v-for="x in a" :key="x.name" type="button" class="flex justify-start h-auto px-1 py-1" @click="connectToBtcProvider(x)">
      <img :src="x.icon" alt="sd" />
      {{ x.name }}
    </button>
  </div>
</template>
