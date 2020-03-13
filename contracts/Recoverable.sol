/**
 * Based on https://github.com/TokenMarketNet/smart-contracts/blob/master/contracts/Recoverable.sol
 */

pragma solidity ^0.5.0;

import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol';

/**
 * Allows to recover any tokens accidentally send on the smart contract.
 *
 * Sending ethers on token contracts is not possible in the first place.
 * as they are not payable.
 *
 * https://twitter.com/moo9000/status/1238514802189795331
 */
contract Recoverable is Ownable {

  /// @dev This will be invoked by the owner, when owner wants to rescue tokens
  /// @param token Token which will we rescue to the owner from the contract
  function recoverTokens(IERC20 token) public onlyOwner {
    token.transfer(owner(), tokensToBeReturned(token));
  }

  /// @dev Interface function, can be overwritten by the superclass
  /// @param token Token which balance we will check and return
  /// @return The amount of tokens (in smallest denominator) the contract owns
  function tokensToBeReturned(IERC20 token) public view returns (uint) {
    return token.balanceOf(address(this));
  }
}