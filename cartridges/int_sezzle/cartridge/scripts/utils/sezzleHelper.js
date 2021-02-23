'use strict';

/* global empty */
var BasketMgr = require('dw/order/BasketMgr');
var sezzle = require('*/cartridge/scripts/sezzle');
var sezzleData = require('~/cartridge/scripts/data/sezzleData');
var Transaction = require('dw/system/Transaction');
var Order = require('dw/order/Order');
var logger = require('dw/system').Logger.getLogger('Sezzle', 'sezzle');

/*
 * Export the publicly available controller methods
 */

/**
 * Check Cart
 *
 * @param {Object} cart Cart
 * @returns {Object} status response
 */
function checkCart(cart) {
    var basket = 'object' in cart ? cart.object : cart;

    var paymentInstruments = basket.paymentInstruments;
    var paymentMethod = '';

    for (var i = 0; i < paymentInstruments.length; i++) { // eslint-disable-line no-plusplus
        var paymentInstrument = paymentInstruments[i];
        paymentMethod = paymentInstrument.paymentMethod;
    }

    if (!paymentInstruments) {
        return {
            status: {
                error: true
            }
        };
    }

    if (!sezzle.data.getSezzleOnlineStatus() || paymentMethod !== 'Sezzle') {
        return {
            status: {
                error: false
            }
        };
    }

	var basketTotal = basket.getTotalGrossPrice();
	var basketTotalInCents = basketTotal.multiply(100).getValue();

	if (basketTotalInCents != session.privacy.sezzleOrderAmount || basket.giftCertificateTotalPrice.value > 0) {
        return {
            status: {
                error: true,
				basket_changed: true
            }
        };
    }


    return {
        status: {
            error: false
        }
    };
}

/**
 * Store tokenize record to Customer profile and Order
 *
 * @param {dw.order.Order} order Order
 * @param {Object} tokenizeObject Tokenize Object
 */
function storeTokenizeRecord(order, tokenizeObject) {
    try {
        var orderObj = order;
        if (empty(tokenizeObject)) {
            throw new Error('{tokenizeObject} is empty');
        }

        if (tokenizeObject.token !== '') {
            if (!tokenizeObject.is_customer_tokenized) {
                throw new Error('Customer not tokenized by Sezzle. Bypassing storing');
            }
            var token = tokenizeObject.token;
            var tokenDetails = sezzle.order.getTokenDetails(token);
            if (tokenDetails == null || tokenDetails.error) {
                throw new Error('Unable to get tokenize details from Sezzle');
            }

            Transaction.wrap(function () {
                var profile = order.getCustomer().getProfile();
                if (profile != null) {
                    profile.custom.SezzleCustomerUUID = tokenDetails.response.customer.uuid;
                    profile.custom.SezzleCustomerTokenizeStatus = true;
                    profile.custom.SezzleCustomerUUIDExpiration = tokenDetails.response.customer.expiration;
                    var customerLinks = tokenDetails.response.customer.links;
                    if (customerLinks) {
                        for (var k = 0; k < customerLinks.length; k++) { // eslint-disable-line no-plusplus
                            var link = customerLinks[k];
                            switch (link.rel) {
                                case 'order':
                                    if (link.method === 'POST') {
                                        profile.custom.SezzleCustomerCreateOrderLink = link.href;
                                    }
                                    break;
                                case 'self':
                                    if (link.method === 'GET') {
                                        profile.custom.SezzleGetCustomerLink = link.href;
                                    }
                                    break;
                                default:
                                    break;
                            }
                        }
                    }
                }

                orderObj.custom.SezzleCustomerUUID = tokenDetails.response.customer.uuid;
                orderObj.custom.SezzleCustomerUUIDExpiration = tokenDetails.response.customer.expiration;
            });
            logger.info('Tokenize record successfully stored in Order and Profile');
        } else if (tokenizeObject.customer_uuid !== '' && tokenizeObject.customer_uuid_expiration !== '') {
            Transaction.wrap(function () {
                orderObj.custom.SezzleCustomerUUID = tokenizeObject.customer_uuid;
                orderObj.custom.SezzleCustomerUUIDExpiration = tokenizeObject.customer_uuid_expiration;
            });
            logger.info('Tokenize record successfully stored in Order and Profile');
        }
    } catch (e) {
        logger.error('sezzleHelper.storeTokenizeRecord.- {0}', e);
        logger.error('Tokenize record not stored in Order and Profile');
    }
}

