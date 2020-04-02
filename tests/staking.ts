/**
 * Test the staking smart contract.
 */

import { accounts, contract } from '@openzeppelin/test-environment';
import {
  expectRevert, // https://docs.openzeppelin.com/test-helpers/0.5/api#expect-revert
  expectEvent, // https://docs.openzeppelin.com/test-helpers/0.5/api#expect-event
  BN, // Big Number support https://github.com/indutny/bn.js
  time, // https://docs.openzeppelin.com/test-helpers/0.5/api#latest
  singletons,
} from '@openzeppelin/test-helpers';
import { keccak256 } from 'web3-utils';
import { ZWeb3 } from '@openzeppelin/upgrades';
import { decodeEvent } from '../src/utils/logs';

import assert = require('assert');

// Ethereum accounts used in these tests
const [
  deployer, // Deploys the smart contract
  owner, // Token owner - an imaginary multisig wallet
  proxyOwner, // Who owns the proxy contract - an imaginary multisig wallet
  oracle, // Price resetter
  user, // User staking tokens
  user2, // Random dude who wants play with tokens
] = accounts;

// Stake 1000 tokens once
const STAKE_PRICE = 1000;

// Stake will last one day in the tests
const STAKE_DURATION = 24 * 60 * 60;

// Used when the price changes in the middle of staking
const STAKE_PRICE_2 = 1500;

// Used whn the price changes in the middle of staking
const STAKE_DURATION_2 = 48 * 60 * 60;

// Loads a compiled contract using OpenZeppelin test-environment
const DawnTokenImpl = contract.fromArtifact('DawnTokenImpl');
const Staking = contract.fromArtifact('Staking');
const DawnTokenProxy = contract.fromArtifact('DawnTokenProxy'); // AdminUpgradeabilityProxy subclass
const FirstBloodTokenMock = contract.fromArtifact('FirstBloodTokenMock'); // Legacy ERC-20

let proxyContract = null; // DawnTokenProxy depoyment, AdminUpgradeabilityProxy
let newTokenImpl = null; // ERC20Pausable
let newToken = null; // Proxy
let staking = null; // Staking.sol
let erc1820registry = null;


beforeEach(async () => {
  // We need to setup the ERC-1820 registry on our test chain,
  // or otherwise ERC-777 initializer will revert()
  erc1820registry = await singletons.ERC1820Registry(deployer);

  // Here we refer the token contract directly without going through the proxy
  newTokenImpl = await DawnTokenImpl.new({ from: deployer });

  // Proxy contract will
  // 1. Store all data, current implementation and future implementations
  // 2. Have a mechanism for proxy owner to change the implementation pointer to a new smart contract
  //
  // Note that this means that you can never call tokenImpl contract directly - because if you call it directly
  // all the memory (data) is missing as it is hold on the proxy contract
  //
  // Copied from
  // https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/test/contracts/upgradeability/AdminUpgradeabilityProxy.test.js
  const initializeData = Buffer.from('');
  proxyContract = await DawnTokenProxy.new(newTokenImpl.address, proxyOwner, initializeData, { from: deployer });

  // This is the constructor in OpenZeppelin upgradeable pattern
  // Route all token calls to go through the proxy contract
  newToken = await DawnTokenImpl.at(proxyContract.address);
  await newToken.initializeDawn(owner, 'New Token', 'NEW');

  // Use the Initializer pattern to bootstrap the contract
  staking = await Staking.new({ from: deployer });
  await staking.initialize(owner, newToken.address, STAKE_PRICE, STAKE_DURATION, oracle, ({ from: deployer }));
});


test('Initial staking contract values are good', async () => {
  assert(await staking.stakePriceOracle() === oracle);
  assert((await staking.stakingAmount()).toString() === STAKE_PRICE.toString());
  assert((await staking.stakingTime()).toString() === STAKE_DURATION.toString());
  assert(await staking.owner() === owner);
  assert(await staking.isPauser(owner) === true);
});


