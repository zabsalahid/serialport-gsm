module.exports = {
	root: true,
	ignorePatterns: ['dist/', 'node_modules/', '.eslintrc.js', '.prettierrc.js'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
	plugins: ['@typescript-eslint'],
	env: {
		es6: true,
		node: true
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2021,
		sourceType: 'module',
		project: ['./tsconfig.json', './tests/tsconfig.json'],
		tsconfigRootDir: __dirname
	},
	rules: {
		eqeqeq: 'error',
		curly: 'error',
		yoda: 'error',
		'linebreak-style': ['error', 'unix'],
		'space-infix-ops': 'error',
		'space-unary-ops': 'error'
	}
};
