import BN from 'bn.js';
import { expect } from 'chai';
import { patract, network, artifacts } from 'redspot';

const { getContractFactory, getRandomSigner } = patract;

const { api, getSigners } = network;

describe('ERC20', () => {
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

  it('Can deposit TokenA', async () => {
    const { sender, TokenA, TokenB, Pool } = await setup();

    await TokenA.approve(Pool.address, 5, { signer: sender });

    expect((await TokenA.allowance(sender.address, Pool.address)).output).to.eq(
      5
    );
    await expect(Pool.deposit(TokenA.address, 5, { signer: sender }))
      .to.emit(Pool, 'Deposit')
      .withArgs(TokenA.address, 5);

    let tokenAmountOfContract = (await TokenA.balanceOf(Pool.address)).output;
    expect(tokenAmountOfContract.toNumber()).to.eq(5);
    let tokenAmountOfSender = (await TokenA.balanceOf(sender.address)).output;
    expect(tokenAmountOfSender.toNumber()).to.eq(495);
  });

  it('Can not deposit TokenB', async () => {
    const { sender, TokenB, Pool } = await setup();

    await TokenB.approve(Pool.address, 10, { signer: sender });
    expect((await TokenB.allowance(sender.address, Pool.address)).output).to.eq(
      10
    );

    await expect(Pool.deposit(TokenB.address, 10, { signer: sender }))
      .to.not.emit(Pool, 'Deposit')
      .withArgs(TokenB.address, 10);

    let tokenAmountOfContract = (await TokenB.balanceOf(Pool.address)).output;
    expect(tokenAmountOfContract.toNumber()).to.eq(0);
    let tokenAmountOfSender = (await TokenB.balanceOf(sender.address)).output;
    expect(tokenAmountOfSender.toNumber()).to.eq(1000);
  });
});
