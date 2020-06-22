/**
 * Use the oracle private key to update the staking price.
 *
 * Edit secrets/oracle.ini and modify newStakeAmountTokens
 *
 * Then run: ts-node src/scripts/updateStakingPrice.ts
 */


import { ZWeb3, Contracts } from '@openzeppelin/upgrades';
import { resolve as resolvePath } from 'path';
import { Account } from 'eth-lib/lib'; // https://github.com/MaiaVictor/eth-lib/blob/master/src/account.js
import * as envalid from 'envalid';

import { createProvider } from '../utils/deploy';

// Get config file from the command line or fallback to the default
const configPath = process.argv[2] || 'secrets/oracle.ini';

console.log('Using configuration file', resolvePath(configPath));

// https://www.npmjs.com/package/envalid
const envOptions = {
  dotEnvPath: configPath,
};

// We need all of these secrets from our
// secrets/goerli.env.ini config file
const inputs = {
  // Deployment account private key
  oraclePrivateKeyHex: envalid.str(),

  // Infura project id key for command-line web3 client for testnet
  infuraProjectId: envalid.str(),

  // "mainnet"
  network: envalid.str(),

  // New stake amount in tokens
  newStakeAmountTokens: envalid.str(),
};

process.stdin.setEncoding('utf8');

// This function reads only one line on console synchronously. After pressing `enter` key the console will stop listening for data.
function readlineSync(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      process.stdin.pause(); // stops after one line reads
      resolve(data.toString());
    });
  });
}


async function run(): Promise<void> {
  const {
    oraclePrivateKeyHex,
    infuraProjectId,
    network,
    newStakeAmountTokens,
  } = envalid.cleanEnv(process.env, inputs, envOptions);

  // Initialze
  const deploymentKeys = [oraclePrivateKeyHex];
  const provider = createProvider(deploymentKeys, infuraProjectId, network);
  const oracleAccount = Account.fromPrivate(`0x${oraclePrivateKeyHex}`);

  ZWeb3.initialize(provider);
  const { web3 } = ZWeb3;

  // Instiate contracts
  const Staking = Contracts.getFromLocal('Staking');
  const staking = Staking.at('0x0B7C98Ba6235952BA847209C35189846A1706BC9');

  // Read the full balance of the multisig wallet
  const currentDuration = await staking.methods.stakingTime().call();
  const currentAmount = await staking.methods.stakingAmount().call();

  const newAmountRaw = web3.utils.toWei(newStakeAmountTokens, 'ether');
  const newDuration = currentDuration;
  const days = newDuration / (24 * 3600);

  console.log('Oracle is', oracleAccount.address, 'Staking contract is', staking.address);
  console.log('Setting new duration ', newDuration, 'seconds (', days, 'days) and new staking amount', newAmountRaw, 'tokens (old amount ', currentAmount, ') [y/n]');
  const reply = await readlineSync();

  if (reply.trim() !== 'y') {
    process.exit(0);
  }

  console.log('Doing transaction');
  // Approve this balance to be used for the token swap
  const receipt = await staking.methods.setStakingParameters(newAmountRaw, newDuration).send({ from: oracleAccount.address });
  console.log('TX receipt', receipt);
  process.exit(0);
}

run();
