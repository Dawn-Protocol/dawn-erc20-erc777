/**
 * Command line deployment utils.
 */

import { ZWeb3 } from '@openzeppelin/upgrades';

// Need JS style import
// https://github.com/ethereum/web3.js/tree/1.x/packages/web3-providers-ws
// https://github.com/ethereum/web3.js/blob/1.x/packages/web3-providers-ws/src/index.js
import * as Web3WsProvider from 'web3-providers-ws';

// https://github.com/trufflesuite/truffle/blob/develop/packages/hdwallet-provider/src/index.ts
import * as HDWalletProvider from '@truffle/hdwallet-provider';

import assert = require('assert');


/**
  * Prepare a new deployment account.
  *
  * @param privateKeyHex raw private key
  */
export async function prepareDeploymentAccount(privateKeyHex: string): Promise<string> {
  console.log('Connected to network', await ZWeb3.getNetworkName());

  const { web3 } = ZWeb3;

  //  When using web3.eth.accounts.privateKeyToAccount
  // https://web3js.readthedocs.io/en/v1.2.0/web3-eth-accounts.html#privatekeytoaccount
  const account = web3.eth.accounts.privateKeyToAccount(`0x${privateKeyHex}`);

  // Check we have gas money for the deployment
  const weiBalance = await web3.eth.getBalance(account.address);
  const ethBalance = web3.utils.fromWei(weiBalance, 'ether');

  const balance = web3.utils.toBN(weiBalance);

  // Big number dies on decimals, so feed it only integers
  assert(!balance.isZero(), `Deployment account ${account.address} has no ETH. If this is a testnet account check https://goerli-faucet.slock.it/ to get some testnet ETH.`);

  console.log(`Deployment account ${account.address} balance:`, ethBalance, 'ETH');

  return account.address;
}

/**
 *  Creates a Web3 provider that uses local private keys for signing the transactions
 *  and WebSockets to communicate and broadcast transactions over Infura node.
 */
export function createProvider(privateKeys: string[], infuraProjectId: string): any {
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

  const zeroExPrivateKeys = privateKeys.map((x) => `0x${x}`);

  // We need this to not to trigger server-side eth_send RPC
  // that is not supported by Infura.
  // Instead, HDWalletProvider will sign transactions locally
  // using imported private key.
  const walletProvider = new HDWalletProvider(zeroExPrivateKeys, connectionProvider);
  console.log('Loaded private keys for addresses', walletProvider.getAddresses());

  // listen for disconnects
  function handleDisconnects(e): void {
    console.log('Disconnect', e);
  }
  connectionProvider.on('error', (e) => handleDisconnects(e));
  connectionProvider.on('end', (e) => handleDisconnects(e));

  return walletProvider;
}

/**
 * Deploy a new contract with a log of debug around what's happening.
 * @param id internally referred contract variable
 * @param _Contract From Contracts.getFromLocal()
 * @param parameters Array of arguments passed to the contract constructor
 * @param txParams Deployment transaction parameters like from and gas
 * @return Contract instance
 */
export async function deployContract(id: string, _Contract: any, parameters: any, txParams: any): Promise<any> {
  // Check we have gas money for the deployment

  const { web3 } = ZWeb3;
  const { from: account } = txParams;

  const weiBalance = await web3.eth.getBalance(account);
  const ethBalance = web3.utils.fromWei(weiBalance, 'ether');

  console.log(`Starting to deploy contract ${id}, constructor`, parameters, 'balance left', ethBalance, 'ETH');
  const p = _Contract.new(...parameters, txParams);
  const deployed = await p;
  console.log(`Deployed ${id} at ${deployed.address}`);

  return _Contract.at(deployed.address);
}


/**
 * Verifies a deployed contract on EtherScan
 *
 * See https://github.com/OpenZeppelin/openzeppelin-sdk/blob/62e0a9869340693dba55bc14ef72d7c120697bc3/packages/cli/src/models/network/NetworkController.ts#L491
 * for inspiration.
 *
 * @param contractAddress
 * @param contractName
 * @param parameter
 * @param etherscanAPIKey
 */

// TODO: Wait reply from OZ https://forum.openzeppelin.com/t/openzeppelin-project-file-with-dynamic-constructor-arguments/2489

/*
export async function verifyOnEtherscan(contractAddress: string, contractName: string, parameter: any, etherscanAPIKey: string): Promise<any> {

  const remote = "etherscan";
  const { compilerVersion, sourcePath } = this.localController.getContractSourcePath(contractName);
  const contractSource = await flattenSourceCode([sourcePath]);
  const contractAddress = this.networkFile.contracts[contractName].address;]
  const network = await ZWeb3.getNetworkName();

  await Verifier.verifyAndPublish(remote, {
    contractName,
    compilerVersion,
    optimizer,
    optimizerRuns,
    contractSource,
    contractAddress,
    apiKey,
    network: this.network,
  });
}
}
*/
