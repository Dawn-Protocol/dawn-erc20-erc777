import { Account } from 'eth-lib/lib'; // https://github.com/MaiaVictor/eth-lib/blob/master/src/account.js
import { soliditySha3 } from 'web3-utils';

import assert = require('assert');

/**
 * Sign an address on the server side.
 */
export function signAddress(signerPrivateKey: string, addr: string): { signature: string; hash: string; v: string; r: string; s: string } {
  assert(signerPrivateKey.startsWith('0x'));
  assert(addr.startsWith('0x'));

  // https://web3js.readthedocs.io/en/v1.2.0/web3-utils.html#id23
  const hash = soliditySha3({ t: 'address', v: addr });

  assert(hash.startsWith('0x'));

  // Account.sign() expects input has hex strings
  // const signature =
  const signature = Account.sign(hash, signerPrivateKey);

  // const account = Account.fromPrivate(signerPrivateKey);
  // console.log('Signing with address', account.address);

  const components = Account.decodeSignature(signature);

  // const address = Account.recover(hash, signature);
  // console.log('Recovered', address);

  // https://github.com/ethereum/solidity/issues/5109#issuecomment-426203414
  assert(components[1].length === 66, 'Watch out for zero padded data issues');
  assert(components[2].length === 66, 'Watch out for zero padded data issues');

  return {
    signature, // Full signature
    hash,
    v: components[0], // 0x1b
    r: components[1], // like: 0x9ece92b5378ac0bfc951b800a7a620edb8618f99d78237436a58e32ba6b0aedc
    s: components[2], // like: 0x386945ff75168e7bd586ad271c985edff54625bdc36be9d88a65432314542a84
  };
}
