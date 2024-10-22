import { build } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.mjs',
  minify: true,
  plugins: [
    copy({
      assets: {
        from: 'src/task.json',
        to: '.',
      },
    }),
  ],
});
