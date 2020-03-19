import { Account } from 'eth-lib/lib'; // https://github.com/MaiaVictor/eth-lib/blob/master/src/account.js
import { soliditySha3 } from 'web3-utils';

import assert = require('assert');

/**
 * Sign an address on the server side.
 */
export function signAddress(signerPrivateKey: string, addr: string): { signature: string; v: string; r: string; s: string } {
  assert(addr.startsWith('0x'));

  // https://web3js.readthedocs.io/en/v1.2.0/web3-utils.html#id23
  const hash = soliditySha3({ t: 'address', v: addr });

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
