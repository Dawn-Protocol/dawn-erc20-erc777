/**
 * Deploy all mock contracts to Goerli/Ropsten testnet.
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

import { checkDeploymentAccounts, createProvider, deployContract } from '../utils/deploy';

import assert = require('assert');

// We need all of these secrets from our
// secrets/goerli.env.ini config file
const inputs = {
  // Deployment account private key
  deployerPrivateKeyHex: envalid.str(),

  // Server-side signer key for token swap
  signerPrivateKeyHex: envalid.str(),

  // Account that is assigned to be the token owner
  tokenOwnerPrivateKeyHex: envalid.str(),

  // Account that is allowed to set pricing for staking
  oraclePrivateKeyHex: envalid.str(),

  // Upgrade proxy owner key
  proxyOwnerPrivateKeyHex: envalid.str(),

  // Infura project id key for command-line web3 client for testnet
  infuraProjectId: envalid.str(),

  // "goerli" or "ropsten"
  network: envalid.str(),

  // Needed to verify deployed contracts on EtherScan
  etherscanAPIKey: envalid.str(),

};

// Get config file from the command line or fallback to the default
const configPath = process.argv[2] || 'secrets/testnet.env.ini';

console.log('Using configuration file', resolve(configPath));

// https://www.npmjs.com/package/envalid
const envOptions = {
  dotEnvPath: configPath,
};

const BURN_ADDRESS = '0x0000000000000000000000000000000000000000';

// How many tokens we approve for the swap 5000_000_000_000_000_000_000
const SWAP_BUDGET = '5000000000000000000000';

// Test staking price is 2.5 tokens
const STAKING_PRICE = '2500000000000000000';

// Testnet staking duration is one day
const STAKING_TIME = 24 * 3600;

// We run async function because top level await is not supported yet
async function deploy(): Promise<void> {
  const {
    deployerPrivateKeyHex,
    signerPrivateKeyHex,
    tokenOwnerPrivateKeyHex,
    oraclePrivateKeyHex,
    infuraProjectId,
    proxyOwnerPrivateKeyHex,
    network,
    etherscanAPIKey,
  } = envalid.cleanEnv(process.env, inputs, envOptions);

  // Get a websocket that connects us to Infura Ethereum node
  const deploymentKeys = [deployerPrivateKeyHex, tokenOwnerPrivateKeyHex];
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
  const FirstBloodTokenMock = Contracts.getFromLocal('FirstBloodTokenMock');
  const TokenSwap = Contracts.getFromLocal('TokenSwap');
  const TokenFaucet = Contracts.getFromLocal('TokenFaucet');
  const Staking = Contracts.getFromLocal('Staking');

  // Deployer account serves all owner functions
  const deployer = Account.fromPrivate(`0x${deployerPrivateKeyHex}`).address;
  const signerAccount = Account.fromPrivate(`0x${signerPrivateKeyHex}`);
  const tokenOwnerAccount = Account.fromPrivate(`0x${tokenOwnerPrivateKeyHex}`);
  const oracleAccount = Account.fromPrivate(`0x${oraclePrivateKeyHex}`);
  const proxyOwner = Account.fromPrivate(`0x${proxyOwnerPrivateKeyHex}`);

  // Gas used 1789.89k on Goerli
  const staking = await deployContract('staking', Staking, [], { from: deployer, gas: 4_000_000 }, etherscanAPIKey);

  // An example of legacy token with its source code recompiled
  const oldToken = await deployContract('oldToken', FirstBloodTokenMock, [tokenOwnerAccount.address, 'Mock of old token', 'OLD'], { from: deployer, gas: 3_000_000 }, etherscanAPIKey);

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
  const proxy = await deployContract('proxy', DawnTokenProxy, [newTokenImpl.address, proxyOwner.address, initializeData], { from: deployer }, etherscanAPIKey);
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

  console.log('Initializing new token at proxy address space of', proxy.address);
  const newToken = DawnTokenImpl.at(proxy.address);
  await newToken.methods.initializeDawn(tokenOwnerAccount.address, 'Mock of new token', 'NEW').send({ from: deployer });

  // This one is big so go with a lot of gas
  const tokenSwap = await deployContract('tokenSwap', TokenSwap, [], { from: deployer, gas: 5_000_000 }, etherscanAPIKey);

  // Faucet gives 300 tokens at a time 300_000_000_000_000_000_000
  const faucetAmount = '300000000000000000000';
  const faucet = await deployContract('faucet', TokenFaucet, [oldToken.address, faucetAmount], { from: deployer, gas: 4_000_000 }, etherscanAPIKey);

  console.log('Initializing token swap');
  let args = [
    tokenOwnerAccount.address,
    signerAccount.address,
    oldToken.address,
    newToken.address,
    BURN_ADDRESS,
  ];
  await tokenSwap.methods.initialize(...args).send({ from: deployer });

  console.log('Initializing staking');
  args = [
    tokenOwnerAccount.address,
    newToken.address,
    STAKING_PRICE,
    STAKING_TIME,
    oracleAccount.address,
  ];
  await staking.methods.initialize(...args).send({ from: deployer });

  console.log('Approving new tokens for swapping');
  await newToken.methods.approve(tokenSwap.address, SWAP_BUDGET.toString()).send({ from: tokenOwnerAccount.address });

  console.log('Make some OLD test tokens available on the faucet');
  await oldToken.methods.transfer(faucet.address, SWAP_BUDGET.toString()).send({ from: tokenOwnerAccount.address });

  // Write report to the console
  console.log(await ZWeb3.getNetworkName(), 'deployment report');

  const legacyTokenInfo = {
    address: oldToken.address,
    name: await oldToken.methods.name().call(),
    symbol: await oldToken.methods.symbol().call(),
    supply: await oldToken.methods.totalSupply().call(),
  };
  console.log('Legacy token', legacyTokenInfo);

  const upgradeProxyInfo = {
    address: newToken.address,
    admin: await proxyWrapper.admin(),
    implementation: await proxyWrapper.implementation(),
  };
  console.log('Upgrade proxy for new token', upgradeProxyInfo);

  const newTokenInfo = {
    name: await newToken.methods.name().call(),
    address: upgradeProxyInfo.address,
    symbol: await newToken.methods.symbol().call(),
    supply: await newToken.methods.totalSupply().call(),
  };
  console.log('New token through upgrade proxy', newTokenInfo);
  assert(upgradeProxyInfo.implementation === newTokenImpl.address, 'Safety check that the upgrade proxy is correctly wired.');

  const tokenSwapInfo = {
    address: tokenSwap.address,
    tokensLeftToSwap: await tokenSwap.methods.getTokensLeftToSwap().call(),
    signerKey: signerPrivateKeyHex,
  };
  console.log('Token swap', tokenSwapInfo);

  const faucetInfo = {
    address: faucet.address,
    faucetAmount: await faucet.methods.amount().call(),
    balance: await oldToken.methods.balanceOf(faucet.address).call(),
  };
  console.log('Faucet', faucetInfo);

  const stakingInfo = {
    address: staking.address,
    token: await staking.methods.token().call(),
    stakingTime: await staking.methods.stakingTime().call(),
    stakingAmount: await staking.methods.stakingAmount().call(),
    oracle: await staking.methods.stakePriceOracle().call(),
  };
  console.log('Staking', stakingInfo);
}

// Top level async is not supported yet, so we need to wrap this in a function
async function run(): Promise<void> {
  try {
    await deploy();
  } catch (e) {
    // Show any exceptions to the user
    console.log(e);
  }

  // Need to explicitly terminate the process or websocket
  // lingers and keeps us alive
  process.exit(0);
}

run();
