/**
 * Test ERC-20 pausable core functionality
 */

import { accounts, contract } from '@openzeppelin/test-environment';
import {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  singletons,
} from '@openzeppelin/test-helpers';

import assert = require('assert');

// https://etherscan.io/address/0xaf30d2a7e90d7dc361c8c4585e9bb7d2f6f15bc7#readContract
const TOKEN_1ST_TOTAL_SUPPLY = new BN('93468683899196345527500000');

// Ethereum accounts used in these tests
const [
  deployer, // Deploys the smart contract
  owner, // Token owner
  user2, // Random dude who wants play with tokens
] = accounts;

// Loads a compiled contract using OpenZeppelin test-environment
const DawnTokenImpl = contract.fromArtifact('DawnTokenImpl');
let token = null; // ERC20Pausable

beforeEach(async () => {
  // We need to setup the ERC-1820 registry on our test chain,
  // or otherwise ERC-777 initializer will revert()
  await singletons.ERC1820Registry(deployer);

  // Here we refer the token contract directly without going through the proxy
  token = await DawnTokenImpl.new({ from: deployer });

  // Use upgrade initialiser pattern to set up initial value
  await token.initialize(deployer, owner, 'New Token', 'NEW');
});

afterEach(() => {
  // No setup
});

test('The new token supply should match original token', async () => {
  const supply = await token.totalSupply();

  // Big number does not have power-assert support yet - https://github.com/power-assert-js/power-assert/issues/124
  assert(supply.toString() === TOKEN_1ST_TOTAL_SUPPLY.toString());
});

test('Pauser role should be only for the token owner', async () => {
  assert((await token.isPauser(owner)) === true);
  assert((await token.isPauser(deployer)) === false);
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

test('Token tranfers can be paused by the owner only', async () => {
  // Transfer tokens fails after the pause
  assert.rejects(async () => {
    await token.pause({ from: user2 });
  });
});

test('Token cannot be send to 0x0 null address by accident', async () => {
  const amount = new BN('1') * new BN('1e18'); // Transfer 1 whole token
  assert.rejects(async () => {
    await token.transfer(constants.ZERO_ADDRESS, amount, { from: owner });
  });
});
