

This is a Dawn ERC-20 token for [FirstBlood decentralised eSports platform](https://firstblood.io).

# Introduction

* Dawn token (DAWN) is a new token that is 1:1 swapped from the existing [FirstBlood 1ST token](https://github.com/Firstbloodio/token)

* Token swap requires an identity verification that is done on the server-side,
  using a Solidity `ecrecover()` signing

* DAWN can be used on FirstBlood platform and other services as a utility token: method of payment, staking, etc.

* Token complies with EIP-20 standard (former ERC-20 proposal).
  The original 1ST token was created at the time when ERC-20 process was still about to start,
  so some implementation details are different.
  This makes it easier to use token in various decentralised finance services like decentralised exchanages (DEXes)
  and lending pools.

* Token smart contract supports recovering ether and tokens accidentally send into it

* The token is upgradeable through [OpenZeppelin proxy pattern](https://docs.openzeppelin.com/learn/upgrading-smart-contracts) ([actual contracts](https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/packages/lib/contracts/upgradeability)).

* Token implements EOS ERC-20 like freeze that will be activated if and when the tokens are migrated to a new network.
  This is implemented using [OpenZeppelin pausable trait](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20Pausable.sol).

* Token implements [MakerDAO MCD like approve-by-signature, or permit(), system allowing easier interaction with smart contracts](https://github.com/makerdao/dss/blob/master/src/dai.sol#L117)

* [GSN support: TODO](https://forum.openzeppelin.com/t/creating-an-erc-20-token-that-supports-gsn-transactions/2425)

# Software versions used

* solc 0.5.16

* Node 0.12

* openzeppelin-solidity 2.5.0

* [npx](https://www.npmjs.com/package/npx)

# Testing

You need to manual compile contracts before running tests:

```sh
npx truffle compile
```

Jest testing is [based on this example](https://github.com/adrianmcli/ganache-jest-example).

## Running tests

You need to generate ABI files in `build/`

```sh
npx truffle compile
```

Then you can run tests with Jest:

```sh
npm run test
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
npx eslint --ext .ts tests/
```

# Deployment strategy

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