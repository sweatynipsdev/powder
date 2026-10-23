// `npx pwa-assets-generator` builds the PNG icons from public/favicon.svg.
// iOS and Android mask the icon themselves, so those versions are full-bleed on the icon's
// own background instead of padded onto white.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const fullBleed = { padding: 0, resizeOptions: { background: '#0f1b2d' } };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { ...minimal2023Preset.apple, ...fullBleed },
    maskable: { ...minimal2023Preset.maskable, ...fullBleed },
  },
  images: ['public/favicon.svg'],
});
