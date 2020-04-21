pragma solidity ^0.5.0;

import "../DawnTokenImpl.sol";

/**
 * This contract is used in the test suite to see that we can successfully upgrade
 * the token contract to a new version: both code + data.
 */
contract UpgradedTokenTestImpl is DawnTokenImpl {

  // We add a new variable
  mapping(address=>uint256) public funnyNumbers;

  function makeNumberGoUp(uint256 value) public {
    funnyNumbers[msg.sender] += value;
  }

  // Same as balanceOf, but with the new V2 implementation
  function readLegacyData(address addr) public view returns(uint) {
    return balanceOf(addr);
  }

}