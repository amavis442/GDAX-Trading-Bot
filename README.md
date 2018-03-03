# GDAX Trading Bot

This program is an automated trading system that can autonomously trade the BTC / EUR pair in the GDAX exchange. 

Keep in mind that trading is a risky activity that can involve a loss of money. You should only invest the amount you can afford to lose.

## Trading strategy

The trading strategy consists of issuing a large number of low value orders. The program continuously monitors the price of bitcoin and issues a market buy order when the price begins to rise above the weighted average of the previous prices. Once the buy order is filled, the program issues a limit sell order with a one percent increase over the purchase price.

### The seed

The seed is the amount of bitcoins that the program will buy and sell continuously to earn euros. The greater the seed, the greater the benefit. The seed value must be set in the program variable SEED_BTC_AMOUNT.

It is recommended that the seed does not exceed one hundredth of the amount of bitcoins you can buy.

Example:

- If your current euro balance is 1000 euros and the bitcoin price is 10000 euros you can buy 0.1 btc
- If you can buy 0.1 btc the recommended seed is 0.001 btc

## Quick guide

### Registration

- Register in Coinbase (https://www.coinbase.com)
- Use the Coinbase account to login to the Gdax exchange (https://www.gdax.com)
- Deposit the amount of euros you want with a SEPA transfer.

### API Key generation

Generate an API Key only with trade permission (https://www.gdax.com/settings/api)

### Environment variables

Copy .env.example to .env and fill in the credentials from coinbase

- TRADING_BOT_PASSPHRASE
- TRADING_BOT_KEY
- TRADING_BOT_SECRET
- LIMIT_BUY
- EURO_IN_ACCOUNT_MINIMUM

You can also set the toplimit to buy when you are not feeling so adventurious and the amount of euro's that has to stay
in your account. This should be amount + price 0.001 BTC euro = 50 + 8.80 when BTC is 8.80 euro.

### Installation

- Install Node.js (https://nodejs.org)
- Download this repository
- Open a system console
- Run "npm install" in the root folder to install the required modules

### Configuration

- Open the file "index.js" with a text editor
- Set the seed in the variable SEED_BTC_AMOUNT

### Execution

- Open a system console
- Run "node index.js" in the root folder to start the execution of the program
- Press Ctrl + C to exit 

## Donations

Please consider making a donation to the following bitcoin address (BTC):

1KNcZ1z3yuEK1hF27y53MyjJSZsPUYz3Ty
