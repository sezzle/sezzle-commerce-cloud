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
var Money = require('dw/value/Money');
var logger = require('dw/system').Logger.getLogger('Sezzle', '');

/*
 * Export the publicly available controller methods
 */

/**
 * Authorize Payment
 *
 * @param {dw.order.Order.orderNo} orderNumber
 * @param {dw.order.PaymentInstrument} PaymentInstrument payment instrument instance
 * @param {dw.order.PaymentProcessor} PaymentProcessor payment processor instance
 * @returns {Object} authorize response
 */
function authorize(orderNumber, paymentInstrument, paymentProcessor){
	var order = OrderMgr.getOrder(orderNumber);

	if (!session.privacy.sezzled && empty(session.privacy.sezzleResponseID)){
		return {error: true};
	}
	
	//Check the reference token passed during redirection
	var reference_id = request.httpParameterMap["order_reference_id"]
	logger.debug('Sezzle Payment Reference Id - {0}', reference_id );
	
	if (session.privacy.referenceId != reference_id){
		logger.debug('Sezzle Error - Reference ID has changed' );
		return {error: true};
	}

	Transaction.wrap(function () {
		paymentInstrument.paymentTransaction.transactionID = reference_id;
		paymentInstrument.paymentTransaction.amount = new Money(session.privacy.sezzleOrderAmount, order.currencyCode).divide(100);
		paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
		var sezzleResponseObject = {
				'reference_id' : session.privacy.referenceId,
				'order_uuid' : session.privacy.orderUUID,
				'events' : [{'id': session.privacy.sezzleFirstEventID}],
				'amount': session.privacy.sezzleOrderAmount,
				'token': session.privacy.sezzleToken,
				'token_expiration': session.privacy.tokenExpiration,
				'order_links' : {
					'get_order' : session.privacy.getOrderLink,
					'update_order' : session.privacy.updateOrderLink,
					'capture_payment' : session.privacy.capturePaymentLink,
					'refund_payment' : session.privacy.refundPaymentLink,
					'release_payment' : session.privacy.releasePaymentLink
				}
		};
		sezzleUtils.order.updateAttributes(order, sezzleResponseObject, paymentProcessor, paymentInstrument);
		
	});
	return {authorized: true};
}

/**
 * Post process order
 *
 * @param {dw.order.Order} order
 * @returns {Object} processing response
 */
function postProcess(order){
	var payment_action = sezzleUtils.data.getSezzlePaymentAction();
	if (sezzleUtils.data.getSezzlePaymentAction() == 'CAPTURE'){
		try {
			Transaction.wrap(function(){
				var resp = sezzleUtils.order.captureOrder(order);
				if (resp){
					if (resp.httpStatus == 200){
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

/**
 * Handle creating of payment instrument
 *
 * @param {dw.order.Order} order
 * @returns {Object} response
 */
function handle(){
	var basket = BasketMgr.getCurrentBasket();
	Transaction.wrap(function(){
		sezzleUtils.basket.createPaymentInstrument(basket);
		session.privacy.sezzleResponseID = '';
		session.privacy.sezzleFirstEventID = '';
		session.privacy.sezzleAmount = '';
	});
	return {success: true};
}


exports.Handle = handle;
exports.Authorize = authorize;
exports.PostProcess = postProcess;