const {
  BN, constants, expectEvent, expectRevert,
} = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const { ZERO_ADDRESS } = constants;

function shouldBehaveLikeERC20(errorPrefix, initialSupply, initialHolder, recipient, anotherAccount) {
  describe('total supply', () => {
    it('returns the total amount of tokens', async function () {
      expect(await this.token.totalSupply()).to.be.bignumber.equal(initialSupply);
    });
  });

  describe('balanceOf', () => {
    describe('when the requested account has no tokens', () => {
      it('returns zero', async function () {
        expect(await this.token.balanceOf(anotherAccount)).to.be.bignumber.equal('0');
      });
    });

    describe('when the requested account has some tokens', () => {
      it('returns the total amount of tokens', async function () {
        expect(await this.token.balanceOf(initialHolder)).to.be.bignumber.equal(initialSupply);
      });
    });
  });

  describe('transfer', () => {
    shouldBehaveLikeERC20Transfer(errorPrefix, initialHolder, recipient, initialSupply,
      function (from, to, value) {
        return this.token.transfer(to, value, { from });
      });
  });

  describe('transfer from', () => {
    const spender = recipient;

    describe('when the token owner is not the zero address', () => {
      const tokenOwner = initialHolder;

      describe('when the recipient is not the zero address', () => {
        const to = anotherAccount;

        describe('when the spender has enough approved balance', () => {
          beforeEach(async function () {
            await this.token.approve(spender, initialSupply, { from: initialHolder });
          });

          describe('when the token owner has enough balance', () => {
            const amount = initialSupply;

            it('transfers the requested amount', async function () {
              await this.token.transferFrom(tokenOwner, to, amount, { from: spender });

              expect(await this.token.balanceOf(tokenOwner)).to.be.bignumber.equal('0');

              expect(await this.token.balanceOf(to)).to.be.bignumber.equal(amount);
            });

            it('decreases the spender allowance', async function () {
              await this.token.transferFrom(tokenOwner, to, amount, { from: spender });

              expect(await this.token.allowance(tokenOwner, spender)).to.be.bignumber.equal('0');
            });

            it('emits a transfer event', async function () {
              const { logs } = await this.token.transferFrom(tokenOwner, to, amount, { from: spender });

              expectEvent.inLogs(logs, 'Transfer', {
                from: tokenOwner,
                to,
                value: amount,
              });
            });

            it('emits an approval event', async function () {
              const { logs } = await this.token.transferFrom(tokenOwner, to, amount, { from: spender });

              expectEvent.inLogs(logs, 'Approval', {
                owner: tokenOwner,
                spender,
                value: await this.token.allowance(tokenOwner, spender),
              });
            });
          });

          describe('when the token owner does not have enough balance', () => {
            const amount = initialSupply.addn(1);

            it('reverts', async function () {
              await expectRevert(this.token.transferFrom(
                tokenOwner, to, amount, { from: spender },
              ), `${errorPrefix}: transfer amount exceeds balance`);
            });
          });
        });

        describe('when the spender does not have enough approved balance', () => {
          beforeEach(async function () {
            await this.token.approve(spender, initialSupply.subn(1), { from: tokenOwner });
          });

          describe('when the token owner has enough balance', () => {
            const amount = initialSupply;

            it('reverts', async function () {
              await expectRevert(this.token.transferFrom(
                tokenOwner, to, amount, { from: spender },
              ), `${errorPrefix}: transfer amount exceeds allowance`);
            });
          });

          describe('when the token owner does not have enough balance', () => {
            const amount = initialSupply.addn(1);

            it('reverts', async function () {
              await expectRevert(this.token.transferFrom(
                tokenOwner, to, amount, { from: spender },
              ), `${errorPrefix}: transfer amount exceeds balance`);
            });
          });
        });
      });

      describe('when the recipient is the zero address', () => {
        const amount = initialSupply;
        const to = ZERO_ADDRESS;

        beforeEach(async function () {
          await this.token.approve(spender, amount, { from: tokenOwner });
        });

        it('reverts', async function () {
          await expectRevert(this.token.transferFrom(
            tokenOwner, to, amount, { from: spender },
          ), `${errorPrefix}: transfer to the zero address`);
        });
      });
    });

    describe('when the token owner is the zero address', () => {
      const amount = 0;
      const tokenOwner = ZERO_ADDRESS;
      const to = recipient;

      it('reverts', async function () {
        await expectRevert(this.token.transferFrom(
          tokenOwner, to, amount, { from: spender },
        ), `${errorPrefix}: transfer from the zero address`);
      });
    });
  });

  describe('approve', () => {
    shouldBehaveLikeERC20Approve(errorPrefix, initialHolder, recipient, initialSupply,
      function (owner, spender, amount) {
        return this.token.approve(spender, amount, { from: owner });
      });
  });
}

