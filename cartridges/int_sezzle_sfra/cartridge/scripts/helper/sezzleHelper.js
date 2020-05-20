'use strict';

/* global empty dw request session customer */

//var sezzleApi = require('~/cartridge/scripts/sezzle/sezzleApi');
var logger = require('dw/system').Logger.getLogger('Sezzle', ''),
    Money = require('dw/value/Money');

var sezzleHelper = {
		SEZZLE_PAYMENT_STATUS_AUTH : 'AUTH',
		SEZZLE_PAYMENT_STATUS_CAPTURE : 'CAPTURE',
		SEZZLE_PAYMENT_STATUS_PARTIAL_CAPTURE : 'PARTIAL_CAPTURE',
		SEZZLE_PAYMENT_STATUS_REFUNDED : 'REFUNDED',
		SEZZLE_PAYMENT_STATUS_PARTIAL_REFUNDED : 'PARTIAL_REFUNDED',
		SEZZLE_PAYMENT_STATUS_RELEASED : 'RELEASED',
		SEZZLE_PAYMENT_STATUS_PARTIAL_RELEASED : 'PARTIAL_RELEASED'
};




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

    //writeTransactionHistory(order.custom, transactionId);
    order.custom.transactionId = transactionId;
    order.custom.paymentStatus = paymentStatus;
}

/**
 * Update transaction history of a Order

 * @param {string} orderNo - Order number
 * @param {string} transactionId - Transaction ID from new transaction
 * @param {string} methodName - Method name
 */
function updateOrderData(order, transactionId, methodName, amount, action) {
//    var order = dw.order.OrderMgr.getOrder(orderNo);
//    var paymentInstrument = sezzleHelper.getSezzlePaymentInstrument(order);
//    var paymentTransaction = paymentInstrument.getPaymentTransaction();
//    var transactionDetailsResult = sezzleApi.getTransactionDetails(paymentTransaction.custom.transactionsHistory[0], order.getCurrencyCode());
//
//    if (transactionDetailsResult.error) {
//        throw new Error('transactionDetailsResult.error');
//    }
//    var paymentStatus = transactionDetailsResult.responseData.paymentstatus;
//
//    if (empty(order)) {
//        throw new Error();
//    }
//
//    //writeTransactionHistory(paymentTransaction.custom, transactionId);
//    paymentTransaction.setTransactionID(transactionId);
//    paymentInstrument.custom.sezzlePaymentStatus = paymentStatus;
    
    //order.custom.SezzleStatus = sezzlePaymentStatus;
    var orderTotal = order.totalGrossPrice;
    var amount = dw.value.Money(amount, order.currencyCode);
    
    var authAmountStr = order.custom.SezzleOrderAmount || '0.00';
	var authAmountInFloat = parseFloat(authAmountStr.replace(order.currencyCode, ''));
	var authAmount = new Money(authAmountInFloat, order.currencyCode);
	//var finalauthAmount = authAmount.add(amount);
    
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
    
    if (action == sezzleHelper.SEZZLE_PAYMENT_STATUS_CAPTURE) {
    	order.custom.SezzleCapturedAmount = finalCapturedAmount;
    	if (authAmount.equals(finalCapturedAmount)) {
    		order.custom.SezzleStatus = sezzleHelper.SEZZLE_PAYMENT_STATUS_CAPTURE;
    		order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PAID);
    		order.setStatus(dw.order.Order.ORDER_STATUS_COMPLETED);
    	} else {
    		order.custom.SezzleStatus = sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_CAPTURE;
    		order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PARTPAID);
    	}
    } else if (action == sezzleHelper.SEZZLE_PAYMENT_STATUS_REFUNDED) {
    	order.custom.SezzleRefundedAmount = finalRefundedAmount;
    	if (authAmount.equals(finalRefundedAmount)) {
    		order.custom.SezzleStatus = sezzleHelper.SEZZLE_PAYMENT_STATUS_REFUNDED;
    	} else {
    		order.custom.SezzleStatus = sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_REFUNDED;
    	}
    } else if (action == sezzleHelper.SEZZLE_PAYMENT_STATUS_RELEASED) {
    	order.custom.SezzleReleasedAmount = finalReleasedAmount;
    	
    	var updatedAuthAmount = orderTotal.getValue() - finalReleasedAmount.getValue();
    	order.custom.SezzleOrderAmount = new Money(updatedAuthAmount, order.currencyCode);
    	
    	if (orderTotal.equals(finalReleasedAmount)) {
    		order.custom.SezzleStatus = sezzleHelper.SEZZLE_PAYMENT_STATUS_RELEASED;
    	} 
//    	else {
//    		order.custom.SezzleStatus = sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_RELEASED;
//    	}
    }

//    if (sezzlePaymentStatus === sezzleHelper.SEZZLE_PAYMENT_STATUS_CAPTURE) {
//        order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PAID);
//        order.setStatus(dw.order.Order.ORDER_STATUS_COMPLETED);
//        order.custom.SezzleCapturedAmount = amount;
//    } else if (sezzlePaymentStatus === sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_CAPTURE) {
//        order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PARTPAID);
//        //order.setStatus(dw.order.Order.ORDER_STATUS_COMPLETED);
//        order.custom.SezzleCapturedAmount = amount;
//    } else if (sezzlePaymentStatus === sezzleHelper.SEZZLE_PAYMENT_STATUS_REFUNDED) {
//        //order.setStatus(dw.order.Order.ORDER_STATUS_CANCELLED);
//        order.custom.SezzleRefundedAmount = amount;
//    } else if (sezzlePaymentStatus === sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_REFUNDED) {
//        //order.setStatus(dw.order.Order.ORDER_STATUS_CANCELLED);
//        order.custom.SezzleRefundedAmount = amount;
//    } else if (sezzlePaymentStatus === sezzleHelper.SEZZLE_PAYMENT_STATUS_RELEASED) {
//        //order.setStatus(dw.order.Order.ORDER_STATUS_CANCELLED);
//        order.custom.SezzleReleasedAmount = amount;
//    } else if (sezzlePaymentStatus === sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_RELEASED) {
//        //order.setStatus(dw.order.Order.ORDER_STATUS_CANCELLED);
//        order.custom.SezzleReleasedAmount = amount;
//    }
}

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
sezzleHelper.updateOrderTransaction = function (order, isCustomOrder, transactionID, methodName, amount, action) {
    try {
        if (isCustomOrder) {
            updateCustomOrderData(order.orderNo, transactionID);
        } else {
            updateOrderData(order, transactionID, methodName, amount, action);
        }
    } catch (error) {
    	logger.error(error);
        return false;
    }

    return true;
};

module.exports = sezzleHelper;
