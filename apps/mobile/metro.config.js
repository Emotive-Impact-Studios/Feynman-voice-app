// Let Metro bundle the Kitten TTS model and voice table as assets.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("onnx", "bin");
module.exports = config;
