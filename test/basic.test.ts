import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils/e2e';

describe('module dans une application Nuxt', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  });

  it('rend la page et expose les connecteurs avec leurs icônes résolues', async () => {
    const html = await $fetch('/');
    expect(html).toContain('<div>basic</div>');
    for (const icon of ['magiceden', 'leather', 'xverse', 'phantom', 'unisat']) {
      expect(html).toContain(`data-icon="/icon/${icon}-icon.png"`);
    }
  });

  it('sert les icônes des portefeuilles', async () => {
    const icon = await $fetch<Blob>('/icon/xverse-icon.png', { responseType: 'blob' });
    expect(icon.size).toBeGreaterThan(0);
  });
});
