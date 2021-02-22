#!/bin/sh

sudo docker run --rm -v $(pwd):/workdir/ -w /workdir/ mongo:4.2 mongodump --verbose=5  --archive="$1" --db=$1 --collection=$2 --host=172.17.0.1 --port=27817
sudo docker run --rm -v $(pwd):/workdir/ -w /workdir/ mongo:4.2 mongorestore --verbose=5 --archive="$1" --host=172.17.0.1 --port=27272