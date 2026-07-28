#!/bin/zsh
cd "$(dirname "$0")/.."
git init
git add .
git commit -m "Initial Stream Control Suite repository"
