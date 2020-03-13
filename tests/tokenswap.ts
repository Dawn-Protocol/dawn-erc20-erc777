/**
 * Test ERC-20 pausable core functionality
 */

import assert = require('assert');

import { accounts, contract } from '@openzeppelin/test-environment';
import { Proxy } from '@openzeppelin/upgrades';
import { ZWeb3 } from '@openzeppelin/upgrades';

import {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
} from '@openzeppelin/test-helpers';

// Ethereum accounts used in these tests
const [
  deployer,  // Deploys the smart contract
  owner, // Token owner - an imaginary multisig wallet
  proxyOwner, // Who owns the proxy contract - an imaginary multisig wallet
  signer, // Server side signing key used to whitelist addresses
  user2 // Random dude who wants play with tokens
] = accounts;

const BURN_ADDRESS = constants.ZERO_ADDRESS;

// We can swap total 900 tokens
const SWAP_BUDGET = new BN("900") * new BN("10e18");

// Loads a compiled contract using OpenZeppelin test-environment
const DawnTokenImpl = contract.fromArtifact('DawnTokenImpl');
const FirstBloodTokenMock = contract.fromArtifact('FirstBloodTokenMock');
const TokenSwap = contract.fromArtifact('TokenSwap');
const DawnTokenProxy = contract.fromArtifact('DawnTokenProxy');  // AdminUpgradeabilityProxy subclass

let proxyContract = null;  // DawnTokenProxy depoyment, AdminUpgradeabilityProxy
let proxy: Proxy = null;  // Zeppelin Proxy helper class
let newTokenImpl = null;  // ERC20Pausable
let newToken = null;  // Proxy
let oldToken = null;  // Lgeacy token
let tokenSwap = null;  // TokenSwap


beforeEach(async () => {
  // Here we refer the token contract directly without going through the proxy

  newTokenImpl = await DawnTokenImpl.new(owner, { from: deployer });

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
  proxyContract = await DawnTokenProxy.new(newTokenImpl.address, proxyOwner, initializeData, { from: deployer });

  // We need this special Proxy helper class,
  // because Proxy smart contract is very special and we can't
  // e.g. refer to Proxy.admin() directly
  proxy = new Proxy(proxyContract.address);

  // This is the constructor in OpenZeppelin upgradeable pattern
  // Route all token calls to go through the proxy contract
  newToken = await DawnTokenImpl.at(proxyContract.address);
  await newToken.initialize(deployer, owner);

  oldToken = await FirstBloodTokenMock.new(owner, { from: deployer });
  tokenSwap = await TokenSwap.new({ from: deployer });

  // Use the Initializer pattern to bootstrap the contract
  await tokenSwap.initializeTokenSwap(deployer, owner, signer, oldToken.address, newToken.address, BURN_ADDRESS, { from: deployer });

  newToken.approve(tokenSwap.address, SWAP_BUDGET, { from: owner });
});


test('Old token supply should match new token supply', async () => {
  const oldSupply = await oldToken.totalSupply();
  const newSupply = await newToken.totalSupply();
  assert(oldSupply.toString() == newSupply.toString());
});


test('Owner has pauser and owner roles', async () => {
  assert(await tokenSwap.isPauser(owner) == true);
  assert(await tokenSwap.owner() == owner);
});

test('Swap is ready', async () => {
  const tokensToGo = await tokenSwap.getTokensLeftToSwap();
  assert(tokensToGo.toString() == SWAP_BUDGET.toString());
});

