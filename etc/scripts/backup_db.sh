#!/bin/sh

sudo docker run --rm -v $(pwd):/workdir/ -w /workdir/ mongo:4.2 mongodump --archive="$1" --db=$1 --host=172.17.0.1 --port=27817