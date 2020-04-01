pragma solidity ^0.5.0;

// https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/blob/master/contracts/token/ERC20/ERC20Pausable.sol
// import '@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Pausable.sol';
import './ERC777Overridable.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol';
import './Recoverable.sol';


/**
 * First implementation of Dawn token.
 *
 * Needs to be set up behind a proxy contract.
 *
 */
contract DawnTokenImpl is Initializable, ERC777Overridable, Recoverable, Pausable {

  /**
   * Create the first Dawn token.
   *
   * @param sender The sender in Initizable pattern
   * @param manager The address that is going ot control Pausable functionality and also receive the initally minted tokens
   * @param _name Token name
   * @param _symbol Token symbol
   */
  function initialize(address sender, address manager, string memory _name, string memory _symbol) public initializer  {

    // We set up an ERC-777 token without any default operators
    address[] memory noAddresses = new address[](0);
    bytes memory emptyBytes = new bytes(0);
    ERC777Overridable.initialize(_name, _symbol, noAddresses);

    // Initializes owner() for recoverTokens
    Recoverable.initialize(sender);

    // Initializes pauser
    Pausable.initialize(sender);

    // Same as in 1ST token
    uint INITIAL_SUPPLY = 93468683899196345527500000;

    // Mint the initial supply
    // https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/blob/master/contracts/token/ERC777/ERC777.sol#L315
    _mint(address(0x0), manager, INITIAL_SUPPLY, emptyBytes, emptyBytes);

    // Set the manager address as the pauser
    _addPauser(manager);  // Set the managing multisig wallet as the pauser
    _removePauser(sender);  // Remove the deployment account as the pauser

    // Ownable always initializes the first owner to sender,
    // move to manager.
    // Set who can recover ETH and tokens send to this smart contract.
    _transferOwnership(manager);
  }

  //
  // We override methods from ERC777 and add whenNotPaused modifier and external keyword
  // (external is required by ERC-777 standard)
  //

  function send(address recipient, uint256 amount, bytes calldata data) external whenNotPaused {
    sendInternal(recipient, amount, data);
  }

  function transfer(address to, uint256 value) external whenNotPaused returns (bool) {
    return transferInternal(to, value);
  }

  function transferFrom(address from, address to, uint256 value) external whenNotPaused returns (bool) {
    return transferFromInternal(from, to, value);
  }


}