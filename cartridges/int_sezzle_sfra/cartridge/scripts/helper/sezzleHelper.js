'use strict';

/* global empty dw request session customer */

var logger = require('dw/system').Logger.getLogger('Sezzle', ''),
    Money = require('dw/value/Money');

var sezzleHelper = {};




/**
 * Update transaction history of a SezzleNewTransactions Custom Object

 * @param {string} orderNo - Order number
 * @param {string} transactionId - Transaction ID from new transaction
 */
function updateCustomOrderData(orderNo, transactionId) {
    var order = dw.object.CustomObjectMgr.getCustomObject('SezzleNewTransactions', orderNo);
    var transactionDetailsResult = sezzleApi.getTransactionDetails(order.custom.transactionsHistory[0], order.currencyCode);

    if (transactionDetailsResult.error) {
        throw new Error('transactionDetailsResult.error');
    }

    var paymentStatus = transactionDetailsResult.responseData.paymentstatus;
    
    order.custom.transactionId = transactionId;
    order.custom.paymentStatus = paymentStatus;
}

/**
 * Update transaction history of a Order

 * @param {string} orderNo - Order number
 * @param {string} transactionId - Transaction ID from new transaction
 * @param {string} methodName - Method name
 */
function updateOrderData(order, transactionId, methodName, amount) {
    var orderTotal = order.totalGrossPrice;
    var amount = dw.value.Money(amount, order.currencyCode);
    
    var authAmountStr = order.custom.SezzleOrderAmount || '0.00';
	var authAmountInFloat = parseFloat(authAmountStr.replace(order.currencyCode, ''));
	var authAmount = new Money(authAmountInFloat, order.currencyCode);
    
    var capturedAmountStr = order.custom.SezzleCapturedAmount || '0.00';
	var capturedAmountInFloat = parseFloat(capturedAmountStr.replace(order.currencyCode, ''));
	var capturedAmount = new Money(capturedAmountInFloat, order.currencyCode);
	var finalCapturedAmount = capturedAmount.add(amount);
	
	var refundedAmountStr = order.custom.SezzleRefundedAmount || '0.00';
	var refundedAmountInFloat = parseFloat(refundedAmountStr.replace(order.currencyCode, ''));
	var refundedAmount = new Money(refundedAmountInFloat, order.currencyCode);
	var finalRefundedAmount = refundedAmount.add(amount);
	
	var releasedAmountStr = order.custom.SezzleReleasedAmount || '0.00';
	var releasedAmountInFloat = parseFloat(releasedAmountStr.replace(order.currencyCode, ''));
	var releasedAmount = new Money(releasedAmountInFloat, order.currencyCode);
	var finalReleasedAmount = releasedAmount.add(amount);
    
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
    }
}

sezzleHelper.updateSezzleOrderAmount = function (order, amount) {
	amount = new Money(amount, order.currencyCode);
	order.custom.SezzleOrderAmount = amount;
};

/**
 * Return Sezzle order payment instrument
 *
 * @param {dw.order.LineItemCtnr} basket - Basket
 * @returns {dw.order.OrderPaymentInstrument} payment instrument with id PAYPAL
 */
sezzleHelper.getSezzlePaymentInstrument = function (basket) {
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

sezzleHelper.getSubtotal = function (order) {
	var items = [],
		productLineItems = order.getProductLineItems().iterator();

	var subtotal = 0.00;
	while (!empty(productLineItems) && productLineItems.hasNext()) {
		let productLineItem = productLineItems.next();
		
		var itemPrice = productLineItem.optionProductLineItem ?
							productLineItem.getBasePrice() :
							productLineItem.product.getPriceModel().getPrice();
		
		subtotal += itemPrice;
		
	}

	return dw.value.Money(subtotal, order.currencyCode);
};

/**
 * Update transactionID and transactions history for Sezzle payment instrument
 *
 * @param {string} orderNo - order number
 * @param {boolean} isCustomOrder -  Indicate if current order is Custom Object
 * @param {string} transactionID - Sezzle transaction ID
 * @param {string} methodName - Used API method
 * @returns {boolean} true in case of success and false when error
 */
sezzleHelper.updateOrderTransaction = function (order, isCustomOrder, transactionID, methodName, amount) {
    try {
        if (isCustomOrder) {
            updateCustomOrderData(order.orderNo, transactionID);
        } else {
            updateOrderData(order, transactionID, methodName, amount);
        }
    } catch (error) {
    	logger.error(error);
        return false;
    }

    return true;
};

module.exports = sezzleHelper;
