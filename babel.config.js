module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', {
        // Force hermes-v0 profile — Hermes 0.12 binary doesn't support private fields
        // hermes-v0 includes @babel/plugin-transform-private-methods & class-properties
        unstable_transformProfile: 'hermes-v0',
      }],
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
