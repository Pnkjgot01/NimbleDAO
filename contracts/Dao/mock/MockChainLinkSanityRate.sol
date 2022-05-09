pragma solidity 0.6.6;

import "../ISanityRate.sol";


contract MockChainLinkSanityRate is ISanityRate {
    uint256 latestAnswerValue;

    function setLatestNmbToEthRate(uint256 _nmbEthRate) external {
        latestAnswerValue = _nmbEthRate;
    }

    function latestAnswer() external view override returns (uint256) {
        return latestAnswerValue;
    }
}
