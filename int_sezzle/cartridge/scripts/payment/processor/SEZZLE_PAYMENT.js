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
var Cart = require(Resource.msg('sezzle.controllers.cartridge','sezzle','app_storefront_controllers') + '/cartridge/scripts/models/CartModel');

/*
 * Export the publicly available controller methods
 */

function authorize(args){
	var orderNo = args.OrderNo;
	var paymentInstrument = args.PaymentInstrument;
	var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();
	var order = OrderMgr.getOrder(orderNo);

	if (!session.custom.sezzled && empty(session.custom.sezzleResponseID)){
		return {error: true};
	}

	Transaction.wrap(function () {
		paymentInstrument.paymentTransaction.transactionID = orderNo;
		paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
		dw.system.Logger.info('Payment Reference Id');
		dw.system.Logger.info(session.custom.referenceId);
		var sezzleResponseObject = {
				'id' : session.custom.referenceId,
				'events' : [{'id': session.custom.sezzleFirstEventID}],
				'amount': session.custom.sezzleAmount
		};
		sezzleUtils.order.updateAttributes(order, sezzleResponseObject, paymentProcessor, paymentInstrument);
	});

	return {authorized: true};
}

function handle(){
	var basket = BasketMgr.getCurrentBasket();
	Transaction.wrap(function(){
		dw.system.Logger.info('Sezzle Basket handle');
		dw.system.Logger.info(JSON.stringify(basket));
		sezzleUtils.basket.createPaymentInstrument(basket);
		session.custom.sezzleResponseID = '';
		session.custom.sezzleFirstEventID = '';
		session.custom.sezzleAmount = '';
	});
	return {success: true};
}

exports.Handle = handle;
exports.Authorize = authorize;