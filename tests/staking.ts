/**
 * Test the staking smart contract.
 */

import { accounts, contract } from '@openzeppelin/test-environment';
import { Account } from 'eth-lib/lib'; // https://github.com/MaiaVictor/eth-lib/blob/master/src/account.js
import { sha3, soliditySha3 } from 'web3-utils';
import {
  expectRevert, // https://docs.openzeppelin.com/test-helpers/0.5/api#expect-revert
  expectEvent, // https://docs.openzeppelin.com/test-helpers/0.5/api#expect-event
  BN, // Big Number support https://github.com/indutny/bn.js
  constants, // Common constants, like the zero address and largest integers,
  time, // https://docs.openzeppelin.com/test-helpers/0.5/api#latest
} from '@openzeppelin/test-helpers';

import { signAddress } from '../src/utils/sign';

import assert = require('assert');

// Ethereum accounts used in these tests
const [
  deployer, // Deploys the smart contract
  owner, // Token owner - an imaginary multisig wallet
  proxyOwner, // Who owns the proxy contract - an imaginary multisig wallet
  oracle, // Price resetter
  user, // User staking tokens
  user2, // Random dude who wants play with tokens
  thirdTokenOwner, // Needed to test interaction with third party tokens
] = accounts;

// Stake 1000 tokens once
const STAKE_PRICE = 1000;

// Stake will last one day in the tests
const STAKE_DURATION = 24 * 60 * 60;

// Loads a compiled contract using OpenZeppelin test-environment
const DawnTokenImpl = contract.fromArtifact('DawnTokenImpl');
const Staking = contract.fromArtifact('Staking');
const DawnTokenProxy = contract.fromArtifact('DawnTokenProxy'); // AdminUpgradeabilityProxy subclass

let proxyContract = null; // DawnTokenProxy depoyment, AdminUpgradeabilityProxy
let newTokenImpl = null; // ERC20Pausable
let newToken = null; // Proxy
let staking = null; // Staking.sol


beforeEach(async () => {
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
  await newToken.initialize(deployer, owner, 'New Token', 'NEW');

  // Use the Initializer pattern to bootstrap the contract
  staking = await Staking.new({ from: deployer });
  await staking.initializeStaking(deployer, owner, newToken.address, STAKE_PRICE, STAKE_DURATION, oracle, ({ from: deployer }));
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
    staking.initializeStaking(deployer, owner, newToken.address, STAKE_PRICE, STAKE_DURATION, oracle, ({ from: deployer })),
    'Contract instance has already been initialized',
  );
  // Avoid the infamous Parity wallet bug
  // Call "overridden" initializer
  await expectRevert(
    staking.initialize(deployer),
    'Contract instance has already been initialized',
  );
});


test('Only owne can reset oracle', async () => {
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


test('User can stake their', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE + 10, { from: owner });

  // User approves token for the swap
  await newToken.approve(staking.address, STAKE_PRICE, { from: user });

  // When we think the user stake should end
  const estimatedEndsAt = (await time.latest()).add(new BN(STAKE_DURATION));

  // This will create staking id 1
  const receipt = await staking.stake({ from: user });

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
  assert(endsAt.toString() === estimatedEndsAt.toString());

  // Check events are right
  expectEvent(receipt, 'Staked', {
    staker: user,
    stakeId: new BN(1),
    amount: new BN(STAKE_PRICE),
    endsAt,
  });
});


test('User can unstake their tokens', async () => {
  // Give user some tokens to stake
  await newToken.transfer(user, STAKE_PRICE + 10, { from: owner });
  // User approves token for the swap
  await newToken.approve(staking.address, STAKE_PRICE, { from: user });
  // This will create staking id 1
  await staking.stake({ from: user });
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
  // User approves token for the swap
  await newToken.approve(staking.address, STAKE_PRICE, { from: user });
  // This will create staking id 1
  await staking.stake({ from: user });
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
  // User approves token for the swap
  await newToken.approve(staking.address, STAKE_PRICE, { from: user });
  // Set the paused state
  await staking.pause({ from: owner });
  await expectRevert(
    staking.stake({ from: user }),
    'Pausable: paused',
  );
  // Random users cannot reset the oracle
  await expectRevert(
    staking.unstake(1, { from: user }),
    'Pausable: paused',
  );
  // Unpause and we can stake again
  await staking.unpause({ from: owner });
  await staking.stake({ from: user });
});


test('We can recover wrong tokens send to the contract', async () => {
  // Create an independent tthird token,
  // albeit recovery works with legacy and new tokens as well
  const thirdToken = await DawnTokenImpl.new(thirdTokenOwner, {
    from: deployer,
  });
  await thirdToken.initialize(deployer, thirdTokenOwner, 'Third Token', '3RD');
  const amount = new BN('100');
  await thirdToken.transfer(user2, amount, { from: thirdTokenOwner });
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
