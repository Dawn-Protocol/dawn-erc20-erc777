/**
 * Test the token swap smart contract.
 */

import { accounts, contract } from '@openzeppelin/test-environment';
import { Account } from 'eth-lib/lib'; // https://github.com/MaiaVictor/eth-lib/blob/master/src/account.js
import { sha3, soliditySha3 } from 'web3-utils';
import {
  BN, // Big Number support https://github.com/indutny/bn.js
  constants, // Common constants, like the zero address and largest integers
} from '@openzeppelin/test-helpers';

import assert = require('assert');

// Ethereum accounts used in these tests
const [
  deployer, // Deploys the smart contract
  owner, // Token owner - an imaginary multisig wallet
  proxyOwner, // Who owns the proxy contract - an imaginary multisig wallet
  user2, // Random dude who wants play with tokens
  thirdTokenOwner, // Needed to test interaction with third party tokens
] = accounts;

// Signer is the server-side private key that whitelists transactions.
// For this account, we need to also have our private key
const signerPrivateKey = sha3('You should really play MindSeize https://www.youtube.com/watch?v=BfCldtdjYzI');
const signerAccount = Account.fromPrivate(signerPrivateKey);
const signer = signerAccount.address;

// Where we send tokens to die
const BURN_ADDRESS = constants.ZERO_ADDRESS;

// We can swap total 900 tokens
const SWAP_BUDGET = new BN('900') * new BN('10e18');

// Loads a compiled contract using OpenZeppelin test-environment
const DawnTokenImpl = contract.fromArtifact('DawnTokenImpl');
const FirstBloodTokenMock = contract.fromArtifact('FirstBloodTokenMock');
const TokenSwap = contract.fromArtifact('TokenSwap');
const DawnTokenProxy = contract.fromArtifact('DawnTokenProxy'); // AdminUpgradeabilityProxy subclass

let proxyContract = null; // DawnTokenProxy depoyment, AdminUpgradeabilityProxy
let newTokenImpl = null; // ERC20Pausable
let newToken = null; // Proxy
let oldToken = null; // Lgeacy token
let tokenSwap = null; // TokenSwap

/**
 * Sign an address on the server side.
 */
function signAddress(address: string): { signature: string; v: string; r: string; s: string } {
  assert(address.startsWith('0x'));

  // https://web3js.readthedocs.io/en/v1.2.0/web3-utils.html#id23
  const hash = soliditySha3({ t: 'address', v: user2 });

  assert(hash.startsWith('0x'));

  // Account.sign() expects input has hex strings
  // const signature =
  const signature = Account.sign(hash, signerPrivateKey);
  const components = Account.decodeSignature(signature);

  return {
    signature, // Full signature
    v: components[0], // 0x1b
    r: components[1], // like: 0x9ece92b5378ac0bfc951b800a7a620edb8618f99d78237436a58e32ba6b0aedc
    s: components[2], // like: 0x386945ff75168e7bd586ad271c985edff54625bdc36be9d88a65432314542a84
  };
}

beforeEach(async () => {
  // Here we refer the token contract directly without going through the proxy
  newTokenImpl = await DawnTokenImpl.new({ from: deployer });

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

  // This is the constructor in OpenZeppelin upgradeable pattern
  // Route all token calls to go through the proxy contract
  newToken = await DawnTokenImpl.at(proxyContract.address);
  await newToken.initialize(deployer, owner, 'New Token', 'NEW');

  oldToken = await FirstBloodTokenMock.new(owner, 'Old Token', 'OLD', { from: deployer });
  tokenSwap = await TokenSwap.new({ from: deployer });

  // Use the Initializer pattern to bootstrap the contract
  await tokenSwap.initializeTokenSwap(deployer, owner, signer, oldToken.address, newToken.address, BURN_ADDRESS, { from: deployer });

  newToken.approve(tokenSwap.address, SWAP_BUDGET, { from: owner });
});

test('Old token supply should match new token supply', async () => {
  const oldSupply = await oldToken.totalSupply();
  const newSupply = await newToken.totalSupply();
  assert(oldSupply.toString() === newSupply.toString());
});

test('Owner has pauser and owner roles', async () => {
  assert((await tokenSwap.isPauser(owner)) === true);
  assert((await tokenSwap.owner()) === owner);
});

test('Swap is ready', async () => {
  const tokensToGo = await tokenSwap.getTokensLeftToSwap();
  assert(tokensToGo.toString() === SWAP_BUDGET.toString());
});

test('Cannot initialize twice', async () => {
  assert.rejects(async () => {
    await tokenSwap.initializeTokenSwap(deployer, owner, signer, oldToken.address, newToken.address, BURN_ADDRESS, { from: deployer });
  });

  assert.rejects(async () => {
    await tokenSwap.initializeTokenSwap(deployer, owner, signer, oldToken.address, newToken.address, BURN_ADDRESS, { from: owner });
  });
});

// Check that TypeScript implementation itself can sign and recover addresses correctly
test('TypeScript is self-consistent in cryptography', async () => {
  // Sign address
  const {
    signature,
    v, // eslint-disable-line
    r, // eslint-disable-line
    s, // eslint-disable-line
  } = signAddress(user2);
  const hash = soliditySha3({ t: 'address', v: user2 });
  const recoveredAddress = Account.recover(hash, signature);
  assert(recoveredAddress === signer);
});

