"use strict";

require('dotenv').config();

const GdaxModule = require('gdax');
const TelegramBot = require('node-telegram-bot-api');
const stdio = require('stdio');

const PASSPHRASE = process.env.TRADING_BOT_PASSPHRASE;
const KEY = process.env.TRADING_BOT_KEY;
const SECRET = process.env.TRADING_BOT_SECRET;
const GDAX_URI = 'https://api.gdax.com';
const TELEGRAMTOKEN = process.env.TELEGRAMTOKEN;
const TELEGRAMCHATID = process.env.TELEGRAMCHATID;

const bot = new TelegramBot(TELEGRAMTOKEN, {polling: true});

let authenticatedClient = null;
let publicClient = null;
let orderParams = null;
let currentPrice = 0.0;
let gdax_ws = null;

let ops = stdio.getopt({
    'cryptocurreny': { key: 'c', args: 1, mandatory: true, description: 'Which crypto curreny LTC,BTC, ETH or BCH' },
    'size': { key: 's', args: 1, mandatory: true, description: 'Size to buy per increment 0.1 ex. for 0.1 LTC' },
    'price': { key: 'p', args: 1, mandatory: true, description: 'Start price to calculate' },
    'spread': { key: 'f', args: 1, mandatory: true, description: 'Diff between sell and buy' },
    'side': { key: 't', args: 1, mandatory: true, description: 'Side to start with buy or sell' },
    'monitor': { description: 'Only monitor sells and buys' },
});

let CRYPTO_CURRENCY = ops.cryptocurreny + '-EUR';
let SIZE = parseFloat(ops.size);
let PRICE = parseFloat(ops.price);
let PROFIT = parseFloat(ops.spread);
let SIDE = ops.side;
let MONITORONLY = ops.monitor ? true: false;

let profit = 0.0;
let tradeProfit = 0.0;

let currentOrder = {
    orderid: '',
    side: 'buy',
    status: 'pending',
    price: 0.0,
    size: 0.0
}


