#!/bin/sh

sudo docker run --rm -v $(pwd):/workdir/ -w /workdir/ mongo:4.2 mongodump --archive="$1" --db=$1 --host=172.17.0.1 --port=27817
sudo docker run --rm -v $(pwd):/workdir/ -w /workdir/ mongo:4.2 mongorestore --archive="$1" --nsFrom="$1.*" --nsTo="$2.*" --host=172.17.0.1 --port=27272