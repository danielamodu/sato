// App entry. Order matters and these use require() (not import) on purpose:
// ES import statements hoist, which would run the crypto assignment out of
// order. Node-global shims load first, then getRandomValues, then WebCrypto's
// subtle, and only then the router — matching the Stacks.js RN guide.
require("./polyfill");
require("react-native-get-random-values");

const { Crypto } = require("@peculiar/webcrypto");
if (!global.crypto || !global.crypto.subtle) {
  Object.assign(global.crypto || (global.crypto = {}), new Crypto());
}

require("expo-router/entry");
