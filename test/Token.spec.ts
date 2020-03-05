const Dawn = artifacts.require("Dawn");

var assert = require('assert'); // Power assert https://github.com/power-assert-js/espower-typescript

// https://etherscan.io/address/0xaf30d2a7e90d7dc361c8c4585e9bb7d2f6f15bc7#readContract
const TOKEN_1ST_TOTAL_SUPPLY = web3.utils.toBN('93468683899196345527500000');

contract("Dawn", ([deployer, user1, user2]) => {

  const tokenOwner = user1;

  it("should have total supply of 1ST token after deploy", async () => {

    const dawn = await Dawn.new(tokenOwner, { from: deployer });
    const supply = await dawn.totalSupply();

    assert(supply.toString() == TOKEN_1ST_TOTAL_SUPPLY.toString());
  });

  it("should allow transfer", async () => {

    const dawn = await Dawn.new(tokenOwner, { from: deployer });
    const amount = web3.utils.toWei("1", "ether"); // 1 full token

    // Transfer tokens
    await dawn.transfer(user2, amount, { from: tokenOwner });
    const balanceAfter = await dawn.balanceOf(user2);
    assert(balanceAfter.toString() == amount.toString());
  });

  it("should not allow transfers after pause", async () => {

    const dawn = await Dawn.new(tokenOwner, { from: deployer });
    const amount = web3.utils.toWei("1", "ether"); // 1 full token

    // Pause
    await dawn.pause({ from: tokenOwner });
    assert(await dawn.paused());

    // Transfer tokens fails
    assert.rejects(async () => {
      await dawn.transfer(user2, amount, { from: user1 });
    });
  });

  it("should not allow pause by a random person", async () => {

    const dawn = await Dawn.new(tokenOwner, { from: deployer });

    // Transfer tokens fails
    assert.rejects(async () => {
      await dawn.pause({ from: user2 });
    });
  });


});