/**
 * Processing post order creation in Salesforce
 *
 * @param {dw.order.Order} order Order
 * @returns {boolean} status
 */
function postProcess(order) {
    var orderObj = order;
    var canCapture = String(sezzleData.getSezzlePaymentAction()) === 'CAPTURE';
    try {
        Transaction.wrap(function () {
            if (canCapture) {
				var captureAmount = sezzle.utils.calculateNonGiftCertificateOrderAmount(order);
                var isCaptured = sezzle.order.captureOrder(orderObj, captureAmount);
				if (!isCaptured) {
					throw new Error('Capture Payment Error');
				}
                orderObj.custom.SezzleCapturedAmount = captureAmount.toString();
                orderObj.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                logger.info('Payment has been captured successfully by Sezzle');
            }
            if (orderObj.custom.SezzleOrderUUID) {
                var sezzleOrder = sezzle.order.getOrderByOrderUUID(orderObj);
                if (!sezzleOrder.error && !canCapture) {
                    orderObj.custom.SezzleAuthExpiration = sezzleOrder.response.authorization.expiration;
                }
                sezzle.order.updateOrder(orderObj);
                logger.info('SFCC Order No has been successfully updated in the corresponding Sezzle order');
            }
        });
        return true;
    } catch (e) {
        logger.error('sezzleHelper.postProcess.- {0}', e);
        return false;
    }
}

/**
 * Validate payments
 *
 * @param {dw.order.Basket} basket Basket
 * @param {dw.util.List} applicablePaymentMethods Applicable Payment Methods
 * @returns {dw.util.List} applicablePaymentMethods
 */
function init(basket, applicablePaymentMethods) {
    return sezzle.basket.validatePayments(basket, applicablePaymentMethods);
}

/**
 * Check if Sezzle payment method can be applicable for checkout
 *
 * @returns {booelan} status
 */
function isSezzleApplicable() {
    var basket = BasketMgr.getCurrentBasket();
    return !(!basket.getGiftCertificateLineItems().empty || !sezzle.data.getSezzleOnlineStatus() || sezzle.data.getSezzlePaymentOnlineStatus() || !sezzle.utils.checkBasketTotalRange('object' in basket ? basket.object : basket));
}

/**
 * Gather Info from Sezzle Checkout
 */
function gatherInfoFromSezzleCheckout(checkoutObject) {
	session.privacy.sezzled = true;
    session.privacy.sezzleOrderAmount = checkoutObject.checkout.amount_in_cents;
    session.privacy.referenceId = checkoutObject.checkout.reference_id;
    session.privacy.orderUUID = checkoutObject.checkout.order_uuid;
    var orderLinks = checkoutObject.checkout.order_links;

    if (!orderLinks.length) {
		return;
	}
	var findLink = function(m, r) {
		var obj = orderLinks.filter(l => l.method === m && l.rel === r);
		return obj.length ? obj[0].href : '';
	}
	
	session.privacy.getOrderLink = findLink('GET', 'self');
	session.privacy.updateOrderLink = findLink('PATCH', 'self');
	session.privacy.capturePaymentLink = findLink('POST', 'capture');
	session.privacy.refundPaymentLink = findLink('POST', 'refund');
	session.privacy.releasePaymentLink = findLink('POST', 'release');
    logger.info('Order Links has been successfully gathered into session');

    if (!checkoutObject.tokenize) {
		return;
	}
    session.privacy.token = checkoutObject.tokenize.token || '';
    session.privacy.tokenExpiration = checkoutObject.tokenize.token_expiration || '';
    session.privacy.customerUUID = checkoutObject.tokenize.customer_uuid || '';
    session.privacy.customerUUIDExpiration = checkoutObject.tokenize.customer_uuid_expiration || '';
    logger.info('Tokenize records has been successfully gathered into session');
}

module.exports = {
    Init: init,
    CheckCart: checkCart,
    StoreTokenizeRecord: storeTokenizeRecord,
    PostProcess: postProcess,
    IsSezzleApplicable: isSezzleApplicable,
	GatherInfoFromSezzleCheckout: gatherInfoFromSezzleCheckout
};
