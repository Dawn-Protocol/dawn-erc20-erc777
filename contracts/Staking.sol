pragma solidity ^0.5.0;

// https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/blob/master/contracts/
// https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/packages/lib/contracts
import "@openzeppelin/contracts/token/ERC777/IERC777.sol";
import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
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
 * We are not using SafeMath here, as we are not doing accounting math.
 * user gets out the same amount of tokens they send in.
 *
 */
contract Staking is Initializable, ReentrancyGuard, Pausable, Recoverable, IERC777Recipient {

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

  //
  // One byte message ids that we can get through ERC-777 token send user data
  //

  // Tokens are staked for the owner itself
  uint8 constant USER_DATA_STAKE_OWN = 0x06;

  // Tokens to be staked are not for the sender address, but someone else
  uint8 constant USER_DATA_STAKE_BEHALF = 0x07;

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

  // An Ethereum servie account that can reset the stating parameters,
  // as likely the stake amount will fluctuate with the dollar
  // price of the token
  address public stakePriceOracle;

  // Stakes by the user
  mapping(uint128 => Stake) public stakes;

  // Staking price and period was reset
  event StakingParametersChanged(uint amount, uint time);

  // User staked their tokens
  event Staked(address indexed staker, uint128 stakeId, uint amount, uint endsAt);

  // User withdraw their tokens from staking
  event Unstaked(address indexed staker, uint128 stakeId, uint amount);

  // Mew stake price oracle has been set
  event OracleChanged(address newOracle);

  /**
   * Set up the staking smart contract
   *
   * We use Zeppelin initializer pattern here for the consistence,
   * even though the contract is not going to be an upgrade proxy
   *
   * @param _owner The owning multisig for pausable action and resetting oracle
   * @param _token Which token we will stake
   * @param _amount Initial amount how many tokens are staked at once
   * @param _time Initial duration of the stake in seconds
   * @param _oracle Address of the initial parameters oracle
   */
  function initialize(address _owner, IERC777 _token, uint _amount, uint _time, address _oracle) public initializer {

    // Call parent initializers
    Recoverable.initialize(_msgSender());

    // Note: ReentrancyGuard.initialze() was added in OpenZeppelin SDK 2.6.0, we are using 2.5.0
    // ReentrancyGuard.initialize();

    // Initial parameters are set by the owner,
    // before we give the control to the real oracle
    stakePriceOracle = _msgSender();
    setStakingParameters(_amount, _time);
    setOracle(_oracle);

    Pausable.initialize(_owner);
    _transferOwnership(_owner);

    token = _token;

    // ERC-777 receiver init
    // See https://forum.openzeppelin.com/t/simple-erc777-token-example/746
    _erc1820.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  /**
   * Stake tokens sent on the contract.
   *
   * @param stakeId Random 128-bit UUID generated on the client side for the user
   * @param staker On whose behalf we are staking
   * @param amount Amount of tokens to stake
   */
  function _stakeInternal(uint128 stakeId, address staker, uint amount) internal whenNotPaused nonReentrant {

    require(stakeId != 0x0, "Invalid stake id");
    require(staker != address(0x0), "Bad staker");
    require(amount == stakingAmount, "Wrong staking amount");
    require(!isStake(stakeId), "stakeId taken");

    uint endsAt = now + stakingTime;

    stakes[stakeId] = Stake(staker, stakingAmount, endsAt);

    totalStaked += stakingAmount;
    currentlyStaked += stakingAmount;

    emit Staked(staker, stakeId, stakingAmount, endsAt);
  }

  /**
   * Return data for a single stake.
   */
  function getStakeInformation(uint128 stakeId) public view returns (address staker, uint amount, uint endsAt) {
    Stake memory s = stakes[stakeId];
    return (s.owner, s.amount, s.endsAt);
  }

  /**
   * Check if a stakeId has been allocated
   */
  function isStake(uint128 stakeId) public view returns (bool) {
    return stakes[stakeId].owner != address(0x0);
  }

  /**
   * Return true if the user has still tokens in the staking contract for a previous stake.
   */
  function isStillStaked(uint128 stakeId) public view returns (bool) {
    return stakes[stakeId].endsAt != 0;
  }

  /**
   * Send tokens back to the staker.
   *
   * It is possible to unstake on behalf of others.
   */
  function unstake(uint128 stakeId) public whenNotPaused nonReentrant {
    Stake memory s = stakes[stakeId];
    require(s.endsAt != 0, "Already unstaked");
    require(now >= s.endsAt, "Unstaking too soon");

    // Mark the stake released
    stakes[stakeId].endsAt = 0;
    currentlyStaked -= s.amount;

    emit Unstaked(s.owner, stakeId, s.amount);

    // Use ERC-777 to send tokens to the wallet of the owner
    token.send(s.owner, s.amount, bytes(''));
  }

  /**
   * Oracle can adjust required stake amount and duration.
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
   * The end point can act differently depending on userData
   * that is supplied with the token transfer.
   *
   * - No data = user is just staking tokens for himself
   * = [0x07: uint8, address] = stake on behalf of someone else
   *
   * Staking on behalf of someone else is useful e.g.
   * if a smart contract buys DAWN tokens for you and
   * wants to get them immediately staked on behalf of you,
   * all in a single tranaction (flash staking).
   *
   * https://forum.openzeppelin.com/t/simple-erc777-token-example/746
   */
  function tokensReceived(
      address,
      address from,
      address,
      uint256 amount,
      bytes calldata userData,
      bytes calldata
  ) external {

    address sender = _msgSender();
    require(sender == address(token), "Invalid token");

    address staker = from;

    // Check what we have in a payload
    require(userData.length > 0, "User data missing");

    uint8 msgId = abi.decode(userData, (uint8));
    uint8 discard;
    uint128 stakeId;
    address behalf;

    if(msgId == USER_DATA_STAKE_OWN) {
      // Stake for yourself

      // Decode Solidity tightly packed arguments
      (discard, stakeId) = abi.decode(userData, (uint8, uint128));

      staker = from;

    } else if(msgId == USER_DATA_STAKE_BEHALF) {
      // Stake for someone else

      // Decode Solidity tightly packed arguments
      (discard, stakeId, behalf) = abi.decode(userData, (uint8, uint128, address));

      staker = behalf;
    } else {
      revert("Unknown send() msg");
    }

    _stakeInternal(stakeId, staker, amount);
  }

}