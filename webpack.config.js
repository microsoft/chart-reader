const path = require('path');

module.exports = {
    mode: 'development',
    entry: { v1: path.resolve(__dirname, 'src', 'v1', 'index.js') },
    output: {
        path: path.resolve(__dirname, 'study_site', 'js-build'),
        filename: '[name].bundle.js',
        library: {
            type: 'umd',
            name: '[name]',
        },
    },
    resolve: {
        extensions: ['.js', '.jsx'],
    },
    module: {
        rules: [
            {
                test: /\.jsx/,
                use: {
                    loader: 'babel-loader',
                    options: { presets: ['@babel/preset-env'] },
                },
            },
        ],
    },
};
