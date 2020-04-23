pragma solidity ^0.5.0;

// https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/blob/master/contracts/
// https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/packages/lib/contracts
import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol';
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import './Recoverable.sol';

/**
 * Swap old 1ST token to new DAWN token.
 *
 * Recoverable allows us to recover any wrong ERC-20 tokens user send here by an accident.
 *
 * This contract *is not* behind a proxy.
 * We use Initializable pattern here to be in line with the other contracts.
 * Normal constructor would work as well, but then we would be mixing
 * base contracts from openzeppelin-contracts and openzeppelin-sdk both,
 * which is a huge mess.
 *
 * We are not using SafeMath here, as we are not doing accounting math.
 * user gets out the same amount of tokens they send in.
 *
 */
contract TokenSwap is Initializable, ReentrancyGuard, Pausable, Ownable, Recoverable {

  /* Token coming for a burn */
  IERC20 public oldToken;

  /* Token sent to the swapper */
  IERC20 public newToken;

  /* Where old tokens are send permantly to die */
  address public burnDestination;

  /* Public key of our server-side signing mechanism to ensure everyone who calls swap is whitelisted */
  address public signerAddress;

  /* How many tokens we have successfully swapped */
  uint public totalSwapped;

  /* For following in the dashboard */
  event Swapped(address indexed owner, uint amount);

  /** When the contract owner sends old token to burn address */
  event LegacyBurn(uint amount);

  /** The server-side signer key has been updated */
  event SignerUpdated(address addr);

  /**
   *
   * 1. Owner is a multisig wallet
   * 2. Owner holds newToken supply
   * 3. Owner does approve() on this contract for the full supply
   * 4. Owner can pause swapping
   * 5. Owner can send tokens to be burned
   *
   */
  function initialize(address owner, address signer, address _oldToken, address _newToken, address _burnDestination)
    public initializer {

    // Note: ReentrancyGuard.initialze() was added in OpenZeppelin SDK 2.6.0, we are using 2.5.0
    // ReentrancyGuard.initialize();

    // Deployer account holds temporary ownership until the setup is done
    Ownable.initialize(_msgSender());
    setSignerAddress(signer);

    Pausable.initialize(owner);
    _transferOwnership(owner);

    _setBurnDestination(_burnDestination);

    oldToken = IERC20(_oldToken);
    newToken = IERC20(_newToken);
    require(oldToken.totalSupply() == newToken.totalSupply(), "Cannot create swap, old and new token supply differ");

  }

  function _swap(address whom, uint amount) internal nonReentrant {
    // Move old tokens to this contract
    address swapper = address(this);
    // We have added some user friendly error messages here if they
    // somehow manage to screw interaction
    totalSwapped += amount;
    require(oldToken.transferFrom(whom, swapper, amount), "Could not retrieve old tokens");
    require(newToken.transferFrom(owner(), whom, amount), "Could not send new tokens");
  }

  /**
   * Check that the server-side signature matches.
   *
   * Note that this check does NOT use Ethereum message signing preamble:
   * https://ethereum.stackexchange.com/a/43984/620
   *
   * Thus, you cannot get v, r, s with user facing wallets, you need
   * to work for those using lower level tools.
   *
   */
  function _checkSenderSignature(address sender, uint8 v, bytes32 r, bytes32 s) internal view {
      // https://ethereum.stackexchange.com/a/41356/620
      bytes memory packed = abi.encodePacked(sender);
      bytes32 hashResult = keccak256(packed);
      require(ecrecover(hashResult, v, r, s) == signerAddress, "Address was not properly signed by whitelisting server");
  }

  /**
   * A server-side whitelisted address can swap their tokens.
   *
   * Please note that after whitelisted once, the address can call this multiple times. This is intentional behavior.
   * As whitelisting per transaction is extra complexite that does not server any business goal.
   *
   */
  function swapTokensForSender(uint amount, uint8 v, bytes32 r, bytes32 s) public whenNotPaused {
    _checkSenderSignature(msg.sender, v, r, s);
    address swapper = address(this);
    require(oldToken.allowance(msg.sender, swapper) >= amount, "You need to first approve() enough tokens to swap for this contract");
    require(oldToken.balanceOf(msg.sender) >= amount, "You do not have enough tokens to swap");
    _swap(msg.sender, amount);

    emit Swapped(msg.sender, amount);
  }

  /**
   * How much new tokens we have loaded on the contract to swap.
   */
  function getTokensLeftToSwap() public view returns(uint) {
    return newToken.allowance(owner(), address(this));
  }

  /**
   * Allows admin to burn old tokens
   *
   * Note that the owner could recoverToken() here,
   * before tokens are burned. However, the same
   * owner can upload the code payload of the new token,
   * so the trust risk for this to happen is low compared
   * to other trust risks.
   */
  function burn(uint amount) public onlyOwner {
    require(oldToken.transfer(burnDestination, amount), "Could not send tokens to burn");
    emit LegacyBurn(amount);
  }

  /**
   * Set the address (0x0000) where we are going to send burned tokens.
   */
  function _setBurnDestination(address _destination) internal {
    burnDestination = _destination;
  }

  /**
   * Allow to cycle the server-side signing key.
   */
  function setSignerAddress(address _signerAddress) public onlyOwner {
    signerAddress = _signerAddress;
    emit SignerUpdated(signerAddress);
  }

}