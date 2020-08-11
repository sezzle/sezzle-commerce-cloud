'use strict';

/* global empty */
var BasketMgr = require('dw/order/BasketMgr');
var sezzle = require('*/cartridge/scripts/sezzle');
var sezzleData = require('~/cartridge/scripts/data/sezzleData');
var Transaction = require('dw/system/Transaction');
var Order = require('dw/order/Order');
var logger = require('dw/system').Logger.getLogger('Sezzle', '');

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
            logger.debug('Tokenize record successfully stored in Order and Profile');
        } else if (tokenizeObject.customer_uuid !== '' && tokenizeObject.customer_uuid_expiration !== '') {
            Transaction.wrap(function () {
                orderObj.custom.SezzleCustomerUUID = tokenizeObject.customer_uuid;
                orderObj.custom.SezzleCustomerUUIDExpiration = tokenizeObject.customer_uuid_expiration;
            });
            logger.debug('Tokenize record successfully stored in Order and Profile');
        }
    } catch (e) {
        logger.debug('sezzleHelper.storeTokenizeRecord.- {0}', e);
        logger.debug('Tokenize record not stored in Order and Profile');
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
                sezzle.order.captureOrder(orderObj);
                orderObj.custom.SezzleCapturedAmount = orderObj.totalGrossPrice.toString();
                orderObj.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                orderObj.setStatus(Order.ORDER_STATUS_COMPLETED);
                logger.debug('Payment has been captured successfully by Sezzle');
            }
            if (orderObj.custom.SezzleOrderUUID) {
                var sezzleOrder = sezzle.order.getOrderByOrderUUID(orderObj);
                if (!sezzleOrder.error && !canCapture) {
                    orderObj.custom.SezzleAuthExpiration = sezzleOrder.response.authorization.expiration;
                }
                sezzle.order.updateOrder(orderObj);
                logger.debug('SFCC Order No has been successfully updated in the corresponding Sezzle order');
            }
        });
        return true;
    } catch (e) {
        logger.debug('sezzleHelper.postProcess.- {0}', e);
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

module.exports = {
    Init: init,
    CheckCart: checkCart,
    StoreTokenizeRecord: storeTokenizeRecord,
    PostProcess: postProcess,
    IsSezzleApplicable: isSezzleApplicable
};
