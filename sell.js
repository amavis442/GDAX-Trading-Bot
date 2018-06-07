"use strict";

require('dotenv').config();

const GdaxModule = require('gdax');
let stdio = require('stdio');
let authenticatedClient = null;
let orderParams = null;
let orderId = null;
let diffPrice = 0.0;

let ops = stdio.getopt({
    'cryptocurreny': {key: 'c', args: 1, mandatory: true, description: 'Which crypto curreny LTC,BTC, ETH or BCH'},
    'size': {key: 's',args: 1, mandatory: true, description: 'Size to buy per increment 0.1 ex. for 0.1 LTC'},
    'number': {key: 'n', args: 1, description: 'Number of orders'},
    'price': {key: 'p', args: 1, mandatory: true, description: 'Start price to calculate'},
    'limitprice': {key: 'l', args: 1, description: 'Limitprice (only used when number is not filled in and it is not included in the number of orders (n-1))'},
    'increment': {key: 'i', args: 1, mandatory: true, description: 'The increment in cents (5 = 5 cent increment)'},
    'amount': {key: 'a', args: 1, description: 'Size of crypto you wonna sell (You do not need to fill in number and topprice'},
});

let CRYPTO_CURRENCY = ops.cryptocurreny + '-EUR';
let SIZE = parseFloat(ops.size);
let NUMBER = parseInt(ops.number);
let PRICE = parseFloat(ops.price);
let INCREMENT = ops.increment;
let LIMITPRICE = parseFloat(ops.limitprice);
let AMOUNT = parseFloat(ops.amount);

const PASSPHRASE = process.env.TRADING_BOT_PASSPHRASE;
const KEY = process.env.TRADING_BOT_KEY;
const SECRET = process.env.TRADING_BOT_SECRET;
const GDAX_URI = 'https://api.gdax.com';

if (!NUMBER && !LIMITPRICE && !AMOUNT){
    console.log('Please fill in number of orders or the limitprice or the amount to sell......');
    return;
}

if (!NUMBER && LIMITPRICE){
    diffPrice = parseFloat((LIMITPRICE - PRICE) * 100).toFixed(2);
    NUMBER = parseInt(Math.floor(diffPrice / INCREMENT));
}

// Round down so we do not sell
if (!NUMBER && !LIMITPRICE){
    NUMBER = parseInt(Math.floor(AMOUNT / SIZE));
}

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

//Functions
const order = (orderType, orderSize, currentPrice, currencyPair) => {
    if (orderType === 'market' ) {
        return {
            'type': 'market',
            'size': orderSize.toFixed(8),
            'product_id': currencyPair,
        };
    } else {
        return {
            'price': currentPrice.toFixed(2),
            'type': 'limit',
            'size': orderSize.toFixed(8),
            'product_id': currencyPair,
            'post_only': true,
        };
    }
};

const orderCallback = (error, response, data) => {
    if (error)
        return console.log(error);
    orderId = data.id;

    console.log('[ORDER] New buyorder id is : ' + orderId);

    return console.log(data);
}

    
const placeOrder = async () => {
    let i = 0;
    let currentPrice = 0.0;
    let orderSize = SIZE;
    for(i = 0;i < NUMBER; i++) {
        currentPrice = PRICE + i * (INCREMENT / 100);
        orderParams = order('limit', orderSize, currentPrice, CRYPTO_CURRENCY);

        console.log("\x1b[42m%s\x1b[0m", "[ORDER] Price: " + currentPrice.toFixed(2) + " EUR, size: " + orderSize.toFixed(8) + ' ' + CRYPTO_CURRENCY);
        console.log('--------');
        console.log(orderParams);
        authenticatedClient.sell(orderParams, orderCallback);
        await sleep(500);
    }
}

authenticatedClient = new GdaxModule.AuthenticatedClient(KEY, SECRET, PASSPHRASE, GDAX_URI);
placeOrder();