//Functions
const order = (orderType, orderSize, currentPrice, currencyPair) => {
    if (orderType === 'market') {
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
    
    currentOrder.orderid = data.id;
    currentOrder.side = data.side;
    currentOrder.size = data.size;
    currentOrder.price = data.price;
    currentOrder.status = 'pending';

    console.log('[ORDER] New ' + currentOrder.side + 'order id is : ' + currentOrder.orderid);

    return console.log(data.status + ': '+ data.reason);
}

const getProductTickerCallback = (error, response, data) => {
    if (error)
        return console.log(error);

    if (data != null) {
        currentPrice = parseFloat(data.bid);
        if (currentOrder.side == 'sell' && currentOrder.status == 'filled') {
            placeOrder('buy', currentPrice)
        }

        if (currentOrder.side == 'buy' && currentOrder.status == 'filled') {
            placeOrder('sell', currentPrice)
        }

    } else {
        console.log('No price avail');
    }

    console.log(currentPrice);

    
}

const placeOrder = (side, price) => {
    let sellPrice = 0.0;
    let buyPrice = 0.0;

    if (parseFloat(currentOrder.price) + PROFIT < price) {
        sellPrice = parseFloat(price) + 0.01; 
    } else {
        sellPrice = parseFloat(currentOrder.price) + PROFIT;
    }

    if (parseFloat(currentOrder.price) - PROFIT > price) {
        buyPrice = parseFloat(price) - 0.01; 
    } else {
        buyPrice = parseFloat(currentOrder.price) - PROFIT;
    }

    currentOrder.orderid = '';
    
    if (side == 'buy') {
        orderParams = order('limit', SIZE, buyPrice, CRYPTO_CURRENCY);
        authenticatedClient.buy(orderParams, orderCallback);
    }

    if (side == 'sell') {
        orderParams = order('limit', SIZE, sellPrice, CRYPTO_CURRENCY);
        authenticatedClient.sell(orderParams, orderCallback);
    }

    console.log("\x1b[42m%s\x1b[0m", side + " [ORDER] Price: " + parseFloat(orderParams.price).toFixed(2) + " EUR, size: " + parseFloat(orderParams.size).toFixed(8) + ' ' + CRYPTO_CURRENCY);
    console.log('--------');
    console.log(orderParams);
    console.log('--------');
}

const init_ws_stream = () => {
    gdax_ws = new GdaxModule.WebsocketClient(['BCH-EUR','BTC-EUR','ETH-EUR', 'LTC-EUR'], 'wss://ws-feed.gdax.com', {
        key: KEY,
        secret: SECRET,
        passphrase: PASSPHRASE,
    }, {
            heartbeat: true,
            channels: ['user', 'heartbeat']
        })

    gdax_ws.on('message', (data) => {
        switch (data.type) {
            case "heartbeat":
            case "subscriptions":
                return
                break
            default:
                process_ws_message(data)
                break
        }
    })

    gdax_ws.on('error', (error) => {
        console.log(error)
    })

    gdax_ws.on('close', (data) => {
        ws_reconnect(gdax_ws, data)
    })
}

const ws_reconnect = (ws, data) => {
    console.log(`GDAX websocket disconnected with data: ${data}`)
    // try to re-connect the first time...
    ws.connect()
    let count = 1
    // attempt to re-connect every 30 seconds.
    // TODO: maybe use an exponential backoff instead
    const interval = setInterval(() => {
        if (!ws.socket) {
            console.log(`Reconnecting to GDAX (attempt ${count++})`)
            //count++
            ws.connect()
        } else {
            console.log('GDAX reconnected')
            clearInterval(interval)
        }
    }, 10000)
}

const sendMessage = (error, response, data) => {
    if (error) {
        console.log(error)
        return
    }
    console.log(data)
    bot.sendMessage(TELEGRAMCHATID, `${data.done_at} :: _${data.side} ${data.product_id}_ *Filled* for ${data.filled_size}  type ${data.type}.`,{'parse_mode': 'Markdown'});
}

/**
 *
 */
const process_ws_message = (data) => {
    console.log(data)
    
    if (currentOrder.orderid != data.order_id) {
        if (data.type == 'done' && data.reason == 'filled') {
            authenticatedClient.getOrder(data.order_id, sendMessage)
        }
        if (data.type == 'done' && data.reason == 'canceled') {
            bot.sendMessage(TELEGRAMCHATID, `${data.time} :: _${data.side} ${data.product_id}_ *Canceled* for ${data.remaining_size}.`,{'parse_mode': 'Markdown'});
        }
        return
    }
    
    switch (data.type) {
        case 'done': {
            switch (data.reason) {
                case 'canceled':
                    currentOrder.status = data.reason;
                    currentOrder.orderid = '';
                    currentOrder.price = 0.0;
                    currentOrder.status = data.reason;
                    bot.sendMessage(TELEGRAMCHATID, `${data.time} :: _${data.side} ${data.product_id}_ *Canceled* for ${currentOrder.price} with size ${data.remaining_size}.`,{'parse_mode': 'Markdown'});
                    break
                case 'filled':
                    if (currentOrder.side == 'sell') {
                        tradeProfit = parseFloat(PROFIT * SIZE).toFixed(2);
                        profit += tradeProfit;
                        console.log('*******');
                        console.log('Profit: ' + profit);
                        console.log('*******');
                        bot.sendMessage(TELEGRAMCHATID, `${data.time} :: _${data.side} ${data.product_id}_ *Filled* for ${currentOrder.price} with size ${data.size}. Orderprofit: ${tradeProfit}. Total profit: ${profit}`,{'parse_mode': 'Markdown'});
                    }
                    currentOrder.status = data.reason;
                    publicClient.getProductTicker(CRYPTO_CURRENCY, getProductTickerCallback);
                    break
            }
        } break
        case 'match': {
            let order_id = null
            switch (data.side) {
                case 'buy':
                    order_id = data.maker_order_id
                    break
                case 'sell':
                    order_id = data.taker_order_id
                    break
            }
            if (!order_id) return
            if (currentOrder.orderid != order_id) return
        } break
    }
}


publicClient = new GdaxModule.PublicClient(GDAX_URI);
authenticatedClient = new GdaxModule.AuthenticatedClient(KEY, SECRET, PASSPHRASE, GDAX_URI);


function main() {
    bot.sendMessage(TELEGRAMCHATID,'*Klaar om te handelen*',{'parse_mode': 'Markdown'});
    currentOrder.price = PRICE;
    if (!MONITORONLY) {
        placeOrder(SIDE, PRICE);
    }
    init_ws_stream();
}
    
main();