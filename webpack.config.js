const path = require('path');

module.exports = {
    mode: 'development',
    entry: {
        chartreader: path.resolve(__dirname, 'src', 'index.ts'),
    },
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].bundle.js',
        library: {
            type: 'umd',
            name: '[name]',
        },
    },
    devtool: 'source-map',
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx|tsx|ts)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
            },
        ],
    },
};
