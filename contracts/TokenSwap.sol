pragma solidity ^0.5.0;

// https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/blob/master/contracts/
// https://github.com/OpenZeppelin/openzeppelin-sdk/tree/master/packages/lib/contracts
import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol';
import './Recoverable.sol';

/**
 * Swap old 1ST token to new DAWN token.
 *
 * Recoverable allos us to recover any wrong tokens user send here by an accident.
 *
 * This contract *is not* behind a proxy.
 * We use Initializable pattern here to be in line with the other contracts.
 * Normal constructor would work as well, but then we would be mixing
 * base contracts from openzeppelin-contracts and openzeppelin-sdk both,
 * which is a huge mess.
 *
 */
contract TokenSwap is Initializable, Pausable, Ownable, Recoverable {

  IERC20 oldToken;
  IERC20 newToken;

  /* Where old tokens are send permantly to die */
  address public burnDestination;

  /* Public key of our server-side signing mechanism to ensure everyone who calls swap is whitelisted */
  address public signerAddress;

  /* How many tokens we have successfully swapped */
  uint public totalSwapped;

  /**
   *
   * 1. Owner is a multisig wallet
   * 2. Owner holds newToken supply
   * 3. Owner does approve() on this contract for the full supply
   * 4. Owner can pause swapping
   * 5. Owner can send tokens to be burned
   *
   * @dev Using initializeTokenSwap() function name to avoid conflicts.
   */
  function initializeTokenSwap(address sender, address owner, address signer, address _oldToken, address _newToken, address _burnDestination)
    public initializer {

    Pausable.initialize(sender);
    Ownable.initialize(sender);

    oldToken = IERC20(_oldToken);
    newToken = IERC20(_newToken);
    require(oldToken.totalSupply() == newToken.totalSupply(), "Cannot create swap, old and new token supply differ");

    setBurnDestination(_burnDestination);
    setSignerAddress(signer);

    // Get rid of deployment account for Pausable
    _addPauser(owner);
    _removePauser(msg.sender);

    // Get rid of deployment account for Ownable
    _transferOwnership(owner);
  }

  function _swap(address whom, uint amount) internal {
    // Move old tokens to this contract
    address swapper = address(this);
    // We have added some user friendly error messages here if they
    // somehow manage to screw interaction
    require(oldToken.balanceOf(msg.sender) >= amount, "You do not have enough tokens to swap");
    require(oldToken.transferFrom(whom, swapper, amount) == true, "Could not retrieve old tokens");
    require(newToken.transferFrom(owner(), whom, amount) == true, "Could not send new tokens");
    totalSwapped += amount;
  }

  /**
   * Check that the server-side signature matches.
   *
   * Note that this check does NOT use Ethereum message signing preamble:
   * https://ethereum.stackexchange.com/a/43984/620
   *
   * Thus, youi cannot get v, r, s with user facing wallets, you need
   * to work for those using lower level tools.
   *
   */
  function _checkSenderSignature(address sender, uint8 v, bytes32 r, bytes32 s) internal view {
      // https://ethereum.stackexchange.com/a/41356/620
      bytes memory packed = abi.encodePacked(sender);
      bytes32 hashResult = keccak256(packed);
      require(ecrecover(hashResult, v, r, s) == signerAddress, "Address was not properly signed by whitelisting server");
  }

  function swapTokensForSender(uint amount, uint8 v, bytes32 r, bytes32 s) public whenNotPaused {
    _checkSenderSignature(msg.sender, v, r, s);
    address swapper = address(this);
    require(oldToken.allowance(msg.sender, swapper) >= amount, "You need to first approve() enough tokens to swap for this contract");
    require(oldToken.balanceOf(msg.sender) >= amount, "You do not have enough tokens to swap");
    _swap(msg.sender, amount);
  }

  /**
   * How much tokens have been swapped so far
   */
  function getCurrentlySwappedSupply() public view returns(uint) {
    return oldToken.balanceOf(address(this));
  }

  /**
   * How much tokens have been swapped so far
   */
  function getTokensLeftToSwap() public view returns(uint) {
    return newToken.allowance(owner(), address(this));
  }

  // Allows admin to burn old tokens
  function burn(uint amount) public onlyOwner {
    require(oldToken.transfer(burnDestination, amount), "Could not send tokens to burn");
  }

  function setBurnDestination(address _destination) public onlyOwner {
    burnDestination = _destination;
  }

  function setSignerAddress(address _signerAddress) public onlyOwner {
    signerAddress = _signerAddress;
  }

  /**
   * A test method exposed to be called from clients to compare that ABI packing and hashing
   * is same across different programming languages.
   *
   * Does ABI encoding for an address and then calculates KECCAK-256 hash over the bytes.
   *
   * https://web3js.readthedocs.io/en/v1.2.0/web3-utils.html#soliditysha3
   *
   */
  function calculateAddressHash(address a) public pure returns (bytes32 hash, bytes memory data) {

    // First we ABI encode the address to bytes.
    // This is so called "tight packing"
    // https://web3js.readthedocs.io/en/v1.2.0/web3-utils.html#soliditysha3
    bytes memory packed = abi.encodePacked(a);

    // Then we calculate keccak256 over the resulting bytes
    bytes32 hashResult = keccak256(packed);

    return(hashResult, packed);
  }

  /**
   * Expose ecrecover, so we can call it from console/tests and compare results.
   */
  function recoverAddress(bytes32 hash, uint8 v, bytes32 r, bytes32 s) public pure returns(address) {
    return ecrecover(hash, v, r, s);
  }
}