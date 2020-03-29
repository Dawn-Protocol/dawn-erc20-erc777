/**
 * One particular signing case that is driving me crazy because goerli/web provides different outcomen than testrpc/node.
 */

import { accounts, contract } from '@openzeppelin/test-environment';
import { Account } from 'eth-lib/lib'; // https://github.com/MaiaVictor/eth-lib/blob/master/src/account.js
import { sha3, soliditySha3 } from 'web3-utils';
import { expectRevert } from '@openzeppelin/test-helpers';
import { signAddress } from '../src/utils/sign';

import assert = require('assert');

// Ethereum accounts used in these tests
const [
  deployer, // Deploys the smart contract
] = accounts;

// Signer is the server-side private key that whitelists transactions.
// For this account, we need to also have our private key
const signerPrivateKey = '0x39cc67e7dbf2c162095bfc058f4b7ba2f9aa7ec006f9e28dc438c07662a3bb41';
const signerAccount = Account.fromPrivate(signerPrivateKey);
const signer = signerAccount.address;

const TokenSwap = contract.fromArtifact('TokenSwap');

let tokenSwap = null; // TokenSwap


test('Verify production signing issue', async () => {
  tokenSwap = await TokenSwap.new({ from: deployer });

  const addr = '0x168767eeb7b63A49F1D1E213FF354A6a934a93b0';

  const {
    signature, // eslint-disable-line
    hash,
    v,
    r,
    s, // eslint-disable-line
  } = signAddress(signerPrivateKey, addr);
  // We hash data in similar in TypeScript and Solidity
  // / const { hash } = await tokenSwap.calculateAddressHash(addr);

  // Account.recover() and Solidity ecrecover() agree
  const recoveredAddress = await tokenSwap.recoverAddress(hash, v, r, s);
  // console.log('r', r, 's', s);
  assert(recoveredAddress === '0x1906617f5AB7a453917761b2dD8928E789f24d2B');
});
