#!/bin/sh
export NODE_OPTIONS=--max-old-space-size=4096
npx hardhat compile &&
npx hardhat compile --config hardhatConfigSol5.js &&
npx hardhat compile --config hardhatConfigSol4.js &&
node contractSizeReport.js
