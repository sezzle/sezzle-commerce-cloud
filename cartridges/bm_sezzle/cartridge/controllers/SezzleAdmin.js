/* global dw request response empty */

var sezzleHelper = require('*/cartridge/scripts/helper/sezzleHelper');
var logger = require('dw/system').Logger.getLogger('Sezzle', '');
var sezzleApi = require('*/cartridge/scripts/api/sezzleAPI');
var Money = require('dw/value/Money');

var ISML = require('dw/template/ISML');
var Transaction = require('dw/system/Transaction');
var CSRFProtection = require('dw/web/CSRFProtection');

/**
 * Get SezzleNewTransactions Custom Object with given order number
 *
 * @param {string} orderNo - Order number
 * @returns {Object} (transactionIdFromOrder: String - Transaction ID from order, order: dw.object.CustomObject - Custom Object that matched with order number)
 */
function getCustomOrderInfo(orderNo) {
    var order;
    var transactionId;
    try {
        order = dw.object.CustomObjectMgr.getCustomObject('SezzleNewTransactions', orderNo);
        transactionId = order.custom.transactionId;
    } catch (error) {
        logger.error(error);
        return false;
    }
    return {
        transactionIdFromOrder: transactionId,
        order: order
    };
}

/**
 * Combine orders and SezzleNewTransactions Custom Objects into one array for pagination
 *
 * @param {string} orderNo - Order number used in "Search by order number" feature
 * @returns {dw.util.ArrayList} Combined array with all orders
 */
function getOrders(orderNo, referenceID) {
    var systemOrders = dw.object.SystemObjectMgr.querySystemObjects('Order', 'orderNo LIKE {0} AND custom.SezzleExternalId !=null AND status != {1}', 'creationDate desc', orderNo, dw.order.Order.ORDER_STATUS_FAILED);
    if (referenceID) {
    	systemOrders = dw.object.SystemObjectMgr.querySystemObjects('Order', 'custom.SezzleExternalId = {0} AND status != {1}', 'creationDate desc', referenceID, dw.order.Order.ORDER_STATUS_FAILED);
    }
    //var sezzleOrders = dw.object.CustomObjectMgr.queryCustomObjects('SezzleNewTransactions', 'custom.orderNo LIKE {0}', 'custom.orderDate desc', orderNo);
    var orders = new dw.util.ArrayList(); // eslint-disable-line no-shadow
    var order;
    //var paymentInstrument;
    var orderDate;
    var orderTotal;
    var obj;

    var orderIndex = 0;
    var maxSystemOrdersCount = 9000;
    var maxSezzleOrdersCount = 9000;
    var sezzleOrdersCount = 0;
    if (sezzleOrdersCount < maxSezzleOrdersCount) {
        maxSystemOrdersCount = 18000 - sezzleOrdersCount;
    }

    while (systemOrders.hasNext()) {
        orderIndex++;
        
        if (orderIndex > maxSystemOrdersCount) {
            break;
        }
        order = systemOrders.next();
        paymentInstrument = sezzleHelper.getSezzlePaymentInstrument(order);
        if (paymentInstrument === null) {
            continue; // eslint-disable-line no-continue
        }
        orderDate = new Date(order.creationDate);
        obj = {
            orderNo: order.orderNo,
            orderDate: dw.util.StringUtils.formatCalendar(new dw.util.Calendar(orderDate), 'M/dd/yy h:mm a'),
            createdBy: order.createdBy,
            isRegestered: order.customer.registered,
            customer: order.customerName,
            email: order.customerEmail,
            orderTotal: order.totalGrossPrice,
            currencyCode: order.getCurrencyCode(),
            sezzleAmount: order.custom.SezzleOrderAmount,
            status: order.custom.SezzleStatus,
            dateCompare: orderDate.getTime(),
            isCustom: false
        };
        orders.push(obj);
    }

//    orderIndex = 0;
//    while (sezzleOrders.hasNext()) {
//        orderIndex++;
//        if (orderIndex > maxSystemOrdersCount) {
//            break;
//        }
//        order = sezzleOrders.next().custom;
//        orderDate = new Date(order.orderDate.replace('Z', '.000Z'));
//        orderTotal = new dw.value.Money(order.orderTotal, order.currencyCode);
//        obj = {
//            orderNo: order.orderNo,
//            orderDate: dw.util.StringUtils.formatCalendar(new dw.util.Calendar(orderDate), 'M/dd/yy h:mm a'),
//            createdBy: 'Merchant',
//            isRegestered: 'Unknown',
//            customer: order.firstName + ' ' + order.lastName,
//            email: order.email,
//            orderTotal: orderTotal,
//            currencyCode: order.currencyCode,
//            sezzleAmount: orderTotal,
//            status: order.paymentStatus,
//            isCustom: true,
//            dateCompare: orderDate.getTime()
//        };
//        orders.push(obj);
//    }

    orders.sort(new dw.util.PropertyComparator('dateCompare', false));

    return orders;
}

