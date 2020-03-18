/**
 * Deploy all mock contracts to Goerli testnet.
 *
 * Using OpenZeppelin SDK https://github.com/OpenZeppelin/openzeppelin-sdk
 *
 * More docs: https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/packages/lib#readme
 *
 * https://ethereum.stackexchange.com/questions/67407/how-to-deploy-a-smart-contract-using-infura-and-web3js1-x-x-on-nodejs
 */

import { ZWeb3, Contracts } from '@openzeppelin/upgrades';
import * as envalid from 'envalid';
import { Account } from 'eth-lib/lib'; // https://github.com/MaiaVictor/eth-lib/blob/master/src/account.js

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
const SWAP_BUDGET = '5000_000_000_000_000_000_000';

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
  const TokenFaucet = Contracts.getFromLocal('TokenFaucet');
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

  const oldToken = await deployContract('oldToken', FirstBloodTokenMock, [tokenOwnerAccount.address, 'Mock of old token', 'OLD'], { from: deployer });

  // This one is big so go with a lot of gas
  const tokenSwap = await deployContract('tokenSwap', TokenSwap, [], { from: deployer, gas: 3_000_000 });

  // Faucet gives 3 tokens at a time
  const faucetAmount = '3_000_000_000_000_000_000';
  const faucet = await deployContract('faucet', TokenFaucet, [oldToken.address, faucetAmount], { from: deployer });

  console.log('Initializing token swap');
  const args = [
    deployer,
    tokenOwnerAccount.address,
    signerAccount.address,
    oldToken.address,
    newToken.address,
    BURN_ADDRESS,
  ];
  await tokenSwap.methods.initializeTokenSwap(...args).send({ from: deployer });

  console.log('Approving new tokens for swapping');
  newToken.methods.approve(tokenSwap.address, SWAP_BUDGET.toString()).send({ from: tokenOwnerAccount.address });

  console.log('Make some OLD test tokens available on the faucet');
  oldToken.methods.transfer(faucet.address, SWAP_BUDGET.toString()).send({ from: tokenOwnerAccount.address });

  // Write report to the console

  console.log(await ZWeb3.getNetworkName(), 'deployment report');

  const legacyTokenInfo = {
    address: oldToken.address,
    name: await oldToken.methods.name.call(),
    symbol: await oldToken.methods.symbol.call(),
    supply: await oldToken.methods.totalSupply.call(),
  };
  console.log('Legacy token', legacyTokenInfo);

  const newTokenInfo = {
    address: newToken.address,
    name: await newToken.methods.name.call(),
    symbol: await newToken.methods.symbol.call(),
    supply: await newToken.methods.totalSupply.call(),
  };
  console.log('New token', newTokenInfo);

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
