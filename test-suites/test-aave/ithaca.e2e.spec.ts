import BigNumber from 'bignumber.js';
import { APPROVAL_AMOUNT_LENDING_POOL, MAX_UINT_AMOUNT } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { RateMode } from '../../helpers/types';
import { IthacaFeed } from '../../types';
import { makeSuite } from './helpers/make-suite';

const chai = require('chai');
const { expect } = chai;

makeSuite('Ithaca-protocol e2e test', (testEnv) => {
  let weth, users, pool, oracle, ithacaFeed: IthacaFeed, usdc, addressesProvider;

  before('setup', async () => {
    ({ weth, users, usdc, pool, oracle, ithacaFeed, addressesProvider } = testEnv);
    await addressesProvider.setIthacaFeedOracle(ithacaFeed.address);
  });

  it('Deposits IthacaCollateral, borrows USDC', async () => {
    const depositor = users[0];
    const borrower = users[1];

    //mints DAI to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 USDC
    const amountDAItoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');

    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountDAItoDeposit, depositor.address, '0');

    let userGlobalData = await pool.getUserAccountData(borrower.address);

    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    let isUsingIthacaAsCollateral = await pool.isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(false);

    await pool.connect(borrower.signer).setUsingIthacaCollateral(true);

    isUsingIthacaAsCollateral = await pool.connect(borrower.signer).isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(true);

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    await ithacaFeed.setData(
      {
        client: borrower.address,
        maintenanceMargin: 0,
        mtm: 0,
        collateral: amountETHtoDeposit,
        vaR: 0,
      },
      1
    );

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);

    // avg ltv
    expect(userGlobalData.ltv).to.be.equal(10000);
    expect(userGlobalData.totalCollateralETH).to.be.equal(amountETHtoDeposit);
    expect(userGlobalData.availableBorrowsETH).to.be.equal(amountETHtoDeposit);
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .multipliedBy(0.95)
        .div(usdcPrice.toString())
        .toFixed(0)
    );

    // 258000000 , 3677141364160000

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    console.log(userGlobalDataAfter);

    // avg ltv
    expect(userGlobalDataAfter.ltv).to.be.equal(10000);
    expect(userGlobalDataAfter.totalCollateralETH).to.be.equal(amountETHtoDeposit);
    // expect(userGlobalDataAfter.availableBorrowsETH).to.be.equal(0);
    expect(userGlobalDataAfter.currentLiquidationThreshold).to.be.equal(0);
    // hf falls below 1
    expect(userGlobalDataAfter.healthFactor).to.be.gt('1000000000000000000');
  });

  it.only('Deposits IthacaCollateral and USDC, borrows USDC', async () => {
    const depositor = users[0];
    const borrower = users[1];

    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 2 deposits 1 WETH
    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //mints DAI to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountDAItoDeposit, depositor.address, '0');

    let userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    let isUsingIthacaAsCollateral = await pool.isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(false);

    await pool.connect(borrower.signer).setUsingIthacaCollateral(true);

    isUsingIthacaAsCollateral = await pool.connect(borrower.signer).isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(true);

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    await ithacaFeed.setData(
      {
        client: borrower.address,
        maintenanceMargin: 0,
        mtm: 0,
        collateral: amountETHtoDeposit,
        vaR: 0,
      },
      1
    );

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);

    console.log(userGlobalData);

    // avg ltv
    expect(userGlobalData.ltv).to.be.equal(9000);
    // 1e18 ithaca collateral & 1e18 usdc
    expect(userGlobalData.totalCollateralETH).to.be.equal((2e18).toFixed(0));
    expect(userGlobalData.availableBorrowsETH).to.be.equal((1.8e18).toFixed(0));
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    // TODO:

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .multipliedBy(0.95)
        .div(usdcPrice.toString())
        .toFixed(0)
    );

    // 258000000 , 3677141364160000

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);
    console.log(userGlobalDataAfter);

    // avg ltv
    expect(userGlobalDataAfter.ltv).to.be.equal(9000);
    expect(userGlobalDataAfter.totalCollateralETH).to.be.equal((2e18).toFixed());
    expect(userGlobalDataAfter.availableBorrowsETH).to.be.lt((1e17).toFixed(0));
    // expect(userGlobalDataAfter.currentLiquidationThreshold).to.be.equal(0);
    expect(userGlobalDataAfter.healthFactor).to.be.gt('1000000000000000000');
  });

  it.only('Deposits IthacaCollateral and usdc has positive mtm, borrows WETH', async () => {
    // todo fix this
    const depositor = users[0];
    const borrower = users[1];

    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 2 deposits 1 WETH
    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //mints DAI to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountDAItoDeposit, depositor.address, '0');

    let userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    let isUsingIthacaAsCollateral = await pool.isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(false);

    await pool.connect(borrower.signer).setUsingIthacaCollateral(true);

    isUsingIthacaAsCollateral = await pool.connect(borrower.signer).isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(true);

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    await ithacaFeed.setData(
      {
        client: borrower.address,
        maintenanceMargin: 0,
        mtm: amountETHtoDeposit,
        collateral: amountETHtoDeposit,
        vaR: 0,
      },
      1
    );

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);
    console.log(userGlobalData);

    // avg ltv
    expect(userGlobalData.ltv).to.be.equal(9333);

    expect(userGlobalData.totalCollateralETH).to.be.equal((3e18).toFixed(0));
    // expect(userGlobalData.availableBorrowsETH).to.be.within(2e18, 3e18);
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    const amountWETHtoBorrow = new BigNumber(userGlobalData.availableBorrowsETH.toString())
      .multipliedBy(0.8)
      .toFixed(0);

    // 258000000 , 3677141364160000

    await pool
      .connect(borrower.signer)
      .borrow(weth.address, amountWETHtoBorrow, RateMode.Variable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    console.log(userGlobalDataAfter);

    // avg ltv
    expect(userGlobalDataAfter.ltv).to.be.equal(9333);
    expect(userGlobalDataAfter.totalCollateralETH).to.be.equal((3e18).toFixed(0));
    // expect(userGlobalDataAfter.availableBorrowsETH).to.be.equal(0);
    expect(userGlobalDataAfter.currentLiquidationThreshold).to.be.equal(0);
    // hf falls below 1
    expect(userGlobalDataAfter.healthFactor).to.be.gt('1000000000000000000');
  });

  it('Deposits IthacaCollateral and usdc has positive margin requirement, borrows WETH', async () => {
    const depositor = users[0];
    const borrower = users[1];

    const amountETHtoDeposit = 1000;

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 2 deposits 1 WETH
    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //mints DAI to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountDAItoDeposit, depositor.address, '0');

    let userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    let isUsingIthacaAsCollateral = await pool.isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(false);

    await pool.connect(borrower.signer).setUsingIthacaCollateral(true);

    isUsingIthacaAsCollateral = await pool.connect(borrower.signer).isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(true);

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    await ithacaFeed.setData(
      { client: borrower.address, maintenanceMargin: 0, mtm: 1000, collateral: 1000, vaR: 0 },
      1
    );

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);

    console.log(userGlobalData);

    // avg ltv
    expect(userGlobalData.ltv).to.be.equal(9333);
    expect(userGlobalData.totalCollateralETH).to.be.equal(3000);
    expect(userGlobalData.availableBorrowsETH).to.be.equal(2800);
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);
  });

  // works
  it('Deposits IthacaCollateral and usdc has negative margin requirement, borrows WETH', async () => {
    const depositor = users[0];
    const borrower = users[1];

    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '3');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 2 deposits 1 WETH
    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //mints DAI to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    let userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    let isUsingIthacaAsCollateral = await pool.isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(false);

    await pool.connect(borrower.signer).setUsingIthacaCollateral(true);

    isUsingIthacaAsCollateral = await pool.connect(borrower.signer).isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(true);

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    await ithacaFeed.setData(
      {
        client: borrower.address,
        maintenanceMargin: 0,
        mtm: -0x0de0b6b3a7640000n,
        collateral: 0,
        vaR: 0,
      },
      1
    );

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);

    console.log(userGlobalData);

    // avg ltv
    expect(userGlobalData.ltv).to.be.equal(8000);
    expect(userGlobalData.totalCollateralETH).to.be.equal((2e18).toFixed(0));
    expect(userGlobalData.availableBorrowsETH).to.be.equal((1.6e18).toFixed(0));
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .multipliedBy(0.95)
        .div(usdcPrice.toString())
        .toFixed(0)
    );

    // 258000000 , 3677141364160000

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    console.log(userGlobalDataAfter);
    // avg ltv
    expect(userGlobalDataAfter.ltv).to.be.equal(8000);
    expect(userGlobalDataAfter.totalCollateralETH).to.be.equal((2e18).toFixed(0));
    // expect(userGlobalDataAfter.availableBorrowsETH).to.be.equal(0);
    // expect(userGlobalDataAfter.currentLiquidationThreshold).to.be.equal(0);
    expect(userGlobalDataAfter.healthFactor).to.be.gt((1e18).toFixed(0));
  });

  it.only('Deposits WETH and USDC, borrows USDC', async () => {
    const depositor = users[0];
    const borrower = users[1];

    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 2 deposits 1 WETH
    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '3677');
    console.log(await usdc.balanceOf(borrower.address));

    //mints usdc to borrower
    await usdc.connect(borrower.signer).mint(amountUSDCtoDeposit);

    //approve protocol to access borrower wallet
    await usdc.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 2 deposits 1 WETH
    await pool
      .connect(borrower.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, borrower.address, '0');

    //mints DAI to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    // user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(usdc.address, '3677');
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountDAItoDeposit, depositor.address, '0');

    let userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);

    console.log(userGlobalData);

    // 3677141365160000000000000000
    // avg ltv
    expect(userGlobalData.ltv).to.be.equal(8000);
    // expect(userGlobalData.totalCollateralETH).to.be.equal(3677);
    // expect(userGlobalData.availableBorrowsETH).to.be.equal(2941713092128);
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .multipliedBy(0.95)
        .div(usdcPrice.toString())
        .toFixed(0)
    );

    // 258000000 , 3677141364160000

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    console.log(userGlobalDataAfter);
    // avg ltv
    expect(userGlobalDataAfter.ltv).to.be.equal(8000);
    expect(userGlobalDataAfter.totalCollateralETH).to.be.equal(amountETHtoDeposit);
    expect(userGlobalDataAfter.availableBorrowsETH).to.be.equal(0);
    expect(userGlobalDataAfter.currentLiquidationThreshold).to.be.equal(0);
    expect(userGlobalDataAfter.healthFactor).to.be.gt((1e18).toFixed(0));
  });
});
