/* global dw request response empty */

var sezzleBmHelper = require('*/cartridge/scripts/helper/sezzleBmHelper');
var logger = require('dw/system').Logger.getLogger('Sezzle', 'sezzle');
var v2 = require('*/cartridge/scripts/api/v2');
var Money = require('dw/value/Money');
var sezzleUtils = require('*/cartridge/scripts/utils/sezzleUtils');

var ISML = require('dw/template/ISML');
var Transaction = require('dw/system/Transaction');
var CSRFProtection = require('dw/web/CSRFProtection');

/**
 * Get Sezzle orders into one array for pagination
 *
 * @param {string} orderNo - Order number used in "Search by order number" feature
 * @param {string} referenceID - Order Reference ID
 * @returns {dw.util.ArrayList} Combined array with all orders
 */
function getOrders(orderNo, referenceID) {
    var systemOrders = dw.object.SystemObjectMgr.querySystemObjects('Order', 'orderNo LIKE {0} AND custom.SezzleExternalId !=null AND status != {1}', 'creationDate desc', orderNo, dw.order.Order.ORDER_STATUS_FAILED);
    if (referenceID) {
        systemOrders = dw.object.SystemObjectMgr.querySystemObjects('Order', 'custom.SezzleExternalId = {0} AND status != {1}', 'creationDate desc', referenceID, dw.order.Order.ORDER_STATUS_FAILED);
    }
    var orders = new dw.util.ArrayList(); // eslint-disable-line no-shadow
    var order;
    var paymentInstrument;
    var orderDate;
    var obj;

    var orderIndex = 0;
    var maxSystemOrdersCount = 9000;
    var maxSezzleOrdersCount = 9000;
    var sezzleOrdersCount = 0;
    if (sezzleOrdersCount < maxSezzleOrdersCount) {
        maxSystemOrdersCount = 18000 - sezzleOrdersCount;
    }

    while (systemOrders.hasNext()) {
        orderIndex += 1;

        if (orderIndex > maxSystemOrdersCount) {
            break;
        }
        order = systemOrders.next();
        paymentInstrument = new Date(sezzleBmHelper.getSezzlePaymentInstrument(order));
        if (paymentInstrument == null) {
            continue; // eslint-disable-line no-continue
        }

        var sezzleAuthExpiration = 'NIL';
        if (order.custom.SezzleAuthExpiration != null) {
            var sezzleAuthExpirationTimestamp = new Date(sezzleUtils.getFormattedDateTimestamp(order.custom.SezzleAuthExpiration));
            sezzleAuthExpiration = dw.util.StringUtils.formatCalendar(new dw.util.Calendar(sezzleAuthExpirationTimestamp), 'M/dd/yy h:mm a');
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
            authExpiration: sezzleAuthExpiration,
            dateCompare: orderDate.getTime(),
            isCustom: false
        };
        orders.push(obj);
    }

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
 * Get orders list. Can be filtered by order ID or reference ID
 */
function orders() {
    var orderNo;
    var referenceID = '';
    var alternativeFlow = false;
    var orders; // eslint-disable-line no-shadow
    var HashMap = require('dw/util/HashMap');
    var errorMsg = new HashMap();

    if (!CSRFProtection.validateRequest()) {
        errorMsg.put('l_longmessage0', 'CSRF token mismatch');
        renderJson('Error', errorMsg);
        return;
    }

    if (request.httpParameterMap.transactionId.submitted) {
        var callApiResponse = v2.getOrderByOrderUUID(request.httpParameterMap.transactionId.stringValue);
        if (callApiResponse !== null && !callApiResponse.error) {
            referenceID = callApiResponse.response.reference_id;
        }
    }
    if (!referenceID) {
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
        render('sezzlebm/components/serverError');
        return;
    }

    var pageSize = !empty(request.httpParameterMap.pagesize.intValue) ? request.httpParameterMap.pagesize.intValue : 10;
    var currentPage = request.httpParameterMap.page.intValue ? request.httpParameterMap.page.intValue : 1;
    pageSize = pageSize === 0 ? orders.length : pageSize;
    var start = pageSize * (currentPage - 1);
    var orderPagingModel = new dw.web.PagingModel(orders);

    orderPagingModel.setPageSize(pageSize);
    orderPagingModel.setStart(start);

    render('sezzlebm/orderList', {
        PagingModel: orderPagingModel
    });
}

/**
 * Get order transaction details
 */
function orderTransaction() {
    var order = null;
    var canCapture = false;
    var canRefund = false;
    var canRelease = false;

    if (!request.httpParameterMap.orderNo || empty(request.httpParameterMap.orderNo.value)) {
        render('sezzlebm/components/serverError');
        return;
    }

    order = dw.order.OrderMgr.getOrder(request.httpParameterMap.orderNo.stringValue);
    if (!order) {
        render('sezzlebm/components/serverError');
        return;
    }

    logger.info('SezzleAdmin.orderTransaction - Order validated');


    var sezzlePaymentAction = order.custom.SezzlePaymentAction;
    var capturedAmountStr = order.custom.SezzleCapturedAmount || '0.00';
    var capturedAmountInFloat = parseFloat(capturedAmountStr.replace(order.currencyCode, ''));


    if (sezzlePaymentAction === 'AUTH' && order.custom.SezzleAuthExpiration) {
        var currentTimestamp = Date.now();
        var authExpirationTimestamp = sezzleUtils.getFormattedDateTimestamp(order.custom.SezzleAuthExpiration);
        if (currentTimestamp > authExpirationTimestamp) {
            Transaction.wrap(function () {
                sezzleBmHelper.updateSezzleOrderAmount(order, capturedAmountInFloat);
            });
        }
    }

    var authAmountStr = order.custom.SezzleOrderAmount || '0.00';
    var authAmountInFloat = parseFloat(authAmountStr.replace(order.currencyCode, ''));

    var refundedAmountStr = order.custom.SezzleRefundedAmount || '0.00';
    var refundedAmountInFloat = parseFloat(refundedAmountStr.replace(order.currencyCode, ''));

    if (authAmountInFloat > capturedAmountInFloat) {
        canCapture = true;
        canRelease = true;
    }

    if (capturedAmountInFloat > refundedAmountInFloat) {
        canRefund = true;
    }

    render('sezzlebm/orderTransaction', {
        isCustomOrder: false,
        Order: order,
        CanCapture: canCapture,
        CanRefund: canRefund,
        CanRelease: canRelease
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
        errorMsg.put('l_longmessage0', 'CSRF token mismatch');
        renderJson('Error', errorMsg);
        return;
    }


    try {
        if (!params.helperAction.submitted) {
            var methodName = params.methodName.stringValue;
            var orderNo = params.orderNo.stringValue;

            if (orderNo) {
                order = dw.order.OrderMgr.getOrder(orderNo);
            } else {
                errorMsg.put('l_longmessage0', 'Order No missing');
                renderJson('Error', errorMsg);
                return;
            }


            var amtInCents = dw.value.Money(params.amt, order.currencyCode).multiply(100).getValue();
            var authAmountStr = order.custom.SezzleOrderAmount || '0.00';
            var authAmountInFloat = parseFloat(authAmountStr.replace(order.currencyCode, ''));
            var authAmountInCents = new Money(authAmountInFloat, order.currencyCode).multiply(100).getValue();

            if (methodName === 'DoCapture') {
                var isPartialCapture = (amtInCents < authAmountInCents);
                callApiResponse = v2.capture(order, amtInCents, isPartialCapture);
            } else if (methodName === 'DoRefund') {
                callApiResponse = v2.refund(order, amtInCents);
            } else if (methodName === 'DoRelease') {
                callApiResponse = v2.release(order, amtInCents);
            }

            if (callApiResponse == null || callApiResponse.error) {
                throw new Error('SezzleAdmin.API Call failed - {0}', methodName);
            }

            logger.info('SezzleAdmin.API Call successfull - {0}', methodName);
            Transaction.wrap(function () {
                sezzleBmHelper.updateOrderTransaction(order, isCustomOrder, transactionid, methodName, params.amt);
            });
        } else {
            logger.error('SezzleAdmin.Failed to get post data from form');
            responseResult = 'Error';
        }
    } catch (e) {
        logger.error('SezzleAdmin.action.- {0}', e);
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
