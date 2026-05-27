export default {
  '**/*.{ts,tsx,mts,cts}': [
    'prettier --write',
    'eslint --fix',
    () => 'npm run typecheck',
  ],
  '**/*.{js,mjs,cjs}': ['prettier --write', 'eslint --fix'],
  '**/*.{json,md,yml,yaml}': ['prettier --write'],
};
