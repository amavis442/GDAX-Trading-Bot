"use strict";

require('dotenv').config();

const GdaxModule = require('gdax');
let stdio = require('stdio');
let authenticatedClient = null;
let orderParams = null;
let orderId = null;

let ops = stdio.getopt({
    'cryptocurreny': {key: 'c', args: 1, mandatory: true, description: 'Which crypto curreny LTC,BTC, ETH or BCH'},
    'size': {key: 's',args: 1, mandatory: true, description: 'Size to buy per increment 0.1 ex. for 0.1 LTC'},
    'number': {key: 'n', args: 1, mandatory: true, description: 'Number of orders'},
    'price': {key: 'p', args: 1, mandatory: true, description: 'Start price to calculate'},
    'increment': {key: 'i', args: 1, mandatory: true, description: 'The increment in cents (5 = 5 cent increment)'},
});

let CRYPTO_CURRENCY = ops.cryptocurreny + '-EUR';
let SIZE = parseFloat(ops.size);
let NUMBER = parseInt(ops.number);
let PRICE = parseFloat(ops.price);
let INCREMENT = ops.increment;

const PASSPHRASE = process.env.TRADING_BOT_PASSPHRASE;
const KEY = process.env.TRADING_BOT_KEY;
const SECRET = process.env.TRADING_BOT_SECRET;
const GDAX_URI = 'https://api.gdax.com';

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
        currentPrice = PRICE - i * (INCREMENT / 100);
        orderParams = order('limit', orderSize, currentPrice, CRYPTO_CURRENCY);

        console.log("\x1b[42m%s\x1b[0m", "[ORDER] Price: " + currentPrice.toFixed(2) + " EUR, size: " + orderSize.toFixed(8) + ' ' + CRYPTO_CURRENCY);
        console.log('--------');
        console.log(orderParams);
        authenticatedClient.buy(orderParams, orderCallback);
        await sleep(500);
    }
}

authenticatedClient = new GdaxModule.AuthenticatedClient(KEY, SECRET, PASSPHRASE, GDAX_URI);
placeOrder();