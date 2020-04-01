pragma solidity ^0.5.0;

import '../DawnTokenImpl.sol';

/**
 * Allow running OpenZeppelin conformance suite
 */
contract ERC777Mock is DawnTokenImpl {

 /**
   * Special initializer called only for ERC-777 comformance test suite
   */
  function initializeDawnForConformanceTest(
    address manager,
    uint _initialSupply,
    string memory _name,
    string memory _symbol,
    address[] memory defaultOperators) public initializer  {

    bytes memory emptyBytes = new bytes(0);
    ERC777Overridable.initialize(_name, _symbol, defaultOperators);
    Recoverable.initialize(manager);
    Pausable.initialize(manager);
    _mint(manager, manager, _initialSupply, emptyBytes, emptyBytes);

  }

  function mintInternal (
      address operator,
      address to,
      uint256 amount,
      bytes memory userData,
      bytes memory operatorData
  ) public {
      _mint(operator, to, amount, userData, operatorData);
  }

}
