/**
 * Test we do not lose tokens or ether on our token contract address.
 */

import { accounts, contract } from '@openzeppelin/test-environment';
import { Proxy, ZWeb3 } from '@openzeppelin/upgrades';
import {
  BN, // Big Number support https://github.com/indutny/bn.js
} from '@openzeppelin/test-helpers';

import assert = require('assert');

// Ethereum accounts used in these tests
const [
  deployer, // Deploys the smart contract
  owner, // Token owner - an imaginary multisig wallet
  proxyOwner, // Who owns the proxy contract - an imaginary multisig wallet
  user2, // Random dude who wants play with tokens
] = accounts;

// Loads a compiled contract using OpenZeppelin test-environment
const DawnTokenImpl = contract.fromArtifact('DawnTokenImpl');
const DawnTokenProxy = contract.fromArtifact('DawnTokenProxy'); // AdminUpgradeabilityProxy subclass

let tokenImpl = null; // ERC20Pausable
let token = null; // Proxied ERC20Pausable
let proxyContract = null; // DawnTokenProxy depoyment, AdminUpgradeabilityProxy
let web3 = null;

beforeEach(async () => {
  // Fix global usage of ZWeb3.provider in Proxy.admin() call
  // https://github.com/OpenZeppelin/openzeppelin-sdk/issues/1504
  ZWeb3.initialize(DawnTokenImpl.web3.currentProvider);
  web3 = ZWeb3.web3;

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
  proxyContract = await DawnTokenProxy.new(
    tokenImpl.address,
    proxyOwner,
    initializeData,
    { from: deployer },
  );

  assert(proxyContract.address != null);

  // Route all token calls to go through the proxy contract
  token = await DawnTokenImpl.at(proxyContract.address);

  // We need this special Proxy helper class,
  // because Proxy smart contract is very special and we can't
  // e.g. refer to Proxy.admin() directly
  proxy = new Proxy(proxyContract.address);

  // This is the constructor in OpenZeppelin upgradeable pattern
  await token.initialize(deployer, owner);
});

test('Token contract is not payable', async () => {
  const amount = web3.utils.toWei(new BN('1'), 'ether');
  const userBalance = new BN(await web3.eth.getBalance(user2));

  assert(userBalance.gt(amount));

  // Accidentally send some ETH on the token
  assert.rejects(async () => {
    await web3.eth.sendTransaction({ from: user2, to: token.address, amount });
  });
});

test('Token contract can recover tokens', async () => {
  const amount = web3.utils.toWei(new BN('1'), 'ether');
  const firstOwnerBalance = await token.balanceOf(owner);

  await token.transfer(user2, amount, { from: owner });

  // Accidentally sending tokens to the smart contract
  await token.transfer(token.address, amount, { from: user2 });

  let bal = await token.balanceOf(token.address);
  assert(bal.gt(0));

  // We know how many tokens we can recover
  const recoverable = await token.tokensToBeReturned(token.address);
  assert(recoverable.toString() === amount.toString(0));

  await token.recoverTokens(token.address, { from: owner });

  bal = await token.balanceOf(token.address);
  assert(bal.isZero());

  const lastOwnerBalance = await token.balanceOf(owner);
  assert(firstOwnerBalance.toString() === lastOwnerBalance.toString());
});

test('Only owner can recover tokens', async () => {
  const amount = web3.utils.toWei(new BN('1'), 'ether');

  await token.transfer(user2, amount, { from: owner });

  // Accidentally sending tokens to the smart contract
  await token.transfer(token.address, amount, { from: user2 });

  // We know how many tokens we can recover
  await token.tokensToBeReturned(token.address);

  assert.rejects(
    async () => {
      // Double s instead of r s
      await token.recoverTokens(token.address, { from: user2 });
    },
    {
      message:
        'Returned error: VM Exception while processing transaction: revert Ownable: caller is not the owner -- Reason given: Ownable: caller is not the owner.',
    },
  );
});
