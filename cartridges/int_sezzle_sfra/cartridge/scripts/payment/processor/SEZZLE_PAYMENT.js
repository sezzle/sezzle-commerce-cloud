'use strict';

/**
 * Controller that renders the home page.
 *
 * @module controllers/Sezzle
 */

var BasketMgr = require('dw/order/BasketMgr');
var Transaction = require('dw/system/Transaction');
var sezzleUtils = require('*/cartridge/scripts/sezzle');
var OrderMgr = require('dw/order/OrderMgr');
var Money = require('dw/value/Money');
var logger = require('dw/system').Logger.getLogger('Sezzle', 'sezzle');

/*
 * Export the publicly available controller methods
 */

/**
 * Authorize Payment
 *
 * @param {dw.order.Order.orderNo} orderNumber Order No
 * @param {dw.order.PaymentInstrument} paymentInstrument payment instrument instance
 * @param {dw.order.PaymentProcessor} paymentProcessor payment processor instance
 * @returns {Object} authorize response
 */
function authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var order = OrderMgr.getOrder(orderNumber);

    if (!session.privacy.sezzled && empty(session.privacy.sezzleResponseID)) {
        return { error: true };
    }

    // Check the reference token passed during redirection
    var reference_id = request.httpParameterMap.order_reference_id;
    logger.info('Sezzle Payment Reference Id - {0}', reference_id);

    if (session.privacy.referenceId != reference_id) {
        logger.error('Sezzle Error - Reference ID has changed');
        return { error: true };
    }

    Transaction.wrap(function () {
        paymentInstrument.paymentTransaction.transactionID = reference_id;
        paymentInstrument.paymentTransaction.amount = new Money(session.privacy.sezzleOrderAmount, order.currencyCode).divide(100);
        paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
        var sezzleResponseObject = {
            reference_id: session.privacy.referenceId,
            order_uuid: session.privacy.orderUUID,
            events: [{ id: session.privacy.sezzleFirstEventID }],
            amount: session.privacy.sezzleOrderAmount,
            type: 'sfra',
            order_links: {
                get_order: session.privacy.getOrderLink,
                update_order: session.privacy.updateOrderLink,
                capture_payment: session.privacy.capturePaymentLink,
                refund_payment: session.privacy.refundPaymentLink,
                release_payment: session.privacy.releasePaymentLink
            }
        };
        sezzleUtils.order.updateAttributes(order, sezzleResponseObject);
    });
    return { authorized: true };
}

/**
 * Handle creating of payment instrument
 *
 * @returns {Object} response
 */
function handle() {
    var basket = BasketMgr.getCurrentBasket();
    Transaction.wrap(function () {
        sezzleUtils.basket.createPaymentInstrument(basket);
        session.privacy.sezzleResponseID = '';
        session.privacy.sezzleFirstEventID = '';
        session.privacy.sezzleAmount = '';
    });
    return { success: true };
}


exports.Handle = handle;
exports.Authorize = authorize;