/**
 * Render Template
 * @param {string} templateName - Template Name
 * @param {Object} data - pdict data
 */
function render(templateName, data) {
    if (typeof data !== 'object') {
        data = {}; // eslint-disable-line no-param-reassign
    }
    try {
        ISML.renderTemplate(templateName, data);
    } catch (e) {
        throw new Error(e.javaMessage + '\n\r' + e.stack, e.fileName, e.lineNumber);
    }
}

/**
 * Render JSON from Objects
 * @param {Object} responseResult - Response Result
 * @param {Object} responseData - Response Data
 */
function renderJson(responseResult, responseData) {
    var data = {};
    if (!empty(responseData)) {
    	data.ack = 'Success';
    }
    //logger.debug(responseData);
    logger.debug(responseResult);
    if (!empty(responseResult)) {
        data.result = responseResult;
    }
    response.setContentType('application/json');
    response.writer.print(JSON.stringify(data, null, 2));
}

/**
 * Show template with create new transaction form
 */
function createNewTransaction() {
    render('sezzlebm/components/newtransaction');
}

/**
 * Returns max amount is allowed for multiple capture operation
 */
function helperGetCaptureAmount() {
    var order = null;
    var responseResult = 'Success';

    if (!empty(request.httpParameterMap.orderNo.value)) {
        if (request.httpParameterMap.isCustomOrder.booleanValue) {
            var orderInfo = getCustomOrderInfo(request.httpParameterMap.orderNo.stringValue);
            if (!orderInfo) {
                responseResult = 'Error';
            } else {
                order = orderInfo.order;
            }
        } else {
            order = dw.order.OrderMgr.getOrder(request.httpParameterMap.orderNo.stringValue);
        }
    }

    if (!order) {
        responseResult = 'Error';
    }

    renderJson(responseResult);
}

/**
 * Create new SezzleNewTransactions Custom Object with data from a new transaction
 *
 * @param {Object} transactionData - Response data from a API call
 * @param {string} invNum - Custom order number for a SezzleNewTransactions Custom Object
 */
function createNewTransactionCustomObject(transactionData, invNum) {
    var newOrder = dw.object.CustomObjectMgr.createCustomObject('SezzleNewTransactions', invNum);
    newOrder.custom.orderDate = transactionData.ordertime;
    newOrder.custom.orderTotal = transactionData.amt;
    newOrder.custom.paymentStatus = transactionData.paymentstatus || 'Unknown';
    newOrder.custom.transactionId = transactionData.transactionid;
    newOrder.custom.firstName = transactionData.firstname;
    newOrder.custom.lastName = transactionData.lastname;
    newOrder.custom.email = transactionData.email || 'Unknown';
    newOrder.custom.currencyCode = transactionData.currencycode;
    newOrder.custom.transactionsHistory = [transactionData.transactionid];
}

/**
 * Get orders list. Can be filtered by order ID or transaction ID
 */
function orders() {
    var orderNo;
    var referenceID = '';
    var alternativeFlow = false;
    var orders; // eslint-disable-line no-shadow
    
    if (request.httpParameterMap.transactionId.submitted) {
        var callApiResponse = sezzleApi.getOrder(request.httpParameterMap.transactionId.stringValue);
        logger.debug(JSON.stringify(callApiResponse));
        if (!callApiResponse.error) {
            referenceID = callApiResponse.response.reference_id;
        } 
    }
    if (!orderNo) {
        alternativeFlow = true;
    }

    if (alternativeFlow) {
        orderNo = empty(request.httpParameterMap.orderNo.stringValue) ? '*' : request.httpParameterMap.orderNo.stringValue;
        orderNo = request.httpParameterMap.transactionId.submitted ? '0' : orderNo;
        orderNo = request.httpParameterMap.transactionId.stringValue === '' ? '*' : orderNo;
    }

    try {
        orders = getOrders(orderNo, referenceID);
    } catch (error) {
        logger.error(error);
        render('sezzlebm/components/servererror');
        return;
    }

    var pageSize = !empty(request.httpParameterMap.pagesize.intValue) ? request.httpParameterMap.pagesize.intValue : 10;
    var currentPage = request.httpParameterMap.page.intValue ? request.httpParameterMap.page.intValue : 1;
    pageSize = pageSize === 0 ? orders.length : pageSize;
    var start = pageSize * (currentPage - 1);
    var orderPagingModel = new dw.web.PagingModel(orders);

    orderPagingModel.setPageSize(pageSize);
    orderPagingModel.setStart(start);

    render('sezzlebm/orderlist', {
        PagingModel: orderPagingModel
    });
}

