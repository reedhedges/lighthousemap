const HardSourceWebpackPlugin = require('hard-source-webpack-plugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const path = require('path')

module.exports = {
  entry: './lighthousemap.js',
  output: { 
    filename: 'lighthousemap-bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  devtool: 'inline-source-map',
  devServer: { contentBase: './dist' },
  resolve: {
    mainFields: ['svelte', 'browser', 'module', 'main']
  },
  module : {
    rules: [ 
      {
        test: /\.js$/,
        exclude: /(node_modules|misc_libraries)/,
        use: {
          loader: 'babel-loader',
          options: { presets: ['env'] }
        }
      },
      {
        test: /\.svelte\.html$/,
        exclude: /(node_modules|misc_libraries)/,
        use: [
          {
            loader: 'svelte-hot-loader'
          },
          {
            loader: 'svelte-loader',
            query: {
              dev: true,
              emitCss: false,
              store: true
            }
          }
        ]
      }
    ] 
  },

  plugins: [
    new HardSourceWebpackPlugin(),
    new UglifyJsPlugin()
  ]
};
