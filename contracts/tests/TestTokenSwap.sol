pragma solidity ^0.5.0;

import '../TokenSwap.sol';

/**
 * A TokenSwap with additional functionality added for tests.
 *
 * Note: This should be an independent contract, as it has pure functions only,
 * but for the legacy reasons it is subcontract of TokenSwap.
 */
contract TestTokenSwap is TokenSwap {

  /**
   * A test method exposed to be called from clients to compare that ABI packing and hashing
   * is same across different programming languages.
   *
   * Does ABI encoding for an address and then calculates KECCAK-256 hash over the bytes.
   *
   * https://web3js.readthedocs.io/en/v1.2.0/web3-utils.html#soliditysha3
   *
   */
  function calculateAddressHash(address a) public pure returns (bytes32 hash, bytes memory data) {

    // First we ABI encode the address to bytes.
    // This is so called "tight packing"
    // https://web3js.readthedocs.io/en/v1.2.0/web3-utils.html#soliditysha3
    bytes memory packed = abi.encodePacked(a);

    // Then we calculate keccak256 over the resulting bytes
    bytes32 hashResult = keccak256(packed);

    return(hashResult, packed);
  }

  /**
   * Expose ecrecover, so we can call it from console/tests and compare results.
   */
  function recoverAddress(bytes32 hash, uint8 v, bytes32 r, bytes32 s) public pure returns(address) {
    return ecrecover(hash, v, r, s);
  }
}