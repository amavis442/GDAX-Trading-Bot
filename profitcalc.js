"use strict";

require('dotenv').config();

let stdio = require('stdio');

let ops = stdio.getopt({
    'cryptocurreny': { key: 'c', args: 1, mandatory: true, description: 'Which crypto curreny LTC,BTC, ETH or BCH' },
    'amount': { key: 'a', args: 1, description: 'Amount' },
    'size': { key: 'q', args: 1, description: 'Size' },
    'buy': { key: 'b', args: 1, mandatory: true, description: 'Buy price' },
    'sell': { key: 's', args: 1, mandatory: true, description: 'Sell price' },
});

let CRYPTO_CURRENCY = ops.cryptocurreny;
let AMOUNT = parseFloat(ops.amount);
let BUY = parseFloat(ops.buy);
let SELL = parseFloat(ops.sell);
let QUANTITY = parseFloat(ops.size);
let fee = 0.0;
let SIZE = 0.0;

if (AMOUNT) {
    SIZE = AMOUNT / BUY;
} else {
    SIZE = QUANTITY;
}


if (CRYPTO_CURRENCY == 'BCH' || CRYPTO_CURRENCY == 'LTC' || CRYPTO_CURRENCY == 'ETH') {
    fee = SIZE * BUY * 0.003;
    
    fee += SIZE * SELL * 0.003
}

if (CRYPTO_CURRENCY == 'BTC') {
    fee = SIZE * BUY * 0.0025;
    fee += SIZE * SELL * 0.003
}

let delta = SELL - BUY;
let profit = delta * SIZE - fee;

console.log('...Amount: ' + SIZE);
console.log('...Total Fee: ' + fee);
console.log('...Delta: ' + delta);
console.log('-----------------------');
console.log('...Profit: ' + parseFloat(profit).toFixed(2));