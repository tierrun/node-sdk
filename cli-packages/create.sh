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
  "bin": { "tier": "./tier" },
  "files": ["tier"],
  "os": ["$os"],
  "cpu": ["$arch"]
}
PJ
    cat > $os/$arch/README.md <<RM
# @tier.run/cli for ${os} ${arch}

This installs the precompiled \`tier\` binary CLI.
RM
  done
done
