/**
 * Test ERC-20 pausable core functionality
 */

import { accounts, contract } from '@openzeppelin/test-environment';
import {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  singletons,
  expectRevert,
} from '@openzeppelin/test-helpers';

import assert = require('assert');

// https://etherscan.io/address/0xaf30d2a7e90d7dc361c8c4585e9bb7d2f6f15bc7#readContract
const TOKEN_1ST_TOTAL_SUPPLY = new BN('93468683899196345527500000');

// Ethereum accounts used in these tests
const [
  deployer, // Deploys the smart contract
  owner, // Token owner
  user2, // Random dude who wants play with tokens
  user3, // Random dude who wants play with tokens
  operator, // ERC-777 operator
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
  await token.initializeDawn(owner, 'New Token', 'NEW');
});

afterEach(() => {
  // No setup
});


test('The new token supply should match original token', async () => {
  const supply = await token.totalSupply();

  // Big number does not have power-assert support yet - https://github.com/power-assert-js/power-assert/issues/124
  assert(supply.toString() === TOKEN_1ST_TOTAL_SUPPLY.toString());
});


test('No default ERC-777 operators', async () => {
  assert((await token.defaultOperators()).length === 0);
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


test('ERC-777 operator send works', async () => {
  const amount = new BN('1') * new BN('1e18'); // Transfer 1 whole token
  await token.transfer(user2, amount, { from: owner });
  await token.authorizeOperator(operator, { from: user2 });
  // Check ERC-777 Sent event
  const receipt = await token.operatorSend(user2, user3, amount, Buffer.from('userNote'), Buffer.from('operatorNote'), { from: operator });
  const logSent = receipt.logs[0];
  assert(logSent.args.operator === operator);
  assert(logSent.args.data === `0x${Buffer.from('userNote').toString('hex')}`);
  assert(logSent.args.operatorData === `0x${Buffer.from('operatorNote').toString('hex')}`);
  await token.revokeOperator(operator, { from: user2 });
});


test('ERC-777 operator burn works', async () => {
  const amount = new BN('1') * new BN('1e18'); // Transfer 1 whole token
  await token.transfer(user2, amount, { from: owner });
  await token.authorizeOperator(operator, { from: user2 });
  // Check ERC-777 Burn event
  const receipt = await token.operatorBurn(user2, amount, Buffer.from('userNote'), Buffer.from('operatorNote'), { from: operator });
  const logBurn = receipt.logs[0];
  console.log(logBurn);
  assert(logBurn.args.operator === operator);
  assert(logBurn.args.data === `0x${Buffer.from('userNote').toString('hex')}`);
  assert(logBurn.args.operatorData === `0x${Buffer.from('operatorNote').toString('hex')}`);
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


test('Token has an explicit burn action', async () => {
  const amount = new BN('1e18'); // Transfer 1 whole token
  await token.transfer(user2, amount, { from: owner });
  const calldata = Buffer.from('');
  await token.burn(amount, calldata, { from: user2 });
  // User burned all of his tokens
  assert((await token.balanceOf(user2)).toString() === '0');
  // Total supply went down
  assert((await token.totalSupply()).toString() === TOKEN_1ST_TOTAL_SUPPLY.sub(amount).toString());
});


test('Token operatorSend is pausable', async () => {
  const amount = new BN('1') * new BN('1e18'); // Transfer 1 whole token
  await token.transfer(user2, amount, { from: owner });
  await token.authorizeOperator(operator, { from: user2 });
  // Check ERC-777 Sent event
  await token.pause({ from: owner });
  await expectRevert(
    token.operatorSend(user2, user3, amount, Buffer.from(''), Buffer.from(''), { from: operator }),
    'Pausable: paused',
  );
});


test('Token operatorBurn is pausable', async () => {
  const amount = new BN('1') * new BN('1e18'); // Transfer 1 whole token
  await token.transfer(user2, amount, { from: owner });
  await token.authorizeOperator(operator, { from: user2 });
  // Check ERC-777 Sent event
  await token.pause({ from: owner });
  await expectRevert(
    token.operatorBurn(user2, amount, Buffer.from(''), Buffer.from(''), { from: operator }),
    'Pausable: paused',
  );
});
