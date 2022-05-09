pragma solidity 0.6.6;

import "../NimbleNetwork.sol";


// override some of original NimbleNetwork contract
contract MockNetwork is NimbleNetwork {
    constructor(address _admin, INimbleStorage _nimbleStorage)
        public
        NimbleNetwork(_admin, _nimbleStorage)
    {}

    // allow set zero contract
    function setContracts(
        INimbleFeeHandler _nimbleFeeHandler,
        INimbleMatchingEngine _nimbleMatchingEngine,
        IGasHelper _gasHelper
    ) external override {
        if (nimbleFeeHandler != _nimbleFeeHandler) {
            nimbleFeeHandler = _nimbleFeeHandler;
            emit NimbleFeeHandlerUpdated(_nimbleFeeHandler);
        }

        if (nimbleMatchingEngine != _nimbleMatchingEngine) {
            nimbleMatchingEngine = _nimbleMatchingEngine;
            emit NimbleMatchingEngineUpdated(_nimbleMatchingEngine);
        }

        if ((_gasHelper != IGasHelper(0)) && (_gasHelper != gasHelper)) {
            gasHelper = _gasHelper;
            emit GasHelperUpdated(_gasHelper);
        }
    }

    function mockHandleChange(
        IERC20 src,
        uint256 srcAmount,
        uint256 requiredSrcAmount,
        address payable trader
    ) public {
        return handleChange(src, srcAmount, requiredSrcAmount, trader);
    }

    function setNetworkFeeData(uint256 _networkFeeBps, uint256 _expiryTimestamp) public {
        updateNetworkFee(_expiryTimestamp, _networkFeeBps);
    }

    function getNetworkFeeData()
        public
        view
        returns (uint256 _networkFeeBps, uint256 _expiryTimestamp)
    {
        (_networkFeeBps, _expiryTimestamp) = readNetworkFeeData();
    }

    function mockGetNetworkFee() public view returns (uint256 networkFeeBps) {
        return getNetworkFee();
    }

    //over ride some functions to reduce contract size.
    function doReserveTrades(
        IERC20 src,
        IERC20 dest,
        address payable destAddress,
        ReservesData memory reservesData,
        uint256 expectedDestAmount,
        uint256 srcDecimals,
        uint256 destDecimals
    ) internal override {
        src;
        dest;
        destAddress;
        reservesData;
        expectedDestAmount;
        srcDecimals;
        destDecimals;

        revert("must use real network");
        // return true;
    }
}
