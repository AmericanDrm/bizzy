const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolverMainFields = ['browser', 'module', 'main'];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jspdf' || moduleName === 'jspdf/dist/jspdf.es.min.js') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/jspdf/dist/jspdf.es.min.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'jspdf-autotable' || moduleName === 'jspdf-autotable/dist/jspdf.plugin.autotable.mjs') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs'),
      type: 'sourceFile',
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
