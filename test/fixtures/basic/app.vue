<template>
  <div>basic</div>
  <ul>
    <li v-for="connector in getConnectors()" :key="connector.id" :data-icon="connector.icon">{{ connector.name }}</li>
  </ul>
</template>
