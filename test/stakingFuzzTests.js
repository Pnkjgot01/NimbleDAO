const TestToken = artifacts.require("TestToken.sol");
// using mock contract here, as we need to read the hasInited value
const MockNimbleStaking = artifacts.require("MockNimbleStaking.sol");

const Helper = require("../helper.js");
const BN = web3.utils.BN;
const StakeSimulator = require("./fuzzerFiles/stakingFuzzer/stakingSimulator.js");
const { precisionUnits } = require("../helper.js");

//global variables
//////////////////
const NUM_RUNS = 100;

// accounts
let admin;
let daoOperator;
let stakers;

// token
let nmbToken;
const tokenDecimals = 18;

// staking and its params
let nimbleStaking;
let epochPeriod = new BN(1000);
let firstBlockTimestamp;

contract('NimbleStaking simulator', async (accounts) => {
    before('one time init: Stakers, NimbleStaking, NMB token', async() => {
        admin = accounts[1];
        daoOperator = accounts[2];
        stakers = accounts.slice(5,); // 5 stakers
        nmbToken = await TestToken.new("nimble Crystals", "NMB", tokenDecimals);

        // prepare nimble staking
        firstBlockTimestamp = await Helper.getCurrentBlockTime();

        nimbleStaking = await MockNimbleStaking.new(
            nmbToken.address,
            epochPeriod,
            firstBlockTimestamp + 1000,
            daoOperator
          );
    });

    beforeEach("deposits some NMB tokens to each account, gives allowance to staking contract", async() => {
        // 1M NMB token
        let nmbTweiDepositAmount = new BN(1000000).mul(precisionUnits);
        let maxAllowance = (new BN(2)).pow(new BN(255));
        // transfer tokens, approve staking contract
        for(let i = 0; i < stakers.length; i++) {
            await nmbToken.transfer(stakers[i], nmbTweiDepositAmount);
            let expectedResult = await nmbToken.balanceOf(stakers[i]);
            Helper.assertEqual(expectedResult, nmbTweiDepositAmount, "staker did not receive tokens");
            await nmbToken.approve(nimbleStaking.address, maxAllowance, {from: stakers[i]});
            expectedResult = await nmbToken.allowance(stakers[i], nimbleStaking.address);
            Helper.assertEqual(expectedResult, maxAllowance, "staker did not give sufficient allowance");
        }
    });

    it(`fuzz tests nimbleStaking contract with ${NUM_RUNS} loops`, async() => {
        await StakeSimulator.doFuzzStakeTests(
            nimbleStaking, NUM_RUNS, nmbToken, stakers, epochPeriod
        );
    });
});
