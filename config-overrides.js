const webpack = require("webpack");

module.exports = function override(config, env) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve("crypto-browserify"),
    stream: require.resolve("stream-browserify"),
    buffer: require.resolve("buffer/"),
    util: require.resolve("util/"),
  };

  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
  ];

  return config;
};
