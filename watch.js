"use strict";

require('dotenv').config();

const GdaxModule = require('gdax');
const TelegramBot = require('node-telegram-bot-api');
const PASSPHRASE = process.env.TRADING_BOT_PASSPHRASE;
const KEY = process.env.TRADING_BOT_KEY;
const SECRET = process.env.TRADING_BOT_SECRET;
const GDAX_URI = 'https://api.gdax.com';
const TELEGRAMTOKEN = process.env.TELEGRAMTOKEN;
const TELEGRAMCHATID = process.env.TELEGRAMCHATID;

const bot = new TelegramBot(TELEGRAMTOKEN, {polling: true});

let authenticatedClient = null;
let publicClient = null;
let gdax_ws = null;

const getProductTickerCallback = (error, response, data) => {
    if (error)
        return console.log(error);

    if (data != null) {
        currentPrice = parseFloat(data.bid);
    } else {
        console.log('No price avail');
    }
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
    switch (data.type) {
        case 'done': {
            switch (data.reason) {
                case 'canceled':
                    bot.sendMessage(TELEGRAMCHATID, `${data.time} :: _${data.side} ${data.product_id}_ *Canceled* for ${data.remaining_size}.`,{'parse_mode': 'Markdown'});
                    break
                case 'filled':
                    authenticatedClient.getOrder(data.order_id, sendMessage)
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
        } break
    }
}

publicClient = new GdaxModule.PublicClient(GDAX_URI);
authenticatedClient = new GdaxModule.AuthenticatedClient(KEY, SECRET, PASSPHRASE, GDAX_URI);

function main() {
    bot.sendMessage(TELEGRAMCHATID,'*Klaar om watchen*',{'parse_mode': 'Markdown'});
    init_ws_stream();
}
    
main();