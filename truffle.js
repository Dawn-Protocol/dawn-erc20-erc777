require('ts-node/register');
require('espower-typescript/guess');

const path = require('path');
const HDWalletProvider = require('@truffle/hdwallet-provider');

require('dotenv').config();

module.exports = {

  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  contracts_build_directory: path.join(__dirname, 'build/contracts'),

  plugins: [
    // "truffle-security",
    // "solidity-coverage",
    'truffle-plugin-verify',
  ],

  networks: {

    kovan: {
      provider: () => new HDWalletProvider(
        process.env.KOVAN_MNEMONIC,
        process.env.KOVAN_PROVIDER_URL,
        0, // address_index
        10, // num_addresses
        true, // shareNonce
      ),
      network_id: 42, // Kovan's id
      // gas: 7017622, //
      // confirmations: 2, // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 50, // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
    },

    mainnet: {
      provider: () => new HDWalletProvider(
        process.env.MAINNET_MNEMONIC,
        process.env.MAINNET_PROVIDER_URL,
        0, // address_index
        10, // num_addresses
        true, // shareNonce
      ),
      network_id: 1, // mainnet's id
      // gas: 7017622
      gasPrice: +process.env.MAINNET_GAS_PRICE || 1000 * 1000 * 1000, // default 1 gwei
      // confirmations: 2, // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 50, // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
    },

  },

  compilers: {
    solc: {
      version: '0.5.16', // A version or constraint - Ex. "^0.5.0"
      // Can also be set to "native" to use a native solc
      // docker: false, // Use a version obtained through docker
      parser: 'solcjs', // Leverages solc-js purely for speedy parsing

      settings: {
        optimizer: {
          enabled: true,
          runs: 1500,
        },
      },
    },
  },
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY,
  },
};
