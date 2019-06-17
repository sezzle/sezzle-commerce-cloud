'use strict';

/**
 * Controller that renders the home page.
 *
 * @module controllers/Sezzle
 */

var BasketMgr = require('dw/order/BasketMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var sezzleUtils = require('int_sezzle_sfra/cartridge/scripts/sezzle');
var OrderMgr = require('dw/order/OrderMgr');
var Resource = require('dw/web/Resource');

/*
 * Export the publicly available controller methods
 */

function authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var order = OrderMgr.getOrder(orderNumber);

    if (!paymentInstrument.custom.sezzleed && empty(session.custom.sezzleResponseID)) {
        return { error: true };
    }
    Transaction.wrap(function () {
        paymentInstrument.paymentTransaction.transactionID = orderNumber;
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
        var sezzleResponseObject = {
                'id': session.custom.sezzleResponseID,
                'events': [{'id': session.custom.sezzleFirstEventID}],
                'amount': session.custom.sezzleAmount
        };
        sezzleUtils.order.updateAttributes(order, sezzleResponseObject, paymentProcessor, paymentInstrument);
    });
    return { authorized: true };
}
function handle() {
    var basket = BasketMgr.getCurrentBasket();
    Transaction.wrap(function () {
        sezzleUtils.basket.createPaymentInstrument(basket);
        session.custom.sezzleResponseID = '';
        session.custom.sezzleFirstEventID = '';
        session.custom.sezzleAmount = '';
    });
    return { success: true };
}

exports.Handle = handle;
exports.Authorize = authorize;