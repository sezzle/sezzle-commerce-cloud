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
var CurrentForms = session.getForms();
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
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


	session.custom.sezzled = true;
	
	return {
		status:{
			error: false,
			PlaceOrderError: new Status(Status.ERROR, 'basket.changed.error')
		}
	};
}

function postProcess(order){
	var logger = require('dw/system').Logger.getLogger('Sezzle', '');
	var payment_action = sezzle.data.getSezzlePaymentAction()
	if (sezzle.data.getSezzlePaymentAction() == 'CAPTURE'){
		try {
			Transaction.wrap(function(){
				var resp = sezzle.order.captureOrder(order.custom.SezzleExternalId, order.orderNo);
				if (resp){
					if (!resp.error){
						order.custom.SezzleStatus = 'CAPTURE';
						order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
						order.setStatus(Order.ORDER_STATUS_COMPLETED);
					}
				}
			});
		} catch (e) {
			sezzle.order.voidOrder(order.custom.SezzleExternalId);
			logger.debug('Sezzle Capturing error. Details - {0}', e);
			return new Status(Status.ERROR);
		}
	}
	return new Status(Status.OK);
}

function redirect() {
	var logger = require('dw/system').Logger.getLogger('Sezzle', '');
	logger.debug('Selected Payment Method Id - {0}', CurrentForms.billing.paymentMethods.selectedPaymentMethodID.value);
	if (CurrentForms.billing.paymentMethods.selectedPaymentMethodID.value.equals(SEZZLE_PAYMENT_METHOD)) {
		var basket = BasketMgr.getCurrentBasket();
		checkoutObject = sezzle.basket.initiateCheckout(basket)
		
		ISML.renderTemplate('sezzle/sezzleredirect', {
			SezzleRedirectUrl : checkoutObject['redirect_url']
		});
		session.custom.sezzleToken=sezzle.utils.getQueryString("id", checkoutObject['redirect_url'])
		session.custom.sezzled = true;
		session.custom.sezzleAmount = checkoutObject['amount_in_cents']
		session.custom.referenceId = checkoutObject['order_reference_id']
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
	var hookName = "dw.int_sezzle.payment_instrument"
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
				paymentInstrument.custom.sezzled = true;
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