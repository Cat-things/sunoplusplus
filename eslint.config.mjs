import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['dist/**', 'coverage/**', 'node_modules/**', 'test-results/**']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.mjs', 'vitest.config.ts', 'vitest.e2e.config.ts']
        },
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }
      ],
      eqeqeq: ['error', 'always'],
      'no-console': 'off'
    }
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['packages/*/src/**/*.ts', 'plugins/**/*.ts'],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['scripts/**/*.ts', 'tests/**/*.ts', '*.config.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    // Plugins are community code that runs on suno.com: keep the dangerous bits out.
    files: ['plugins/**/*.ts'],
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'off',
      '@typescript-eslint/no-implied-eval': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'chrome', message: 'Use the plugin context instead of extension APIs.' },
        { name: 'browser', message: 'Use the plugin context instead of extension APIs.' }
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message: 'Plugins cannot load code at runtime; bundle everything.'
        }
      ]
    }
  },
  prettier
)
