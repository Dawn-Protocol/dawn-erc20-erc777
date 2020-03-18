/**
 * Command line deployment utils.
 */

import { ZWeb3, Contracts, SimpleProject } from '@openzeppelin/upgrades';
import {
  BN, // Big Number support
} from '@openzeppelin/test-helpers';

import assert = require('assert');

// Need JS style import
// https://github.com/ethereum/web3.js/tree/1.x/packages/web3-providers-ws
// https://github.com/ethereum/web3.js/blob/1.x/packages/web3-providers-ws/src/index.js
const Web3WsProvider = require('web3-providers-ws');
const HDWalletProvider = require('@truffle/hdwallet-provider');


/**
  * Prepare a new deployment account.
  *
  * @param privateKeyHex raw private key
  */
export async function prepareDeploymentAccount(privateKeyHex: string): Promise<string> {
  console.log('Connected to network', await ZWeb3.getNetworkName());

  const { web3 } = ZWeb3;

  // https://web3js.readthedocs.io/en/v1.2.0/web3-eth-accounts.html#privatekeytoaccount
  const account = web3.eth.accounts.privateKeyToAccount(privateKeyHex);

  // Check we have gas money for the deployment
  const weiBalance = await web3.eth.getBalance(account.address);
  const ethBalance = web3.utils.fromWei(weiBalance, 'ether');

  // Big number dies on decimals, so feed it only integers
  const balance = new BN(weiBalance);

  assert(!balance.isZero(), `Deployment account ${account.address} has no ETH`);

  console.log(`Deployment account ${account.address} balance:`, ethBalance, 'ETH');

  return account.address;
}

export function createProvider(privateKeyHex: string, infuraProjectId: string) {
  // https://github.com/trufflesuite/truffle/tree/develop/packages/hdwallet-provider

  // Be explicit on our connection options so we
  // can better understand situations like timeouts
  // TODO: FUTURE! https://github.com/ethereum/web3.js/pull/3190
  const wsOptions = {
    timeout: 5000,
  };

  assert(infuraProjectId, 'Infure project id missing');
  const rpcURL = `wss://goerli.infura.io/ws/v3/${infuraProjectId}`;

  console.log('Connecting to Infura endpoint', rpcURL);

  const connectionProvider = new Web3WsProvider(rpcURL, wsOptions);

  // We need this to not to trigger server-side eth_send RPC
  // that is not supported by Infura.
  // Instead, HDWalletProvider will sign transactions locally
  // using imported private key.
  const walletProvider = new HDWalletProvider(privateKeyHex, connectionProvider);
  console.log('Loeaded addresses', walletProvider.getAddresses());

  // listen for disconnects
  connectionProvider.on('error', (e) => handleDisconnects(e));
  connectionProvider.on('end', (e) => { console.log('end'); handleDisconnects(e); });

  function handleDisconnects(e) {
    console.log('Disconnect error', e);
  }

  return walletProvider;
}

export async function deployContract(id: string, contractName: string, parameters: any, deployer: string): Promise<any> {
  console.log(`Starting to deploy contract ${id}`);
  const Contract = Contracts.getFromLocal(contractName);
  console.log('Constructor arguments', parameters);
  const p = Contract.new(parameters, { from: deployer });
  const deployed = await p;
  return deployed;
}
