#!/usr/bin/env bash

set -e

OS=(linux darwin windows)
ARCH=(amd64 arm64)

read -p "Enter OTP code for npm publish: " otp

p=$PWD
for os in "${OS[@]}"; do
  for arch in "${ARCH[@]}"; do
    cat $os/$arch/package.json
    (cd $os/$arch ; npm publish --otp=$otp --loglevel=silly)
  done
done

