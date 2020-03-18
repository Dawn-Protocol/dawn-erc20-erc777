/**
 * Test ERC-20 token faucet.
 */

import { accounts, contract } from '@openzeppelin/test-environment';
import {
  BN, // Big Number support
} from '@openzeppelin/test-helpers';

import assert = require('assert');

// https://etherscan.io/address/0xaf30d2a7e90d7dc361c8c4585e9bb7d2f6f15bc7#readContr
// Ethereum accounts used in these tests
const [
  deployer, // Deploys the smart contract
  owner, // Token owner
  user, // Random dude who wants play with tokens
] = accounts;

// Loads a compiled contract using OpenZeppelin test-environment
const DawnTokenImpl = contract.fromArtifact('DawnTokenImpl');
const TokenFaucet = contract.fromArtifact('TokenFaucet');
let token = null; // ERC20Pausable
let faucet = null; // TokenFaucet

beforeEach(async () => {
  // Here we refer the token contract directly without going through the proxy

  token = await DawnTokenImpl.new({ from: deployer });

  // Use upgrade initialiser pattern to set up initial value
  await token.initialize(deployer, owner, 'New Token', 'NEW');

  // Create a faucet of 5 tokens
  faucet = await TokenFaucet.new(token.address, new BN('5').mul(new BN('10e18')), { from: deployer });

  // Load faucet with all the tokens owner minted
  await token.transfer(faucet.address, await token.balanceOf(owner), { from: owner });
});


test('User can receive tokens from the faucet', async () => {
  const faucetBal = await token.balanceOf(faucet.address);
  assert(!faucetBal.isZero());
  await faucet.fetchTokens({ from: user });
  assert(await token.balanceOf(user).toString() === await faucet.amount().toString());
});
