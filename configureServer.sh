#!/bin/sh
ts=$(date +%s)
export resultsFile="Results/.${ts}.json"
export inventoryFile="Inventory/${ts}.txt"
./selectOptions.js $1 || exit -1
./processOptions.js || exit -1
