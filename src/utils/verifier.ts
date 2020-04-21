/**
 * Patched Verifier from https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-sdk/11352d7ee54cbbee8234f418cd0ffc0bac30e749/packages/cli/src/models/Verifier.ts
 *
 * Added support for constructorArguments
 */

import axios from 'axios';
import { stringify } from 'querystring';

import { sleep, Loggy } from '@openzeppelin/upgrades';

// Max number of API request retries on error
const RETRY_COUNT = 3;

// Time to sleep between retries for API requests
const RETRY_SLEEP_TIME = 5000;

interface VerifierOptions {
  contractName: string;
  compilerVersion: string;
  optimizer: boolean;
  optimizerRuns: string;
  contractSource: string;
  contractAddress: string;
  network: string;
  apiKey?: string;
  constructorArguments?: string;
}


function setEtherscanApiSubdomain(network: string): string | never {
  switch (network) {
    case 'mainnet':
      return 'api';
    case 'rinkeby':
      return 'api-rinkeby';
    case 'ropsten':
      return 'api-ropsten';
    case 'kovan':
      return 'api-kovan';
    case 'goerli':
      return 'api-goerli';
    default:
      throw new Error('Invalid network. Currently, etherscan supports mainnet, rinkeby, ropsten, goerli and kovan');
  }
}


async function checkEtherscanVerificationStatus(
  guid: string,
  etherscanApiUrl: string,
  retries: number = RETRY_COUNT,
): Promise<void | never> {
  const queryParams = stringify({
    guid,
    action: 'checkverifystatus',
    module: 'contract',
  });

  try {
    const response = await axios.request({
      method: 'GET',
      url: `${etherscanApiUrl}?${queryParams}`,
    });

    if (response.data.status !== '1') {
      throw new Error(`Error while trying to verify contract: ${response.data.result}`);
    }
  } catch (error) {
    if (retries === 0) throw new Error(error.message || 'Error while trying to check verification status');
    await sleep(RETRY_SLEEP_TIME);
    await checkEtherscanVerificationStatus(guid, etherscanApiUrl, retries - 1);
  }
}


export async function publishToEtherscan(params: VerifierOptions): Promise<void | never> {
  if (!params.apiKey) {
    throw Error('Etherscan API key not specified. To get one, follow this link: https://etherscan.io/myapikey');
  }

  const {
    network, compilerVersion, optimizer, contractAddress,
  } = params;
  const compiler = `v${compilerVersion.replace('.Emscripten.clang', '')}`;
  const optimizerStatus = optimizer ? 1 : 0;

  const apiSubdomain = setEtherscanApiSubdomain(network);
  const etherscanApiUrl = `https://${apiSubdomain}.etherscan.io/api`;
  const networkSubdomain = network === 'mainnet' ? '' : `${network}.`;
  const etherscanContractUrl = `https://${networkSubdomain}etherscan.io/address`;

  const data = {
    apikey: params.apiKey,
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode: params.contractSource,
    contractname: params.contractName,
    compilerversion: compiler,
    optimizationUsed: optimizerStatus,
    constructorArguements: params.constructorArguments,
    runs: params.optimizerRuns,
  };

  // console.log('Args', data.constructorArguements);

  try {
    const response = await axios.request({
      method: 'POST',
      url: etherscanApiUrl,
      data: stringify(data),
      headers: {
        'Content-type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.status === 200 && response.data.status === '1') {
      await checkEtherscanVerificationStatus(response.data.result, etherscanApiUrl, RETRY_COUNT);
      Loggy.succeed(
        'verify-and-publish',
        `Contract source code of ${params.contractName} verified and published successfully. You can check it here: ${etherscanContractUrl}/${contractAddress}#code`,
      );
    } else {
      throw new Error(`Error while trying to verify contract: ${response.data.result}`);
    }
  } catch (error) {
    throw new Error(error.message || 'Error while trying to verify contract');
  }
}
