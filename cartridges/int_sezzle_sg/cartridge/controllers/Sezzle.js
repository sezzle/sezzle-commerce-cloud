'use strict';

/**
 * Controller that renders the home page.
 *
 * @module controllers/Sezzle
 */
var SEZZLE_PAYMENT_METHOD = 'Sezzle';
var Resource = require('dw/web/Resource');
var sezzleData = require('*/cartridge/scripts/data/sezzleData');
var storeFrontPath = sezzleData.getStoreFrontPath();
var fullStoreFrontPath = Resource.msg('sezzle.controllers.cartridge', 'sezzle', storeFrontPath);
var app = require(fullStoreFrontPath + '/cartridge/scripts/app');
var guard = require(fullStoreFrontPath + '/cartridge/scripts/guard');
var BasketMgr = require('dw/order/BasketMgr');
var ISML = require('dw/template/ISML');
var sezzle = require('*/cartridge/scripts/sezzle'),
    CurrentForms = session.getForms();
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var Order = require('dw/order/Order');
var logger = require('dw/system').Logger.getLogger('Sezzle', '');

/**
 * Redirects the user to Sezzle's checkout
 */

function redirect() {
    logger.debug('Selected Payment Method Id - {0}',
        CurrentForms.billing.paymentMethods.selectedPaymentMethodID.value);
    if (CurrentForms.billing.paymentMethods.selectedPaymentMethodID.value.equals(SEZZLE_PAYMENT_METHOD)) {
        var basket = BasketMgr.getCurrentBasket();
        var checkoutObject = sezzle.basket.initiateV1Checkout(basket);
        if (empty(checkoutObject)) {
            return false;
        }

        ISML.renderTemplate('sezzle/sezzleRedirect',
            {
                SezzleRedirectUrl: checkoutObject.redirect_url
            });
        session.privacy.sezzled = true;
        session.privacy.sezzleAmount = checkoutObject.amount_in_cents;
        session.privacy.referenceId = checkoutObject.order_reference_id;

        return true;
    }

    return false;
}

function init(basket, applicablePaymentMethods) {
    return sezzle.basket.validatePayments(basket,
        applicablePaymentMethods);
}

function postProcess(order) {
    try {
        Transaction.wrap(function () {
            sezzle.order.captureOrder(order, 'v1');
            order.custom.SezzleCapturedAmount = order.totalGrossPrice.toString();
            order.custom.SezzleStatus = 'CAPTURE';
            order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
            order.setStatus(Order.ORDER_STATUS_COMPLETED);
        });
    } catch (e) {
        logger.error('Sezzle Capturing error. Details - {0}',
            e);

        return new Status(Status.ERROR);
    }
    return new Status(Status.OK);
}

/**
 * Handle successful response from Sezzle
 */
function success() {
    var placeOrderResult = app.getController('COPlaceOrder').Start();

    if (placeOrderResult.error) {
        app.getController('COSummary').Start({
            PlaceOrderError: placeOrderResult.PlaceOrderError
        });
    } else if (placeOrderResult.order_created) {
        app.getController('COSummary').ShowConfirmation(placeOrderResult.Order);
        postProcess(placeOrderResult.Order);
    }
}

/**
 * Redirects customer to sezzle's checkout if sezzle is enabled and there is no
 * gift certificates in basket
 */
exports.Redirect = redirect;
exports.Success = guard.ensure(['get'],
    success);
exports.PostProcess = postProcess;
exports.Init = init;
