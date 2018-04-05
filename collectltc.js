"use strict";

require('dotenv').config();

/*
 ============================================================================
 Name        : GDAX Trading Bot
 Author      : Kenshiro
 Version     : 3.03
 Copyright   : GNU General Public License (GPLv3)
 Description : Trading bot for GDAX exchange
 ============================================================================
 */

const GdaxModule = require('gdax');

const PASSPHRASE = process.env.TRADING_BOT_PASSPHRASE;
const KEY = process.env.TRADING_BOT_KEY;
const SECRET = process.env.TRADING_BOT_SECRET;

// Buy limit threshold to stop buying.
const LIMIT_BUY = 0.1;

const ORDERTYPE = String(process.env.ORDERTYPE);

// Minimum of euros that should stay in account just in case it goes south.
const EURO_IN_ACCOUNT_MINIMUM = parseFloat(process.env.EURO_IN_ACCOUNT_MINIMUM);

const GDAX_URI = 'https://api.gdax.com';

const CURRENCY_PAIR = 'LTC-EUR';

const EURO_TICKER = 'EUR';

const BITCOIN_TICKER = 'LTC';

const SLEEP_TIME = 5000; // 5 seconds

//Minimum increase over the average price to allow a purchase of bitcoin
const MINIMUM_PRICE_INCREMENT = 0.05;

// When price goes up to fast, follow it carefully, else it will take a long time to get sold again
const MAXIMUM_PRICE_INCREMENT = 0.30;

/*If the difference between the current price of bitcoin and the price of a
limit buy order reaches this amount, the limit buy order will be canceled*/
const CANCEL_BUY_ORDER_THRESHOLD = 0.05;

let currentPrice = null;
let averagePrice = null;

let lastBuyOrderPrice = null;
let buyOrderId = null;
let sellOrderId = null;

let eurAvailable = 0;
let eurBalance = 0;

let ltcAvailable = 0;
let ltcBalance = 0;

let numberOfCyclesCompleted = 0;

let estimatedProfit = 0;

let authenticatedClient = null;
let publicClient = null;

//Callbacks

const cancelOrderCallback = (error, response, data) => {
    if (error)
        return console.log(error);
        
    buyOrderId = null;
    lastBuyOrderPrice = null;
}

const sellPreviousPurchaseCallback = (error, response, data) => {
    if (error)
        return console.log(error);

    if ((data != null) && (data.status === 'pending')) {
        estimatedProfit = 0;
        lastBuyOrderPrice = null;
        buyOrderId = null;
        sellOrderId = data.id;
        numberOfCyclesCompleted++;
    }

    return console.log(data);
}

const buyOrderCallback = (error, response, data) => {
    if (error)
        return console.log(error);

    if ((data != null) && (data.status === 'pending')) {
        if ((lastBuyOrderPrice === null) || (lastBuyOrderPrice < currentPrice))
            lastBuyOrderPrice = currentPrice;
    }

    buyOrderId = data.id;

    console.log('[ORDER] New buyorder id is : ' + buyOrderId);

    return console.log(data);
}

const getBuyOrderCallBack = (error, response, data) => {
    console.log('[ORDER] Check status of buyorder: ' + data.id);
    if (data.status === 'done') {
        console.log("\x1b[42m%s\x1b[0m", "[COMPLETE BUY ORDER] Price: " + Number(data.price).toFixed(2) + " EUR, size: " + Number(data.size).toFixed(8) + " BTC");
        if (ltcAvailable >= 0.1 && lastBuyOrderPrice != null) {
            console.log('[INFO] Place sell order for buyorderid: ' + data.id);
            sellPreviousPurchase();
        }
        buyOrderId = null;
    } else {
        if (data.status !== 'open' && data.status !== 'pending' && data.status !== 'done') {
            // Manual deleted perhaps
            buyOrderId = null;        
        } else {
            let orderPrice = parseFloat(data.price);
            let priceDifference = Math.abs(orderPrice - currentPrice);
            if ((data.product_id === CURRENCY_PAIR) && (data.side === 'buy') && (priceDifference >= CANCEL_BUY_ORDER_THRESHOLD)) {
                console.log("\n[INFO] Canceling buy order (order price: " + orderPrice.toFixed(2) + " EUR, current price: " + currentPrice.toFixed(2) + " EUR)");
                authenticatedClient.cancelOrder(data.id, cancelOrderCallback);
            }
        }
    }
}

const getSellOrderCallBack = (error, response, data) => {
    console.log('[ORDER] Check status of sellorder: ' + data.id);
    if (data.status === 'done') {
        console.log("\x1b[41m%s\x1b[0m", "[COMPLETE SELL ORDER] Price: " + Number(data.price).toFixed(2) + " EUR, size: " + Number(data.size).toFixed(8) + " BTC");
        sellOrderId = null;
    }else {
        if (data.status !== 'open' && data.status !== 'pending' && data.status !== 'done') {
            // Manual deleted perhaps
            sellOrderId = null;  
        }
    }
}

