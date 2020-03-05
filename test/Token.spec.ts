const Dawn = artifacts.require("Dawn");
import Web3 from 'web3';
//import assert = require('assert'); // Power assert https://github.com/power-assert-js/espower-typescript

// https://etherscan.io/address/0xaf30d2a7e90d7dc361c8c4585e9bb7d2f6f15bc7#readContract
const TOKEN_1ST_TOTAL_SUPPLY = web3.utils.toBN('93468683899196345527500000');

contract("Dawn", ([deployer, user1]) => {
  it("should have total supply of 1ST token after deploy", async () => {
    const expectedMessage = "abc";

    const greeter = await Dawn.new(user1, { from: deployer });
    const supply = await greeter.totalSupply();

    assert(supply == TOKEN_1ST_TOTAL_SUPPLY);
  });
});
