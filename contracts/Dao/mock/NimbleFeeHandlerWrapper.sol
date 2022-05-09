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
        IFeeHandler kyberFeeHandler;
        uint256 startEpoch;
    }

    INimbleDao public immutable kyberDao;
    IERC20[] internal supportedTokens;
    mapping(IERC20 => NimbleFeeHandlerData[]) internal kyberFeeHandlersPerToken;
    address public daoSetter;

    event FeeHandlerAdded(IERC20 token, IFeeHandler kyberFeeHandler);

    constructor(
        INimbleDao _kyberDao,
        address _daoOperator
    ) public DaoOperator(_daoOperator) {
        require(_kyberDao != INimbleDao(0), "kyberDao 0");
        kyberDao = _kyberDao;
    }

    function addFeeHandler(IERC20 _token, IFeeHandler _kyberFeeHandler) external onlyDaoOperator {
        addTokenToSupportedTokensArray(_token);
        addFeeHandlerToNimbleFeeHandlerArray(kyberFeeHandlersPerToken[_token], _kyberFeeHandler);
        emit FeeHandlerAdded(_token, _kyberFeeHandler);
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
            NimbleFeeHandlerData[] memory kyberFeeHandlerArray = kyberFeeHandlersPerToken[supportedTokens[i]];
            uint256 endNimbleFeeHandlerId = (endNimbleFeeHandlerIndex >= kyberFeeHandlerArray.length) ?
                kyberFeeHandlerArray.length - 1: endNimbleFeeHandlerIndex - 1;
            require(endNimbleFeeHandlerId >= startNimbleFeeHandlerIndex, "bad array indices");
            amounts = new uint256[](endNimbleFeeHandlerId - startNimbleFeeHandlerIndex + 1);

            // iteration starts from endIndex, differs from claiming reserve rebates and platform wallets
            for (uint256 j = endNimbleFeeHandlerId; j >= startNimbleFeeHandlerIndex; j--) {
                NimbleFeeHandlerData memory kyberFeeHandlerData = kyberFeeHandlerArray[j];
                if (kyberFeeHandlerData.startEpoch < epoch) {
                    amounts[j] = kyberFeeHandlerData.kyberFeeHandler.claimStakerReward(staker, epoch);
                    break;
                } else if (kyberFeeHandlerData.startEpoch == epoch) {
                    amounts[j] = kyberFeeHandlerData.kyberFeeHandler.claimStakerReward(staker, epoch);
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
            NimbleFeeHandlerData[] memory kyberFeeHandlerArray = kyberFeeHandlersPerToken[supportedTokens[i]];
            uint256 endNimbleFeeHandlerId = (endNimbleFeeHandlerIndex >= kyberFeeHandlerArray.length) ?
                kyberFeeHandlerArray.length : endNimbleFeeHandlerIndex;
            require(endNimbleFeeHandlerId >= startNimbleFeeHandlerIndex, "bad array indices");
            amounts = new uint256[](endNimbleFeeHandlerId - startNimbleFeeHandlerIndex + 1);
            
            for (uint256 j = startNimbleFeeHandlerIndex; j < endNimbleFeeHandlerId; j++) {
                IFeeHandler feeHandler = kyberFeeHandlerArray[j].kyberFeeHandler;
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
            NimbleFeeHandlerData[] memory kyberFeeHandlerArray = kyberFeeHandlersPerToken[supportedTokens[i]];
            uint256 endNimbleFeeHandlerId = (endNimbleFeeHandlerIndex >= kyberFeeHandlerArray.length) ?
                kyberFeeHandlerArray.length : endNimbleFeeHandlerIndex;
            require(endNimbleFeeHandlerId >= startNimbleFeeHandlerIndex, "bad array indices");
            amounts = new uint256[](endNimbleFeeHandlerId - startNimbleFeeHandlerIndex + 1);

            for (uint256 j = startNimbleFeeHandlerIndex; j < endNimbleFeeHandlerId; j++) {
                IFeeHandler feeHandler = kyberFeeHandlerArray[j].kyberFeeHandler;
                if (feeHandler.feePerPlatformWallet(platformWallet) > 1) {
                    amounts[j] = feeHandler.claimPlatformFee(platformWallet);
                }
            }
        }
    }

    function getNimbleFeeHandlersPerToken(IERC20 token) external view returns (
        IFeeHandler[] memory kyberFeeHandlers,
        uint256[] memory epochs
        )
    {
        NimbleFeeHandlerData[] storage kyberFeeHandlerData = kyberFeeHandlersPerToken[token];
        kyberFeeHandlers = new IFeeHandler[](kyberFeeHandlerData.length);
        epochs = new uint256[](kyberFeeHandlerData.length);
        for (uint i = 0; i < kyberFeeHandlerData.length; i++) {
            kyberFeeHandlers[i] = kyberFeeHandlerData[i].kyberFeeHandler;
            epochs[i] = kyberFeeHandlerData[i].startEpoch;
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
        NimbleFeeHandlerData[] storage kyberFeeHandlerArray,
        IFeeHandler _kyberFeeHandler
    ) internal {
        uint256 i;
        for (i = 0; i < kyberFeeHandlerArray.length; i++) {
            if (_kyberFeeHandler == kyberFeeHandlerArray[i].kyberFeeHandler) {
                // already added, return
                return;
            }
        }
        kyberFeeHandlerArray.push(NimbleFeeHandlerData({
            kyberFeeHandler: _kyberFeeHandler,
            startEpoch: kyberDao.getCurrentEpochNumber()
            })
        );
    }
}
