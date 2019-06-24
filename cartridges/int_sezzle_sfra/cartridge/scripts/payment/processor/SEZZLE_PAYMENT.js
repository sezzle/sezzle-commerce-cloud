'use strict';

/**
 * Controller that renders the home page.
 *
 * @module controllers/Sezzle
 */

var BasketMgr = require('dw/order/BasketMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var sezzleUtils = require('int_sezzle/cartridge/scripts/sezzle');
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
    
  //Check the reference token passed during redirection
	var reference_id = request.httpParameterMap["order_reference_id"]
	dw.system.Logger.debug('Sezzle Payment Reference Id - {0}', reference_id );
	
	if (session.custom.referenceId != reference_id){
		dw.system.Logger.debug('Sezzle Error - Reference ID has changed' );
		return {error: true};
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