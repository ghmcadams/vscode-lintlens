# LintLens - VSCode extension

[![Visual Studio Marketplace](https://img.shields.io/vscode-marketplace/v/ghmcadams.lintlens.svg)](https://marketplace.visualstudio.com/items?itemName=ghmcadams.lintlens)
[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/installs-short/ghmcadams.lintlens.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=ghmcadams.lintlens)
[![David](https://img.shields.io/david/ghmcadams/vscode-lintlens?style=flat-square)](https://david-dm.org/ghmcadams/vscode-lintlens)
[![David](https://img.shields.io/david/dev/ghmcadams/vscode-lintlens.svg?style=flat-square)](https://david-dm.org/ghmcadams/vscode-lintlens?type=dev)
[![The MIT License](https://img.shields.io/badge/license-MIT-orange.svg?style=flat-square)](http://opensource.org/licenses/MIT)

Augment your ESLint rules in Visual Studio Code — Adds metadata and usage information beside each ESLint rule.

<p align="left">
  <br />
  <img src="https://raw.githubusercontent.com/ghmcadams/vscode-lintlens/master/images/lintlens-screenshot-hover.png" alt="LintLens Screenshot" width="300px" />
  <br />
</p>

## Features

Adds details beside each [ESLint rule](https://eslint.org/docs/rules/) in your configuration file (including [plugins](https://www.npmjs.com/search?q=eslint-plugin-&ranking=popularity)) located anywhere in your workspace folders (supports multiple config files).

Displays detailed information (including usage schema information and a link to the official docs page) in a hover container for each rule.

Supports all configuration file formats currently [supported by ESLint](https://eslint.org/docs/user-guide/configuring#configuration-file-formats)

- JavaScript - use `.eslintrc.js` or `.eslintrc.cjs` and export an object containing your configuration.
- YAML - use `.eslintrc.yaml` or `.eslintrc.yml` to define the configuration structure.
- JSON - use `.eslintrc.json` to define the configuration structure. ESLint’s JSON files also allow JavaScript-style comments.
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

- Does not support globally installed eslint or plugin packages
- ESLint v4.15.0 added an official location for rules to store a URL to their documentation in the rule metadata in [eslint/eslint#9788](https://github.com/eslint/eslint/pull/9788). This adds the URL to all the existing rules so anything consuming them can know where their documentation is without having to resort to external packages to guess.  If your plugin hasn't included this metadata, its possible you have an older version that needs to be updated.
- When using the JS configuration file format, this extension currently only supports rules existing
  in a single exports object at the root (`module.exports.rules`). Additionally, the language mode
  must match `javascript` or `javascriptreact`.