function shouldBehaveLikeERC20Transfer(errorPrefix, from, to, balance, transfer) {
  describe('when the recipient is not the zero address', () => {
    describe('when the sender does not have enough balance', () => {
      const amount = balance.addn(1);

      it('reverts', async function () {
        await expectRevert(transfer.call(this, from, to, amount),
          `${errorPrefix}: transfer amount exceeds balance`);
      });
    });

    describe('when the sender transfers all balance', () => {
      const amount = balance;

      it('transfers the requested amount', async function () {
        await transfer.call(this, from, to, amount);

        expect(await this.token.balanceOf(from)).to.be.bignumber.equal('0');

        expect(await this.token.balanceOf(to)).to.be.bignumber.equal(amount);
      });

      it('emits a transfer event', async function () {
        const { logs } = await transfer.call(this, from, to, amount);

        expectEvent.inLogs(logs, 'Transfer', {
          from,
          to,
          value: amount,
        });
      });
    });

    describe('when the sender transfers zero tokens', () => {
      const amount = new BN('0');

      it('transfers the requested amount', async function () {
        await transfer.call(this, from, to, amount);

        expect(await this.token.balanceOf(from)).to.be.bignumber.equal(balance);

        expect(await this.token.balanceOf(to)).to.be.bignumber.equal('0');
      });

      it('emits a transfer event', async function () {
        const { logs } = await transfer.call(this, from, to, amount);

        expectEvent.inLogs(logs, 'Transfer', {
          from,
          to,
          value: amount,
        });
      });
    });
  });

  describe('when the recipient is the zero address', () => {
    it('reverts', async function () {
      await expectRevert(transfer.call(this, from, ZERO_ADDRESS, balance),
        `${errorPrefix}: transfer to the zero address`);
    });
  });
}

function shouldBehaveLikeERC20Approve(errorPrefix, owner, spender, supply, approve) {
  describe('when the spender is not the zero address', () => {
    describe('when the sender has enough balance', () => {
      const amount = supply;

      it('emits an approval event', async function () {
        const { logs } = await approve.call(this, owner, spender, amount);

        expectEvent.inLogs(logs, 'Approval', {
          owner,
          spender,
          value: amount,
        });
      });

      describe('when there was no approved amount before', () => {
        it('approves the requested amount', async function () {
          await approve.call(this, owner, spender, amount);

          expect(await this.token.allowance(owner, spender)).to.be.bignumber.equal(amount);
        });
      });

      describe('when the spender had an approved amount', () => {
        beforeEach(async function () {
          await approve.call(this, owner, spender, new BN(1));
        });

        it('approves the requested amount and replaces the previous one', async function () {
          await approve.call(this, owner, spender, amount);

          expect(await this.token.allowance(owner, spender)).to.be.bignumber.equal(amount);
        });
      });
    });

    describe('when the sender does not have enough balance', () => {
      const amount = supply.addn(1);

      it('emits an approval event', async function () {
        const { logs } = await approve.call(this, owner, spender, amount);

        expectEvent.inLogs(logs, 'Approval', {
          owner,
          spender,
          value: amount,
        });
      });

      describe('when there was no approved amount before', () => {
        it('approves the requested amount', async function () {
          await approve.call(this, owner, spender, amount);

          expect(await this.token.allowance(owner, spender)).to.be.bignumber.equal(amount);
        });
      });

      describe('when the spender had an approved amount', () => {
        beforeEach(async function () {
          await approve.call(this, owner, spender, new BN(1));
        });

        it('approves the requested amount and replaces the previous one', async function () {
          await approve.call(this, owner, spender, amount);

          expect(await this.token.allowance(owner, spender)).to.be.bignumber.equal(amount);
        });
      });
    });
  });

  describe('when the spender is the zero address', () => {
    it('reverts', async function () {
      await expectRevert(approve.call(this, owner, ZERO_ADDRESS, supply),
        `${errorPrefix}: approve to the zero address`);
    });
  });
}

module.exports = {
  shouldBehaveLikeERC20,
  shouldBehaveLikeERC20Transfer,
  shouldBehaveLikeERC20Approve,
};
