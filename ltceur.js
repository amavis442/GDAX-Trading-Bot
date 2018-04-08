"use strict";

require('dotenv').config();

const GdaxModule = require('gdax');

const PASSPHRASE = process.env.TRADING_BOT_PASSPHRASE;
const KEY = process.env.TRADING_BOT_KEY;
const SECRET = process.env.TRADING_BOT_SECRET;
const GDAX_URI = 'https://api.gdax.com';

// Buy limit threshold to stop buying.
const ORDERTYPE = String(process.env.ORDERTYPE);

// Minimum of euros that should stay in account just in case it goes south.
const EURO_IN_ACCOUNT_MINIMUM = parseFloat(process.env.EURO_IN_ACCOUNT_MINIMUM);
const SEED_LTC_AMOUNT = parseFloat(process.env.SEED_LTC_AMOUNT); 

const CURRENCY_PAIR = 'LTC-EUR';

const EURO_TICKER = 'EUR';

const BITCOIN_TICKER = 'LTC';

const SLEEP_TIME = 10000; // 30 seconds


const BUYAT = parseFloat(process.env.BUYAT);
const SELLAT = BUYAT + parseFloat(process.env.SELLAT);

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

// Telegram logger
const telegramLogger = require('telegram-logger')
const logger = telegramLogger({
    token: process.env.TELEGRAMTOKEN,
    chat_id: process.env.TELEGRAMCHATID,
});

//Callbacks

const sellPreviousPurchaseCallback = (error, response, data) => {
    if (error)
        return console.log(error);

    if ((data != null) && (data.status === 'pending')) {
        estimatedProfit += (currentPrice - BUYAT) * SEED_LTC_AMOUNT ;
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
        buyOrderId = data.id;
        console.log('[ORDER] New buyorder id is : ' + buyOrderId);
        if ((lastBuyOrderPrice === null) || (lastBuyOrderPrice < currentPrice)) {
            lastBuyOrderPrice = currentPrice;
        }
    }
}

// Checks if buy has been filled
const getBuyOrderCallBack = (error, response, data) => {
    if (error)
        return console.log(error);

    if ((data != null)) {
        console.log('[ORDER] Check status of buyorder: ' + data.id);
    
        if (data.status === 'done') {
            console.log("\x1b[42m%s\x1b[0m", "[COMPLETE BUY ORDER] Price: " + Number(data.price).toFixed(2) + " EUR, size: " + Number(data.size).toFixed(8) + " LTC");
            if (ltcAvailable >= SEED_LTC_AMOUNT) { 
                console.log('[INFO] Place sell order for buyorderid: ' + data.id);
                sellPreviousPurchase();
            }
            logger('Bought ' + Number(data.size).toFixed(8) + ' LTC for ' + Number(data.price).toFixed(2))
                .then(data => console.log(data))
                .catch(err => console.error(err));
        } else {
            if (data.status !== 'open' && data.status !== 'pending' && data.status !== 'done') {
                // Manual deleted perhaps
                buyOrderId = null;        
            }
        }
    }
}

const getSellOrderCallBack = (error, response, data) => {
    if (error)
        return console.log(error);

    if (data != null) {
        console.log('[ORDER] Check status of sellorder: ' + data.id);
        if (data.status === 'done') {
            console.log("\x1b[41m%s\x1b[0m", "[COMPLETE SELL ORDER] Price: " + Number(data.price).toFixed(2) + " EUR, size: " + Number(data.size).toFixed(8) + " LTC");
            sellOrderId = null;
            logger('Sold ' + Number(data.size).toFixed(8) + ' LTC for ' + Number(data.price).toFixed(2) + '... Estimated profit' + estimatedProfit.toFixed(2))
                .then(data => console.log(data))
                .catch(err => console.error(err));
        } else {
            if (data.status !== 'open' && data.status !== 'pending' && data.status !== 'done') {
                // Manual deleted perhaps
                sellOrderId = null;  
            }
        }
    }
}

const buyOrder = (orderType, buySize, buyPrice, currencyPair) => {
    if (orderType === 'market' ) {
        return {
            'type': 'market',
            'size': buySize.toFixed(8),
            'product_id': currencyPair,
        };
    } else {
        return {
            'price': buyPrice.toFixed(2),
            'size': buySize.toFixed(8),
            'product_id': currencyPair,
            'post_only': true,
        };
    }
};

function placeBuyOrder() {
    let threshold = (BUYAT + 1.0) * SEED_LTC_AMOUNT;
    console.log('Eur available: ' + eurAvailable + ', buyThreshold: ' + threshold);
    
    if (eurAvailable >= threshold) {
        const buyParams = buyOrder(ORDERTYPE, SEED_LTC_AMOUNT, BUYAT, CURRENCY_PAIR);

        console.log("\x1b[42m%s\x1b[0m", "[BUY ORDER] Price: " + BUYAT.toFixed(2) + " EUR, size: " + SEED_LTC_AMOUNT.toFixed(8) + " LTC");

        authenticatedClient.buy(buyParams, buyOrderCallback);
    }
}

function sellPreviousPurchase() {
    let sellPrice;

    if (currentPrice > SELLAT) {    
        sellPrice = currentPrice + 0.01;
    } else {
        sellPrice = SELLAT;
    }
    
    const sellSize = SEED_LTC_AMOUNT;
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

        if (averagePrice === null) {
            console.log("[LITECOIN TICKER] Now: " + currentPrice.toFixed(2) + " EUR, time: " + data.time);
        } else {
            console.log("[LITECOINCOIN TICKER] Now: " + currentPrice.toFixed(2) + " EUR, average: " + averagePrice.toFixed(2) + " EUR, time: " + data.time);
        }

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

//Main logic
console.log("\n Config: SEED LTC: " + SEED_LTC_AMOUNT.toFixed(2));
console.log("\n Config: Order type: " + ORDERTYPE);
console.log("\n Config: Buy At: " + BUYAT.toFixed(2));
console.log("\n Config: Sell At: " + SELLAT.toFixed(2));
console.log("\n\n\n\nConnecting to GDAX in " + parseInt(SLEEP_TIME / 1000) + " seconds ...");

logger('Starting LTC-EUR BOT')
  .then(data => console.log(data))
  .catch(err => console.error(err))

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
