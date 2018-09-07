'use strict';

/**
 * Controller that renders the home page.
 * 
 * @module controllers/Sezzle
 */
var SEZZLE_PAYMENT_METHOD = 'Sezzle';
var Resource = require('dw/web/Resource');
var app = require(Resource.msg('sezzle.controllers.cartridge','sezzle','app_storefront_controllers') + '/cartridge/scripts/app');
var guard = require(Resource.msg('sezzle.controllers.cartridge','sezzle','app_storefront_controllers') + '/cartridge/scripts/guard');
var BasketMgr = require('dw/order/BasketMgr');
var ISML = require('dw/template/ISML');
var sezzle = require('int_sezzle/cartridge/scripts/sezzle.ds');
var parametersMap = request.httpParameterMap;
var CurrentForms = session.getForms();
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var PaymentMgr = require('dw/order/PaymentMgr');
var Order = require('dw/order/Order');




/*
 * Export the publicly available controller methods
 */

function checkCart(cart) {
	var basket = 'object' in cart ? cart.object : cart;
	var selectedPaymentMethod = CurrentForms.billing.paymentMethods.selectedPaymentMethodID.value;
	if (!sezzle.data.getSezzleOnlineStatus() || selectedPaymentMethod != SEZZLE_PAYMENT_METHOD){
		return {
			status: new Status(Status.OK),
			authResponse: null
		};
	}

		var order_reference_id = parametersMap.order_reference_id.stringValue;
		if (empty(order_reference_id)) {
			dw.system.Logger.info('Checkout token empty')
			return {
				status:{
					error: true,
					PlaceOrderError: new Status(Status.ERROR, 'confirm.error.technical')
				}
			};
		}
//		var sezzleResponse = sezzle.order.authOrder(token);
//		session.custom.sezzleResponseID = sezzleResponse.response.id;
//		session.custom.sezzleFirstEventID = sezzleResponse.response.events[0].id;
//		session.custom.sezzleAmount = sezzleResponse.response.amount;
		session.custom.sezzleed = true;
		session.custom.referenceId = order_reference_id;
//		if (empty(sezzleResponse) || sezzleResponse.error){
//			dw.system.Logger.info('Empty Sezzle Response')
//			return {
//				status:{
//					error: true,
//					PlaceOrderError: new Status(Status.ERROR, 'confirm.error.technical')
//				}
//			};
//		}
//		var sezzleStatus = sezzle.basket.syncBasket(basket, sezzleResponse.response);
//		if (sezzleStatus.error){
//			sezzle.order.voidOrder(sezzleResponse.response.id);
//		}
//		dw.system.Logger.info('Something else is wrong')
//		return {
//			status:{
//				error: sezzleStatus.error,
//				PlaceOrderError: new Status(Status.ERROR, 'basket.changed.error')
//			}
//		};
		
		return {
			status:{
				error: false,
				PlaceOrderError: new Status(Status.ERROR, 'basket.changed.error')
			}
		};
}

function postProcess(order){
	var logger = require('dw/system').Logger.getLogger('Sezzle', '');
	if (sezzle.data.getSezzlePaymentAction() == 'CAPTURE'){
		try {
			Transaction.wrap(function(){
				sezzle.order.captureOrder(order.custom.SezzleExternalId);
				order.custom.SezzleStatus = 'CAPTURE';
				order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
				order.setStatus(Order.ORDER_STATUS_COMPLETED);
			});
		} catch (e) {
			sezzle.order.voidOrder(order.custom.SezzleExternalId);
			logger.error('Sezzle Capturing error. Details - {0}', e);
			return new Status(Status.ERROR);
		}
	}
	return new Status(Status.OK);
}

function redirect() {
	var logger = require('dw/system').Logger.getLogger('Sezzle', '');
	if (CurrentForms.billing.paymentMethods.selectedPaymentMethodID.value.equals(SEZZLE_PAYMENT_METHOD) && sezzle.data.getSezzleVCNStatus() != 'on') {
		
		var basket = BasketMgr.getCurrentBasket();
		logger.debug('Sezzle Basket Details - {0}', basket);
		ISML.renderTemplate('sezzle/sezzlecheckout', {
			Basket : basket
		});
		return true;
	} else {
		return false;
	}
}

function init(basket, applicablePaymentMethods) {
	return sezzle.basket.validatePayments(basket, applicablePaymentMethods);
}

/**
 * Handle successful response from Sezzle
 */
function success() {
	var placeOrderResult = app.getController('COPlaceOrder').Start();
	if (placeOrderResult.error) {
		app.getController('COSummary').Start({
			PlaceOrderError : placeOrderResult.PlaceOrderError
		});
	} else if (placeOrderResult.order_created) {
		app.getController('COSummary').ShowConfirmation(placeOrderResult.Order);
	}
}

function updateBasket(){
	if (!dw.web.CSRFProtection.validateRequest()){
		response.writer.print(JSON.stringify({error: true}));
		return;
	}
	var hookName = "dw.int_sezzle.payment_instrument." + sezzle.data.VCNPaymentInstrument();
	var basket = BasketMgr.getCurrentBasket();
	var cart = app.getModel('Cart').get(basket);
	response.setContentType('application/json');
	Transaction.wrap(function(){
		cart.removeExistingPaymentInstruments(SEZZLE_PAYMENT_METHOD);
	});
	if (dw.system.HookMgr.hasHook(hookName)){
		var paymentInstrument = dw.system.HookMgr.callHook(hookName, "add", basket);
		if (!paymentInstrument){
			response.writer.print(JSON.stringify({error: true}));
			return;
		} else {
			Transaction.wrap(function(){
				paymentInstrument.custom.sezzleed = true;
			});
		}
	} else {
		response.writer.print(JSON.stringify({error: true}));
		return;
	}
	
	response.writer.print(JSON.stringify({error: false}));
}

/**
 * Checks authentication and synchronization DW Basket and Sezzle Basket
 */
exports.CheckCart = checkCart;

/**
 * Redirects customer to sezzle's checkout if sezzle is enabled and there is no
 * gift certificates in basket
 */
exports.Redirect = redirect;
exports.Success = guard.ensure([ 'get' ], success);
exports.Init = init;
exports.Update = guard.ensure([ 'post' ], updateBasket);
exports.PostProcess = postProcess;