// Check that TypeScript implementation and Solidity agree how to recover an address
test('TypeScript and Solidity are consistent in cryptography', async () => {
  // Sign address
  const {
    signature, // eslint-disable-line
    v,
    r,
    s, // eslint-disable-line
  } = signAddress(user2);

  // This is an address is a hexadecimal format
  const ourData = user2.toLowerCase();

  // https://web3js.readthedocs.io/en/v1.2.0/web3-utils.html#id23
  // Convert address to bytes using "tight packing"
  // and them calculates keccak-256 over the resulting bytes
  const ourHash = soliditySha3({ t: 'address', v: user2 });

  // We hash data in similar in TypeScript and Solidity
  const { hash, data } = await tokenSwap.calculateAddressHash(user2);
  assert(ourData.toLowerCase() === data.toLowerCase());
  assert(ourHash.toLowerCase() === hash.toLowerCase());

  // Account.recover() and Solidity ecrecover() agree
  const recoveredAddress = await tokenSwap.recoverAddress(ourHash, v, r, s);
  assert(recoveredAddress === signer);
});

test('Swap all tokens', async () => {
  // Check that we are set up for the swap
  const tokensLeftToSwap = await tokenSwap.getTokensLeftToSwap();
  assert(tokensLeftToSwap.toString() === SWAP_BUDGET.toString());

  // Giver user2 tokens
  const amount = new BN('100');
  await oldToken.transfer(user2, amount, { from: owner });
  assert((await oldToken.balanceOf(user2)).eq(amount));

  // User approves token for the swap
  await oldToken.approve(tokenSwap.address, amount, { from: user2 });

  // Get server-side whitelist
  const {
    signature, // eslint-disable-line
    v,
    r,
    s,
  } = signAddress(user2);

  // Do the swap transaction
  assert((await tokenSwap.signerAddress()) === signer);
  await tokenSwap.swapTokensForSender(amount, v, r, s, { from: user2 });

  // See everything went well
  assert((await oldToken.balanceOf(user2)).isZero());
  assert((await newToken.balanceOf(user2)).toString() === amount.toString());

  // New token amount on the token swap smart contract decreased
  assert((await tokenSwap.getTokensLeftToSwap()).eq(tokensLeftToSwap.sub(amount)));
});

test('Swap part of tokens tokens', async () => {
  // Check that we are set up for the swap
  const tokensLeftToSwap = await tokenSwap.getTokensLeftToSwap();
  assert(tokensLeftToSwap.toString() === SWAP_BUDGET.toString());

  // Giver user2 tokens
  const amount = new BN('100');
  const amountToSwap = new BN('30');
  await oldToken.transfer(user2, amount, { from: owner });

  // User approves token for the swap
  await oldToken.approve(tokenSwap.address, amount, { from: user2 });

  // Get server-side whitelist
  const {
    signature, // eslint-disable-line
    v,
    r,
    s,
  } = signAddress(user2);

  await tokenSwap.swapTokensForSender(amountToSwap, v, r, s, { from: user2 });

  // See everything went well
  assert((await oldToken.balanceOf(user2)).isZero() === false);
  assert((await newToken.balanceOf(user2)).toString() === amountToSwap.toString());

  // New token amount on the token swap smart contract decreased
  assert((await tokenSwap.getTokensLeftToSwap()).eq(tokensLeftToSwap.sub(amountToSwap)));
});

test('Cannot swap with a bad signature', async () => {
  // Giver user2 tokens
  const amount = new BN('100');
  await oldToken.transfer(user2, amount, { from: owner });

  // User approves token for the swap
  await oldToken.approve(tokenSwap.address, amount, { from: user2 });

  // Get server-side whitelist
  const {
    signature, // eslint-disable-line
    v,
    r, // eslint-disable-line
    s,
  } = signAddress(user2);

  assert.rejects(async () => {
    // Double s instead of r s
    await tokenSwap.swapTokensForSender(amount, v, s, s, { from: user2 });
  });
});

test('Tokens can be send to burn', async () => {
  // Giver user2 tokens
  const amount = new BN('100');
  await oldToken.transfer(user2, amount, { from: owner });

  // User approves token for the swap
  await oldToken.approve(tokenSwap.address, amount, { from: user2 });

  // Get server-side whitelist
  const {
    signature, // eslint-disable-line
    v,
    r,
    s,
  } = signAddress(user2);

  await tokenSwap.swapTokensForSender(amount, v, r, s, { from: user2 });

  // New token amount on the token swap smart contract decreased
  assert((await tokenSwap.getCurrentlySwappedSupply()).eq(amount));

  // Send to 0x0
  await tokenSwap.burn(amount, { from: owner });

  // New token amount on the token swap smart contract decreased
  assert((await tokenSwap.getCurrentlySwappedSupply()).isZero());

  // We have sent tokens to 0x0 to die
  const zeroAddressBalance = await oldToken.balanceOf(constants.ZERO_ADDRESS);

  assert(zeroAddressBalance.eq(amount));
});

test('We can recover wrong tokens send to the contract', async () => {
  // Create an independent tthird token,
  // albeit recovery works with legacy and new tokens as well
  const thirdToken = await DawnTokenImpl.new(thirdTokenOwner, {
    from: deployer,
  });
  await thirdToken.initialize(deployer, thirdTokenOwner, 'Third Token', '3RD');

  const amount = new BN('100');

  await thirdToken.transfer(user2, amount, { from: thirdTokenOwner });

  // Accidentally sending tokens to the smart contract
  await thirdToken.transfer(tokenSwap.address, amount, { from: user2 });

  let bal = await thirdToken.balanceOf(tokenSwap.address);
  assert(bal.gt(0));

  // We know how many tokens we can recover
  const recoverable = await tokenSwap.tokensToBeReturned(thirdToken.address);
  assert(recoverable.toString() === amount.toString(0));

  await tokenSwap.recoverTokens(thirdToken.address, { from: owner });

  bal = await thirdToken.balanceOf(tokenSwap.address);
  assert(bal.isZero());

  const ownerBal = await thirdToken.balanceOf(owner);
  assert(ownerBal.toString() === amount.toString());
});