test('Cannot initialize twice', async () => {
  // Avoid the infamous Parity wallet bug
  // Call our initializer
  await expectRevert(
    staking.initialize(owner, newToken.address, STAKE_PRICE, STAKE_DURATION, oracle, ({ from: deployer })),
    'Contract instance has already been initialized',
  );
  // Avoid the infamous Parity wallet bug
  // Call "overridden" initializer
  await expectRevert(
    staking.initialize(deployer),
    'Contract instance has already been initialized',
  );
});


test('ERC-1820 registrations are correct', async () => {
  const iERC777TokensRecipient = keccak256('ERC777TokensRecipient');
  const implementer = await erc1820registry.getInterfaceImplementer(staking.address, iERC777TokensRecipient);
  assert(implementer === staking.address);
});


test('Only owner can reset oracle', async () => {
  assert(await staking.stakePriceOracle() === oracle);

  const receipt = await staking.setOracle(user2, { from: owner });

  // Check the events
  expectEvent(receipt, 'OracleChanged', { newOracle: user2 });

  // State was updated
  assert(await staking.stakePriceOracle() === user2);

  // Random users cannot reset the oracle
  await expectRevert(
    staking.setOracle(user, { from: user }),
    'Ownable: caller is not the owner',
  );
});


test('Only oracle can set pricing', async () => {
  const receipt = await staking.setStakingParameters(STAKE_PRICE_2, STAKE_DURATION_2, { from: oracle });
  // Check events are right
  expectEvent(receipt, 'StakingParametersChanged', {
    amount: new BN(STAKE_PRICE_2),
    time: new BN(STAKE_DURATION_2),
  });
  // Random users cannot set pricing
  await expectRevert(
    staking.setStakingParameters(STAKE_PRICE, STAKE_DURATION, { from: user }),
    'Only oracle can set pricing',
  );
});


test('User can stake their tokens', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE + 10, { from: owner });

  // When we think the user stake should end
  const estimatedEndsAt = (await time.latest()).add(new BN(STAKE_DURATION));

  // This will create staking id 1
  const receipt = await newToken.send(staking.address, STAKE_PRICE, Buffer.from(''), { from: user });

  // Check the state is right
  assert((await staking.currentlyStaked()).toString() === STAKE_PRICE.toString());
  assert((await staking.totalStaked()).toString() === STAKE_PRICE.toString());
  assert(await staking.isStillStaked(1) === true);
  assert((await newToken.balanceOf(staking.address)).toString() === STAKE_PRICE.toString());
  assert((await newToken.balanceOf(user)).toString() === '10'.toString());
  // Check the stake data
  const { staker, amount, endsAt } = await staking.getStakeInformation(1);
  assert(staker === user);
  assert(amount.toString() === STAKE_PRICE.toString());

  // Must be ~5 seconds difference at the estimated time, allow some slack with block producing
  assert(Math.abs(endsAt.toNumber() - estimatedEndsAt.toNumber()) < 5);

  // expectEvent() does not work as the emitting contract is not `to` from the tx receitp
  // In the logs we have Send, Transfer, Staking, so taking event is the last
  const log = receipt.receipt.rawLogs[2];
  const event = decodeEvent(Staking, log, 'Staked');

  assert(event.stakeId === '1');
  assert(event.amount === STAKE_PRICE.toString());
  assert(event.staker === user);
  assert(event.endsAt === endsAt.toString());

  /*
  // Check events are right
  expectEvent(receipt, 'Staked', {
    staker: user,
    stakeId: new BN(1),
    amount: new BN(STAKE_PRICE),
    endsAt,
  }); */
});


