/**
 * Test ERC-20 pausable core functionality
 */

import assert = require('assert');

import { accounts, contract } from '@openzeppelin/test-environment';

import {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
} from '@openzeppelin/test-helpers';

// Ethereum accounts used in these tests
const [
  deployer,  // Deploys the smart contract
  owner, // Token owner
  user2 // Random dude who wants play with tokens
] = accounts;


const BURN_ADDRESS = constants.ZERO_ADDRESS;

// We can swap total 900 tokens
const SWAP_BUDGET = new BN("900") * new BN("10e18");

// Loads a compiled contract using OpenZeppelin test-environment
const DawnTokenImpl = contract.fromArtifact('DawnTokenImpl');
const FirstBloodTokenMock = contract.fromArtifact('FirstBloodTokenMock');
const TokenSwap = contract.fromArtifact('TokenSwap');
let newToken = null;  // ERC20Pausable
let oldToken = null;  // ERC20Pausable
let tokenSwap = null;  // TokenSwap

beforeEach(async () => {
  // Here we refer the token contract directly without going through the proxy

  newToken = await DawnTokenImpl.new(owner, { from: deployer });

  // Use upgrade initialiser pattern to set up initial value
  await newToken.initialize(deployer, owner);

  oldToken = await FirstBloodTokenMock.new(owner, { from: deployer });
  tokenSwap = await TokenSwap.new(owner, oldToken.address, newToken.address, BURN_ADDRESS, { from: deployer });

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

