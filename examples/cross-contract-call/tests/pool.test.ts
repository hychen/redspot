import BN from 'bn.js';
import { expect } from 'chai';
import { patract, network, artifacts } from 'redspot';

const { getContractFactory, getRandomSigner } = patract;

const { api, getSigners } = network;

describe('Pool', () => {
  after(() => {
    return api.disconnect();
  });

  async function setup() {
    const one = new BN(10).pow(new BN(api.registry.chainDecimals[0]));
    const signers = await getSigners();
    const Alice = signers[0];
    const sender = await getRandomSigner(Alice, one.muln(10000));
    const TokenA = await (await getContractFactory('erc20', sender)).deploy(
      'new',
      500
    );
    const TokenB = await (await getContractFactory('erc20', sender)).deploy(
      'new',
      1000
    );
    const Pool = await (await getContractFactory('pool', sender)).deploy(
      'new',
      [TokenA.address]
    );
    expect((await Pool.isWhitelisted(TokenA.address)).output).to.eq(true);
    expect((await Pool.isWhitelisted(TokenB.address)).output).to.eq(false);
    return { sender, TokenA, TokenB, Pool };
  }

  it('Can add/remove a token from the whitelist', async () => {
    const { TokenB, Pool } = await setup();
    await expect(Pool.addToWhitelist(TokenB.address))
      .to.emit(Pool, 'AddToWhitelist')
      .withArgs(TokenB.address);
    expect((await Pool.isWhitelisted(TokenB.address)).output).to.eq(true);
    await expect(Pool.removeFromWhitelist(TokenB.address))
      .to.emit(Pool, 'RemoveFromWhitelist')
      .withArgs(TokenB.address);
    expect((await Pool.isWhitelisted(TokenB.address)).output).to.eq(false);
  });

  describe('Can deposit Tokens whitelisted', () => {
    it('Can deposit TokenA if sender approve', async () => {
      const { sender, TokenA, Pool } = await setup();
      // sender deposit 5 tokenA.
      await TokenA.approve(Pool.address, 5, { signer: sender });
      await Pool.deposit(TokenA.address, 5, { signer: sender });

      //@FIXE: This does work correctly.
      //       .to.changeTokenBalances(TokenA, [sender, Pool], [-5, 5]);
      let tokenAmountOfContract = (await TokenA.balanceOf(Pool.address)).output;
      expect(tokenAmountOfContract.toNumber()).to.eq(5);
      let tokenAmountOfSender = (await TokenA.balanceOf(sender.address)).output;
      expect(tokenAmountOfSender.toNumber()).to.eq(495);
    });

    it('transfer emit event', async () => {
      const { sender, TokenA, Pool } = await setup();
      await TokenA.approve(Pool.address, 5, { signer: sender });
      await expect(Pool.deposit(TokenA.address, 5, { signer: sender }))
        .to.emit(Pool, 'Deposit')
        .withArgs(TokenA.address, 5);
    });

    it('Can not transfer above amount', async () => {
      const { sender, TokenA, Pool } = await setup();
      await expect(
        Pool.deposit(TokenA.address, 5, { signer: sender })
      ).to.not.emit(Pool, 'Deposit');
    });
  });

  describe('Can not deposite Tokens not whitelisted', () => {
    it('Can not transfer', async () => {
      const { sender, TokenB, Pool } = await setup();
      await TokenB.approve(Pool.address, 10, { signer: sender });
      await expect(
        Pool.deposit(TokenB.address, 10, { signer: sender })
      ).to.not.emit(Pool, 'Deposit');
    });
  });

  describe('Withdraw Token A', () => {
    it('happy case', async () => {
      const { sender, TokenA, Pool } = await setup();
      // Given: Sender deposits 5 TokenA.
      await TokenA.approve(Pool.address, 5, { signer: sender });
      await expect(Pool.deposit(TokenA.address, 5, { signer: sender }))
        .to.emit(Pool, 'Deposit')
        .withArgs(TokenA.address, 5);

      // When: Sender withdraw 5 TokenA.
      await expect(Pool.withdraw(TokenA.address, 5, { signer: sender }))
        .to.emit(Pool, 'Withdraw')
        .withArgs(TokenA.address, 5);

      // Expect: Pool has 0 tokenA, sender has 500 tokenA.
      let tokenAmountOfContract = (await TokenA.balanceOf(Pool.address)).output;
      expect(tokenAmountOfContract.toNumber()).to.eq(0);
      let tokenAmountOfSender = (await TokenA.balanceOf(sender.address)).output;
      expect(tokenAmountOfSender.toNumber()).to.eq(500);
    });
  });
});
