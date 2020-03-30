

This is a Dawn ERC-20 token for [FirstBlood decentralised eSports platform](https://firstblood.io).

# Introduction

* Dawn token (DAWN) is a new token that is 1:1 swapped from the existing [FirstBlood 1ST token](https://github.com/Firstbloodio/token).

* Token swap requires an identity verification that is done on the server-side whitelisting,
  using a Solidity `ecrecover()` signing.

* DAWN can be used on FirstBlood platform and other services as a utility token: method of payment, staking, etc.

* Token complies with EIP-20 standard (former ERC-20 proposal).
  The original 1ST token was created at the time when ERC-20 process was still about to start,
  so some implementation details are different.
  This makes it easier to use token in various decentralised finance services like decentralised exchanages (DEXes)
  and lending pools.

* Token smart contract supports recovering ether and tokens accidentally send into it.

* The token is upgradeable through [OpenZeppelin proxy pattern](https://docs.openzeppelin.com/learn/upgrading-smart-contracts)
  ([actual contracts](https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/packages/lib/contracts/upgradeability)).

* Token implements transfer pause that will be activated if and when the tokens are migrated to a new network.
  This is implemented using [OpenZeppelin pausable trait](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20Pausable.sol).
  This is similar what EOS did with their genesis block.

* Token smart contract supports burning of tokens to allow new utility models in the future.

# Software required

* solc 0.5.16

* Node 0.12

* openzeppelin-solidity 2.5.0

* [npx](https://www.npmjs.com/package/npx)

# Overview

Below is an narrative introduction how contracts are deployed and engineered.

# Base packages

All contracts are based on base contracts from [OpenZeppelin SDK](https://github.com/OpenZeppelin/openzeppelin-sdk) package.
This package differs from more well known [openzeppelin-solidity](https://github.com/OpenZeppelin/openzeppelin-sdk)
package, as all contracts use `Initializer` pattern instead of `constructor` pattern to set up the contracts.
This is done to support Upgrade Proxies that do not work with direct constructors.

Although, currently only Dawn ERC-20 token contracts is upgradeable, we do not want to mix contracts
with the same name from two different packages, so all contracts are done using OpenZeppelin SDK flavour.

## Token

Token is based on OpenZeppelin upgradeable ERC-20 contract.

### Token deployment

![token deployment](docs/deployment/token.png)

The upgrade proxy contract is the actual "published" token contract.

* Upgrade proxy will be controlled by its own multisig, as `owner()` of token cannot be shared between
  proxy and the actual implementation

* Token owner multisig can pause the token - an action that might later required in a chain migration

* Token supports the following traits: Burnable, Pausable, Recoverable

## Token swap

The token swap contract is written from the scratch for this swap.

### Token swap deployment

![token swap deployment](docs/deployment/token-swap.png)

* The new token supply is held in the owner multisig and approve()'ed for the token swap

* The users will `approve()` their old tokens for the swap and then perform a `swap()` transaction

* Each `swap()` transaction requires a server-side calculation of v, r, and s. We use this
  with `ecrecover()` to check that the address performing the swap was whitelisted by our server.

* Token swap contract has `Recoverable` trait to help users with the issues of missending wrong tokens
  on the contract

* Token swap contract has a `burn()` with a destination, where the old tokens can
  be send to die by the swap owner.
  The legacy 1ST token does not have a burn trait, so these tokens are simply
  send to the zero address.

## Staking

A staking contracts allows users to lock up a predefined amount of tokens for a predefined time.
This is the simplest form of staking, allowing FirstBlood and other eSports actors
to take the first steps towards a more decentralized ecosystem over the time.

### Staking deployment

![staking deployment](docs/deployment/staking.png)

* Staking contract is in-house, written from the scratch

* Users can `stake()` their tokens and get an id for their stake

* These ids can be parsed fron Ethereum event logs. A server-side component we call
  cashier reads these events and can perform actions on user accounts based on them.

* Later, after the stake period is expired, the user can `unstake()` their tokens using the given id

* User can run multiple stakes a the same time, though there is no real use case for this

* Staking contract has `Recoverable` trait to help users with the issues of missending wrong tokens
  on the contract

## Recoverable

Recoverable is a mix-in contract that allows the owner to reclaim any
ERC-20 tokens send on the contract.

## TokenFaucet

The token faucet contract is a simple test token give away contract.
Its intend is to give people tokens in the (Görli) testnet, so they can
interact with the token swap on the beta website.

# Testing

You need to generate ABI files in `build/`

```sh
npx truffle compile
```

Then you can run tests with Jest:

```sh
npx jest
```

## Running a single text

Example:

```sh
npx jest -t 'Proxy should have an admin right'
```

## Running a single test module

Example:

```sh
npx jest --testPathPattern "tokenswap.ts"
```

## Debugging tests in Visual Studio Code

### Automatically attaching to a terminal command

Use `CMD + F1` and turn on Debugger Auto Attach in command palette.

Then you can run individual tests and VSCode will attach

```typescript
node --inspect-brk node_modules/.bin/jest --runInBand -t 'The supply should match original token'
```

### Using Launch config

launch.json example:

```json
// https://github.com/microsoft/vscode-recipes/tree/master/debugging-jest-tests
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Jest All",
            "program": "${workspaceFolder}/node_modules/.bin/jest",
            "args": [
                "--runInBand",
                "--config",
                "./test/jest-e2e.json"
            ],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen",
            "disableOptimisticBPs": true,
            "windows": {
                "program": "${workspaceFolder}/node_modules/jest/bin/jest",
            },
            "env": {
                "PATH": "/Users/moo/.nvm/versions/node/v11.0.0/bin:${env:PATH}"
            },
        },
    ]
}
```

## Integrating token testing in frontend and backend

If you want to use Mock token and Ganache inside your frontend/backend development tests.

# Linting

Follow [AirBNB TypeScript Coding Conventions](https://www.npmjs.com/package/eslint-config-airbnb-typescript)

## Visual Studio Code

[Install ESLint Plugin](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

Add to your workspace settings.json

```json
    "editor.codeActionsOnSave": {
        "source.fixAll": true
    }

    "prettier.eslintIntegration": true
```

## Prettier

[Install Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode).

Add in Visual Studio Code Settings JSON

```json
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": false
  }
```

You can manually format the source code with `CMD + F1` and choosing `Format document`.

[See also this blog post](https://levelup.gitconnected.com/setting-up-eslint-with-prettier-typescript-and-visual-studio-code-d113bbec9857)

## Command line

Run `eslint` by hand:

```bash
npx eslint --ext .ts tests/ src/
```

# Deploying

## Goerli testnet

This will deploy a mock of old token, a mock of new token, a token swap and
a testnet token faucet contracts.

1. Generate two new private keys, one for the deployment account and one for the server-side signer

```sh
openssl rand -hex 32
```

2. [Create account on Infura and get API key for goearly]().

3. Create a config file `secrets/goearly.env.ini`

```ini
privateKeyHex = "..."

signerKeyHex = "..."

infuraProjectId = "..."
```

4. Get the address for the deployment account by running the deployer without ETH

```sh
npx ts-node src/scripts/deployGoerli.ts
```

5. [Visit faucet to get testnet eth on the deployment account](https://goerli-faucet.slock.it/)

6. Deploy now with having some gas money

```sh
npx ts-node src/scripts/deployGoerli.ts
```
# Goerli deployment

Here is a sample deployment in Goerli testnet

```
  Legacy token {
    address: '0x5bad7e8039C11840fDad4a3e34e1Aa0Fc43D1De4',
    name: 'Mock of old token',
    symbol: 'OLD',
    supply: '93468683899196345527500000'
  }
  New token {
    address: '0x886263505cabBE7312aA3DAEE3d92Fa7D3d0779a',
    name: 'Mock of new token',
    symbol: 'NEW',
    supply: '93468683899196345527500000'
  }
  Token swap {
    address: '0xb41b52f8cac2DB0841528fefa299aDb86CB83312',
    tokensLeftToSwap: '5000000000000000000000',
    signerKey: '39cc67e7dbf2c162095bfc058f4b7ba2f9aa7ec006f9e28dc438c07662a3bb41'
  }
  Faucet {
    address: '0x57853504653e2250fc43AF90C3a5A75CfbF3F133',
    faucetAmount: '3000000000000000000',
    balance: '5000000000000000000000'
  }
```
# Production deployment strategy

Two different multi-signature wallets are needed.

* Token owner who is responsible for admin functions for the token contract itself like `pause()` from `ERC20Pausable`

* Proxy owner who is responsible for calling `upgradeTo()` if a contract upgrade is needed

* [Due to the fact how Proxy contract works, these two addresses cannot be the same wallet](https://docs.openzeppelin.com/upgrades/2.7/proxies#transparent-proxies-and-function-clashes)

# Other

* [More about OpenZeppelin smart contract upgrade pattern](https://docs.openzeppelin.com/upgrades/2.7/)

* [Truffle and TypeChain example](https://github.com/ethereum-ts/truffle-typechain-example) (a legacy reference - was a lot of pain and both Truffle and TypeChain have now been removed)

# TODO

* [Open issue](https://github.com/ethereum-ts/truffle-typings/issues/17) How to make [power-assert](https://github.com/power-assert-js/espower-typescript) to work with [truffle-typings](https://www.npmjs.com/package/truffle-typings),
so that easy `assert()` could be used instead of expect.

* Why ganache-core pulled in git hooks for husky

* [Why is Visual Studio Code Solidity extension using solc 0.6](https://github.com/juanfranblanco/vscode-solidity/issues/163)

```#!/bin/sh
# husky

# Hook created by Husky v4.0.10 (https://github.com/typicode/husky#readme)
#   At: 3/10/2020, 5:17:30 PM
#   From: /Users/mikkoohtamaa/code/dawn/dawn-erc20/node_modules/ganache-core/node_modules/husky (https://github.com/typicode/husky#readme)
#   With: npm
```