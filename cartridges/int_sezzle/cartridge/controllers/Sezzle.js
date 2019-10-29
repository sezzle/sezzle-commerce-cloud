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
var sezzle = require('*/cartridge/scripts/sezzle.ds');
var CurrentForms = session.getForms();
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var Order = require('dw/order/Order');

/**
 * Redirects the user to Sezzle's checkout
 */

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

/**
 * Redirects customer to sezzle's checkout if sezzle is enabled and there is no
 * gift certificates in basket
 */
exports.Redirect = redirect;
exports.Success = guard.ensure([ 'get' ], success);
exports.Init = init;