/**
 * Get order transaction details
 */
function orderTransaction() {
    var errorFlow = false;
    var order = null;
    var paymentInstrument = null;
    var transactionIdFromOrder = null;
    var canCapture = false;
    var canRefund = false;
    var canRelease = false;
    

    if (request.httpParameterMap.orderNo && !empty(request.httpParameterMap.orderNo.value)) {
        if (request.httpParameterMap.isCustomOrder && !empty(request.httpParameterMap.isCustomOrder.stringValue)) {
            var orderInfo = getCustomOrderInfo(request.httpParameterMap.orderNo.stringValue);
            if (!orderInfo) {
                errorFlow = true;
            } else {
                order = orderInfo.order;
                transactionIdFromOrder = orderInfo.transactionIdFromOrder;
            }
        } else {
            order = dw.order.OrderMgr.getOrder(request.httpParameterMap.orderNo.stringValue);
//            if (order) {
//                paymentInstrument = sezzleHelper.getSezzlePaymentInstrument(order);
//            }
        }
    }
    

    
    // var sezzleOrder = sezzleApi.getOrder(order);
    
    var authAmountStr = order.custom.SezzleOrderAmount || '0.00';
	var authAmountInFloat = parseFloat(authAmountStr.replace(order.currencyCode, ''));
	
	var refundedAmountStr = order.custom.SezzleRefundedAmount || '0.00';
	var refundedAmountInFloat = parseFloat(refundedAmountStr.replace(order.currencyCode, ''));
	
	var capturedAmountStr = order.custom.SezzleCapturedAmount || '0.00';
	var capturedAmountInFloat = parseFloat(capturedAmountStr.replace(order.currencyCode, ''));
	
	var releasedAmountStr = order.custom.SezzleReleasedAmount || '0.00';
	var releasedAmountInFloat = parseFloat(releasedAmountStr.replace(order.currencyCode, ''));
	
	logger.debug(capturedAmountInFloat)
	logger.debug(refundedAmountInFloat)

    if (!order) {
        render('sezzlebm/components/servererror');
        return;
    }
	
	if (authAmountInFloat > capturedAmountInFloat) {
		canCapture = true;
	}
	
	if (capturedAmountInFloat > refundedAmountInFloat) {
		canRefund = true;
	}
	
	if (authAmountInFloat > capturedAmountInFloat) {
		canRelease = true;
	}
    
//    if ((order.paymentStatus == dw.order.Order.PAYMENT_STATUS_NOTPAID 
//    	|| order.paymentStatus == dw.order.Order.PAYMENT_STATUS_PARTPAID) 
//    	&& (order.status == dw.order.Order.ORDER_STATUS_NEW 
//    	|| order.status == dw.order.Order.ORDER_STATUS_OPEN)		
//    	&& (order.custom.SezzleStatus == sezzleHelper.SEZZLE_PAYMENT_STATUS_AUTH 
//    	|| order.custom.SezzleStatus == sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_CAPTURE)
//    	&& authAmountInFloat > 0) {
//    	canCapture = true;
//    }
    
//	if ((order.paymentStatus == dw.order.Order.PAYMENT_STATUS_PAID
//		|| order.paymentStatus == dw.order.Order.PAYMENT_STATUS_PARTPAID)
//		&& (order.status == dw.order.Order.ORDER_STATUS_COMPLETED 
//		|| order.status == dw.order.Order.ORDER_STATUS_NEW)
//		&& (order.custom.SezzleStatus == sezzleHelper.SEZZLE_PAYMENT_STATUS_CAPTURE
//		|| order.custom.SezzleStatus == sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_CAPTURE
//		|| order.custom.SezzleStatus == sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_REFUNDED)
//		&& (capturedAmountInFloat > refundedAmountInFloat)) {
//		canRefund = true;
//	}
	
//	if ((order.paymentStatus == dw.order.Order.PAYMENT_STATUS_NOTPAID 
//    	|| order.paymentStatus == dw.order.Order.PAYMENT_STATUS_PARTPAID)
//    	&& (order.status == dw.order.Order.ORDER_STATUS_NEW 
//    	|| order.status == dw.order.Order.ORDER_STATUS_OPEN) 
//    	&& (order.custom.SezzleStatus == sezzleHelper.SEZZLE_PAYMENT_STATUS_AUTH
//		|| order.custom.SezzleStatus == sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_CAPTURE)
//		&& authAmountInFloat > 0) {
//    	canRelease = true;
//    }
	
	


    render('sezzlebm/ordertransaction', {
        isCustomOrder: false,
        Order: order,
        CanCapture: canCapture,
        CanRefund: canRefund,
        CanRelease: canRelease
        //TransactionDetails: result.responseData
    });
}

