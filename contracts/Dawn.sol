pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol";

contract Dawn is ERC20Pausable {

  string public name = "Dawn";
  string public symbol = "DAWN";
  uint8 public decimals = 18;

  // Same as in 1ST token
  uint public INITIAL_SUPPLY = 93468683899196345527500000;

  // PauserRole will be taken by FirstBlood multisig wallet in the mainnet deployment
  constructor(address manager) public {
    _mint(manager, INITIAL_SUPPLY);
    _addPauser(manager);
  }
}
