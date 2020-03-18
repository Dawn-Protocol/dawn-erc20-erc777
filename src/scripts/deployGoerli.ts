/**
 * Deploy all mock contracts to Goerli testnet.
 *
 * Using OpenZeppelin SDK https://github.com/OpenZeppelin/openzeppelin-sdk
 *
 * More docs: https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/packages/lib#readme
 *
 * https://ethereum.stackexchange.com/questions/67407/how-to-deploy-a-smart-contract-using-infura-and-web3js1-x-x-on-nodejs
 */

import { ZWeb3, Contracts, SimpleProject } from '@openzeppelin/upgrades';
import { promises as fs } from 'fs';
import Web3 from 'web3';
import { prepareDeploymentAccount, createProvider, deployContract } from '../utils/deploy';
import { initWeb3 } from '../utils/web3patch';

// We run async function because top level await is not supported yet
async function deploy(): Promise<void> {
  // Ethereum network we are using
  const network = 'goerli';

  // Deployment account private key
  const privateKeyHex = await (await fs.readFile('secrets/goerli-deployer-private-key.txt', 'utf-8')).trim();

  // Infura API key for command-line web3 client
  const infuraProjectId = await (await fs.readFile('secrets/goerli-infura-project-id.txt', 'utf-8')).trim();

  const provider = createProvider(privateKeyHex, infuraProjectId);

  // // https://github.com/OpenZeppelin/openzeppelin-sdk/blob/62ffef55559e0076ef6066ccf2861fd31de6a3aa/packages/lib/src/artifacts/ZWeb3.ts
  ZWeb3.initialize(provider);

  initWeb3(ZWeb3.web3);

  const MockToken = Contracts.getFromLocal('FirstBloodTokenMock');

  // Deployer account serves all owner functions
  const deployer = await prepareDeploymentAccount(privateKeyHex);

  const legacyToken = await deployContract('legacyToken', 'FirstBloodTokenMock', deployer, deployer);

  // Need to have an explicit disconnect or websocket prevents Node to terminate
  provider.disconnect();
}

async function run() {
  try {
    await deploy();
  } catch (e) {
    console.log(e);
  }
}

run();
