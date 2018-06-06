"use strict";

require('dotenv').config();

const GdaxModule = require('gdax');

const PASSPHRASE = process.env.TRADING_BOT_PASSPHRASE;
const KEY = process.env.TRADING_BOT_KEY;
const SECRET = process.env.TRADING_BOT_SECRET;

const GDAX_URI = 'https://api.gdax.com';

let authenticatedClient = null;

const getAccountsCallback = (error, response, data) => {
    if (error)
        return console.log(error);

    if ((data != null) && (Symbol.iterator in Object(data))) {
        for (var item of data) {
            console.log(item.currency + ":: Available: " + item.available + ' Balance: ' + item.balance)
        }
    }
}

authenticatedClient = new GdaxModule.AuthenticatedClient(KEY, SECRET, PASSPHRASE, GDAX_URI);
//Get the balance of the wallets and execute the trading strategy
authenticatedClient.getAccounts(getAccountsCallback);