test('User can unstake their tokens', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE + 10, { from: owner });
  // This will create staking id 1
  await newToken.send(staking.address, STAKE_PRICE, Buffer.from(''), { from: user });
  // Time travel to unlock
  time.increase(STAKE_DURATION + 1);
  const receipt = await staking.unstake(1, { from: user });
  // Check events are right
  expectEvent(receipt, 'Unstaked', {
    staker: user,
    stakeId: new BN(1),
    amount: new BN(STAKE_PRICE),
  });
  // Check the state is right
  assert((await staking.currentlyStaked()).toString() === '0');
  assert((await staking.totalStaked()).toString() === STAKE_PRICE.toString());
  assert(await staking.isStillStaked(1) === false);
  assert((await newToken.balanceOf(staking.address)).toString() === '0');
  assert((await newToken.balanceOf(user)).toString() === (STAKE_PRICE + 10).toString().toString());
  // Check the stake data
  const { staker, amount, endsAt } = await staking.getStakeInformation(1);
  assert(staker === user);
  assert(amount.toString() === STAKE_PRICE.toString());
  assert(endsAt.toString() === '0'); // Signals that the tokens have been unstaked
});


test('User cannot unstake their tokens too soon', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE, { from: owner });
  // This will create staking id 1
  await newToken.send(staking.address, STAKE_PRICE, Buffer.from(''), { from: user });
  time.increase(STAKE_DURATION - 2);
  // Random users cannot reset the oracle
  await expectRevert(
    staking.unstake(1, { from: user }),
    'Unstaking too soon',
  );
});


test('Users cannot stake or unstake while paused', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE + 10, { from: owner });
  // Set the paused state
  await staking.pause({ from: owner });
  // Cannot stake while paused
  await expectRevert(
    newToken.send(staking.address, STAKE_PRICE, Buffer.from(''), { from: user }),
    'Pausable: paused',
  );
  // Random users cannot reset the oracle
  await expectRevert(
    staking.unstake(1, { from: user }),
    'Pausable: paused',
  );
  // Unpause and we can stake again
  await staking.unpause({ from: owner });
  await newToken.send(staking.address, STAKE_PRICE, Buffer.from(''), { from: user });
});


test('User need to send the correct amount to stake', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE + 10, { from: owner });
  await expectRevert(
    newToken.send(staking.address, STAKE_PRICE / 2, Buffer.from(''), { from: user }),
    'Wrong staking amount',
  );
});


test('Two different users can stake on different staking periods', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE, { from: owner });
  await newToken.transfer(user2, STAKE_PRICE_2, { from: owner });
  // User 1 stakes
  await newToken.send(staking.address, STAKE_PRICE, Buffer.from(''), { from: user });
  time.increase(5);
  // User 2 stakes
  await staking.setStakingParameters(STAKE_PRICE_2, STAKE_DURATION_2, { from: oracle });
  await newToken.send(staking.address, STAKE_PRICE_2, Buffer.from(''), { from: user2 });
  // Check state
  assert((await staking.currentlyStaked()).toNumber() === STAKE_PRICE + STAKE_PRICE_2);
  assert((await staking.totalStaked()).toNumber() === STAKE_PRICE + STAKE_PRICE_2);
  assert(await staking.isStillStaked(1) === true);
  assert(await staking.isStillStaked(2) === true);
  assert((await staking.stakeNumber()).toNumber() === 2);
  assert((await newToken.balanceOf(staking.address)).toNumber() === STAKE_PRICE + STAKE_PRICE_2);
  const stake1 = await staking.getStakeInformation(1);
  assert(stake1.staker === user);
  const stake2 = await staking.getStakeInformation(2);
  assert(stake2.staker === user2);
  assert(stake2.endsAt.toString() !== stake1.endsAt.toString());
  assert(stake2.amount.toString() !== stake1.amount.toString());
  // User 1 cannot unstake yet
  await expectRevert(
    staking.unstake(1, { from: user }),
    'Unstaking too soon',
  );
  // Go forward until both stakes have expired
  await time.increase(STAKE_DURATION_2);
  // User 2 cannot unstake for user 1
  await expectRevert(
    staking.unstake(1, { from: user2 }),
    'Not your stake',
  );
  // Unstake both in different order
  await staking.unstake(2, { from: user2 });
  await staking.unstake(1, { from: user });
  assert((await newToken.balanceOf(user)).toNumber() === STAKE_PRICE);
  assert((await newToken.balanceOf(user2)).toNumber() === STAKE_PRICE_2);
  assert((await newToken.balanceOf(staking.address)).toNumber() === 0);
});


