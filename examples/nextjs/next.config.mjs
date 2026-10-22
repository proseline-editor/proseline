// Proseline's packages ship plain ESM with types, so Next needs no special configuration.
// happy-dom (used by @tiptap/html on the server) stays an external Node package.
const config = { serverExternalPackages: ['happy-dom'] };

export default config;
