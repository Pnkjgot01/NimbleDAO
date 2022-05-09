pragma solidity 0.6.6;

import "../NimbleFeeHandler.sol";


contract MockContractCallBurnNmb {
    NimbleFeeHandler public feeHandler;

    constructor(NimbleFeeHandler _feeHandler) public {
        feeHandler = _feeHandler;
    }

    function callBurnNmb() public {
        feeHandler.burnNmb();
    }
}
