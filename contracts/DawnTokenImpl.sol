pragma solidity ^0.5.0;

// https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/tree/master/contracts/token/ERC777
import './ERC777Overridable.sol';
import '@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol';
import './Recoverable.sol';


/**
 * First implementation of Dawn token.
 *
 * Needs to be set up behind a proxy contract.
 *
 * We use a modified OpenZeppelin ERC777 contract, as otherwise we cannot
 * override send(), transfer() and transferFrom(), etc. from the parent contract
 * as they are marked external.
 * EVM currently does not allow overriding of external functions.
 * Changing the call signatures for the required functions
 * was the only change done on ERC777Overridable.sol contract - otherwise
 * it is a vanilla copy of
 * https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/blob/bf0277b398c0454276bd8caf0ee35efaf46e686b/contracts/token/ERC777/ERC777.sol
 *
 */
contract DawnTokenImpl is ERC777Overridable, Recoverable, Pausable {

  /**
   * Create the first Dawn token.
   *
   * We are using a function name `initializeDawn` instead of `initialize`
   * as otherwise we get a function override name clash with same number of parameters
   * that are different type. The web3.js code
   * will try to call the initializer() of a ERC777Overridable with a wrong signature and this is the error:
   *
   * expected array value (arg="defaultOperators", coderType="array", value="NEW")
   *
   * @param manager The address that is going ot control Pausable functionality and also receive the initially minted tokens
   * @param _name Token name
   * @param _symbol Token symbol
   */
  function initializeDawn(address manager, string memory _name, string memory _symbol) public initializer  {

    // We set up an ERC-777 token without any default operators
    address[] memory noAddresses = new address[](0);
    bytes memory emptyBytes = bytes('');

    ERC777Overridable.initialize(_name, _symbol, noAddresses);

    // Initializes owner() for recoverTokens
    Recoverable.initialize(manager);

    // Initializes pauser
    Pausable.initialize(manager);

    // Same as in 1ST token
    // https://etherscan.io/token/0xaf30d2a7e90d7dc361c8c4585e9bb7d2f6f15bc7
    uint INITIAL_SUPPLY = 93468683899196345527500000;

    // Mint the initial supply
    // https://github.com/OpenZeppelin/openzeppelin-contracts-ethereum-package/blob/master/contracts/token/ERC777/ERC777.sol#L315
    _mint(manager, manager, INITIAL_SUPPLY, emptyBytes, emptyBytes);

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

  function burn(uint256 amount, bytes calldata data) external whenNotPaused {
    burnInternal(amount, data);
  }

  function operatorSend(
    address sender,
    address recipient,
    uint256 amount,
    bytes calldata data,
    bytes calldata operatorData
  ) external whenNotPaused {
    operatorSendInternal(sender, recipient, amount, data, operatorData);
  }

  function operatorBurn(address account, uint256 amount, bytes calldata data, bytes calldata operatorData) external whenNotPaused {
    operatorBurnInternal(account, amount, data, operatorData);
  }

   // Upgradeability - add some space
  uint256[50] private ______gap;

}