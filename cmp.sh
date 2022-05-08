#!/bin/sh
export NODE_OPTIONS=--max-old-space-size=4096
npx hardhat compile &&
npx hardhat compile --config hardhatConfig.js &&
node contractSizeReport.js
