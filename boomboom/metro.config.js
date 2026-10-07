const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const exclusionList =
  require('metro-config/private/defaults/exclusionList').default;

const srcDir = path.resolve(__dirname, 'src');
const defaultConfig = getDefaultConfig(__dirname);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: exclusionList([
      defaultConfig.resolver.blockList,
      /android\/app\/build\/.*/,
      /android\/app\/\.cxx\/.*/,
      /ios\/Pods\/.*/,
      /ios\/build\/.*/,
    ]),
    // Mirrors the `@/*` path alias in tsconfig.json.
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith('@/')) {
        return context.resolveRequest(
          context,
          path.join(srcDir, moduleName.slice(2)),
          platform,
        );
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
