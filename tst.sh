#!/bin/sh
ALL=false

while getopts "f:a" arg; do
  case $arg in
    a) ALL=true;;
    f) FILE=$OPTARG;;
  esac
done

if [ -n "$FILE" ]; then
  npx hardhat test --no-compile $FILE
elif [ "$ALL" = true ]; then
  echo "Running all tests..."
  npx hardhat test --no-compile
else
  echo "Running sol6 tests..." 
  npx hardhat test --config ./hardhatConfigSol6.js --no-compile 
fi
