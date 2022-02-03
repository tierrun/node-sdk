#!/usr/bin/env bash

set -e

OS=(linux darwin windows)
ARCH=(amd64 arm64)

for os in "${OS[@]}"; do
  for arch in "${ARCH[@]}"; do
    mkdir -p "$os/$arch"
    # TODO: put the shasums on S3 so we can skip downloading unchanged ones
    url=https://s3.amazonaws.com/tier.run/dl/tier.latest.$os-$arch.tar.gz
    curl -s $url > $os-$arch.tar.gz
    tar xvf $os-$arch.tar.gz -C "$os/$arch"
  done
done

shasum -a 256 *.tar.gz */*/tier > SHASUMS.txt

myarch=$(uname -m)
myos=$(uname | tr '[:upper:]' '[:lower:]')
$myos/$myarch/tier version
verFromTier=$($myos/$myarch/tier version 2>/dev/null)
verDate="0.0.0-$(date +"%Y-%m-%d-%H-%M-%S")"
version=${verFromTier:-$verDate}

for os in "${OS[@]}"; do
  for arch in "${ARCH[@]}"; do
    cat > $os/$arch/package.json <<PJ
{
  "name": "@tier.run/cli-${os}-${arch}",
  "version": "$version",
  "bin": { "tier-${os}-${arch}": "./tier" },
  "files": ["tier", "index.js"],
  "os": ["$os"],
  "cpu": ["$arch"]
}
PJ
    cat > $os/$arch/README.md <<RM
# @tier.run/cli for ${os} ${arch}

This package includes the pre-compiled tier binary, and an index.js which
reports the full path to the compiled binary.

You almost certainly want to use
[@tier.run/sdk](https://npmjs.com/package/@tier.run/sdk), not this package
directly.
RM

    cat > $os/$arch/index.js <<JS
module.exports = require('path').resolve(__dirname, 'tier')
JS

  done
done
