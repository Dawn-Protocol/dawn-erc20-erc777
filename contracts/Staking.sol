pragma solidity ^0.5.0;

// https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/blob/master/contracts/
// https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/packages/lib/contracts
import "@openzeppelin/contracts/token/ERC777/IERC777.sol";
import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import '@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol';

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
 * Staking happens by sending the correct amonut of tokens
 * to the contract using ERC-777 send().
 *
 */
contract Staking is Initializable, Pausable, Recoverable, IERC777Recipient {

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

  // ERC-777 callbacks
  // https://forum.openzeppelin.com/t/simple-erc777-token-example/746
  IERC1820Registry private _erc1820 = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
  bytes32 constant private TOKENS_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");

  // Trusted DAWN token contract
  IERC777 public token;

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


  /**
   * Set up the staking smart contract
   *
   * We use Zeppelin initializer pattern here for the consistence,
   * even though the contract is not going to be an upgrade proxy
   *
   * @param sender Sender in the Initializer pattern
   * @param _owner The owning multisig for pausable action and resetting oracle
   * @param _token Which token we will stake
   * @param _amount Initial amount how many tokens are staked at once
   * @param _time Initial duration of the stake in seconds
   * @param _oracle Address of the initial parameters oracle
   */
  function initialize(address sender, address _owner, address _token, uint _amount, uint _time, address _oracle) public initializer {

    // Call parent initializers
    Recoverable.initialize(sender);
    Pausable.initialize(sender);

    token = IERC777(_token);

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

    // ERC-777 receiver init
    // See https://forum.openzeppelin.com/t/simple-erc777-token-example/746
    _erc1820.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  /**
   * Stake tokens sent on the contract.
   */
  function stakeInternal(address sender, uint amount) internal whenNotPaused {

    require(amount == stakingAmount, "Wrong staking amount");

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

    token.send(sender, s.amount, bytes(''));

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

  /**
   * ERC-777 tokens received callback.
   *
   * This is the only public method to get tokens staked.
   *
   * https://forum.openzeppelin.com/t/simple-erc777-token-example/746
   */
  function tokensReceived(
      address,
      address from,
      address,
      uint256 amount,
      bytes calldata,
      bytes calldata
  ) external {
    require(msg.sender == address(token), "Invalid token");
    stakeInternal(from, amount);
  }

}