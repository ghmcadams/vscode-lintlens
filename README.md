# ESLint Rules Metadata

Augment your ESLint rules in Visual Studio Code - Adds descriptions above each ESLint rule via code lenses.

## Features

Adds details and a documentation link above each [ESLint rule](https://eslint.org/docs/rules/) (including [plugins](https://www.npmjs.com/search?q=eslint-plugin-&ranking=popularity)).

Supports all configuration file formats currently [supported by ESLint](https://eslint.org/docs/user-guide/configuring#configuration-file-formats) (`.eslintrc.js`, `.eslintrc.yaml`, `.eslintrc.yml`, `.eslintrc.json`, `.eslintrc`, `package.json`). If you are new to ESLint check the [documentation](http://eslint.org/).  

Auto-updates as you type:

![Main](images/lintlens-preview-main.gif)


Click for more information on each rule:

![Main](images/lintlens-preview-links.gif)


## Requirements

The extension uses the ESLint library and plugins installed in the opened workspace folder(s).  If ESLint is not installed locally, the extension uses its own installed version (currently `^5.1.0`).  Due to restrictions in vscode, this extension does not support globally installed packages.

## Known Issues

- Does not support globally installed eslint or eslint plugin packages
- When using the JS configuration file format, this extension currently only supports rules existing in a single exports object at the root (`module.exports.rules`).
