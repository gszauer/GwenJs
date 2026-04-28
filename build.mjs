import * as esbuild from 'esbuild';
import { gzipSync } from 'node:zlib';

const watch = process.argv.includes('--watch');

const base = {
  bundle: true,
  target: 'es2020',
  format: 'iife',
  platform: 'browser',
  logLevel: 'info',
};

// Library bundles (production).
// gwen.min.js uses aggressive minification + no legal comments + identifier mangling.
const libConfigs = [
  { entryPoints: ['src/index.ts'], outfile: 'dist/gwen.js',     minify: false, sourcemap: true,  globalName: 'Gwen' },
  {
    entryPoints: ['src/index.ts'],
    outfile: 'dist/gwen.min.js',
    minify: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    legalComments: 'none',
    sourcemap: false,
    globalName: 'Gwen',
  },
];

// Demo bundle — used by the HTML demo and Playwright tests.
// Emitted into demo/ so index.html can reference a sibling script and
// work regardless of what directory root the page is served from.
const demoConfig = {
  entryPoints: ['demo/main.ts'],
  outfile: 'demo/demo.js',
  minify: false,
  sourcemap: true,
};

if (watch) {
  const ctxs = await Promise.all([
    ...libConfigs.map(c => esbuild.context({ ...base, ...c })),
    esbuild.context({ ...base, ...demoConfig }),
  ]);
  await Promise.all(ctxs.map(c => c.watch()));
  console.log('[watch] rebuilding on change...');
} else {
  for (const cfg of libConfigs) {
    await esbuild.build({ ...base, ...cfg });
  }
  await esbuild.build({ ...base, ...demoConfig });
  const fs = await import('node:fs/promises');
  const minBuf = await fs.readFile('dist/gwen.min.js');
  const gz = gzipSync(minBuf).length;
  console.log(`Built dist/gwen.js, dist/gwen.min.js (${(minBuf.length/1024).toFixed(1)} KB raw / ${(gz/1024).toFixed(1)} KB gzip), dist/demo.js`);
}
