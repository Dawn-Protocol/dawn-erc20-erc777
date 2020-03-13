pragma solidity ^0.5.0;

// https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts
import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol';

/**
 * Swap old 1ST token to new DAWN token
 */
contract TokenSwap is Pausable, Ownable {

  IERC20 oldToken;
  IERC20 newToken;

  address public burnDestination;

  uint public totalSwapped;

  /**
   * 1. Owner is a multisig wallet
   * 2. Owner holds newToken supply
   * 3. Owner does approve() on this contract for the full supply
   * 4. Owner can pause swapping
   * 5. Owner can send tokens to be burned
   */
  constructor(address owner, address _oldToken, address _newToken, address _burnDestination) Pausable() Ownable() public {
    oldToken = IERC20(_oldToken);
    newToken = IERC20(_newToken);
    setBurnDestination(_burnDestination);
    require(oldToken.totalSupply() == newToken.totalSupply(), "Cannot create swap, old and new token supply differ");

    // Get rid of deployment account for Pausable
    _addPauser(owner);
    _removePauser(msg.sender);

    // Get rid of deployment account for Ownable
    transferOwnership(owner);
  }

  function _swap(address whom, uint amount) internal {
    // Move old tokens to this contract
    address swapper = address(this);
    require(newToken.balanceOf(msg.sender) >= amount, "You do not have enough tokens to swap");
    require(oldToken.transferFrom(whom, swapper, amount) == true, "Could not retrieve old tokens");
    require(newToken.transferFrom(owner(), whom, amount) == true, "Could not send new tokens");
    totalSwapped += amount;
  }

  function swapAllTokensForSender(uint amount) public whenNotPaused {
    address swapper = address(this);
    require(oldToken.allowance(msg.sender, swapper) > amount, "You need to first approve() enough tokens to swap for this contract");
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

}