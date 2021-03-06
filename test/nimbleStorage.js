const TestToken = artifacts.require("Token.sol");
const MockReserve = artifacts.require("MockReserve.sol");
const NimbleHistory = artifacts.require("NimbleHistory.sol");
const NimbleStorage = artifacts.require("NimbleStorage.sol");
const NimbleNetwork = artifacts.require("NimbleNetwork.sol");
const MockStorage = artifacts.require("MockStorage.sol");
const Helper = require("../helper.js");
const nwHelper = require("./networkHelper.js");

const BN = web3.utils.BN;
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const {zeroAddress, zeroBN, ethAddress} = require("../helper.js");
const { ReserveType, MOCK_ID } = require('./networkHelper.js');

//global variables
//////////////////
const maxProxies = new BN(2);

let txResult;

let admin;
let operator;
let network;
let nimbleNetworkHistory;
let nimbleFeeHandlerHistory;
let nimbleDaoHistory;
let nimbleMatchingEngineHistory;
let nimbleStorage;
let user;
let feeHandlerAddr;
let matchingEngineAddr;

//reserve data
//////////////
let reserveInstances = {};
let reserve;
let numReserves;

//tokens data
////////////
let token;

contract('NimbleStorage', function(accounts) {

    before("one time global init", async() => {
        //init accounts
        user = accounts[0];
        admin = accounts[1];
        operator = accounts[2];
        nimbleDaoAddr = accounts[4];
        feeHandlerAddr = accounts[6];
        matchingEngineAddr = accounts[7];
    });

    describe("test init reverts with null historical address", async() => {
        before("deploy historical contracts", async() => {
            nimbleNetworkHistory = await NimbleHistory.new(admin);
            nimbleFeeHandlerHistory = await NimbleHistory.new(admin);
            nimbleDaoHistory = await NimbleHistory.new(admin);
            nimbleMatchingEngineHistory = await NimbleHistory.new(admin);
        });

        it("should revert for null nimbleNetworkHistory address", async() => {
            await expectRevert(
                NimbleStorage.new(
                    admin,
                    zeroAddress,
                    nimbleFeeHandlerHistory.address,
                    nimbleDaoHistory.address,
                    nimbleMatchingEngineHistory.address
                ),
                "nimbleNetworkHistory 0"
            );
        });

        it("should revert for null nimbleFeeHandlerHistory address", async() => {
            await expectRevert(
                NimbleStorage.new(
                    admin,
                    nimbleNetworkHistory.address,
                    zeroAddress,
                    nimbleDaoHistory.address,
                    nimbleMatchingEngineHistory.address
                ),
                "nimbleFeeHandlerHistory 0"
            );
        });

        it("should revert for null nimbleDaoHistory address", async() => {
            await expectRevert(
                NimbleStorage.new(
                    admin,
                    nimbleNetworkHistory.address,
                    nimbleFeeHandlerHistory.address,
                    zeroAddress,
                    nimbleMatchingEngineHistory.address
                ),
                "nimbleDaoHistory 0"
            );
        });

        it("should revert for null nimbleMatchingEngineHistory address", async() => {
            await expectRevert(
                NimbleStorage.new(
                    admin,
                    nimbleNetworkHistory.address,
                    nimbleFeeHandlerHistory.address,
                    nimbleDaoHistory.address,
                    zeroAddress
                ),
                "nimbleMatchingEngineHistory 0"
            );
        });
    });

    describe("test onlyAdmin and onlyOperator permissions", async() => {
        before("deploy NimbleStorage instance, 1 mock reserve and 1 mock token", async() => {
            nimbleStorage = await nwHelper.setupStorage(admin);
            network = await NimbleNetwork.new(admin, nimbleStorage.address);
            await nimbleStorage.addOperator(operator, {from: admin});
            await nimbleStorage.setNetworkContract(network.address, { from: admin});
            await nimbleStorage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: admin});
            await nimbleStorage.setEntitledRebatePerReserveType(true, false, true, false, true, true, {from: admin});
            token = await TestToken.new("test", "tst", 18);

            //init 1 mock reserve
            let result = await nwHelper.setupReserves(network, [], 1,0,0,0, accounts, admin, operator);
            reserveInstances = result.reserveInstances;
            numReserves = result.numAddedReserves * 1;
            for (const value of Object.values(reserveInstances)) {
                reserve = value;
            }
        });

        it("should not have unauthorized personnel set network contract", async() => {
            await expectRevert(
                nimbleStorage.setNetworkContract(network.address, {from: user}),
                "only admin"
            );

            await expectRevert(
                nimbleStorage.setNetworkContract(network.address, {from: operator}),
                "only admin"
            );
        });

        it("should have admin set network contract", async() => {
            await nimbleStorage.setNetworkContract(network.address, {from: admin});
            let result = await nimbleStorage.nimbleNetwork();
            Helper.assertEqual(network.address, result, "network not set by admin");
        });

        it("should not have unauthorized personnel add reserve", async() => {
            await expectRevert(
                nimbleStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: user}),
                "only operator"
            );

            await expectRevert(
                nimbleStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: admin}),
                "only operator"
            );
        });

        it("should have operator add reserve", async() => {
            await nimbleStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
            let reserveId = await nimbleStorage.getReserveId(reserve.address);

            let reserveAddress = await nimbleStorage.getReserveAddressesByReserveId(reserve.reserveId);
            Helper.assertEqual(reserve.reserveId, reserveId, "wrong address to ID");
            Helper.assertEqual(reserve.address, reserveAddress[0], "wrong ID to address");
        });

        it("should not have unauthorized personnel set rebate wallet", async() => {
            await expectRevert(
                nimbleStorage.setRebateWallet(reserve.reserveId, accounts[2], {from: user}),
                "only operator"
            );

            await expectRevert(
                nimbleStorage.setRebateWallet(reserve.reserveId, accounts[2], {from: admin}),
                "only operator"
            );
        });

        it("should not have unauthorized personnel list token pair for reserve", async() => {
            await expectRevert(
                nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, true, {from: user}),
                "only operator"
            );

            await expectRevert(
                nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, true, {from: admin}),
                "only operator"
            );
        });

        it("should have operator list pair for reserve", async() => {
            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, true, {from: operator});
            let result = await nimbleStorage.getReserveIdsPerTokenSrc(token.address);
            Helper.assertEqual(result[0], reserve.reserveId, "reserve should have supported token");
            result = await nimbleStorage.getReserveIdsPerTokenDest(token.address);
            Helper.assertEqual(result[0], reserve.reserveId, "reserve should have supported token");
        });

        it("should not have unauthorized personnel remove reserve", async() => {
            await expectRevert(
                nimbleStorage.removeReserve(reserve.reserveId, zeroBN, {from: user}),
                "only operator"
            );

            await expectRevert(
                nimbleStorage.removeReserve(reserve.reserveId, zeroBN, {from: admin}),
                "only operator"
            );
        });

        it("should have operator removes reserve", async() => {
            await nimbleStorage.removeReserve(reserve.reserveId, zeroBN, {from: operator});
        });

        it("should not have unauthorized personnel set contracts", async() => {
            await expectRevert(
                nimbleStorage.setNimbleDaoContract(nimbleDaoAddr, { from: operator}), "only nimbleNetwork"
            );

            await expectRevert(
                nimbleStorage.setNimbleDaoContract(nimbleDaoAddr, { from: admin}), "only nimbleNetwork"
            );

            await expectRevert(
                nimbleStorage.setContracts(feeHandlerAddr, matchingEngineAddr, { from: operator}), "only nimbleNetwork"
            );

            await expectRevert(
                nimbleStorage.setContracts(feeHandlerAddr, matchingEngineAddr, { from: admin}), "only nimbleNetwork"
            );
        });

        it("should have network set contracts", async() => {
            let oldNetwork = await nimbleStorage.nimbleNetwork();
            network = accounts[3];
            await nimbleStorage.setNetworkContract(network, { from: admin});
            await nimbleStorage.setNimbleDaoContract(nimbleDaoAddr, { from: network});
            await nimbleStorage.setContracts(feeHandlerAddr, matchingEngineAddr, { from: network });
            let result = await nimbleStorage.getContracts();
            Helper.assertEqualArray(result.nimbleDaoAddresses, [nimbleDaoAddr], "unexpected dao history");
            Helper.assertEqualArray(result.nimbleMatchingEngineAddresses, [matchingEngineAddr], "unexpected match engine history");
            Helper.assertEqualArray(result.nimbleFeeHandlerAddresses, [feeHandlerAddr], "unexpected fee handler history");
            Helper.assertEqualArray(result.nimbleNetworkAddresses, [network, oldNetwork], "unexpected network history");
        });
    });

    describe("test contract event", async() => {
        before("deploy and setup nimbleStorage instance", async() => {
            nimbleStorage = await nwHelper.setupStorage(admin);
            network = await NimbleNetwork.new(admin, nimbleStorage.address);
            await nimbleStorage.addOperator(operator, {from: admin});
            await nimbleStorage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: admin});
            await nimbleStorage.setEntitledRebatePerReserveType(true, false, true, false, true, true, {from: admin});
        });

        it("shoud test set network event", async() => {
            txResult = await nimbleStorage.setNetworkContract(network.address, {from: admin});
            expectEvent(txResult, "NimbleNetworkUpdated", {
                newNimbleNetwork: network.address
            });
        });

        it("Add reserve", async() => {
            let anyWallet = accounts[0];
            let mockReserve = await MockReserve.new();
            let txResult = await nimbleStorage.addReserve(mockReserve.address, nwHelper.genReserveID(MOCK_ID, mockReserve.address), ReserveType.FPR, anyWallet, {from: operator});
            expectEvent(txResult, 'AddReserveToStorage', {
                reserve: mockReserve.address,
                reserveId: nwHelper.genReserveID(MOCK_ID, mockReserve.address).toLowerCase(),
                reserveType: new BN(ReserveType.FPR),
                rebateWallet: anyWallet
            });
            expectEvent(txResult, 'ReserveRebateWalletSet', {
                reserveId: nwHelper.genReserveID(MOCK_ID, mockReserve.address).toLowerCase(),
                rebateWallet: anyWallet
            });
            await nimbleStorage.removeReserve(
                nwHelper.genReserveID(MOCK_ID, mockReserve.address).toLowerCase(),
                0,
                {from: operator}
            );
        });

        it("Remove reserve", async() => {
            let anyWallet = accounts[0];
            let mockReserve = await MockReserve.new();
            let mockReserveID = nwHelper.genReserveID(MOCK_ID, mockReserve.address).toLowerCase();
            await nimbleStorage.addReserve(mockReserve.address, mockReserveID, ReserveType.FPR, anyWallet, {from: operator});
            let txResult = await nimbleStorage.removeReserve(
                mockReserveID,
                0,
                {from: operator}
            );
            expectEvent(txResult, 'RemoveReserveFromStorage', {
                reserve: mockReserve.address,
                reserveId: mockReserveID
            });
        });

        it("Set rebate wallet for reserve", async() => {
            let anyWallet = accounts[0];
            let mockReserve = await MockReserve.new();
            let txResult = await nimbleStorage.addReserve(mockReserve.address, nwHelper.genReserveID(MOCK_ID, mockReserve.address), ReserveType.FPR, anyWallet, {from: operator});
            expectEvent(txResult, 'ReserveRebateWalletSet', {
                reserveId: nwHelper.genReserveID(MOCK_ID, mockReserve.address).toLowerCase(),
                rebateWallet: anyWallet
            });
            anyWallet = accounts[2];
            txResult = await nimbleStorage.setRebateWallet(nwHelper.genReserveID(MOCK_ID, mockReserve.address).toLowerCase(), anyWallet, {from: operator});
            expectEvent(txResult, 'ReserveRebateWalletSet', {
                reserveId: nwHelper.genReserveID(MOCK_ID, mockReserve.address).toLowerCase(),
                rebateWallet: anyWallet
            });
            await nimbleStorage.removeReserve(
                nwHelper.genReserveID(MOCK_ID, mockReserve.address).toLowerCase(),
                0,
                {from: operator}
            );
        });

        it("List pair For reserve eth to token", async() => {
            let anyWallet = accounts[0];
            let anotherMockReserve = await MockReserve.new();
            let mockReserveId = nwHelper.genReserveID(MOCK_ID, anotherMockReserve.address).toLowerCase();
            let token = await TestToken.new("test token", "tst", 18);
            await nimbleStorage.addReserve(anotherMockReserve.address, mockReserveId, ReserveType.FPR, anyWallet, {from: operator});

            let reserveData = await nimbleStorage.getReservesData([mockReserveId], ethAddress, token.address);
            assert(!reserveData.areAllReservesListed, "reserve should not be listed when getReservesData");

            let txResult = await nimbleStorage.listPairForReserve(mockReserveId, token.address, true, false, true, {from: operator});
            expectEvent(txResult, 'ListReservePairs', {
                reserveId: mockReserveId,
                reserve: anotherMockReserve.address,
                src: ethAddress,
                dest: token.address,
                add: true
            });
            // check reserve is listed when getReservesData
            reserveData = await nimbleStorage.getReservesData([mockReserveId], ethAddress, token.address);
            assert(reserveData.areAllReservesListed, "reserve should be listed when getReservesData");
        });

        it("List pair For reserve token to eth", async() => {
            let anyWallet = accounts[0];
            let anotherMockReserve = await MockReserve.new();
            let mockReserveId = nwHelper.genReserveID(MOCK_ID, anotherMockReserve.address).toLowerCase();
            let token = await TestToken.new("test token", "tst", 18);
            await nimbleStorage.addReserve(anotherMockReserve.address, mockReserveId, ReserveType.FPR, anyWallet, {from: operator});

            let reserveData = await nimbleStorage.getReservesData([mockReserveId], token.address, ethAddress);
            assert(!reserveData.areAllReservesListed, "reserve should not be listed when getReservesData");

            let txResult = await nimbleStorage.listPairForReserve(mockReserveId, token.address, false, true, true, {from: operator});
            expectEvent(txResult, 'ListReservePairs', {
                reserveId: mockReserveId,
                reserve: anotherMockReserve.address,
                src: token.address,
                dest: ethAddress,
                add: true
            });

            reserveData = await nimbleStorage.getReservesData([mockReserveId], token.address, ethAddress);
            assert(reserveData.areAllReservesListed, "reserve should be listed when getReservesData");
        });
    });

    describe("test setting contracts and params", async() => {
        before("deploy and setup nimbleStorage instance", async() => {
            nimbleStorage = await nwHelper.setupStorage(admin);
            network = accounts[3];
            await nimbleStorage.setNetworkContract(network, {from: admin});
            await nimbleStorage.addOperator(operator, {from: admin});
        });

        it("should revert setting zero address for network", async() => {
            await expectRevert(
                nimbleStorage.setNetworkContract(zeroAddress, {from: admin}),
                "nimbleNetwork 0");
        });

        it("set empty fee handler contract", async function(){
            await expectRevert(
                nimbleStorage.setContracts(zeroAddress, matchingEngineAddr, {from: network}),
                "nimbleFeeHandler 0"
            );
        });

        it("set empty matching engine contract", async function(){
            await expectRevert(
                nimbleStorage.setContracts(feeHandlerAddr, zeroAddress, {from: network}),
                "nimbleMatchingEngine 0"
            );
        });

        it("set and get contracts history", async() =>{
            await nimbleStorage.setNimbleDaoContract(nimbleDaoAddr, { from: network});
            await nimbleStorage.setContracts(feeHandlerAddr, matchingEngineAddr, { from: network });
            
            // get and set second dao, matchingEngine, feeHandler and network contracts
            let nimbleDaoAddr2 = accounts[7];
            let feeHandlerAddr2 = accounts[8];
            let matchingEngineAddr2 = accounts[9];
            let networkAddr2 = accounts[10];

            await nimbleStorage.setNimbleDaoContract(nimbleDaoAddr2, { from: network});
            await nimbleStorage.setContracts(feeHandlerAddr2, matchingEngineAddr2, { from: network });
            await nimbleStorage.setNetworkContract(networkAddr2, { from: admin});

            let result= await nimbleStorage.getContracts();
            Helper.assertEqualArray(result.nimbleDaoAddresses, [nimbleDaoAddr2, nimbleDaoAddr], "unexpected dao history");
            Helper.assertEqualArray(result.nimbleMatchingEngineAddresses, [matchingEngineAddr2, matchingEngineAddr], "unexpected match engine history");
            Helper.assertEqualArray(result.nimbleFeeHandlerAddresses, [feeHandlerAddr2, feeHandlerAddr], "unexpected fee handler history");
            Helper.assertEqualArray(result.nimbleNetworkAddresses, [networkAddr2, network], "unexpected network history");

            // reset network contract
            await nimbleStorage.setNetworkContract(network, { from: admin});
        });

        it("should enable setting an empty dao contract", async function(){
            await nimbleStorage.setNimbleDaoContract(zeroAddress, {from: network});

            let rxContracts = await nimbleStorage.getContracts();

            assert.equal(rxContracts.nimbleDaoAddresses[0], zeroAddress);
        });
    });

    describe("test adding / removing proxy.", async() => {
        let proxy1 = accounts[9];
        let proxy2 = accounts[8];
        let proxy3 = accounts[7];
        let network = accounts[3];
        let tempStorage;

        beforeEach("create storage", async() => {
            nimbleStorage= await nwHelper.setupStorage(admin);
            await nimbleStorage.setNetworkContract(network, {from: admin});
        });

        it("test can add max two proxies", async() => {
            await nimbleStorage.addNimbleProxy(proxy1, maxProxies, {from: network});
            await nimbleStorage.addNimbleProxy(proxy2, maxProxies, {from: network});

            assert(await nimbleStorage.isNimbleProxyAdded(), "proxy is not added");

            await expectRevert(
                nimbleStorage.addNimbleProxy(proxy3, maxProxies, {from: network}),
                "max nimbleProxies limit reached"
            );

            proxies = await nimbleStorage.getNimbleProxies();
            Helper.assertEqualArray(proxies, [proxy1, proxy2], "unexpected proxies");
        });

        it("test remove proxy revert if not added", async() => {
            await nimbleStorage.addNimbleProxy(proxy2, maxProxies, {from: network});
            await expectRevert(
                nimbleStorage.removeNimbleProxy(proxy1, {from: network}),
                "nimbleProxy not found"
            );
            await nimbleStorage.addNimbleProxy(proxy1, maxProxies, {from: network});
            await nimbleStorage.removeNimbleProxy(proxy1, {from: network});
        });

        it("test only admin can add proxies", async() => {
            await expectRevert(
                nimbleStorage.addNimbleProxy(proxy1, new BN(100), {from: accounts[0]}),
                "only nimbleNetwork"
            );
        });

        it("test can't add proxy zero address", async() => {
            await expectRevert(
                nimbleStorage.addNimbleProxy(zeroAddress, maxProxies, {from: network}),
                "nimbleProxy 0"
            );
        });
    });

    describe("test adding reserves", async() => {
        before("deploy and setup nimbleStorage instance & 1 mock reserve", async() => {
            nimbleStorage = await nwHelper.setupStorage(admin);
            network = await NimbleNetwork.new(admin, nimbleStorage.address);
            await nimbleStorage.addOperator(operator, {from: admin});
            await nimbleStorage.setNetworkContract(network.address, {from: admin});
            await nimbleStorage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: admin});
            await nimbleStorage.setEntitledRebatePerReserveType(true, false, true, false, true, true, {from: admin});
            let result = await nwHelper.setupReserves(network, [], 1,0,0,0, accounts, admin, operator);
            reserveInstances = result.reserveInstances;
            numReserves = result.numAddedReserves * 1;
            for (const value of Object.values(reserveInstances)) {
                reserve = value;
            }
            token = await TestToken.new("test", "tst", 18);
        });

        describe("test cases where reserve has never been added", async() => {
            it("should revert for zero reserve id", async() => {
                await expectRevert(
                    nimbleStorage.addReserve(reserve.address, nwHelper.ZERO_RESERVE_ID, reserve.onChainType, reserve.rebateWallet, {from: operator}),
                    "reserveId = 0"
                );
            });

            it("should return no reserve data if reserve id does not exist", async() => {
                let reserveId = "0xaa00000026d1e94963c8b382ad00000000000000000000000000000000000000";
                let reserveData = await nimbleStorage.getReserveDetailsById(reserveId);
    
                Helper.assertEqual(reserveData.reserveAddress, "0x0000000000000000000000000000000000000000", "reserve address not 0x0");
                Helper.assertEqual(reserveData.rebateWallet, "0x0000000000000000000000000000000000000000", "rebate wallet not 0x0");
                Helper.assertEqual(reserveData.resType, "0", "reserve type not 0");
                Helper.assertEqual(reserveData.isFeeAccountedFlag, false, "isFeeAccountedFlag not false");
                Helper.assertEqual(reserveData.isEntitledRebateFlag, false, "isEntitledRebateFlag not false");

                let result = await nimbleStorage.getListedTokensByReserveId(reserveId);
                Helper.assertEqual(result.srcTokens.length, zeroBN, "src tokens not empty");
                Helper.assertEqual(result.destTokens.length, zeroBN, "dest tokens not empty");
            });

            it("should return no reserve data if reserve address does not exist", async() => {
                let reserveData = await nimbleStorage.getReserveDetailsByAddress(admin);
    
                Helper.assertEqual(reserveData.reserveId, nwHelper.ZERO_RESERVE_ID, "reserve ID not 0x0");
                Helper.assertEqual(reserveData.rebateWallet, "0x0000000000000000000000000000000000000000", "rebate wallet not 0x0");
                Helper.assertEqual(reserveData.resType, "0", "reserve type not 0");
                Helper.assertEqual(reserveData.isFeeAccountedFlag, false, "isFeeAccountedFlag not false");
                Helper.assertEqual(reserveData.isEntitledRebateFlag, false, "isEntitledRebateFlag not false");
            });

            it("should successfully add a reserve", async() => {
                // before adding reserve
                let reserves = await nimbleStorage.getReserves();
                Helper.assertEqual(reserves.length, zeroBN, "reserve arrays not equal");
                reserves = await nimbleStorage.getReservesPerType(ReserveType.FPR);
                Helper.assertEqual(reserves.length, zeroBN, "reserve arrays not equal");

                await nimbleStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});

                // after adding
                reserves = await nimbleStorage.getReserves();
                Helper.assertEqualArray(reserves, [reserve.address], "reserve arrays not equal");
                reserves = await nimbleStorage.getReservesPerType(reserve.onChainType);
                Helper.assertEqualArray(reserves, [reserve.reserveId], "reserve arrays not equal");

                let reserveAddresses = await nimbleStorage.getReserveAddressesByReserveId(reserve.reserveId);
                Helper.assertEqualArray(reserveAddresses, [reserve.address], "reserve arrays not equal");

                // reset
                await nimbleStorage.removeReserve(reserve.reserveId, 0, {from: operator});
                reserveAddresses = await nimbleStorage.getReserveAddressesByReserveId(reserve.reserveId);
                Helper.assertEqualArray(reserveAddresses, [zeroAddress, reserve.address], "reserve arrays not equal");
            });
        });

        describe("test cases for an already added reserve", async() => {
            before("add reserve", async() => {
                await nimbleStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
            });

            it("should revert for adding an existing reserve", async() => {
                await expectRevert(
                    nimbleStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator}),
                    "reserve has id"
                );
            });

            it("should revert for a new reserve with an already taken reserve id", async() => {
                let newReserve = await MockReserve.new();
                await expectRevert(
                    nimbleStorage.addReserve(newReserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator}),
                    "reserveId taken"
                );
            });

            it("should be able to re-add a reserve after its removal", async() => {
                await nimbleStorage.removeReserve(reserve.reserveId, zeroBN, {from: operator});
                let reserveAddresses = await nimbleStorage.getReserveAddressesByReserveId(reserve.reserveId);
                Helper.assertEqualArray(reserveAddresses, [zeroAddress, reserve.address, reserve.address], "reserve arrays not equal");
                await nimbleStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
                reserveAddresses = await nimbleStorage.getReserveAddressesByReserveId(reserve.reserveId);
                Helper.assertEqualArray(reserveAddresses, [reserve.address, reserve.address ,reserve.address], "reserve arrays not equal");
            });

            it("should be able to add a new reserve address for an existing id after removing an old one", async() => {
                let newReserve = await MockReserve.new();
                await nimbleStorage.removeReserve(reserve.reserveId, zeroBN, {from: operator});
                let reserveAddresses = await nimbleStorage.getReserveAddressesByReserveId(reserve.reserveId);
                Helper.assertEqualArray(reserveAddresses, [zeroAddress, reserve.address, reserve.address ,reserve.address], "reserve arrays not equal");
                await nimbleStorage.addReserve(newReserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
                reserveAddresses = await nimbleStorage.getReserveAddressesByReserveId(reserve.reserveId);
                Helper.assertEqualArray(reserveAddresses, [newReserve.address, reserve.address, reserve.address ,reserve.address], "reserve arrays not equal");
                let reserves = await nimbleStorage.getReserveAddressesByReserveId(reserve.reserveId);
                let actualNewReserveAddress = reserves[0];
                let actualOldReserveAddress = reserves[1];
                let reserveData = await nimbleStorage.getReserveDetailsById(reserve.reserveId);
                assert(reserveData.reserveAddress == newReserve.address, "new reserve address not equal to expected");
                let reserveIds = await nimbleStorage.getReservesPerType(reserve.onChainType);
                assert(reserveIds[0], reserve.reserveId, "reserveId not found in reservesPerType");

                Helper.assertEqual(newReserve.address, actualNewReserveAddress, "new reserve address not equal to expected");
                Helper.assertEqual(reserve.address, actualOldReserveAddress, "old reserve address not equal to expected");
            })
        });

        describe("test cases for set rebate wallet", async() => {
            let mockReserve;
            let mockReserveId;
            let mockRebateWallet;
            before("setup data", async() => {
                mockReserve = await MockReserve.new();
                mockReserveId = nwHelper.genReserveID(MOCK_ID, mockReserve.address).toLowerCase();
                mockRebateWallet = accounts[0];
            });

            it("test correct rebate wallet after add reserve", async() => {
                await nimbleStorage.addReserve(mockReserve.address, mockReserveId, ReserveType.FPR, mockRebateWallet, {from: operator});
                let reserveData = await nimbleStorage.getReserveDetailsById(mockReserveId);
                Helper.assertEqual(mockRebateWallet, reserveData.rebateWallet);
                let rebateWallets = await nimbleStorage.getRebateWalletsFromIds([mockReserveId]);
                Helper.assertEqual(1, rebateWallets.length);
                Helper.assertEqual(mockRebateWallet, rebateWallets[0]);
            })

            it("test correct rebate wallet after set new", async() => {
                let newRebateWallet = accounts[2];
                await nimbleStorage.setRebateWallet(mockReserveId, newRebateWallet, {from: operator});
                let reserveData = await nimbleStorage.getReserveDetailsById(mockReserveId);
                Helper.assertEqual(newRebateWallet, reserveData.rebateWallet);
                let rebateWallets = await nimbleStorage.getRebateWalletsFromIds([mockReserveId]);
                Helper.assertEqual(1, rebateWallets.length);
                Helper.assertEqual(newRebateWallet, rebateWallets[0]);
                // reset rebate wallet
                await nimbleStorage.setRebateWallet(mockReserveId, mockRebateWallet, {from: operator});
                reserveData = await nimbleStorage.getReserveDetailsById(mockReserveId);
                Helper.assertEqual(mockRebateWallet, reserveData.rebateWallet);
            });

            it("test rebate wallet == reserve address", async() => {
                let newReserve = await MockReserve.new();
                let newReserveId = nwHelper.genReserveID(MOCK_ID, newReserve.address);
                await nimbleStorage.addReserve(newReserve.address, newReserveId, ReserveType.FPR, newReserve.address, {from: operator});
                let reserveData = await nimbleStorage.getReserveDetailsById(newReserveId);
                Helper.assertEqual(newReserve.address, reserveData.rebateWallet);
                let rebateWallets = await nimbleStorage.getRebateWalletsFromIds([newReserveId]);
                Helper.assertEqual(1, rebateWallets.length);
                Helper.assertEqual(newReserve.address, rebateWallets[0]);
                // reset the same rebate wallet
                await nimbleStorage.setRebateWallet(newReserveId, newReserve.address, {from: operator});
                reserveData = await nimbleStorage.getReserveDetailsById(newReserveId);
                Helper.assertEqual(newReserve.address, reserveData.rebateWallet);
            });

            it("test get rebate wallets", async() => {
                // get empty list
                rebateWallets = await nimbleStorage.getRebateWalletsFromIds([]);
                Helper.assertEqual(0, rebateWallets.length);
                // get with 1 id
                rebateWallets = await nimbleStorage.getRebateWalletsFromIds([mockReserveId]);
                Helper.assertEqual(1, rebateWallets.length);
                Helper.assertEqual(mockRebateWallet, rebateWallets[0]);
                // get with 2 ids
                let newReserve = await MockReserve.new();
                let newRebateWallet = accounts[1];
                let newReserveId = nwHelper.genReserveID(MOCK_ID, newReserve.address);
                await nimbleStorage.addReserve(newReserve.address, newReserveId, ReserveType.FPR, newRebateWallet, {from: operator});
                rebateWallets = await nimbleStorage.getRebateWalletsFromIds([mockReserveId, newReserveId]);
                Helper.assertEqual(2, rebateWallets.length);
                Helper.assertEqual(mockRebateWallet, rebateWallets[0]);
                Helper.assertEqual(newRebateWallet, rebateWallets[1]);
                // get with same ids
                rebateWallets = await nimbleStorage.getRebateWalletsFromIds([mockReserveId, mockReserveId]);
                Helper.assertEqual(2, rebateWallets.length);
                Helper.assertEqual(mockRebateWallet, rebateWallets[0]);
                Helper.assertEqual(mockRebateWallet, rebateWallets[1]);
            });

            it("test should revert reserve id is 0", async() => {
                await expectRevert(
                    nimbleStorage.setRebateWallet(nwHelper.ZERO_RESERVE_ID, accounts[0], {from: operator}),
                    "reserveId = 0"
                );
            });

            it("test should revert rebate wallet is 0", async() => {
                let newReserveId = nwHelper.genReserveID(MOCK_ID, accounts[0]).toLowerCase();
                await expectRevert(
                    nimbleStorage.setRebateWallet(newReserveId, zeroAddress, {from: operator}),
                    "rebate wallet is 0"
                );
            });

            it("test should revert reserve id not found", async() => {
                let newReserveId = nwHelper.genReserveID(MOCK_ID, accounts[0]).toLowerCase();
                await expectRevert(
                    nimbleStorage.setRebateWallet(newReserveId, accounts[0], {from: operator}),
                    "reserveId not found"
                );
            });

            it("test should revert no reserve found for reserve id", async() => {
                let newReserve = await MockReserve.new();
                let newReserveId = nwHelper.genReserveID(MOCK_ID, newReserve.address).toLowerCase();
                // add reserve
                await nimbleStorage.addReserve(newReserve.address, newReserveId, ReserveType.FPR, accounts[0], {from: operator});
                // remove reserve
                await nimbleStorage.removeReserve(newReserveId, 0, {from: operator});
                await expectRevert(
                    nimbleStorage.setRebateWallet(newReserveId, accounts[0], {from: operator}),
                    "no reserve associated"
                );
            });
        });

        
        it("test get reserve method", async() => {
            // setup storage and reserve
            let nimbleStorage = await nwHelper.setupStorage(admin);
            let network = await NimbleNetwork.new(admin, nimbleStorage.address);
            await nimbleStorage.addOperator(operator, {from: admin});
            await nimbleStorage.setNetworkContract(network.address, {from: admin});
            await nimbleStorage.setFeeAccountedPerReserveType(true, true, true, true, false, true, {from: admin});
            await nimbleStorage.setEntitledRebatePerReserveType(true, true, true, true, false, true, {from: admin});
            let reserveTypes = Object.values(ReserveType);
            // ignore ReserveType.NONE
            reserveTypes = reserveTypes.slice(1,);
            let reserveAddresses= [];
            let reserveIds = [];
            let reserveIdsPerType = {};
            let reserveFeeData = [];
            let reserveRebateData = [];
            let reserveRebateWalletData = [];

            // set up 3 mock reserves for each reserve type
            for (const resType of reserveTypes) {
                reserveIdsPerType[resType] = [];
                for (let i = 0; i < 3; i++) {
                    let reserve = await MockReserve.new();
                    let reserveId = nwHelper.genReserveID(MOCK_ID, reserve.address).toLowerCase();
                    reserveAddresses.push(reserve.address);
                    reserveIds.push(reserveId);
                    reserveFeeData.push(resType != ReserveType.CUSTOM);
                    reserveRebateData.push(resType != ReserveType.CUSTOM);
                    reserveRebateWalletData.push(reserve.address);
                    reserveIdsPerType[resType].push(reserveId);
                    await nimbleStorage.addReserve(reserve.address, reserveId, resType, reserve.address, {from: operator});
                    assert(await nimbleStorage.getReserveId(reserve.address) == reserveId, "unexpected reserveId");
                    let reserveData = await nimbleStorage.getReserveDetailsById(reserveId);
                    assert(reserveData.reserveAddress == reserve.address, "unexpected reserve address");
                    assert(reserveData.rebateWallet == reserve.address, "unexpected rebate address");
                    assert(reserveData.resType == resType, "unexpected reserve on chain type");
                    assert(reserveData.isFeeAccountedFlag == (resType != ReserveType.CUSTOM), "unexpected fee accounted flag");
                    assert(reserveData.isEntitledRebateFlag == (resType != ReserveType.CUSTOM), "unexpected entitled rebate flag");
                    // list ethToToken
                    await nimbleStorage.listPairForReserve(reserveId, token.address, true, false, true, {from: operator});
                }
            }

            Helper.assertEqualArray(await nimbleStorage.getReserves(), reserveAddresses, "unexpected reserve addresses");
            for (const resType of reserveTypes) {
                Helper.assertEqualArray(await nimbleStorage.getReservesPerType(resType), reserveIdsPerType[resType], "unexpected reserveId");
            }
            Helper.assertEqualArray(await nimbleStorage.getReserveIdsFromAddresses(reserveAddresses), reserveIds);
            Helper.assertEqualArray(await nimbleStorage.getReserveAddressesFromIds(reserveIds), reserveAddresses);
            Helper.assertEqualArray(await nimbleStorage.getFeeAccountedData(reserveIds), reserveFeeData);
            Helper.assertEqualArray(await nimbleStorage.getEntitledRebateData(reserveIds), reserveRebateData);
            let feesRebatesAndAddresses = await nimbleStorage.getReservesData(reserveIds, ethAddress, token.address);
            assert(feesRebatesAndAddresses.areAllReservesListed, "reserveIds is invalid for eth to token")
            Helper.assertEqualArray(feesRebatesAndAddresses.feeAccountedArr, reserveFeeData);
            Helper.assertEqualArray(feesRebatesAndAddresses.entitledRebateArr, reserveRebateData);
            Helper.assertEqualArray(feesRebatesAndAddresses.reserveAddresses, reserveAddresses);
        });
    });

    describe("test listing token pair and removing reserve", async() => {
        before("deploy and setup nimbleStorage instance & add 2 mock reserves, & 1 mock token", async() => {
            nimbleStorage = await nwHelper.setupStorage(admin);
            network = await NimbleNetwork.new(admin, nimbleStorage.address);
            await nimbleStorage.addOperator(operator, {from: admin});
            await nimbleStorage.setNetworkContract(network.address, {from: admin});
            await nimbleStorage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: admin});
            await nimbleStorage.setEntitledRebatePerReserveType(true, false, true, false, true, true, {from: admin});
            //init 2 mock reserve
            let result = await nwHelper.setupReserves(network, [], 2,0,0,0, accounts, admin, operator);
            reserveInstances = result.reserveInstances;
            numReserves = result.numAddedReserves * 1;
            for (const reserve of Object.values(reserveInstances)) {
                await nimbleStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
            }

            //create token
            token = await TestToken.new("test", "tst", 18);
        });

        afterEach("delist token pair on both sides", async() => {
            for (const reserve of Object.values(reserveInstances)) {
                await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, false, {from: operator});
            }
        });

        it("should revert when listing token for non-reserve", async() => {
            let mockReserveId = nwHelper.genReserveID(MOCK_ID, user);
            await expectRevert(
                nimbleStorage.listPairForReserve(mockReserveId, token.address, true, true, true, {from: operator}),
                "reserveId not found"
           );
        });

        it("should revert when removing non-reserve", async() => {
            await expectRevert(
                nimbleStorage.removeReserve(nwHelper.genReserveID(MOCK_ID, user).toLowerCase(), zeroBN, {from : operator}),
                "reserveId not found"
           );
        });

        it("should revert when removing reserve twice", async() => {
            let anyWallet = accounts[0];
            let mockReserve = await MockReserve.new();
            let mockReserveId = nwHelper.genReserveID(MOCK_ID, mockReserve.address);
            await nimbleStorage.addReserve(mockReserve.address, mockReserveId, ReserveType.FPR, anyWallet, {from: operator});
            await nimbleStorage.removeReserve(mockReserveId, 0, {from : operator}),
            await expectRevert(
                nimbleStorage.removeReserve(mockReserveId, 0, {from : operator}),
                "reserve not found"
           );
        });

        it("should revert if reserveId is 0 when removing reserve", async() => {
            nimbleNetworkHistory = await NimbleHistory.new(admin);
            nimbleFeeHandlerHistory = await NimbleHistory.new(admin);
            nimbleDaoHistory = await NimbleHistory.new(admin);
            nimbleMatchingEngineHistory = await NimbleHistory.new(admin);
            let mockStorage = await MockStorage.new(
                admin,
                nimbleNetworkHistory.address,
                nimbleFeeHandlerHistory.address,
                nimbleDaoHistory.address,
                nimbleMatchingEngineHistory.address,
                );
            await nimbleNetworkHistory.setStorageContract(mockStorage.address, {from: admin});
            await nimbleFeeHandlerHistory.setStorageContract(mockStorage.address, {from: admin});
            await nimbleDaoHistory.setStorageContract(mockStorage.address, {from: admin});
            await nimbleMatchingEngineHistory.setStorageContract(mockStorage.address, {from: admin});
            let mockNetwork = await NimbleNetwork.new(admin, mockStorage.address);
            await mockStorage.addOperator(operator, {from: admin});
            await mockStorage.setNetworkContract(mockNetwork.address, {from: admin});
            await mockStorage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: admin});
            await mockStorage.setEntitledRebatePerReserveType(true, false, true, false, true, true, {from: admin});
            for (const value of Object.values(reserveInstances)) {
                reserve = value;
            }
            await mockStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
            await mockStorage.setReserveId(reserve.address, nwHelper.ZERO_RESERVE_ID);
            await expectRevert(
                mockStorage.removeReserve(reserve.reserveId, zeroBN, {from: operator}),
                "reserve's existing reserveId is 0"
            );
        });

        it("should have reserveId reset to zero after removal", async() => {
            await nimbleStorage.removeReserve(reserve.reserveId, zeroBN, {from: operator});
            let reserveId = await nimbleStorage.getReserveId(reserve.address);
            Helper.assertEqual(reserveId, nwHelper.ZERO_RESERVE_ID, "reserve id was not reset to zero");

            //reset
            await nimbleStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
        });

        it("should list reserves and test get reserve addresses", async() => {
            let reserveAddresses = [];
            for (let reserve of Object.values(reserveInstances)) {
                await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, true, {from: operator});
                reserveAddresses.push(reserve.address);
            }
            // only 1 index
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 0, 0);
            Helper.assertEqual(result.length, 1, "T2E should be listed");
            Helper.assertEqual(result[0], reserveAddresses[0], "T2E should be listed");
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 1, 1);
            Helper.assertEqual(result.length, 1, "T2E should be listed");
            Helper.assertEqual(result[0], reserveAddresses[1], "T2E should be listed");
            // 2 indices
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 0, 1);
            Helper.assertEqual(result.length, 2, "T2E should be listed");
            Helper.assertEqual(result[0], reserveAddresses[0], "T2E should be listed");
            Helper.assertEqual(result[1], reserveAddresses[1], "T2E should be listed");
            // end index is big
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 0, 3);
            Helper.assertEqual(result.length, 2, "T2E should be listed");
            Helper.assertEqual(result[0], reserveAddresses[0], "T2E should be listed");
            Helper.assertEqual(result[1], reserveAddresses[1], "T2E should be listed");
            // start + end indices are big
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 3, 4);
            Helper.assertEqual(result.length, zeroBN);
            // start index > end index
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 1, 0);
            Helper.assertEqual(result.length, zeroBN);
            // delist for both side
            for (let reserve of Object.values(reserveInstances)) {
                await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, false, {from: operator});
            }
        });

        it("should list E2T side with 2 reserve", async() => {
            let reserveIds = [];
            for (let reserve of Object.values(reserveInstances)) {
                await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, false, true, {from: operator});
                reserveIds.push(reserve.reserveId);
            }
            let result = await nimbleStorage.getReserveIdsPerTokenSrc(token.address);
            Helper.assertEqual(result.length, zeroBN, "T2E should not be listed");
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 0, 1);
            Helper.assertEqual(result.length, zeroBN, "T2E should not be listed");

            result = await nimbleStorage.getReserveIdsPerTokenDest(token.address);
            Helper.assertEqualArray(result, reserveIds, "E2T should be listed");

            for (let reserve of Object.values(reserveInstances)) {
                result = await nimbleStorage.getListedTokensByReserveId(reserve.reserveId);
                Helper.assertEqual(result.srcTokens.length, zeroBN, "T2E should not be listed");
                Helper.assertEqual(result.destTokens[0], token.address, "E2T should be listed");
            };

            // delist for both side
            for (let reserve of Object.values(reserveInstances)) {
                await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, false, {from: operator});
            }
        });

        it("should list E2T side only", async() => {
            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, false, true, {from: operator});
            let result = await nimbleStorage.getReserveIdsPerTokenSrc(token.address);
            Helper.assertEqual(result.length, zeroBN, "T2E should not be listed");
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 0, 1);
            Helper.assertEqual(result.length, zeroBN, "T2E should not be listed");

            result = await nimbleStorage.getReserveIdsPerTokenDest(token.address);
            Helper.assertEqual(result[0], reserve.reserveId, "E2T should be listed");

            result = await nimbleStorage.getListedTokensByReserveId(reserve.reserveId);
            Helper.assertEqual(result.srcTokens.length, zeroBN, "T2E should not be listed");
            Helper.assertEqual(result.destTokens[0], token.address, "E2T should be listed");

            result = await nimbleStorage.getReservesData([reserve.reserveId], token.address, ethAddress);
            assert(!result.areAllReservesListed, "getReservesData for T2E should not be valid");
            result = await nimbleStorage.getReservesData([reserve.reserveId], ethAddress, token.address);
            assert(result.areAllReservesListed, "getReservesData for E2T should be valid");
        });

        it("should list T2E side only", async() => {
            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, false, true, true, {from: operator});
            let result = await nimbleStorage.getReserveIdsPerTokenSrc(token.address);
            Helper.assertEqual(result[0], reserve.reserveId, "T2E should be listed");
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 0, 0);
            Helper.assertEqual(result[0], reserve.address, "T2E should be listed");

            result = await nimbleStorage.getReserveIdsPerTokenDest(token.address);
            Helper.assertEqual(result.length, zeroBN, "E2T should not be listed");

            result = await nimbleStorage.getListedTokensByReserveId(reserve.reserveId);
            Helper.assertEqual(result.srcTokens[0], token.address, "T2E should be listed");
            Helper.assertEqual(result.destTokens.length, zeroBN, "E2T should not be listed");

            result = await nimbleStorage.getReservesData([reserve.reserveId], token.address, ethAddress);
            assert(result.areAllReservesListed, "getReservesData for T2E should be valid");
            result = await nimbleStorage.getReservesData([reserve.reserveId], ethAddress, token.address);
            assert(!result.areAllReservesListed, "getReservesData for E2T should not be valid");
        });

        it("should list both T2E and E2T", async() => {
            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, true, {from: operator});
            let result = await nimbleStorage.getReserveIdsPerTokenSrc(token.address);
            Helper.assertEqual(result[0], reserve.reserveId, "T2E should be listed");
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 0, 0);
            Helper.assertEqual(result[0], reserve.address, "T2E should be listed");

            result = await nimbleStorage.getReserveIdsPerTokenDest(token.address);
            Helper.assertEqual(result[0], reserve.reserveId, "E2T should be listed");

            result = await nimbleStorage.getListedTokensByReserveId(reserve.reserveId);
            Helper.assertEqual(result.srcTokens[0], token.address, "T2E should be listed");
            Helper.assertEqual(result.destTokens[0], token.address, "E2T should be listed");

            result = await nimbleStorage.getReservesData([reserve.reserveId], ethAddress, token.address);
            assert(result.areAllReservesListed, "getReservesData for E2T should be valid");
            result = await nimbleStorage.getReservesData([reserve.reserveId], token.address, ethAddress);
            assert(result.areAllReservesListed, "getReservesData for T2E should be valid");
        });

        it("should delist T2E side only", async() => {
            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, true, {from: operator});
            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, false, true, false, {from: operator});
            let result = await nimbleStorage.getReserveIdsPerTokenSrc(token.address);
            Helper.assertEqual(result.length, zeroBN, "T2E should not be listed");
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 0, 0);
            Helper.assertEqual(result.length, zeroBN, "T2E should not be listed");

            result = await nimbleStorage.getReserveIdsPerTokenDest(token.address);
            Helper.assertEqual(result[0], reserve.reserveId, "E2T should be listed");

            result = await nimbleStorage.getListedTokensByReserveId(reserve.reserveId);
            Helper.assertEqual(result.srcTokens.length, zeroBN, "T2E should not be listed");
            Helper.assertEqual(result.destTokens[0], token.address, "E2T should be listed");

            result = await nimbleStorage.getReservesData([reserve.reserveId], token.address, ethAddress);
            assert(!result.areAllReservesListed, "getReservesData for T2E should not be valid");
            result = await nimbleStorage.getReservesData([reserve.reserveId], ethAddress, token.address);
            assert(result.areAllReservesListed, "getReservesData for E2T should be valid");
        });

        it("should delist E2T side only", async() => {
            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, true, {from: operator});
            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, false, false, {from: operator});
            let result = await nimbleStorage.getReserveIdsPerTokenSrc(token.address);
            Helper.assertEqual(result[0], reserve.reserveId, "T2E should be listed");
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 0, 0);
            Helper.assertEqual(result[0], reserve.address, "T2E should be listed");

            result = await nimbleStorage.getReserveIdsPerTokenDest(token.address);
            Helper.assertEqual(result.length, zeroBN, "E2T should not be listed");

            result = await nimbleStorage.getListedTokensByReserveId(reserve.reserveId);
            Helper.assertEqual(result.srcTokens[0], token.address, "T2E should be listed");
            Helper.assertEqual(result.destTokens.length, zeroBN, "E2T should not be listed");

            result = await nimbleStorage.getReservesData([reserve.reserveId], token.address, ethAddress);
            assert(result.areAllReservesListed, "getReservesData for T2E should be valid");
            result = await nimbleStorage.getReservesData([reserve.reserveId], ethAddress, token.address);
            assert(!result.areAllReservesListed, "getReservesData for E2T should not be valid");
        });

        it("should delist both T2E and E2T", async() => {
            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, true, {from: operator});
            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, false, {from: operator});
            let result = await nimbleStorage.getReserveIdsPerTokenSrc(token.address);
            Helper.assertEqual(result.length, zeroBN, "T2E should not be listed");
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 0, 0);
            Helper.assertEqual(result[0], zeroBN, "T2E should not be listed");

            result = await nimbleStorage.getReserveIdsPerTokenDest(token.address);
            Helper.assertEqual(result.length, zeroBN, "E2T should not be listed");

            result = await nimbleStorage.getListedTokensByReserveId(reserve.reserveId);
            Helper.assertEqual(result.srcTokens.length, zeroBN, "T2E should not be listed");
            Helper.assertEqual(result.destTokens.length, zeroBN, "E2T should not be listed");
        });

        it("should revert for listing twice (approving)", async() => {
            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, true, {from: operator});
            await expectRevert.unspecified(
                nimbleStorage.listPairForReserve(reserve.reserveId, token.address, true, true, true, {from: operator})
            )
            let result = await nimbleStorage.getReserveIdsPerTokenSrc(token.address);
            Helper.assertEqual(result[0], reserve.reserveId, "T2E should be listed");
            result = await nimbleStorage.getReserveAddressesPerTokenSrc(token.address, 0, 0);
            Helper.assertEqual(result[0], reserve.address, "T2E should be listed");

            result = await nimbleStorage.getReserveIdsPerTokenDest(token.address);
            Helper.assertEqual(result[0], reserve.reserveId, "E2T should be listed");
        });

        it("should revert when list tokens for reserve that has been removed", async() => {
            let anyWallet = accounts[0];
            let mockReserve = await MockReserve.new();
            let mockReserveId = nwHelper.genReserveID(MOCK_ID, mockReserve.address).toLowerCase();
            await nimbleStorage.addReserve(mockReserve.address, mockReserveId, ReserveType.FPR, anyWallet, {from: operator});
            await nimbleStorage.removeReserve(mockReserveId, 0, {from : operator}),
            await expectRevert(
                nimbleStorage.listPairForReserve(mockReserveId, token.address, true, true, true, {from: operator}),
                "reserve = 0"
           );
        });

        it("should delist all tokens automatically when only removeReserve is called", async() => {
            let token2 = await TestToken.new("test2", "tst2", 18);
            let token3 = await TestToken.new("test3", "tst3", 18);
            // 1 token for only T2E, 1 token for both side, 1 token for only E2T
            let srcTokenAddresses = [token.address, token2.address];
            let destTokenAddresses = [token2.address, token3.address];
            let allTokenAddresses = [token.address, token2.address, token3.address];
            let result;

            await nimbleStorage.listPairForReserve(reserve.reserveId, token.address, false, true, true, {from: operator});
            await nimbleStorage.listPairForReserve(reserve.reserveId, token2.address, true, true, true, {from: operator});
            await nimbleStorage.listPairForReserve(reserve.reserveId, token3.address, true, false, true, {from: operator});

            for (let tokenAdd of Object.values(srcTokenAddresses)) {
                result = await nimbleStorage.getReserveIdsPerTokenSrc(tokenAdd);
                Helper.assertEqual(result[0], reserve.reserveId, "T2E should be listed");
            }

            for (let tokenAdd of Object.values(destTokenAddresses)) {
                result = await nimbleStorage.getReserveIdsPerTokenDest(tokenAdd);
                Helper.assertEqual(result[0], reserve.reserveId, "E2T should be listed");
            }

            result = await nimbleStorage.getListedTokensByReserveId(reserve.reserveId);
            Helper.assertEqualArray(result.srcTokens, srcTokenAddresses, "src tokens listed not the same");
            Helper.assertEqualArray(result.destTokens, destTokenAddresses, "dest tokens listed not the same");

            await nimbleStorage.removeReserve(reserve.reserveId, 0, {from: operator});

            for (let tokenAdd of Object.values(allTokenAddresses)) {
                result = await nimbleStorage.getReserveIdsPerTokenSrc(tokenAdd);
                Helper.assertEqual(result.length, zeroBN, "T2E should not be listed");
                result = await nimbleStorage.getReserveIdsPerTokenDest(tokenAdd);
                Helper.assertEqual(result.length, zeroBN, "E2T should not be listed");
            }
            result = await nimbleStorage.getListedTokensByReserveId(reserve.reserveId);
            Helper.assertEqual(result.srcTokens.length, zeroBN, "src tokens listed not the same");
            Helper.assertEqual(result.destTokens.length, zeroBN, "dest tokens listed not the same");

            // reset
            await nimbleStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
        });

        it("should have reserveId and reserve address removed from reservesPerType and getReserves respectively", async() => {
            // remove all existing reserves
            for (const reserve of Object.values(reserveInstances)) {
                await nimbleStorage.removeReserve(reserve.reserveId, 0, {from : operator});
            }

            // add reserve for each type
            let anyWallet = accounts[0];
            let mockReserve;
            let mockReserves = [];
            let mockReserveId;
            let mockReserveIds = [];
            let reserveTypes = Object.values(ReserveType);
            // ignore ReserveType.NONE
            reserveTypes = reserveTypes.slice(1,);
            for (const resType of reserveTypes) {
                mockReserve = await MockReserve.new();
                mockReserves.push(mockReserve.address);
                mockReserveId = nwHelper.genReserveID(MOCK_ID, mockReserve.address);
                mockReserveIds.push(mockReserveId);
                await nimbleStorage.addReserve(mockReserve.address, mockReserveId, resType, anyWallet, {from: operator});
                Helper.assertEqualArray(await nimbleStorage.getReservesPerType(resType), [mockReserveId.toLowerCase()], "reserves per type not equal");
            }

            let allReserves = await nimbleStorage.getReserves();
            Helper.assertEqualArray(allReserves, mockReserves, "all reserves not equal");

            // remove each reserve
            for (let i = reserveTypes.length - 1; i >= 0; i--) {
                allReserves.pop();
                await nimbleStorage.removeReserve(mockReserveIds[i], 0, {from: operator});
                Helper.assertEqualArray(await nimbleStorage.getReserves(), allReserves, "reserves not equal");
                Helper.assertEqual((await nimbleStorage.getReservesPerType(reserveTypes[i])).length, zeroBN, "reserves per type not equal");
            }

            // reset
            for (const reserve of Object.values(reserveInstances)) {
                await nimbleStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
            }
        });
    });


    describe("test onlyAdmin and onlyOperator permissions", async() => {
        before("deploy storage instance, 1 mock reserve and 1 mock token", async() => {
            storage = await nwHelper.setupStorage(admin);
            network = await NimbleNetwork.new(admin, storage.address);
            await storage.addOperator(operator, {from: admin});
            await storage.setNetworkContract(network.address, {from:admin});
            token = await TestToken.new("test", "tst", 18);

            //init 1 mock reserve
            let result = await nwHelper.setupReserves(network, [], 1,0,0,0, accounts, admin, operator);
            reserveInstances = result.reserveInstances;
            numReserves = result.numAddedReserves * 1;
            for (const value of Object.values(reserveInstances)) {
                reserve = value;
            }
        });

        it("should not have unauthorized personnel set fee accounted data", async() => {
            await expectRevert(
                storage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: operator}),
                "only admin"
            );

            await expectRevert(
                storage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: user}),
                "only admin"
            );
        });

        it("should have admin set fee accounted data", async() => {
            await storage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: admin});
        });

        it("should not have unauthorized personnel set entitled rebate data", async() => {
            await expectRevert(
                storage.setEntitledRebatePerReserveType(true, false, true, false, true, true, {from: operator}),
                "only admin"
            );

            await expectRevert(
                storage.setEntitledRebatePerReserveType(true, false, true, false, true, true, {from: user}),
                "only admin"
            );
        });

        it("should have admin set entitled rebate data", async() => {
            await storage.setEntitledRebatePerReserveType(true, false, true, false, true, true, {from: admin});
        });

        it("should not have unauthorized personnel add reserve", async() => {
            await expectRevert(
                storage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: user}),
                "only operator"
            );

            await expectRevert(
                storage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: admin}),
                "only operator"
            );
        });

        it("should have operator adds reserve", async() => {
            await storage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: admin});
            await storage.setEntitledRebatePerReserveType(true, false, true, false, true, true, {from: admin});
            await storage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
        });

        it("should not have unauthorized personnel remove reserve", async() => {
            await expectRevert(
                storage.removeReserve(reserve.reserveId, 0, {from: user}),
                "only operator"
            );

            await expectRevert(
                storage.removeReserve(reserve.reserveId, 0, {from: admin}),
                "only operator"
            );
        });

        it("should have operator removes reserve", async() => {
            await storage.removeReserve(reserve.reserveId, 0, {from: operator});
        });
    });

    describe("test adding reserves", async() => {
        let tempNetwork;
        before("deploy and setup matchingEngine instance & 1 mock reserve", async() => {
            tempStorage = await nwHelper.setupStorage(admin);
            tempNetwork = await NimbleNetwork.new(admin, tempStorage.address);
            await tempStorage.addOperator(operator, {from: admin});
            await tempStorage.setNetworkContract(tempNetwork.address, {from: admin});

            //init 1 mock reserve
            let result = await nwHelper.setupReserves(tempNetwork, [], 1,0,0,0, accounts, admin, operator);
            reserveInstances = result.reserveInstances;
            numReserves = result.numAddedReserves * 1;
            for (const value of Object.values(reserveInstances)) {
                reserve = value;
            }
        });

        describe("test cases where reserve has never been added", async() => {
            it("should revert for NONE reserve type", async() => {
                await expectRevert(
                    tempStorage.addReserve(reserve.address, reserve.reserveId, 0, reserve.rebateWallet, {from: operator}),
                    "bad reserve type"
                );
            });

            it("should revert for LAST reserve type", async() => {
                await expectRevert(
                    tempStorage.addReserve(reserve.address, reserve.reserveId, 7, reserve.rebateWallet, {from: operator}),
                    "bad reserve type"
                );
            });

            it("should revert for valid reserve because fee accounted data not set", async() => {
                await expectRevert(
                    tempStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator}),
                    "fee accounted data not set"
                );
            });

            it("should revert when rebate is 0", async() => {
                let newReserve = await MockReserve.new();
                await expectRevert(
                    nimbleStorage.addReserve(newReserve.address, reserve.reserveId, reserve.onChainType, zeroAddress, {from: operator}),
                    "rebate wallet is 0"
                );
            });

            it("should revert for valid reserve because entitled rebate data not set", async() => {
                await tempStorage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: admin});
                await expectRevert(
                    tempStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator}),
                    "entitled rebate data not set"
                );
            });
        });

        describe("test cases for an already added reserve", async() => {
            before("add fee accounted and entitled rebate data and add reserve", async() => {
                await tempStorage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: admin});
                await tempStorage.setEntitledRebatePerReserveType(true, false, true, false, true, true, {from: admin});
                await tempStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
            });

            it("should be able to re-add a reserve after its removal", async() => {
                await tempStorage.removeReserve(reserve.reserveId, 0, {from: operator});
                await tempStorage.addReserve(reserve.address, reserve.reserveId, reserve.onChainType, reserve.rebateWallet, {from: operator});
            });
        });
    });

    describe("test fee accounted data per reserve", async() => {
        let token;
        let reserveInstances;
        let result;
        let totalReserveTypes = 6;
        let allReserveIDs = [];

        before("setup matchingEngine instance reserve per each reserve type", async() => {
            storage = await nwHelper.setupStorage(admin);
            network = await NimbleNetwork.new(admin, storage.address);
            await storage.addOperator(operator, {from: admin});
            await storage.setNetworkContract(network.address, {from: admin});
            await storage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: admin});
            await storage.setEntitledRebatePerReserveType(true, true, true, false, true, true, {from: admin});

            //init token
            token = await TestToken.new("Token", "TOK", 18);

            result = await nwHelper.setupReserves(network, [token], totalReserveTypes, 0, 0, 0, accounts, admin, operator);
            reserveInstances = result.reserveInstances;

            //add reserves for all types, store reserve IDs in array
            let type = 1;
            for (reserve of Object.values(reserveInstances)) {
                await storage.addReserve(reserve.address, reserve.reserveId, type, reserve.rebateWallet, {from: operator});
                await storage.listPairForReserve(reserve.reserveId, token.address, true, false, true, {from: operator});
                allReserveIDs.push(reserve.reserveId);
                type++;
            }
        });

        it("get reserve details while modifying fee accounted per type. see as expected", async() => {
            let pay = [];
            let numCombinations = totalReserveTypes ** 2;
            //generate different pay combinations
            for (let i = 0; i < numCombinations; i++) {
                pay = [];
                let j = i;
                for (let n = 1; j > 0; j = j >> 1, n = n * 2) {
                    pay.push(j % 2 == 1);
                }
                let originalResLength = result.length;
                //append the rest of pay array with false values
                for (let k = 0; k < totalReserveTypes - originalResLength; k++) {
                    pay = pay.concat([false]);
                }

                await storage.setFeeAccountedPerReserveType(pay[0], pay[1], pay[2], pay[3], pay[4], pay[5], {from: admin});
                let index = 0;
                for (reserve of Object.values(reserveInstances)) {
                    let actualResult = await storage.getReserveDetailsByAddress(reserve.address);
                    Helper.assertEqual(reserve.reserveId, actualResult.reserveId);
                    Helper.assertEqual(reserve.rebateWallet, actualResult.rebateWallet);
                    Helper.assertEqual(index + 1, actualResult.resType);
                    Helper.assertEqual(pay[index], actualResult.isFeeAccountedFlag);

                    actualResult = await storage.getReserveDetailsById(reserve.reserveId);
                    Helper.assertEqual(reserve.address, actualResult.reserveAddress);
                    Helper.assertEqual(reserve.rebateWallet, actualResult.rebateWallet);
                    Helper.assertEqual(index + 1, actualResult.resType);
                    Helper.assertEqual(pay[index], actualResult.isFeeAccountedFlag);
                    ++index;
                }

                actualResult = await storage.getFeeAccountedData(allReserveIDs);
                for (let index = 0; index < pay.length; index++) {
                    Helper.assertEqual(pay[index], actualResult[index]);
                }
                
                actualResult = await storage.getReservesData(allReserveIDs, ethAddress, token.address);
                assert(actualResult.areAllReservesListed, "invalid reserveIds for pair");
                for (let index = 0; index < pay.length; index++) {
                    Helper.assertEqual(pay[index], actualResult.feeAccountedArr[index]);
                }
            }
        });
    });

    describe("test entitled rebate data per reserve", async() => {
        let token;
        let reserveInstances;
        let result;
        let totalReserveTypes = 6;
        let allReserveIDs = [];

        before("setup matchingEngine instance", async() => {
            storage = await nwHelper.setupStorage(admin);
            network = await NimbleNetwork.new(admin, storage.address);
            await storage.setNetworkContract(network.address, {from: admin});
            await storage.addOperator(operator, {from: admin});
        });

        it("should revert when trying to set entitled rebate data if fee paying data not set yet", async() => {
            await expectRevert(
                storage.setEntitledRebatePerReserveType(true, true, true, true, true, true, {from: admin}),
                "fee accounted data not set"
            );
        });

        it("should revert if fpr is not fee accounted, but setting rebate entitlement to be true", async() => {
            await storage.setFeeAccountedPerReserveType(false, true, true, true, true, true, {from: admin});
            await expectRevert(
                storage.setEntitledRebatePerReserveType(true, true, true, true, true, true, {from: admin}),
                "fpr not fee accounted"
            );
        });

        it("should revert if apr is not fee accounted, but setting rebate entitlement to be true", async() => {
            await storage.setFeeAccountedPerReserveType(true, false, true, true, true, true, {from: admin});
            await expectRevert(
                storage.setEntitledRebatePerReserveType(true, true, true, true, true, true, {from: admin}),
                "apr not fee accounted"
            );
        });
        
        it("should revert if bridge is not fee accounted, but setting rebate entitlement to be true", async() => {
            await storage.setFeeAccountedPerReserveType(true, true, false, true, true, true, {from: admin});
            await expectRevert(
                storage.setEntitledRebatePerReserveType(true, true, true, true, true, true, {from: admin}),
                "bridge not fee accounted"
            );
        });

        it("should revert if utility is not fee accounted, but setting rebate entitlement to be true", async() => {
            await storage.setFeeAccountedPerReserveType(true, true, true, false, true, true, {from: admin});
            await expectRevert(
                storage.setEntitledRebatePerReserveType(true, true, true, true, true, true, {from: admin}),
                "utility not fee accounted"
            );
        });

        it("should revert if custom is not fee accounted, but setting rebate entitlement to be true", async() => {
            await storage.setFeeAccountedPerReserveType(true, true, true, true, false, true, {from: admin});
            await expectRevert(
                storage.setEntitledRebatePerReserveType(true, true, true, true, true, true, {from: admin}),
                "custom not fee accounted"
            );
        });
        
        it("should revert if orderbook is not fee accounted, but setting rebate entitlement to be true", async() => {
            await storage.setFeeAccountedPerReserveType(true, true, true, true, true, false, {from: admin});
            await expectRevert(
                storage.setEntitledRebatePerReserveType(true, true, true, true, true, true, {from: admin}),
                "orderbook not fee accounted"
            );
        });

        it("get reserve details while modifying entitled rebate per type. see as expected", async() => {
            await storage.setFeeAccountedPerReserveType(true, true, true, true, true, true, {from: admin});
            await storage.setEntitledRebatePerReserveType(true, true, true, true, true, true, {from: admin});

            //init token
            token = await TestToken.new("Token", "TOK", 18);

            result = await nwHelper.setupReserves(network, [token], totalReserveTypes, 0, 0, 0, accounts, admin, operator);
            reserveInstances = result.reserveInstances;

            //add reserves for all types, store reserve IDs in array
            let type = 1;
            for (reserve of Object.values(reserveInstances)) {
                await storage.addReserve(reserve.address, reserve.reserveId, type, reserve.rebateWallet, {from: operator});
                await storage.listPairForReserve(reserve.reserveId, token.address, true, false, true , {from: operator});
                allReserveIDs.push(reserve.reserveId);
                type++;
            }

            let rebate = [];
            let numCombinations = totalReserveTypes ** 2;
            //generate different rebate combinations
            for (let i = 0; i < numCombinations; i++) {
                rebate = [];
                let j = i;
                for (let n = 1; j > 0; j = j >> 1, n = n * 2) {
                    rebate.push(j % 2 == 1);
                }
                let originalResLength = result.length;
                //append the rest of array with false values
                for (let k = 0; k < totalReserveTypes - originalResLength; k++) {
                    rebate = rebate.concat([false]);
                }

                await storage.setEntitledRebatePerReserveType(
                    rebate[0],
                    rebate[1],
                    rebate[2],
                    rebate[3],
                    rebate[4],
                    rebate[5],
                    {from: admin}
                );

                let index = 0;
                for (reserve of Object.values(reserveInstances)) {
                    let actualResult = await storage.getReserveDetailsByAddress(reserve.address);
                    Helper.assertEqual(reserve.reserveId, actualResult.reserveId);
                    Helper.assertEqual(reserve.rebateWallet, actualResult.rebateWallet);
                    Helper.assertEqual(index + 1, actualResult.resType);
                    Helper.assertEqual(true, actualResult.isFeeAccountedFlag);
                    Helper.assertEqual(rebate[index], actualResult.isEntitledRebateFlag);

                    actualResult = await storage.getReserveDetailsById(reserve.reserveId);
                    Helper.assertEqual(reserve.address, actualResult.reserveAddress);
                    Helper.assertEqual(reserve.rebateWallet, actualResult.rebateWallet);
                    Helper.assertEqual(index + 1, actualResult.resType);
                    Helper.assertEqual(true, actualResult.isFeeAccountedFlag);
                    Helper.assertEqual(rebate[index], actualResult.isEntitledRebateFlag);
                    ++index;
                }

                actualResult = await storage.getEntitledRebateData(allReserveIDs);
                for (let index = 0; index < rebate.length; index++) {
                    Helper.assertEqual(rebate[index], actualResult[index]);
                }
                
                actualResult = await storage.getReservesData(allReserveIDs, ethAddress, token.address);
                assert(actualResult.areAllReservesListed, "invalid reserveIDs for token to eth");
                for (let index = 0; index < rebate.length; index++) {
                    Helper.assertEqual(rebate[index], actualResult.entitledRebateArr[index]);
                }
            }
        });
    });
});
