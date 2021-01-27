'use strict';

/**
 * Controller that renders the home page.
 *
 * @module controllers/Sezzle
 */

var BasketMgr = require('dw/order/BasketMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var sezzleUtils = require('*/cartridge/scripts/sezzle');
var Money = require('dw/value/Money');
var logger = require('dw/system').Logger.getLogger('Sezzle', 'sezzle');

/*
 * Export the publicly available controller methods
 */

function authorize(args) {
    var paymentInstrument = args.PaymentInstrument,
        paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor(),
        order = args.Order;

    if (!session.privacy.sezzled && empty(session.privacy.sezzleResponseID)) {
        return { error: true };
    }

    // Check the reference token passed during redirection
    var reference_id = request.httpParameterMap.order_reference_id;

    logger.info('Sezzle Payment Reference Id from redirection - {0}', reference_id);
    logger.info('Sezzle Payment Reference Id stored - {0}', session.privacy.referenceId);

    if (session.privacy.referenceId != reference_id) {
        logger.error('Sezzle Error - Reference ID has changed');

        return { error: true };
    }

    Transaction.wrap(function () {
        paymentInstrument.paymentTransaction.transactionID = reference_id;
        paymentInstrument.paymentTransaction.amount = new Money(session.privacy.sezzleOrderAmount, order.currencyCode).divide(100);
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
        var sezzleResponseObject = {
            reference_id: session.privacy.referenceId,
            order_uuid: session.privacy.orderUUID,
            events: [{ id: session.privacy.sezzleFirstEventID }],
            amount: session.privacy.sezzleOrderAmount,
            type: 'sg',
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

function handle() {
    var basket = BasketMgr.getCurrentBasket();

    Transaction.wrap(function () {
        sezzleUtils.basket.createPaymentInstrument(basket);
        session.privacy.sezzleResponseID = '';
        session.privacy.sezzleFirstEventID = '';
        session.privacy.sezzleOrderAmount = '';
    });

    return { success: true };
}

exports.Handle = handle;
exports.Authorize = authorize;
