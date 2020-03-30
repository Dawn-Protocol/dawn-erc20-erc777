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

    // When this staking ends.
    // Set to zero after unstaking, so the owner
    // cannot unstake the same stake twice.
    uint endsAt;

  }

  // Trusted DAWN token contract
  IERC20 token;

  // How many takens the user can stak
  uint public stakingAmount;

  // Seconds how low the staking will take
  uint public stakingTime;

  // How many tokens we have staked over the life time of this contract
  uint public totalStaked;

  // How many tokens there are currently on the contract
  // (unstaked tokens are removed)
  uint public currentlyStaked;

  // The next staking action unique identifier
  uint public stakeNumber;

  // An Ethereum servie account that can reset the stating parameters,
  // as likely the stake amount will fluctuate with the dollar
  // price of the token
  address public stakePriceOracle;

  // Stakes by the user
  mapping(uint => Stake) stakes;

  // Staking price and period was reset
  event StakingParametersChanged(uint amount, uint time);

  // User staked their tokens
  event Staked(address indexed staker, uint stakeId, uint amount, uint endsAt);

  // User withdraw their tokens from staking
  event Unstaked(address indexed staker, uint stakeId, uint amount);

  // Mew stake price oracle has been set
  event OracleChanged(address newOracle);

  // We use Zeppelin initializer pattern here for the consistence,
  // even though the contract is not going to be an upgrade proxy
  function initializeStaking(address sender, address _owner, address _token, uint _amount, uint _time, address _oracle) public initializer {

    token = IERC20(_token);

    Pausable.initialize(sender);
    Ownable.initialize(sender);

    // Initial parameters are set by the owner,
    // before we give the control to the real oracle
    stakePriceOracle = sender;
    setStakingParameters(_amount, _time);
    setOracle(_oracle);

    // Get rid of deployment account for Pausable
    _addPauser(_owner);
    _removePauser(msg.sender);

    // Move ownership away from the deployment account to the multisig
    _transferOwnership(_owner);
  }

  /**
   * Stake owner tokens.
   */
  function stake() public whenNotPaused {

    address sender = _msgSender();

    require(token.allowance(sender, address(this)) >= stakingAmount, "You need to first approve() enough tokens to stake");
    require(token.balanceOf(sender) >= stakingAmount, "You do not have enough tokens to stake in your wallet");
    require(token.transferFrom(sender, address(this), stakingAmount) == true, "Could not transfer tokens for staking");

    // Generate an unique id for this action
    // We use a running counter and the 1 is the
    // id for the first stake.
    uint id = (++stakeNumber);
    uint endsAt = now + stakingTime;

    stakes[id] = Stake(sender, stakingAmount, endsAt);

    totalStaked += stakingAmount;
    currentlyStaked += stakingAmount;

    emit Staked(sender, id, stakingAmount, endsAt);
  }

  /**
   * Return data for a single stake.
   */
  function getStakeInformation(uint stakeId) public view returns (address staker, uint amount, uint endsAt) {
    Stake memory s = stakes[stakeId];
    return (s.owner, s.amount, s.endsAt);
  }

  /**
   * Return true if the user has still tokens in the staking contract for a previous stake.
   */
  function isStillStaked(uint stakeId) public view returns (bool) {
    return stakes[stakeId].endsAt != 0;
  }

  function unstake(uint stakeId) public whenNotPaused {
    address sender = _msgSender();
    Stake memory s = stakes[stakeId];
    require(s.endsAt != 0, "Already unstaked");
    require(now >= s.endsAt, "Unstaking too soon");
    require(s.owner == sender, "Not your stake");
    require(token.transfer(sender, s.amount) == true, "Could not return tokens");

    // Mark the stake released
    stakes[stakeId].endsAt = 0;

    currentlyStaked -= s.amount;

    emit Unstaked(sender, stakeId, s.amount);
  }

  /**
   * Owner can adjust required stake amount and duration.
   */
  function setStakingParameters(uint _amount, uint _time) public {
    address sender = _msgSender();
    require(sender == stakePriceOracle, "Only oracle can set pricing");
    require(_amount > 0, "Amount cannot be zero");
    require(_time > 0, "Time cannot be zero");
    stakingAmount = _amount;
    stakingTime = _time;
    emit StakingParametersChanged(_amount, _time);
  }

  /**
   * Set a new oracle that change staking pricing.
   */
  function setOracle(address _oracle) public onlyOwner {
    stakePriceOracle = _oracle;
    emit OracleChanged(_oracle);
  }

}