test('User cannot unstake twice', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE, { from: owner });
  await newToken.transfer(user2, STAKE_PRICE_2, { from: owner });
  // Add enough balance for 2 unstakes
  await newToken.send(staking.address, STAKE_PRICE, Buffer.from(''), { from: user });
  await newToken.send(staking.address, STAKE_PRICE, Buffer.from(''), { from: user2 });
  await time.increase(STAKE_DURATION_2);
  // User 1 cannot unstake stwice
  await staking.unstake(1, { from: user });
  await expectRevert(
    staking.unstake(1, { from: user }),
    'Already unstaked',
  );
});


test('User can stake behalf of another', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE, { from: owner });

  // Create a user data for ERC-777 send()
  const { web3 } = DawnTokenImpl;
  const STAKE_BEHALF_MSG = 0x07;
  const userData = web3.eth.abi.encodeParameters(['uint8', 'address'], [STAKE_BEHALF_MSG, user2]);

  // This will create staking id 1
  const receipt = await newToken.send(staking.address, STAKE_PRICE, userData, { from: user });

  // Check the state is right
  assert((await staking.currentlyStaked()).toString() === STAKE_PRICE.toString());
  assert((await staking.totalStaked()).toString() === STAKE_PRICE.toString());
  assert(await staking.isStillStaked(1) === true);

  // Check the stake data
  const { staker, amount, endsAt } = await staking.getStakeInformation(1);
  assert(staker === user2);
  assert(amount.toString() === STAKE_PRICE.toString());

  // expectEvent() does not work as the emitting contract is not `to` from the tx receitp
  // In the logs we have Send, Transfer, Staking, so taking event is the last
  const log = receipt.receipt.rawLogs[2];
  const event = decodeEvent(Staking, log, 'Staked');

  assert(event.stakeId === '1');
  assert(event.amount === STAKE_PRICE.toString());
  assert(event.staker === user2);
  assert(event.endsAt === endsAt.toString());
});


test('ERC-777 token receiver gives an error on wrong userdata', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE, { from: owner });

  // Create a user data for ERC-777 send()
  const { web3 } = DawnTokenImpl;
  const INVALID_MSG = 0x08;
  const userData = web3.eth.abi.encodeParameters(['uint8', 'address'], [INVALID_MSG, user2]);

  await expectRevert(
    newToken.send(staking.address, STAKE_PRICE, userData, { from: user }),
    'Unknown userdata',
  );
});


test('ERC-777 token receiver gives an error on wrong message length', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE, { from: owner });
  // Create a user data for ERC-777 send()
  const { web3 } = DawnTokenImpl;
  const STAKE_BEHALF_MSG = 0x07;
  const userData = web3.eth.abi.encodeParameters(['uint8', 'address'], [STAKE_BEHALF_MSG, user2]);
  // abi.decode in Solidity will simply just "revert" as the error message
  await expectRevert(
    newToken.send(staking.address, STAKE_PRICE, userData.slice(0, 4), { from: user }),
    'revert',
  );
});


test('We can recover wrong tokens send to the contract', async () => {
  // Create an independent tthird token,
  // albeit recovery works with legacy and new tokens as well
  const thirdToken = await FirstBloodTokenMock.new(deployer, 'OLD', 'OLD', {
    from: deployer,
  });
  const amount = new BN('100');
  await thirdToken.transfer(user2, amount, { from: deployer });
  // Accidentally sending tokens to the smart contract
  await thirdToken.transfer(staking.address, amount, { from: user2 });
  let bal = await thirdToken.balanceOf(staking.address);
  assert(bal.gt(0));
  // We know how many tokens we can recover
  const recoverable = await staking.tokensToBeReturned(thirdToken.address);
  assert(recoverable.toString() === amount.toString(0));
  await staking.recoverTokens(thirdToken.address, { from: owner });
  bal = await thirdToken.balanceOf(staking.address);
  assert(bal.isZero());
  const ownerBal = await thirdToken.balanceOf(owner);
  assert(ownerBal.toString() === amount.toString());
});
