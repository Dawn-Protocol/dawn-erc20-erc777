/**
 * Convert private key read from stdin to an Ethereum address.
 */
import { readFileSync } from 'fs';
import { Account } from 'eth-lib/lib'; // https://github.com/MaiaVictor/eth-lib/blob/master/src/account.js

// https://stackoverflow.com/a/45486670/315168
// 0 = stdin
const privateKeyHex = readFileSync(0).toString().trim();

const account = Account.fromPrivate(privateKeyHex);

console.log(account);
