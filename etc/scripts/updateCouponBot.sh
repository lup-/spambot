#!/bin/sh
export MONGO_PORT=27817
export MONGO_HOST=localhost
export MONGO_DB=coupon_bot
export ADMITAD_CLIENT_ID=IrzMQs9NsigSsuUHUAKLXR2AaqunvN
export ADMITAD_CLIENT_SECRET=Dzix0VNiHidllP0vQUIYfcU7teVxzY
export MONGO_TIMEOUT=3600

node updateCouponBot.js