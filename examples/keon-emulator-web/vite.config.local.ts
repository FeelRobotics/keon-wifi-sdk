import { mergeConfig } from 'vite';
import baseConfig from './vite.config';

export default mergeConfig(baseConfig, {
  base: './',
  build: {
    outDir: 'dist-local',
    sourcemap: false,
  },
});
