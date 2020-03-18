/**
 * Deploy all mock contracts to Goerli testnet.
 *
 * Using OpenZeppelin SDK https://github.com/OpenZeppelin/openzeppelin-sdk
 *
 * More docs: https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/packages/lib#readme
 *
 * https://ethereum.stackexchange.com/questions/67407/how-to-deploy-a-smart-contract-using-infura-and-web3js1-x-x-on-nodejs
 */

import { ZWeb3, Contracts, SimpleProject } from '@openzeppelin/upgrades';
import { promises as fs } from 'fs';
import Web3 from 'web3';
import * as envalid from 'envalid';
import { Account } from 'eth-lib/lib'; // https://github.com/MaiaVictor/eth-lib/blob/master/src/account.js
import BigNumber from 'bignumber.js';
import {
  BN, // Big Number support https://github.com/indutny/bn.js
} from '@openzeppelin/test-helpers';
import { prepareDeploymentAccount, createProvider, deployContract } from '../utils/deploy';

// We need all of these secrets from our
// secrets/goerli.env.ini config file
const inputs = {
  // Deployment account private key
  deployerPrivateKeyHex: envalid.str(),

  // Server-side signer key for token swap
  signerPrivateKeyHex: envalid.str(),

  // Account that is assigned to be the token owner
  tokenOwnerPrivateKeyHex: envalid.str(),

  // Infura project id key for command-line web3 client for Goerli network
  infuraProjectId: envalid.str(),
};

// https://www.npmjs.com/package/envalid
const envOptions = {
  dotEnvPath: 'secrets/goerli.env.ini',
};

const BURN_ADDRESS = '0x0000000000000000000000000000000000000000';

// How many tokens we approve for the swap
const SWAP_BUDGET = new BN('5000').mul(new BN('10e18'));

// We run async function because top level await is not supported yet
async function deploy(): Promise<void> {
  const {
    deployerPrivateKeyHex, signerPrivateKeyHex, tokenOwnerPrivateKeyHex, infuraProjectId,
  } = envalid.cleanEnv(process.env, inputs, envOptions);

  // Get a websocket that connects us to Infura Ethereum node
  const provider = createProvider([deployerPrivateKeyHex, tokenOwnerPrivateKeyHex], infuraProjectId);

  // OpenZeppelin framework likes it globals
  // // https://github.com/OpenZeppelin/openzeppelin-sdk/blob/62ffef55559e0076ef6066ccf2861fd31de6a3aa/packages/lib/src/artifacts/ZWeb3.ts
  ZWeb3.initialize(provider);

  // Loads a compiled contract using OpenZeppelin test-environment
  const DawnTokenImpl = Contracts.getFromLocal('DawnTokenImpl');
  const FirstBloodTokenMock = Contracts.getFromLocal('FirstBloodTokenMock');
  const TokenSwap = Contracts.getFromLocal('TokenSwap');
  // const DawnTokenProxy = Contracts.getFromLocal('DawnTokenProxy'); // AdminUpgradeabilityProxy subclass

  // Deployer account serves all owner functions
  const deployer = await prepareDeploymentAccount(deployerPrivateKeyHex);
  const signerAccount = Account.fromPrivate(`0x${signerPrivateKeyHex}`);
  const tokenOwnerAccount = Account.fromPrivate(`0x${tokenOwnerPrivateKeyHex}`);

  // Here we refer the token contract directly without going through the proxy
  const newTokenImpl = await deployContract('newTokenImpl', DawnTokenImpl, [deployer], { from: deployer });

  // Proxy contract will
  // 1. Store all data, current implementation and future implementations
  // 2. Have a mechanism for proxy owner to change the implementation pointer to a new smart contract
  //
  // Note that this means that you can never call tokenImpl contract directly - because if you call it directly
  // all the memory (data) is missing as it is hold on the proxy contract
  //
  // Copied from
  // https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/test/contracts/upgradeability/AdminUpgradeabilityProxy.test.js

  // const initializeData = Buffer.from('');
  // proxyContract = await deployContract('proxyContract', DawnTokenProxy, [newTokenImpl.address, proxyOwner], initializeData, { from: deployer });

  // console.log('New token', newTokenImpl);

  // Call pattern here is standard web3.contract, not OpenZeppelin one
  // https://web3js.readthedocs.io/en/v1.2.0/web3-eth-contract.html#methods-mymethod-send

  console.log('Initializing new token');
  await newTokenImpl.methods.initialize(deployer, tokenOwnerAccount.address, 'Mock of new token', 'NEW').send({ from: deployer });

  const newToken = newTokenImpl;

  const oldToken = await deployContract('oldToken', FirstBloodTokenMock, [deployer, 'Mock of old token', 'OLD'], { from: deployer });
  const tokenSwap = await deployContract('tokenSwap', TokenSwap, [], { from: deployer, gas: 3_000_000 });

  console.log('Initializing token swap');
  await tokenSwap.methods.initializeTokenSwap(deployer, tokenOwnerAccount.address, signerAccount.address, oldToken.address, newToken.address, BURN_ADDRESS).send({ from: deployer });

  console.log('Approving tokens for swapping');
  newToken.methods.approve(tokenSwap.address, SWAP_BUDGET.toString()).send({ from: tokenOwnerAccount.address });
}

// Top level async is not supported yet, so we need to wrap this in a function
async function run() {
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