const getOrdersCallback = (error, response, data) => {
    if (error)
        return console.log(error);

    if ((data != null) && (Symbol.iterator in Object(data))) {
        if (buyOrderId !== null) {
            authenticatedClient.getOrder(buyOrderId, getBuyOrderCallBack);
        }

        if (sellOrderId !== null) {
            authenticatedClient.getOrder(sellOrderId, getSellOrderCallBack);
        }

        console.log('');

        if (buyOrderId === null && sellOrderId === null) {
            placeBuyOrder();
        }

        if (averagePrice === null)
            averagePrice = currentPrice;
        else
            averagePrice = (averagePrice * 10 + currentPrice) / 11;
    }
}

const getProductTickerCallback = (error, response, data) => {
    if (error)
        return console.log(error);

    if (data != null) {
        currentPrice = parseFloat(data.bid);

        if (averagePrice === null)
            console.log("[LITECOIN TICKER] Now: " + currentPrice.toFixed(2) + " EUR, time: " + data.time);
        else
            console.log("[LITECOINCOIN TICKER] Now: " + currentPrice.toFixed(2) + " EUR, average: " + averagePrice.toFixed(2) + " EUR, time: " + data.time);

        console.log("\n[INFO] Number of cycles completed: " + numberOfCyclesCompleted + ", estimated profit: " + estimatedProfit.toFixed(2) + " EUR");

        authenticatedClient.getOrders(getOrdersCallback);
    }
}

const getAccountsCallback = (error, response, data) => {
    if (error)
        return console.log(error);

    if ((data != null) && (Symbol.iterator in Object(data))) {
        for (var item of data) {
            if (item.currency === EURO_TICKER) {
                eurAvailable = parseFloat(item.available);
                eurBalance = parseFloat(item.balance);
            } else {
                if (item.currency === BITCOIN_TICKER) {
                    ltcAvailable = parseFloat(item.available);
                    ltcBalance = parseFloat(item.balance);
                }
            }
        }

        console.log("[EURO WALLET] Available: " + eurAvailable.toFixed(2) + " EUR, Balance: " + eurBalance.toFixed(2) + " EUR");
        console.log("[LITECOIN WALLET] Available: " + ltcAvailable.toFixed(8) + " LTC, Balance: " + ltcBalance.toFixed(8) + " LTC\n");

        publicClient.getProductTicker(CURRENCY_PAIR, getProductTickerCallback);
    }
}

//Functions
const buyOrder = (orderType, buySize, currentPrice, currencyPair) => {
    if (orderType === 'market' ) {
        return {
            'type': 'market',
            'size': buySize.toFixed(8),
            'product_id': currencyPair,
        };
    } else {
        return {
            'price': currentPrice.toFixed(2),
            'size': buySize.toFixed(8),
            'product_id': currencyPair,
            'post_only': true,
        };
    }
};

function placeBuyOrder() {
    let buySize = parseFloat(eurAvailable / currentPrice);
        
    console.log(buySize);
    if (buySize > 0.101) {
        const buyParams = buyOrder(ORDERTYPE, buySize, currentPrice, CURRENCY_PAIR);

        console.log("\x1b[42m%s\x1b[0m", "[BUY ORDER] Price: " + currentPrice.toFixed(2) + " EUR, size: " + buySize.toFixed(8) + " LTC");

        authenticatedClient.buy(buyParams, buyOrderCallback);
    } else {
        console.log('Size is smaller then 0.101 so not buying it .......');
    }
}

function sellPreviousPurchase() {
    let sellPrice;

    if (currentPrice < lastBuyOrderPrice || currentPrice < lastBuyOrderPrice + 0.05)
    {    
        sellPrice = lastBuyOrderPrice + 0.05;
    } else {
        sellPrice = currentPrice;
    }
        const sellSize = 0.1;
        const sellParams =
        {
            'price': sellPrice.toFixed(2),
            'size': sellSize.toFixed(8),
            'product_id': CURRENCY_PAIR,
            'post_only': true,
        };

    console.log("\x1b[41m%s\x1b[0m", "[SELL ORDER] Price: " + sellPrice.toFixed(2) + " EUR, size: " + sellSize.toFixed(8) + " LTC");

    authenticatedClient.sell(sellParams, sellPreviousPurchaseCallback);
}

//Main logic
console.log("\n Config: SEED LTC: " + 0.1);
console.log("\n Config: Order type: " + ORDERTYPE);
console.log("\n Config: Cancel buy order treshold: " + CANCEL_BUY_ORDER_THRESHOLD);
console.log("\n Config: Limit Buy: " + LIMIT_BUY);
console.log("\n Config: Minimum price increment: " + MINIMUM_PRICE_INCREMENT);
console.log("\n\n\n\nConnecting to GDAX in " + parseInt(SLEEP_TIME / 1000) + " seconds ...");

setInterval(() => {
    console.log('\n\n');

    currentPrice = null;

    eurAvailable = 0;
    eurBalance = 0;

    ltcAvailable = 0;
    ltcBalance = 0;

    publicClient = new GdaxModule.PublicClient(GDAX_URI);
    authenticatedClient = new GdaxModule.AuthenticatedClient(KEY, SECRET, PASSPHRASE, GDAX_URI);

    //Get the balance of the wallets and execute the trading strategy
    authenticatedClient.getAccounts(getAccountsCallback);

}, SLEEP_TIME);