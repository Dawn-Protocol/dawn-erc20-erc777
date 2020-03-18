/**
 * Test that token functionality works through the proxy.
 */

import { accounts, contract } from '@openzeppelin/test-environment';
import { Proxy, ZWeb3 } from '@openzeppelin/upgrades';
import {
  BN, // Big Number support
} from '@openzeppelin/test-helpers';

import assert = require('assert');

// https://etherscan.io/address/0xaf30d2a7e90d7dc361c8c4585e9bb7d2f6f15bc7#readContract
const TOKEN_1ST_TOTAL_SUPPLY = new BN('93468683899196345527500000');

// Ethereum accounts used in these tests
const [
  deployer, // Deploys the smart contract
  owner, // Token owner - an imaginary multisig wallet
  proxyOwner, // Who owns the proxy contract - an imaginary multisig wallet
  user2, // Random dude who wants play with tokens
] = accounts;

// Loads a compiled contract using OpenZeppelin test-environment
const DawnTokenImpl = contract.fromArtifact('DawnTokenImpl'); // ERC20Pausable subclass
const DawnTokenProxy = contract.fromArtifact('DawnTokenProxy'); // AdminUpgradeabilityProxy subclass

let tokenImpl = null; // ERC20Pausable
let token = null; // Proxied ERC20Pausable
let proxyContract = null; // DawnTokenProxy depoyment, AdminUpgradeabilityProxy
let proxy: Proxy = null; // Zeppelin Proxy helper class

beforeEach(async () => {
  // Fix global usage of ZWeb3.provider in Proxy.admin() call
  // https://github.com/OpenZeppelin/openzeppelin-sdk/issues/1504
  ZWeb3.initialize(DawnTokenImpl.web3.currentProvider);

  // This is the first implementation contract - v1 for the smart contarct code.
  // Here we refer the token contract directly without going through the proxy.
  tokenImpl = await DawnTokenImpl.new(owner, { from: deployer });

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
  proxyContract = await DawnTokenProxy.new(tokenImpl.address, proxyOwner, initializeData, { from: deployer });

  assert(proxyContract.address != null);

  // Route all token calls to go through the proxy contract
  token = await DawnTokenImpl.at(proxyContract.address);

  // We need this special Proxy helper class,
  // because Proxy smart contract is very special and we can't
  // e.g. refer to Proxy.admin() directly
  proxy = new Proxy(proxyContract.address);

  // This is the constructor in OpenZeppelin upgradeable pattern
  await token.initialize(deployer, owner, 'New Token', 'NEW');
});

test('Proxy owner should be initially proxy multisig', async () => {
  assert(await proxy.admin() === proxyOwner);
});

test('Proxy should point to the first implementation ', async () => {
  assert(await proxy.implementation() === tokenImpl.address);
});

test('Proxy supply should match the original token', async () => {
  const supply = await token.totalSupply();
  assert(supply.toString() === TOKEN_1ST_TOTAL_SUPPLY.toString());
});

test('Token should allow transfer', async () => {
  const amount = new BN('1') * new BN('1e18'); // Transfer 1 whole token
  await token.transfer(user2, amount, { from: owner });
  const balanceAfter = await token.balanceOf(user2);
  assert(balanceAfter.toString() === amount.toString());
});

test('Token tranfers are disabled after pause', async () => {
  const amount = new BN('1') * new BN('1e18'); // Transfer 1 whole token
  // Pause
  await token.pause({ from: owner });
  assert(await token.paused());
  // Transfer tokens fails after the pause
  assert.rejects(async () => {
    await token.transfer(user2, amount, { from: owner });
  });
});
