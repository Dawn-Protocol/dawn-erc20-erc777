/**
 * Test ugprade functionality, so that we retain all the data and new functionality activates.
 */

import { accounts, contract } from '@openzeppelin/test-environment';
import { ZWeb3 } from '@openzeppelin/upgrades';
import {
  BN, // Big Number support
  singletons,
} from '@openzeppelin/test-helpers';

import assert = require('assert');

// https://etherscan.io/address/0xaf30d2a7e90d7dc361c8c4585e9bb7d2f6f15bc7#readContract
const TOKEN_1ST_TOTAL_SUPPLY = new BN('93468683899196345527500000');

// Ethereum accounts used in these tests
const [
  deployer, // Deploys the smart contract
  owner, // Token owner - an imaginary multisig wallet
  proxyOwner, // Who owns the proxy contract - an imaginary multisig wallet
  user1, // Random dude who wants play with tokens
  user2, // Random dude who wants play with tokens
  allowedUser, // Somebody using tokens through the allowance
] = accounts;

// Loads a compiled contract using OpenZeppelin test-environment
const DawnTokenImpl = contract.fromArtifact('DawnTokenImpl'); // ERC20Pausable subclass
const V2TokenImpl = contract.fromArtifact('UpgradedTokenTestImpl'); // ERC20Pausable subclass
const DawnTokenProxy = contract.fromArtifact('DawnTokenProxy'); // AdminUpgradeabilityProxy subclass

let tokenImpl = null; // ERC20Pausable
let token = null; // Proxied ERC20Pausable
let v2TokenImpl = null; // UpgradeTokenTestImpl
let v2Token = null; // Proxied UpgradeTokenTestImpl

let proxyContract = null; // DawnTokenProxy depoyment, AdminUpgradeabilityProxy

/**
 * Do some token transfers and operations we can verify also after the upgrade.
 *
 * @param owner Ethereum account
 * @param user1 Ethereum account
 * @param user2 Ethereum account
 */
async function doSomeActivity(): Promise<void> {
  await token.transfer(user1, new BN('100'), { from: owner });
  await token.transfer(user2, new BN('50'), { from: owner });
  await token.approve(allowedUser, new BN('20'), { from: user2 });
  await token.transferFrom(user2, user1, new BN('5'), { from: allowedUser });
}

beforeEach(async () => {
  // Fix global usage of ZWeb3.provider in Proxy.admin() call
  // https://github.com/OpenZeppelin/openzeppelin-sdk/issues/1504
  ZWeb3.initialize(DawnTokenImpl.web3.currentProvider);

  // We need to setup the ERC-1820 registry on our test chain,
  // or otherwise ERC-777 initializer will revert()
  await singletons.ERC1820Registry(deployer);

  // This is the first implementation contract - v1 for the smart contarct code.
  // Here we refer the token contract directly without going through the proxy.
  tokenImpl = await DawnTokenImpl.new({ from: deployer });

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

  // This is the constructor in OpenZeppelin upgradeable pattern
  await token.initializeDawn(owner, 'New Token', 'NEW');

  // Make sure we have legacy data written in the contract memor
  await doSomeActivity();

  v2TokenImpl = await V2TokenImpl.new(owner, { from: deployer });
  await proxyContract.upgradeTo(v2TokenImpl.address, { from: proxyOwner });

  // Test V2
  v2Token = await V2TokenImpl.at(proxyContract.address);
  token = v2Token;
});

test('V2 owneship looks right', async () => {
  assert((await token.owner()) === owner);
  assert((await token.isPauser(owner)) === true);
});

test('V1 legacy data is correct', async () => {
  const supply = await token.totalSupply();
  assert(supply.toString() === TOKEN_1ST_TOTAL_SUPPLY.toString());
  assert((await token.balanceOf(user1)).toString() === new BN('105').toString());
  assert((await token.balanceOf(user2)).toString() === new BN('45').toString());
  assert((await token.allowance(user2, allowedUser)).toString() === new BN('15').toString());
});

test('V1 functionality works after the update', async () => {
  await token.transfer(user2, new BN('3'), { from: user1 });
  assert((await token.balanceOf(user1)).toString() === new BN('102').toString());
  assert((await token.balanceOf(user2)).toString() === new BN('48').toString());
});

test('V2 functionality works after the update', async () => {
  const test = await v2Token.funnyNumbers(user1);
  assert(test.toString() === new BN('0').toString());

  await v2Token.makeNumberGoUp(new BN('10'), { from: user1 });
  const test2 = await v2Token.funnyNumbers(user1);
  assert(test2.toString() === new BN('10').toString());

  const balance = await v2Token.funnyNumbers(user1);
  assert(balance.toString() === new BN('10').toString());
});
