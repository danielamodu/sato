// Node globals Stacks.js expects at runtime. Loaded first, before anything that
// touches crypto (see index.js). Kept separate from the WebCrypto assignment
// because loading them together can trip runtime init errors on some devices.
const { Buffer } = require("buffer");
const process = require("process");

if (typeof global.Buffer === "undefined") global.Buffer = Buffer;
if (typeof global.process === "undefined") global.process = process;

const { TextEncoder, TextDecoder } = require("text-encoding");
if (typeof global.TextEncoder === "undefined") global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === "undefined") global.TextDecoder = TextDecoder;
