/**
 * Test the token swap smart contract.
 */

import assert = require('assert');

import { accounts, contract, web3 } from '@openzeppelin/test-environment';
import { Proxy } from '@openzeppelin/upgrades';
import { ZWeb3 } from '@openzeppelin/upgrades';
import { Account }  from 'eth-lib/lib'; // https://github.com/MaiaVictor/eth-lib/blob/master/src/account.js
import { sha3, keccak256 } from 'web3-utils';

import {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
} from '@openzeppelin/test-helpers';

// Ethereum accounts used in these tests
const [
  deployer,  // Deploys the smart contract
  owner, // Token owner - an imaginary multisig wallet
  proxyOwner, // Who owns the proxy contract - an imaginary multisig wallet
  user2 // Random dude who wants play with tokens
] = accounts;

// Signer is the server-side private key that whitelists transactions.
// For this account, we need to also have our private key
let signerPrivateKey = sha3("You should really play MindSeize https://www.youtube.com/watch?v=BfCldtdjYzI");
let signerAccount = Account.fromPrivate(signerPrivateKey);
let signer = signerAccount.address;

// Where we send tokens to die
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


test('Cannot initialize twice', async () => {

  assert.rejects(async () => {
    await tokenSwap.initializeTokenSwap(deployer, owner, signer, oldToken.address, newToken.address, BURN_ADDRESS, { from: deployer });
  });

  assert.rejects(async () => {
    await tokenSwap.initializeTokenSwap(deployer, owner, signer, oldToken.address, newToken.address, BURN_ADDRESS, { from: owner });
  });

});


test('Swap tokens', async () => {

  // Giver user2 tokens
  const amount = new BN('100');
  oldToken.transfer(user2, amount, { from: owner });
  const tokensLeftToSwap = await tokenSwap.getTokensLeftToSwap();

  // User approves token for the swap
  await oldToken.approve(tokenSwap.address, amount, { from: user2 });

  // Get server-side whitelist
  const { v, r, s } = signAddress(user2);

  // Do the swap transaction
  await tokenSwap.swapTokensForSender(amount, v, r, s, { from: user2 });

  // See everything went well
  assert(await oldToken.balanceOf(user2) == 0);
  assert(await newToken.balanceOf(user2) == amount.toString())
  assert(await tokenSwap.getTokensLeftToSwap() == tokensLeftToSwap.minus(amount));

});


/**
 * Sign an address on the server side.
 */
function signAddress(address: string): {v: string, r: string, s: string} {

  assert(address.substring(0, 2) == "0x");

  const data = address;
  const hash = keccak256(data);

  assert(hash.substring(0, 2) == "0x");

  // Account.sign() expects input has hex strings
  // const signature =
  const signature = Account.sign(hash, signerPrivateKey);
  const components = Account.decodeSignature(signature);

  return {
    v: components[0], // 0x1b
    r: components[1], // like: 0x9ece92b5378ac0bfc951b800a7a620edb8618f99d78237436a58e32ba6b0aedc
    s: components[2]  // like: 0x386945ff75168e7bd586ad271c985edff54625bdc36be9d88a65432314542a84
  }
}