/**
 * Do some action, like DoAuthorize, DoCapture, DoRefund and etc
 */
function action() {
    var params = request.httpParameterMap;
    var responseResult = 'Success';
    var callApiResponse = {};
    var isCustomOrder = false;
    var transactionid = 1;
    var order = {};
    var HashMap = require('dw/util/HashMap');
    var errorMsg = new HashMap();
    if (!CSRFProtection.validateRequest()) {
        errorMsg.put('l_longmessage0', 'CSRF token mismatch')
        renderJson('Error', errorMsg);
        return;
    }
    
    

    if (!params.helperAction.submitted) {
        var methodName = params.methodName.stringValue;
        var methodData = params;
        var orderNo = params.orderNo.stringValue;
        var transactionResult = false;
        //var isCustomOrder = params.isCustomOrder.booleanValue;
        //var isSaveToCustomOrder = methodName !== 'DoReferenceTransaction' && methodName !== 'DoDirectPayment';

        if (orderNo) {
        	order = dw.order.OrderMgr.getOrder(orderNo);
        } else {
            errorMsg.put('l_longmessage0', 'Order No missing')
            renderJson('Error', errorMsg);
            return;
        }
        
        
        
        var amtInCents = dw.value.Money(params.amt, order.currencyCode).multiply(100).getValue();
        //var orderTotalInCents = order.totalGrossPrice.multiply(100).getValue();
        var authAmountStr = order.custom.SezzleOrderAmount || '0.00';
    	var authAmountInFloat = parseFloat(authAmountStr.replace(order.currencyCode, ''));
    	var authAmountInCents = new Money(authAmountInFloat, order.currencyCode).multiply(100).getValue();
        //var sezzlePaymentStatus = order.custom.SezzleStatus;
        var action = "";
        
        if (methodName == 'DoCapture') {
        	action = sezzleHelper.SEZZLE_PAYMENT_STATUS_CAPTURE;
        	var isPartialCapture = (amtInCents < authAmountInCents);
        	if (order.custom.SezzleAuthUUID) {
        		callApiResponse = sezzleApi.captureByAuthUUID(order, amtInCents, isPartialCapture);
        	} else {
        		callApiResponse = sezzleApi.capture(order, amtInCents, isPartialCapture);
        	}
        	//sezzlePaymentStatus = isPartialCapture ? sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_CAPTURE : sezzleHelper.SEZZLE_PAYMENT_STATUS_CAPTURE;
        	
        } else if (methodName == 'DoRefund') {
        	action = sezzleHelper.SEZZLE_PAYMENT_STATUS_REFUNDED;
        	if (order.custom.SezzleAuthUUID) {
        		callApiResponse = sezzleApi.refundByAuthUUID(order, amtInCents);
        	} else {
        		callApiResponse = sezzleApi.refund(order, amtInCents);
        	}
        	
        	//sezzlePaymentStatus = orderTotalInCents == amtInCents ? sezzleHelper.SEZZLE_PAYMENT_STATUS_REFUNDED : sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_REFUNDED;
        } else if (methodName == 'DoRelease') {
        	action = sezzleHelper.SEZZLE_PAYMENT_STATUS_RELEASED;
        	if (order.custom.SezzleAuthUUID) {
        		callApiResponse = sezzleApi.releaseByAuthUUID(order, amtInCents);
        	} else {
        		callApiResponse = sezzleApi.release(order, amtInCents);
        	}
        	//sezzlePaymentStatus = orderTotalInCents == amtInCents ? sezzleHelper.SEZZLE_PAYMENT_STATUS_RELEASED : sezzleHelper.SEZZLE_PAYMENT_STATUS_PARTIAL_RELEASED;
        }
        
        if (!callApiResponse.error) {
        	Transaction.wrap(function () {
                transactionResult = sezzleHelper.updateOrderTransaction(order, isCustomOrder, transactionid, methodName, params.amt, action);
            });
        	logger.debug(JSON.stringify(callApiResponse));
        }
    } else {
        responseResult = 'Error';
    }
    renderJson(responseResult, callApiResponse);
}

orders.public = true;
orderTransaction.public = true;
action.public = true;
createNewTransaction.public = true;

exports.Orders = orders;
exports.OrderTransaction = orderTransaction;
exports.Action = action;
exports.CreateNewTransaction = createNewTransaction;
