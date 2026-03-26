import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  prettier,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': [
        'warn',
        {
          // Ignore args prefixed with _
          argsIgnorePattern: '^_',
          // Ignore PascalCase names — React components are always PascalCase and
          // ESLint can't detect JSX usage without eslint-plugin-react/jsx-uses-vars.
          // This prevents hundreds of false-positive warnings on imported components.
          varsIgnorePattern: '^[A-Z]',
        },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'react-hooks/set-state-in-effect': 'warn',
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        Float64Array: 'readonly',
        Infinity: 'readonly',
        NaN: 'readonly',
        localStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        HTMLElement: 'readonly',
        navigator: 'readonly',
        getComputedStyle: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '.wrangler/', '**/*.ts'],
  },
]
