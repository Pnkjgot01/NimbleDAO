pragma solidity 0.6.6;


/// @title Sanity Rate check to prevent burning nmb with too expensive or cheap price
/// @dev Using ChainLink as the provider for current nmb/eth price
interface ISanityRate {
    // return latest rate of nmb/eth
    function latestAnswer() external view returns (uint256);
}
