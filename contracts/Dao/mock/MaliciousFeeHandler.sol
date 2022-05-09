pragma solidity 0.6.6;

import "../NimbleFeeHandler.sol";


contract MaliciousFeeHandler is NimbleFeeHandler {
    constructor(
        address daoSetter,
        INimbleProxy _nimbleNetworkProxy,
        address _nimbleNetwork,
        IERC20 _nmb,
        uint256 _burnBlockInterval,
        address _daoOperator
    )
        public
        NimbleFeeHandler(
            daoSetter,
            _nimbleNetworkProxy,
            _nimbleNetwork,
            _nmb,
            _burnBlockInterval,
            _daoOperator
        )
    {}

    function setTotalPayoutBalance(uint256 _amount) external {
        totalPayoutBalance = _amount;
    }

    function withdrawEther(uint256 amount, address payable sendTo) external {
        sendTo.transfer(amount);
    }
}
