'use strict';

/**
 * Controller that renders the home page.
 *
 * @module controllers/Sezzle
 */

var BasketMgr = require('dw/order/BasketMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var sezzleUtils = require('*/cartridge/scripts/sezzle');
var OrderMgr = require('dw/order/OrderMgr');
var Resource = require('dw/web/Resource');
var Order = require('dw/order/Order');
var logger = require('dw/system').Logger.getLogger('Sezzle', '');

/*
 * Export the publicly available controller methods
 */

function authorize(orderNumber, paymentInstrument, paymentProcessor){
	var order = OrderMgr.getOrder(orderNumber);

	if (!session.custom.sezzled && empty(session.custom.sezzleResponseID)){
		return {error: true};
	}
	
	//Check the reference token passed during redirection
	var reference_id = request.httpParameterMap["order_reference_id"]
	logger.debug('Sezzle Payment Reference Id - {0}', reference_id );
	
	if (session.custom.referenceId != reference_id){
		logger.debug('Sezzle Error - Reference ID has changed' );
		return {error: true};
	}

	Transaction.wrap(function () {
		paymentInstrument.paymentTransaction.transactionID = orderNumber;
		paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
		var sezzleResponseObject = {
				'id' : session.custom.referenceId,
				'events' : [{'id': session.custom.sezzleFirstEventID}],
				'amount': session.custom.sezzleAmount,
				'token': session.custom.sezzleToken
		};
		sezzleUtils.order.updateAttributes(order, sezzleResponseObject, paymentProcessor, paymentInstrument);
		
	});
	return {authorized: true};
}

function postProcess(order){
	var payment_action = sezzleUtils.data.getSezzlePaymentAction();
	if (sezzleUtils.data.getSezzlePaymentAction() == 'CAPTURE'){
		try {
			Transaction.wrap(function(){
				var resp = sezzleUtils.order.captureOrder(order.custom.SezzleExternalId, order.orderNo);
				if (resp){
					if (resp.httpStatus == 200){
						order.custom.SezzleStatus = 'CAPTURE';
						order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
					}
					else{
						logger.debug('Sezzle Capturing error');
						return {error: true};
					}
				}
				else{
					logger.debug('Sezzle Capturing error. Details');
					return {error: true};
				}
			});
		} catch (e) {
			logger.debug('Sezzle Capturing error. Details - {0}', e);
			return {error: true};
		}
	}
	return {error: false};
}

function handle(){
	var basket = BasketMgr.getCurrentBasket();
	Transaction.wrap(function(){
		sezzleUtils.basket.createPaymentInstrument(basket);
		session.custom.sezzleResponseID = '';
		session.custom.sezzleFirstEventID = '';
		session.custom.sezzleAmount = '';
	});
	return {success: true};
}

exports.Handle = handle;
exports.Authorize = authorize;