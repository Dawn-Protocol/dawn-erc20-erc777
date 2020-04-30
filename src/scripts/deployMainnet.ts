/**
 * Set ups a environment for deploying mainnet versions of new token, staking and swap contracts.
 *
 * Actual deployment is done through ts-node REPL where you can import inputs.
 *
 * Using OpenZeppelin SDK https://github.com/OpenZeppelin/openzeppelin-sdk
 *
 * More docs: https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/packages/lib#readme
 *
 * https://ethereum.stackexchange.com/questions/67407/how-to-deploy-a-smart-contract-using-infura-and-web3js1-x-x-on-nodejs
 */

import { resolve } from 'path';
import { Proxy, ZWeb3, Contracts } from '@openzeppelin/upgrades';
import * as envalid from 'envalid';
import { Account } from 'eth-lib/lib'; // https://github.com/MaiaVictor/eth-lib/blob/master/src/account.js

import { checkDeploymentAccounts, createProvider } from '../utils/deploy';

// We need all of these secrets from our
// secrets/goerli.env.ini config file
const inputs = {
  // Deployment account private key
  deployerPrivateKeyHex: envalid.str(),

  // Server-side signer account
  signerAccount: envalid.str(),

  // Account that is assigned to be the token owner
  tokenOwnerAccount: envalid.str(),

  // Account that is assigne to be the oracle
  oracleAccount: envalid.str(),

  // Account that is assigned to be the project owner
  proxyOwnerAccount: envalid.str(),

  // Infura project id key for command-line web3 client for testnet
  infuraProjectId: envalid.str(),

  // "goerli" or "ropsten"
  network: envalid.str(),

  // Needed to verify deployed contracts on EtherScan
  etherscanAPIKey: envalid.str(),

};

// Get config file from the command line or fallback to the default
const configPath = process.argv[2] || 'secrets/mainnet.ini';

console.log('Using configuration file', resolve(configPath));

// https://www.npmjs.com/package/envalid
const envOptions = {
  dotEnvPath: configPath,
};

const BURN_ADDRESS = '0x0000000000000000000000000000000000000000';

// How many tokens we approve for the swap 500000_000_000_000_000_000_000
const SWAP_BUDGET = '500000000000000000000000';

// Initial staking price is 800 tokens,
// but this will be later set by a scheduler job
const STAKING_PRICE = '800000000000000000000';

// Old FirstBlood smart contract address
const OLD_TOKEN_ADDRESS = '0xaf30d2a7e90d7dc361c8c4585e9bb7d2f6f15bc7';

// Initial duration of staking is 360 days
const STAKING_TIME = 360 * 24 * 3600;

/**
 * This function is made available for ts-node REPL.
 *
 * You get all inputs needed and then you can manually deploy contracts one by one.
 */
