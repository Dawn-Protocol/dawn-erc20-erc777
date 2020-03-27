pragma solidity ^0.5.0;

// https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/blob/master/contracts/
// https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/packages/lib/contracts
import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol';
import './Recoverable.sol';



/**
 * Allows token owners to lock tokens for the period of time.
 *
 * A non-custodial way to lock up tokens.
 * For lock ups, the emitted events are read on the server-side
 * and can trigger actions like subscription.
 *
 * For each stake action, we give an unique id and generate an event.
 * Then the user can get these events from logs and unstake by id.
 *
 */
contract Staking is Initializable, Pausable, Ownable, Recoverable {

  // A single staking event
  struct Stake {

    // Who is staking
    address owner;

    // How many tokens staked
    uint amount;

    // When this staking ends
    uint endsAt;

  }

  IERC20 token;

  // How many takens the user can stak
  uint public stakingAmount;

  // Seconds how low the staking will take
  uint public stakingTime;

  uint public totalStaked;

  uint public currentlyStaked;

  uint public stakeNumber;

  event StakingParametersChanged(uint amount, uint time);

  event Staked(address indexed staker, uint stakeId, uint amount, uint endsAt);
  event Unstaked(uint stakeId);

  // Stakes by the user
  mapping(uint => Stake) stakes;

  /**
   * Stake owner tokens.
   */
  function stake() public {

    address sender = _msgSender();

    require(token.allowance(sender, address(this)) >= stakingAmount, "You need to first approve() enough tokens to stake");
    require(token.balanceOf(sender) >= stakingAmount, "You do not have enough tokens to stake in your wallet");
    require(token.transferFrom(owner, address(this), stakingAmount) == true, "Could not transfer tokens for staking");

    // Generate an unique id for this action
    // We use a running counter and the 1 is the
    // id for the first stake.
    uint id = (++stakeNumber);
    const endsAt = now + stakingTime;

    stakes[id] = Stake(owner, stakingAmount, endsAt);

    totalStaked += stakingAmount;
    currentlyStaked += stakingAmount;

    Staked(sender, id, amonut, endsAt);
  }

  functoin getStakeInformation(address, uint stakeId) {}

  function unstake(uint stakeId) public {

    address sender = _msgSender();
    Stake stake = stake[sender][stakeId];

    require(stake.owner )
  }

  function setStakingParameters(uint _amount, uint _time) public onlyOwner {
    require(_amount > 0, "Amount cannot be zero");
    require(_time > 0, "Time cannot be zero");
    stakingAmount = _amount;
    stakingTime = _time;
    emit StakingParametersChanged(_amount, _time);
  }

}