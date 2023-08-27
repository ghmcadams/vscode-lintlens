'use strict';

const path = require('path');

const config = {
    target: 'node',

    entry: './src/extension.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "[absolute-resource-path]",
    },
    devtool: 'source-map',
    externals: [
        'eslint',
        {
            // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
            vscode: "commonjs vscode"
        }
    ],
    module: {
        rules: [
            {
                test: /static/,
                exclude: /node_modules/,
                use: 'raw-loader'
            },
            {
                test: /\.mjs$/,
                type: 'javascript/auto',
            },
            {
                test: /\.js$/,
                exclude: /(node_modules|static)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                        plugins: ['@babel/plugin-transform-runtime']
                    }
                }
            },
            {
                test: /\.js$/,
                enforce: "pre",
                use: ["source-map-loader"],
            }
        ]
    }
}

module.exports = config;
