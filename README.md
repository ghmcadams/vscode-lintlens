# LintLens - VSCode extension

[![Visual Studio Marketplace](https://vsmarketplacebadges.dev/version-short/ghmcadams.lintlens.svg)](https://marketplace.visualstudio.com/items?itemName=ghmcadams.lintlens)
[![Visual Studio Marketplace](https://vsmarketplacebadges.dev/installs-short/ghmcadams.lintlens.svg)](https://marketplace.visualstudio.com/items?itemName=ghmcadams.lintlens)
[![Visual Studio Marketplace](https://vsmarketplacebadges.dev/rating-star/ghmcadams.lintlens.svg)](https://marketplace.visualstudio.com/items?itemName=ghmcadams.lintlens)
[![The MIT License](https://img.shields.io/badge/license-MIT-orange.svg?style=flat-square)](http://opensource.org/licenses/MIT)
[![Twitter](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Fimg.shields.io%2Ftwitter%2Furl%3Furl%3Dhttps%253A%252F%252Fgithub.com%252Fghmcadams%252Fvscode-lintlens%252F)](https://twitter.com/intent/tweet?text=Wow:&url=https%3A%2F%2Fgithub.com%2Fghmcadams%2Fvscode-lintlens%2F)

Augment your ESLint rules in Visual Studio Code — Adds metadata and usage information beside each ESLint rule.

<p align="left">
  <br />
  <img src="https://raw.githubusercontent.com/ghmcadams/vscode-lintlens/master/images/lintlens-screenshot-hover.png" alt="LintLens Screenshot" width="300px" />
  <br />
</p>

## Features

Adds details beside each [ESLint rule](https://eslint.org/docs/rules/) in your configuration file (including [plugins](https://www.npmjs.com/search?q=eslint-plugin-&ranking=popularity)) located anywhere in your workspace folders (supports multiple config files, and even multiple versions of ESLint and plugins).

Displays detailed information (including usage schema information and a link to the official docs page) in a hover container for each rule.

Adds intellisense (autocomplete) for rule IDs and for simple rule values (complex rule value intellisense MIGHT be added in the future)

Adds rule value validation

Supports all configuration file formats currently [supported by ESLint](https://eslint.org/docs/user-guide/configuring#configuration-file-formats)

- Flat Config - use `eslint.config.js` at the root and export an array containing your configurations.
- JavaScript - use `.eslintrc.js` or `.eslintrc.cjs` (or any other javascript file in your workspace) and export an object containing your configuration.
- YAML - use `.eslintrc.yaml` or `.eslintrc.yml` (or any other yaml file in your workspace) to define the configuration structure.
- JSON - use `.eslintrc.json` (or any other JSON file in your workspace) to define the configuration structure. ESLint’s JSON files also allow JavaScript-style comments.
- **Deprecated** - use `.eslintrc`, which can be either JSON or YAML.
- package.json - create an `eslintConfig` property in your `package.json` file and define your configuration there.

If you are new to ESLint check the [documentation](http://eslint.org/).  

Hover for more information on each rule:

<p align="center">
  <br />
  <img src="https://raw.githubusercontent.com/ghmcadams/vscode-lintlens/master/images/lintlens-preview-hover.gif" alt="LintLens Preview Hover" width="600px" />
  <br />
</p>


Auto-updates as you type:

<p align="center">
  <br />
  <img src="https://raw.githubusercontent.com/ghmcadams/vscode-lintlens/master/images/lintlens-preview-main.gif" alt="LintLens Preview Main" width="600px" />
  <br />
</p>


## Requirements

In an effort to support all possible plugins and to keep size small, this extension uses both ESLint and ESLint plugins installed in the opened workspace folder(s).  Due to restrictions in vscode, this extension does not support globally installed packages.

## Known Issues

- Does not support globally installed eslint or plugin packages (must be installed in the currently open workspace)
- ESLint v4.15.0 added an official location for rules to store a URL to their documentation in the rule metadata in [eslint/eslint#9788](https://github.com/eslint/eslint/pull/9788). This adds the URL to all the existing rules so anything consuming them can know where their documentation is without having to resort to external packages to guess.  If your plugin hasn't included this metadata, its possible you have an older version that needs to be updated.
- Parsing js configs (flat and legacy) is somewhat limited, but should work in almost all cases.
  - Simple exporting of a config works
  - Exporting from a variable works
  - Finding rules through rest spread works
  - rule option validation does not work when variables are used
  - Beyond that, parsing could be improved
  - Additionally, the language mode must match `javascript` or `javascriptreact`.
- Intellisense does not work for YAML config files
- Rule option validation does not work for YAML config files
