pragma solidity 0.6.6;

import "../../utils/Utils5.sol";
import "../../utils/zeppelin/ReentrancyGuard.sol";
import "../../utils/zeppelin/SafeERC20.sol";
import "../../utils/zeppelin/SafeMath.sol";
import "../../INimbleDao.sol";
import "../../INimbleFeeHandler.sol";
import "../DaoOperator.sol";

interface IFeeHandler is INimbleFeeHandler {
    function feePerPlatformWallet(address) external view returns (uint256);
    function rebatePerWallet(address) external view returns (uint256);
}


contract NimbleFeeHandlerWrapper is DaoOperator {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct NimbleFeeHandlerData {
        IFeeHandler nimbleFeeHandler;
        uint256 startEpoch;
    }

    INimbleDao public immutable nimbleDao;
    IERC20[] internal supportedTokens;
    mapping(IERC20 => NimbleFeeHandlerData[]) internal nimbleFeeHandlersPerToken;
    address public daoSetter;

    event FeeHandlerAdded(IERC20 token, IFeeHandler nimbleFeeHandler);

    constructor(
        INimbleDao _nimbleDao,
        address _daoOperator
    ) public DaoOperator(_daoOperator) {
        require(_nimbleDao != INimbleDao(0), "nimbleDao 0");
        nimbleDao = _nimbleDao;
    }

    function addFeeHandler(IERC20 _token, IFeeHandler _nimbleFeeHandler) external onlyDaoOperator {
        addTokenToSupportedTokensArray(_token);
        addFeeHandlerToNimbleFeeHandlerArray(nimbleFeeHandlersPerToken[_token], _nimbleFeeHandler);
        emit FeeHandlerAdded(_token, _nimbleFeeHandler);
    }

    /// @dev claim from multiple feeHandlers
    /// @param staker staker address
    /// @param epoch epoch for which the staker is claiming the reward
    /// @param startTokenIndex index of supportedTokens to start iterating from (inclusive)
    /// @param endTokenIndex index of supportedTokens to end iterating to (exclusive)
    /// @param startNimbleFeeHandlerIndex index of feeHandlerArray to start iterating from (inclusive)
    /// @param endNimbleFeeHandlerIndex index of feeHandlerArray to end iterating to (exclusive)
    /// @return amounts staker reward wei / twei amount claimed from each feeHandler
    function claimStakerReward(
        address staker,
        uint256 epoch,
        uint256 startTokenIndex,
        uint256 endTokenIndex,
        uint256 startNimbleFeeHandlerIndex,
        uint256 endNimbleFeeHandlerIndex
    ) external returns(uint256[] memory amounts) {
        if (
            startTokenIndex > endTokenIndex ||
            startNimbleFeeHandlerIndex > endNimbleFeeHandlerIndex ||
            supportedTokens.length == 0
        ) {
            // no need to do anything
            return amounts;
        }

        uint256 endTokenId = (endTokenIndex >= supportedTokens.length) ?
            supportedTokens.length : endTokenIndex;

        for (uint256 i = startTokenIndex; i < endTokenId; i++) {
            NimbleFeeHandlerData[] memory nimbleFeeHandlerArray = nimbleFeeHandlersPerToken[supportedTokens[i]];
            uint256 endNimbleFeeHandlerId = (endNimbleFeeHandlerIndex >= nimbleFeeHandlerArray.length) ?
                nimbleFeeHandlerArray.length - 1: endNimbleFeeHandlerIndex - 1;
            require(endNimbleFeeHandlerId >= startNimbleFeeHandlerIndex, "bad array indices");
            amounts = new uint256[](endNimbleFeeHandlerId - startNimbleFeeHandlerIndex + 1);

            // iteration starts from endIndex, differs from claiming reserve rebates and platform wallets
            for (uint256 j = endNimbleFeeHandlerId; j >= startNimbleFeeHandlerIndex; j--) {
                NimbleFeeHandlerData memory nimbleFeeHandlerData = nimbleFeeHandlerArray[j];
                if (nimbleFeeHandlerData.startEpoch < epoch) {
                    amounts[j] = nimbleFeeHandlerData.nimbleFeeHandler.claimStakerReward(staker, epoch);
                    break;
                } else if (nimbleFeeHandlerData.startEpoch == epoch) {
                    amounts[j] = nimbleFeeHandlerData.nimbleFeeHandler.claimStakerReward(staker, epoch);
                }

                if (j == 0) {
                    break;
                }
            }
        }
    }

    /// @dev claim reabate per reserve wallet. called by any address
    /// @param rebateWallet the wallet to claim rebates for. Total accumulated rebate sent to this wallet
    /// @param startTokenIndex index of supportedTokens to start iterating from (inclusive)
    /// @param endTokenIndex index of supportedTokens to end iterating to (exclusive)
    /// @param startNimbleFeeHandlerIndex index of feeHandlerArray to start iterating from (inclusive)
    /// @param endNimbleFeeHandlerIndex index of feeHandlerArray to end iterating to (exclusive)
    /// @return amounts reserve rebate wei / twei amount claimed from each feeHandler
    function claimReserveRebate(
        address rebateWallet,
        uint256 startTokenIndex,
        uint256 endTokenIndex,
        uint256 startNimbleFeeHandlerIndex,
        uint256 endNimbleFeeHandlerIndex
    ) external returns (uint256[] memory amounts) 
    {
        if (
            startTokenIndex > endTokenIndex ||
            startNimbleFeeHandlerIndex > endNimbleFeeHandlerIndex ||
            supportedTokens.length == 0
        ) {
            // no need to do anything
            return amounts;
        }

        uint256 endTokenId = (endTokenIndex >= supportedTokens.length) ?
            supportedTokens.length : endTokenIndex;

        for (uint256 i = startTokenIndex; i < endTokenId; i++) {
            NimbleFeeHandlerData[] memory nimbleFeeHandlerArray = nimbleFeeHandlersPerToken[supportedTokens[i]];
            uint256 endNimbleFeeHandlerId = (endNimbleFeeHandlerIndex >= nimbleFeeHandlerArray.length) ?
                nimbleFeeHandlerArray.length : endNimbleFeeHandlerIndex;
            require(endNimbleFeeHandlerId >= startNimbleFeeHandlerIndex, "bad array indices");
            amounts = new uint256[](endNimbleFeeHandlerId - startNimbleFeeHandlerIndex + 1);
            
            for (uint256 j = startNimbleFeeHandlerIndex; j < endNimbleFeeHandlerId; j++) {
                IFeeHandler feeHandler = nimbleFeeHandlerArray[j].nimbleFeeHandler;
                if (feeHandler.rebatePerWallet(rebateWallet) > 1) {
                    amounts[j] = feeHandler.claimReserveRebate(rebateWallet);
                }
            }
        }
    }

    /// @dev claim accumulated fee per platform wallet. Called by any address
    /// @param platformWallet the wallet to claim fee for. Total accumulated fee sent to this wallet
    /// @param startTokenIndex index of supportedTokens to start iterating from (inclusive)
    /// @param endTokenIndex index of supportedTokens to end iterating to (exclusive)
    /// @param startNimbleFeeHandlerIndex index of feeHandlerArray to start iterating from (inclusive)
    /// @param endNimbleFeeHandlerIndex index of feeHandlerArray to end iterating to (exclusive)
    /// @return amounts platform fee wei / twei amount claimed from each feeHandler
    function claimPlatformFee(
        address platformWallet,
        uint256 startTokenIndex,
        uint256 endTokenIndex,
        uint256 startNimbleFeeHandlerIndex,
        uint256 endNimbleFeeHandlerIndex
    ) external returns (uint256[] memory amounts)
    {
        if (
            startTokenIndex > endTokenIndex ||
            startNimbleFeeHandlerIndex > endNimbleFeeHandlerIndex ||
            supportedTokens.length == 0
        ) {
            // no need to do anything
            return amounts;
        }

        uint256 endTokenId = (endTokenIndex >= supportedTokens.length) ?
            supportedTokens.length : endTokenIndex;

        for (uint256 i = startTokenIndex; i < endTokenId; i++) {
            NimbleFeeHandlerData[] memory nimbleFeeHandlerArray = nimbleFeeHandlersPerToken[supportedTokens[i]];
            uint256 endNimbleFeeHandlerId = (endNimbleFeeHandlerIndex >= nimbleFeeHandlerArray.length) ?
                nimbleFeeHandlerArray.length : endNimbleFeeHandlerIndex;
            require(endNimbleFeeHandlerId >= startNimbleFeeHandlerIndex, "bad array indices");
            amounts = new uint256[](endNimbleFeeHandlerId - startNimbleFeeHandlerIndex + 1);

            for (uint256 j = startNimbleFeeHandlerIndex; j < endNimbleFeeHandlerId; j++) {
                IFeeHandler feeHandler = nimbleFeeHandlerArray[j].nimbleFeeHandler;
                if (feeHandler.feePerPlatformWallet(platformWallet) > 1) {
                    amounts[j] = feeHandler.claimPlatformFee(platformWallet);
                }
            }
        }
    }

    function getNimbleFeeHandlersPerToken(IERC20 token) external view returns (
        IFeeHandler[] memory nimbleFeeHandlers,
        uint256[] memory epochs
        )
    {
        NimbleFeeHandlerData[] storage nimbleFeeHandlerData = nimbleFeeHandlersPerToken[token];
        nimbleFeeHandlers = new IFeeHandler[](nimbleFeeHandlerData.length);
        epochs = new uint256[](nimbleFeeHandlerData.length);
        for (uint i = 0; i < nimbleFeeHandlerData.length; i++) {
            nimbleFeeHandlers[i] = nimbleFeeHandlerData[i].nimbleFeeHandler;
            epochs[i] = nimbleFeeHandlerData[i].startEpoch;
        }
    }
    
    function getSupportedTokens() external view returns (IERC20[] memory) {
        return supportedTokens;
    }

    function addTokenToSupportedTokensArray(IERC20 _token) internal {
        uint256 i;
        for (i = 0; i < supportedTokens.length; i++) {
            if (_token == supportedTokens[i]) {
                // already added, return
                return;
            }
        }
        supportedTokens.push(_token);
    }

    function addFeeHandlerToNimbleFeeHandlerArray(
        NimbleFeeHandlerData[] storage nimbleFeeHandlerArray,
        IFeeHandler _nimbleFeeHandler
    ) internal {
        uint256 i;
        for (i = 0; i < nimbleFeeHandlerArray.length; i++) {
            if (_nimbleFeeHandler == nimbleFeeHandlerArray[i].nimbleFeeHandler) {
                // already added, return
                return;
            }
        }
        nimbleFeeHandlerArray.push(NimbleFeeHandlerData({
            nimbleFeeHandler: _nimbleFeeHandler,
            startEpoch: nimbleDao.getCurrentEpochNumber()
            })
        );
    }
}
