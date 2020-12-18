'use strict';

/* global empty dw */

var logger = require('dw/system').Logger.getLogger('Sezzle', 'sezzle');
var Money = require('dw/value/Money');

var sezzleBmHelper = {};

/**
 * Update transaction history of a Order

 * @param {dw.order.Order} order Order
 * @param {string} transactionId Transaction ID
 * @param {string} methodName Method Name
 * @param {number} amount Amount
 */
function updateOrderData(order, transactionId, methodName, amount) {
    var orderObj = order;
    var orderTotal = orderObj.totalGrossPrice;
    var amountInMoneyFmt = dw.value.Money(amount, orderObj.currencyCode);

    var authAmountStr = orderObj.custom.SezzleOrderAmount || '0.00';
    var authAmountInFloat = parseFloat(authAmountStr.replace(orderObj.currencyCode, ''));
    var authAmount = new Money(authAmountInFloat, orderObj.currencyCode);

    var capturedAmountStr = orderObj.custom.SezzleCapturedAmount || '0.00';
    var capturedAmountInFloat = parseFloat(capturedAmountStr.replace(orderObj.currencyCode, ''));
    var capturedAmount = new Money(capturedAmountInFloat, orderObj.currencyCode);
    var finalCapturedAmount = capturedAmount.add(amountInMoneyFmt);

    var refundedAmountStr = orderObj.custom.SezzleRefundedAmount || '0.00';
    var refundedAmountInFloat = parseFloat(refundedAmountStr.replace(orderObj.currencyCode, ''));
    var refundedAmount = new Money(refundedAmountInFloat, orderObj.currencyCode);
    var finalRefundedAmount = refundedAmount.add(amountInMoneyFmt);

    var releasedAmountStr = orderObj.custom.SezzleReleasedAmount || '0.00';
    var releasedAmountInFloat = parseFloat(releasedAmountStr.replace(orderObj.currencyCode, ''));
    var releasedAmount = new Money(releasedAmountInFloat, orderObj.currencyCode);
    var finalReleasedAmount = releasedAmount.add(amountInMoneyFmt);

    if (methodName === 'DoCapture') {
        orderObj.custom.SezzleCapturedAmount = finalCapturedAmount;
        if (authAmount.equals(finalCapturedAmount)) {
            orderObj.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PAID);
            orderObj.setStatus(dw.order.Order.ORDER_STATUS_COMPLETED);
        } else {
            orderObj.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PARTPAID);
        }
    } else if (methodName === 'DoRefund') {
        orderObj.custom.SezzleRefundedAmount = finalRefundedAmount;
    } else if (methodName === 'DoRelease') {
        orderObj.custom.SezzleReleasedAmount = finalReleasedAmount;

        var updatedAuthAmount = orderTotal.getValue() - finalReleasedAmount.getValue();
        orderObj.custom.SezzleOrderAmount = new Money(updatedAuthAmount, orderObj.currencyCode);

        if (authAmount.equals(finalReleasedAmount)) {
            orderObj.setStatus(dw.order.Order.ORDER_STATUS_CANCELLED);
        }
    }
}

/**
 * Update Sezzle Order Amount in Order Object

 * @param {dw.order.Order} order Order
 * @param {number} amount Amount
 */
sezzleBmHelper.updateSezzleOrderAmount = function (order, amount) {
    var orderObject = order;
    orderObject.custom.SezzleOrderAmount = new Money(amount, orderObject.currencyCode);
};

/**
 * Return Sezzle order payment instrument
 *
 * @param {dw.order.LineItemCtnr} basket - Basket
 * @returns {dw.order.OrderPaymentInstrument} payment instrument with id SEZZLE_PAYMENT
 */
sezzleBmHelper.getSezzlePaymentInstrument = function (basket) {
    var paymentInstruments = basket.getPaymentInstruments();
    var iterator = paymentInstruments.iterator();
    var paymentInstrument = null;
    while (iterator.hasNext()) {
        paymentInstrument = iterator.next();
        var paymentMethod = dw.order.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod());
        if (paymentMethod) {
            var paymentProcessorId = paymentMethod.getPaymentProcessor().getID();
            if (paymentProcessorId === 'SEZZLE_PAYMENT') {
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
 * @returns {dw.value.Money} order subtotal
 */
sezzleBmHelper.getSubtotal = function (order) {
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
sezzleBmHelper.updateOrderTransaction = function (order, isCustomOrder, transactionID, methodName, amount) {
    try {
        updateOrderData(order, transactionID, methodName, amount);
    } catch (error) {
        logger.error('sezzleBmHelper.updateOrderTransaction.- {0}', error);
        return false;
    }

    return true;
};

module.exports = sezzleBmHelper;
