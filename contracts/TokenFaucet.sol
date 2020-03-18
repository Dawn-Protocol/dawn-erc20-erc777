/**
 * Based on https://github.com/TokenMarketNet/smart-contracts/blob/master/contracts/Recoverable.sol
 */

pragma solidity ^0.5.0;

import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol';

/**
 * Give users free tokens.
 */
contract TokenFaucet {

  IERC20 public token;

  uint public amount;

  constructor(address addr, uint _amount) public {
    token = IERC20(addr);
    amount = _amount;
  }

  /**
   * User does a transaction to this funcion and receives tokens back in an exchange.
   */
  function fetchTokens() public {
    require(token.balanceOf(address(this)) > amount, "Faucet is out of tokens");
    require(token.transfer(msg.sender, amount) == true, "Token transfer failed");
  }
}