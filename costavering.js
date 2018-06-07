"use strict";

let stdio = require('stdio');

let ops = stdio.getopt({
    'price': {key: 'p', args: 1, mandatory: true, description: 'Start price to calculate'},
    'size': {key: 's',args: 1, mandatory: true, description: 'Size to buy per increment 0.1 ex. for 0.1 LTC'},
    'number': {key: 'n', args: 1, description: 'Number of orders'},
    'bottombuyprice': {key: 'b', args: 1, description: 'Bottom buy price'},
    'increment': {key: 'i', args: 1, mandatory: true, description: 'The increment in cents (5 = 5 cent increment)'},
    'sellprice': {key: 't', args: 1, mandatory: true, description: 'Price at which to sell'},
});

let PRICE = parseFloat(ops.price);
let SIZE = parseFloat(ops.size);
let NUMBER = parseInt(ops.number);
let INCREMENT = ops.increment;
let SELLPRICE = parseFloat(ops.sellprice);
let BOTTOMPRICE = parseFloat(ops.bottombuyprice);
let diffPrice = 0.0;
let incrementInCents = 0;

if (!NUMBER){
    diffPrice = parseFloat((PRICE -BOTTOMPRICE) * 100).toFixed(2);
    NUMBER = parseInt(diffPrice / INCREMENT) + 1;
}
//console.log('DiffPrice: ' + diffPrice);

//console.log('Number orders: ' + NUMBER);


let profit = 0.0;
let breakeven = 0.0;
let buyPrice = 0.0;
let n = 0;
let profitPerOrder = 0.0;
let sizeOrders = 0.0;

for (var i = 0; i < NUMBER;i++) {
    n = i + 1;
    buyPrice = parseFloat(PRICE - i*(INCREMENT/100)).toFixed(2);
    //console.log(n + 'th buyPrice: ' + buyPrice);
    profitPerOrder = (SELLPRICE - buyPrice) * SIZE;
    profit += profitPerOrder;
    //console.log('Profit: ' + parseFloat(profitPerOrder).toFixed(2));
    breakeven += parseFloat(buyPrice);
    sizeOrders += parseFloat(SIZE);
}

//console.log('Break even total: ' + breakeven);
breakeven = (breakeven / NUMBER);
console.log('Break even sellprice: ' + parseFloat(breakeven).toFixed(3));
console.log('Profit at sellprice ' + SELLPRICE + '  = ' + parseFloat(profit).toFixed(2));
console.log('Number of orders: ' + NUMBER);
console.log('Ordersize: ' + parseFloat(sizeOrders).toFixed(8));