export async function getDeploymentEnvironment(extraPrivateKeys: string[]): Promise<any> {
  const {
    deployerPrivateKeyHex,
    signerAccount,
    tokenOwnerAccount,
    oracleAccount,
    infuraProjectId,
    proxyOwnerAccount,
    network,
    etherscanAPIKey,
  } = envalid.cleanEnv(process.env, inputs, envOptions);

  // Get a websocket that connects us to Infura Ethereum node
  const deploymentKeys = [deployerPrivateKeyHex].concat(extraPrivateKeys);
  const provider = createProvider(deploymentKeys, infuraProjectId, network);

  // OpenZeppelin framework likes it globals
  // // https://github.com/OpenZeppelin/openzeppelin-sdk/blob/62ffef55559e0076ef6066ccf2861fd31de6a3aa/packages/lib/src/artifacts/ZWeb3.ts
  ZWeb3.initialize(provider);

  console.log('Connected to', await ZWeb3.getNetworkName(), 'network');

  // Check we have money on accounts we need
  await checkDeploymentAccounts(deploymentKeys);

  // Loads a compiled contract using OpenZeppelin test-environment
  const DawnTokenImpl = Contracts.getFromLocal('DawnTokenImpl');
  const DawnTokenProxy = Contracts.getFromLocal('DawnTokenProxy');
  const TokenSwap = Contracts.getFromLocal('TokenSwap');
  const Staking = Contracts.getFromLocal('Staking');

  // Deployer account serves all owner functions
  const deployer = Account.fromPrivate(`0x${deployerPrivateKeyHex}`).address;

  /*
  // Gas used 1789.89k on Goerli
  const staking = await deployContract('staking', Staking, [], { from: deployer, gas: 4_000_000 }, etherscanAPIKey);

  // Here we refer the token contract directly without going through the proxy
  // This will take a LOT of gas
  //
  const newTokenImpl = await deployContract('newTokenImpl', DawnTokenImpl, [], { from: deployer }, etherscanAPIKey);

  // Proxy contract will
  // 1. Store all data, current implementation and future implementations
  // 2. Have a mechanism for proxy owner to change the implementation pointer to a new smart contract
  //
  // Note that this means that you can never call tokenImpl contract directly - because if you call it directly
  // all the memory (data) is missing as it is hold on the proxy contract
  //
  // Copied from
  // https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/test/contracts/upgradeability/AdminUpgradeabilityProxy.test.js
  const initializeData = Buffer.from('');
  const proxy = await deployContract('proxy', DawnTokenProxy, [newTokenImpl.address, proxyOwnerAccount, initializeData], { from: deployer }, etherscanAPIKey);
  const proxyWrapper = new Proxy(proxy.address);
  // Proxy contract will
  // 1. Store all data, current implementation and future implementations
  // 2. Have a mechanism for proxy owner to change the implementation pointer to a new smart contract
  //
  // Note that this means that you can never call tokenImpl contract directly - because if you call it directly
  // all the memory (data) is missing as it is hold on the proxy contract
  //
  // Copied from
  // https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/test/contracts/upgradeability/AdminUpgradeabilityProxy.test.js

  // Call pattern here is standard web3.contract, not OpenZeppelin one
  // https://web3js.readthedocs.io/en/v1.2.0/web3-eth-contract.html#methods-mymethod-send

  // Ropsten gas usage:
  // Deployed newTokenImpl at 0xB993bE16857dB18fF8A04739654334aDb4164CAE gas used 3771.14k
  console.log('Initializing new token at proxy address space of', proxy.address);
  const newToken = DawnTokenImpl.at(proxy.address);
  await newToken.methods.initializeDawn(tokenOwnerAccount, 'Dawn', 'DAWN').send({ from: deployer });

  const tokenSwap = await deployContract('tokenSwap', TokenSwap, [], { from: deployer, gas: 5_000_000 }, etherscanAPIKey);

  console.log('Initializing token swap');
  let args = [
    tokenOwnerAccount,
    signerAccount,
    OLD_TOKEN_ADDRESS,
    newToken.address,
    BURN_ADDRESS,
  ];
  await tokenSwap.methods.initialize(...args).send({ from: deployer });

  console.log('Initializing staking');
  args = [
    tokenOwnerAccount,
    newToken.address,
    STAKING_PRICE,
    STAKING_TIME,
    oracleAccount,
  ];
  await staking.methods.initialize(...args).send({ from: deployer });

  console.log('Approving new tokens for swapping');
  await newToken.methods.approve(tokenSwap.address, SWAP_BUDGET.toString()).send({ from: tokenOwnerAccount.address });

  console.log('Make some OLD test tokens available on the faucet');
  await oldToken.methods.transfer(faucet.address, SWAP_BUDGET.toString()).send({ from: tokenOwnerAccount.address });
  */
  return {
    deployer,
    signerAccount,
    tokenOwnerAccount,
    oracleAccount,
    infuraProjectId,
    proxyOwnerAccount,
    network,
    etherscanAPIKey,
    DawnTokenImpl,
    DawnTokenProxy,
    TokenSwap,
    Staking,
    BURN_ADDRESS,
    SWAP_BUDGET,
    OLD_TOKEN_ADDRESS,
    STAKING_TIME,
    STAKING_PRICE,
  };
}
