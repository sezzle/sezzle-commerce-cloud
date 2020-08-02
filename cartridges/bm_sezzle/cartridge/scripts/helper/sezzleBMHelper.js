'use strict';

/* global empty dw request session customer */

var logger = require('dw/system').Logger.getLogger('Sezzle', '');
var Money = require('dw/value/Money');

var sezzleBMHelper = {};

/**
 * Update transaction history of a Order

 * @param {dw.order.Order} order Order
 * @param {string} transactionId Transaction ID
 * @param {string} methodName Method Name
 * @param {number} amount Amount
 */
function updateOrderData(order, transactionId, methodName, amount) {
    var orderTotal = order.totalGrossPrice;
    var amountInMoneyFmt = dw.value.Money(amount, order.currencyCode);

    var authAmountStr = order.custom.SezzleOrderAmount || '0.00';
    var authAmountInFloat = parseFloat(authAmountStr.replace(order.currencyCode, ''));
    var authAmount = new Money(authAmountInFloat, order.currencyCode);

    var capturedAmountStr = order.custom.SezzleCapturedAmount || '0.00';
    var capturedAmountInFloat = parseFloat(capturedAmountStr.replace(order.currencyCode, ''));
    var capturedAmount = new Money(capturedAmountInFloat, order.currencyCode);
    var finalCapturedAmount = capturedAmount.add(amountInMoneyFmt);

    var refundedAmountStr = order.custom.SezzleRefundedAmount || '0.00';
    var refundedAmountInFloat = parseFloat(refundedAmountStr.replace(order.currencyCode, ''));
    var refundedAmount = new Money(refundedAmountInFloat, order.currencyCode);
    var finalRefundedAmount = refundedAmount.add(amountInMoneyFmt);

    var releasedAmountStr = order.custom.SezzleReleasedAmount || '0.00';
    var releasedAmountInFloat = parseFloat(releasedAmountStr.replace(order.currencyCode, ''));
    var releasedAmount = new Money(releasedAmountInFloat, order.currencyCode);
    var finalReleasedAmount = releasedAmount.add(amountInMoneyFmt);

    if (methodName == 'DoCapture') {
    	order.custom.SezzleCapturedAmount = finalCapturedAmount;
    	if (authAmount.equals(finalCapturedAmount)) {
    		order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PAID);
    		order.setStatus(dw.order.Order.ORDER_STATUS_COMPLETED);
    	} else {
    		order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PARTPAID);
    	}
    } else if (methodName == 'DoRefund') {
    	order.custom.SezzleRefundedAmount = finalRefundedAmount;
    } else if (methodName == 'DoRelease') {
    	order.custom.SezzleReleasedAmount = finalReleasedAmount;

    	var updatedAuthAmount = orderTotal.getValue() - finalReleasedAmount.getValue();
    	order.custom.SezzleOrderAmount = new Money(updatedAuthAmount, order.currencyCode);

        if (authAmount.equals(finalReleasedAmount)) {
    		order.setStatus(dw.order.Order.ORDER_STATUS_CANCELLED);
    	}
    }
}

/**
 * Update Sezzle Order Amount in Order Object

 * @param {dw.order.Order} order Order
 * @param {number} amount Amount
 */
sezzleBMHelper.updateSezzleOrderAmount = function (order, amount) {
    amount = new Money(amount, order.currencyCode);
    order.custom.SezzleOrderAmount = amount;
};

/**
 * Return Sezzle order payment instrument
 *
 * @param {dw.order.LineItemCtnr} basket - Basket
 * @returns {dw.order.OrderPaymentInstrument} payment instrument with id SEZZLE_PAYMENT
 */
sezzleBMHelper.getSezzlePaymentInstrument = function (basket) {
    var paymentInstruments = basket.getPaymentInstruments();
    var iterator = paymentInstruments.iterator();
    var paymentInstrument = null;
    while (iterator.hasNext()) {
        paymentInstrument = iterator.next();
        var paymentMethod = dw.order.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod());
        if (paymentMethod) {
            var paymentProcessorId = paymentMethod.getPaymentProcessor().getID();
            if (paymentProcessorId == 'SEZZLE_PAYMENT') {
                return paymentInstrument;
            }
        }
    }
    return null;
};

/**
 * Return Order Subtotal
 *
 * @param {dw.order.Order} order Order
 * @returns {money} order subtotal
 */
sezzleBMHelper.getSubtotal = function (order) {
    var items = [];
    var productLineItems = order.getProductLineItems().iterator();

    var subtotal = 0.00;
    while (!empty(productLineItems) && productLineItems.hasNext()) {
        var productLineItem = productLineItems.next();

        var itemPrice = productLineItem.optionProductLineItem
            ? productLineItem.getBasePrice()
            : productLineItem.product.getPriceModel().getPrice();

        subtotal += itemPrice;
    }

    return dw.value.Money(subtotal, order.currencyCode);
};

/**
 * Update transactional data for Sezzle payment instrument
 *
 * @param {dw.order.Order} order - order
 * @param {boolean} isCustomOrder -  Indicate if current order is Custom Object
 * @param {string} transactionID - Sezzle transaction ID
 * @param {string} methodName - Used Action method
 * @param {number} amount - Amount passed
 * @returns {boolean} true in case of success and false when error
 */
sezzleBMHelper.updateOrderTransaction = function (order, isCustomOrder, transactionID, methodName, amount) {
    try {
        updateOrderData(order, transactionID, methodName, amount);
    } catch (error) {
    	logger.debug('sezzleBMHelper.updateOrderTransaction.- {0}', error);
        return false;
    }

    return true;
};

module.exports = sezzleBMHelper;
