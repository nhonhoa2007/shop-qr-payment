/**
 * Resolve hook ánh xạ các path alias của tsconfig.json sang đường dẫn file thực.
 * Xem tests/register-alias.mjs để biết cách hook được nạp.
 */
import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');

const ALIASES = [
  ['@server/', 'src/server'],
  ['@shared/', 'src/shared'],
  ['@client/', 'src/client'],
  ['@/', 'src'],
];

const EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.cts', '/index.ts', '/index.tsx'];

function resolveAlias(specifier) {
  const mapping = ALIASES.find(([prefix]) => specifier.startsWith(prefix));
  if (!mapping) return null;

  const [prefix, target] = mapping;
  const basePath = path.join(PROJECT_ROOT, target, specifier.slice(prefix.length));
  const hit = EXTENSIONS.map((ext) => basePath + ext).find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile()
  );
  return hit ? pathToFileURL(hit).href : null;
}

export function resolve(specifier, context, nextResolve) {
  const resolved = resolveAlias(specifier);
  if (resolved) {
    return { url: resolved, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
