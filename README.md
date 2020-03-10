

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

* The token is upgradeable through [OpenZeppelin proxy pattern](https://docs.openzeppelin.com/learn/upgrading-smart-contracts).

* Token implements EOS ERC-20 like freeze that will be activated if and when the tokens are migrated to a new network.
  This is implemented using [OpenZeppelin pausable trait](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20Pausable.sol).

* Token implements [MakerDAO MCD like approve-by-signature, or permit(), system allowing easier interaction with smart contracts](https://github.com/makerdao/dss/blob/master/src/dai.sol#L117)

* [GSN support: TODO](https://forum.openzeppelin.com/t/creating-an-erc-20-token-that-supports-gsn-transactions/2425)

# Testing

Jest testing is [based on this example](https://github.com/adrianmcli/ganache-jest-example).

## Running tests

You need to generate ABI files in `build/`

```sh
truffle compile
```

Then you can run tests with Jest:

```sh
npm run test
```

## Integrating token testing in third party pplications

If you want to use Mock token and Ganache inside your frontend/backend development tests.

# Other

[Truffle and TypeChain example](https://github.com/ethereum-ts/truffle-typechain-example)

# TODO

* [Open issue](https://github.com/ethereum-ts/truffle-typings/issues/17) How to make [power-assert](https://github.com/power-assert-js/espower-typescript) to work with [truffle-typings](https://www.npmjs.com/package/truffle-typings),
so that easy `assert()` could be used instead of expect.