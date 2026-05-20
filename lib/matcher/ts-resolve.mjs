// Minimal ESM resolve hook for running the matcher tests with Node's native
// type-stripping. The source files use extensionless relative imports
// (`./levenshtein`) per the Next.js bundler convention. Node's default
// resolver won't append `.ts`, so this hook does it for relative specifiers.
//
// No dependencies — pure Node loader API. Used only by the test command.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !specifier.endsWith('.ts') &&
    !specifier.endsWith('.js') &&
    !specifier.endsWith('.mjs') &&
    context.parentURL
  ) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const candidate = pathResolve(parentDir, `${specifier}.ts`);
    if (existsSync(candidate)) {
      return nextResolve(`${specifier}.ts`, context);
    }
  }
  return nextResolve(specifier, context);
}
