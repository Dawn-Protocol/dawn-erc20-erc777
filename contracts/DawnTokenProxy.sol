pragma solidity ^0.5.0;

// https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/contracts/upgradeability/Proxy.sol
// https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/contracts/upgradeability/AdminUpgradeabilityProxy.sol
import "@openzeppelin/upgrades/contracts/upgradeability/AdminUpgradeabilityProxy.sol";

/**
 * The upgrade proxy for Dawn token.
 *
 * 1. Deploy first implementation of token code
 * 2. Deploy proxy pointing to this implementation and having proxy multisig wallet as the owner
 *
 */
contract DawnTokenProxy is AdminUpgradeabilityProxy {

  constructor(address _logic, address _admin, bytes memory _data) AdminUpgradeabilityProxy(_logic, _admin, _data) public {
    // We are 1:1 implementation with the parent and here is nothing to see
  }
}