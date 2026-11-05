/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
    root: true,
    env: {
        browser: true,
        node: true,
        es2022: true,
    },
    extends: ['plugin:vue/vue3-essential', 'eslint:recommended', '@vue/eslint-config-prettier'],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    ignorePatterns: ['dist/', 'node_modules/', 'public/data/'],
    rules: {
        'vue/multi-word-component-names': 'off',
    },
}
