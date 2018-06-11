"use strict";

require('dotenv').config();

const GdaxModule = require('gdax');
let stdio = require('stdio');
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
    'side': { key: 't', args: 1, mandatory: true, description: 'Side to start with buy or sell' }
});

let CRYPTO_CURRENCY = ops.cryptocurreny + '-EUR';
let SIZE = parseFloat(ops.size);
let PRICE = parseFloat(ops.price);
let PROFIT = parseFloat(ops.spread);
let SIDE = ops.side;

let currentOrder = {
    orderid: '',
    side: 'buy',
    status: 'pending',
    price: 0.0,
    size: 0.0
}

const PASSPHRASE = process.env.TRADING_BOT_PASSPHRASE;
const KEY = process.env.TRADING_BOT_KEY;
const SECRET = process.env.TRADING_BOT_SECRET;
const GDAX_URI = 'https://api.gdax.com';

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
    gdax_ws = new GdaxModule.WebsocketClient([CRYPTO_CURRENCY], 'wss://ws-feed.gdax.com', {
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

/**
 *
 */
const process_ws_message = (data) => {
    console.log(data)
    
    if (currentOrder.orderid != data.order_id) return

    switch (data.type) {
        case 'done': {
            switch (data.reason) {
                case 'canceled':
                    currentOrder.status = data.reason;
                    currentOrder.orderid = '';
                    break
                case 'filled':
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

currentOrder.price = PRICE;
placeOrder(SIDE, PRICE);
init_ws_stream();