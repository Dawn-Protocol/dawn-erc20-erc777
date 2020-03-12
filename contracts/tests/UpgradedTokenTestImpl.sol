pragma solidity ^0.5.0;

import "../DawnTokenImpl.sol";

contract UpgradedTokenTestimpl is DawnTokenImpl {

    // We add a new variable
    mapping(address=>uint256) public funnyNumbers;

    function makeNumberGoUp(uint256 value) public {
      funnyNumbers[msg.sender] += value;
    }

}