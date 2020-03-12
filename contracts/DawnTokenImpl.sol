pragma solidity ^0.5.0;

// https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/blob/master/contracts/token/ERC20/ERC20Pausable.sol
import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Pausable.sol';

/**
 * First implementation of Dawn token.
 *
 * Needs to be set up behind a proxy contract.
 *
 */
contract DawnTokenImpl is ERC20Pausable {

  // Because of Upgradeability, not of the variables can be initialised in place
  // https://docs.openzeppelin.com/upgrades/2.7/writing-upgradeable#avoid-initial-values-in-field-declarations
  string public name;
  string public symbol;
  uint8 public decimals;

  // Same as in 1ST token
  uint constant INITIAL_SUPPLY = 93468683899196345527500000;

  function initialize(address sender, address manager) public initializer  {

    ERC20Pausable.initialize(sender);

    name = "Dawn";
    symbol = "DAWN";
    decimals = 18;

    _mint(manager, INITIAL_SUPPLY);
    _addPauser(manager);  // Set the managing multisig wallet as the pauser
    _removePauser(sender);  // Remove the deployment account as the pauser
  }
}
