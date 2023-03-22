#!/usr/bin/env bash

v=$(node -p 'require("./package.json").version')
g=$(git show --no-patch --pretty=%H HEAD)

cat >dist/cjs/package.json <<!EOF
{
  "type": "commonjs"
}
!EOF

rm dist/cjs/version*
rm dist/mjs/version*

cat >dist/cjs/version.d.ts <<!EOF
export declare const version: '$v';
export declare const git: '$g';
!EOF

cat >dist/cjs/version.js <<!EOF
exports.version = '$v'
exports.git = '$g'
!EOF

cat >dist/mjs/package.json <<!EOF
{
  "type": "module"
}
!EOF

cat >dist/mjs/version.d.ts <<!EOF
export declare const version: '$v';
export declare const git: '$g';
!EOF
cat >dist/mjs/version.js <<!EOF
export const version = "$v"
export const git = "$g"
!EOF
