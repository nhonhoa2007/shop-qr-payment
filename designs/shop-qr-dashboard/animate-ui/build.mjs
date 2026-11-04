import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stat } from 'node:fs/promises';

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(here, '../src');
const reactAliases = {
  react: 'window.ShopQrPreviewRuntime.React',
  'react/jsx-runtime': 'window.ShopQrPreviewRuntime.JSX',
  'react/jsx-dev-runtime': 'window.ShopQrPreviewRuntime.JSX',
  'react-dom': 'window.ShopQrPreviewRuntime.DOM',
  'react-dom/client': 'window.ShopQrPreviewRuntime.Client',
};
const aliases = entries => ({
  name: 'shared-preview-runtime',
  setup(builder) {
    builder.onResolve({ filter: /^(react($|\/)|react-dom($|\/)|motion($|\/)|radix-ui$)/ }, args => {
      if (entries[args.path]) return { path: args.path, namespace: 'preview-shared' };
    });
    builder.onLoad({ filter: /.*/, namespace: 'preview-shared' }, args => ({
      contents: `module.exports = ${entries[args.path]};`, loader: 'js',
    }));
  },
});
const bundles = [
  ['react-runtime.js', 'ShopQrPreviewRuntime', `import * as React from 'react'; import * as JSX from 'react/jsx-runtime'; import * as DOM from 'react-dom'; import * as Client from 'react-dom/client'; export {React,JSX,DOM,Client};`, {}],
  ['motion-runtime.js', 'ShopQrPreviewMotion', `export * from 'motion/react';`, reactAliases],
  ['radix-runtime.js', 'ShopQrPreviewRadix', `export {Dialog,DropdownMenu,ToggleGroup} from 'radix-ui';`, reactAliases],
  ['animate-components.js', 'ShopQrPreviewUI', null, {...reactAliases, 'motion/react':'window.ShopQrPreviewMotion', 'radix-ui':'window.ShopQrPreviewRadix'}],
];
for (const [filename, globalName, contents, shared] of bundles) {
  const outfile = path.join(output, filename);
  await build({
    absWorkingDir:here,
    ...(contents ? {stdin:{contents,resolveDir:here,sourcefile:filename}} : {entryPoints:['components.jsx']}),
    outfile, bundle:true, format:'iife', globalName, minify:true, target:'es2022',
    platform:'browser', define:{'process.env.NODE_ENV':'"production"'},
    legalComments:'inline', plugins:[aliases(shared)],
    footer:{js:`window.${globalName}=${globalName};`},
    logLevel:'warning',
  });
  const bytes = (await stat(outfile)).size;
  if(bytes>256*1024) throw new Error(`${filename} exceeds the dashboard's 256 KB document limit (${bytes} bytes)`);
  console.log(`${filename}: ${bytes} bytes`);
}
