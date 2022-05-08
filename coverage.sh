#!/bin/sh
while getopts "f:" arg; do
  case $arg in
    f) FILE=$OPTARG;;
  esac
done

export NODE_OPTIONS=--max-old-space-size=4096

npx hardhat clean
npx hardhat compile --config ./hardhatCoverageSol4.js

if [ -n "$FILE" ]
then
    npx hardhat coverage --config ./hardhatConfigSol6.js --testfiles $FILE --solcoverjs ".solcover.js" --temp ""
else
    npx hardhat coverage --config ./hardhatConfigSol6.js --testfiles "" --solcoverjs ".solcover.js" --temp ""
fi
