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
var Order = require('dw/order/Order');
var logger = require('dw/system').Logger.getLogger(
    'Sezzle',
    ''
);

/*
 * Export the publicly available controller methods
 */

function authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var order = OrderMgr.getOrder(orderNumber);

    if (!session.privacy.sezzled && empty(session.privacy.sezzleResponseID)) {
        return { error: true };
    }

    // Check the reference token passed during redirection
    var reference_id = request.httpParameterMap.order_reference_id;

    logger.debug(
        'Sezzle Payment Reference Id - {0} {1}',
        reference_id,
        session.privacy.referenceId
    );

    if (session.privacy.referenceId != reference_id) {
        logger.debug('Sezzle Error - Reference ID has changed');
        return { error: true };
    }

    Transaction.wrap(function () {
        paymentInstrument.paymentTransaction.transactionID = orderNumber;
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
        var sezzleResponseObject = {
            id: session.privacy.referenceId,
            events: [{ id: session.privacy.sezzleFirstEventID }],
            amount: session.privacy.sezzleAmount,
            token: session.privacy.sezzleToken
        };
        sezzleUtils.order.updateAttributes(order, sezzleResponseObject, paymentProcessor, paymentInstrument);
    });
    return { authorized: true };
}

function postProcess(order) {
    if (sezzleUtils.data.getSezzlePaymentAction() === 'CAPTURE') {
        try {
            Transaction.wrap(function () {
                var resp = sezzleUtils.order.captureOrder(order.custom.SezzleExternalId, order.orderNo);
                if (resp) {
                    if (resp.httpStatus === 200) {
                        order.custom.SezzleStatus = 'CAPTURE';
                        order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                    } else {
                        logger.debug('Sezzle Capturing error');
                        return { error: true };
                    }
                } else {
                    logger.debug('Sezzle Capturing error. Details');
                    return { error: true };
                }
                return { error: false };
            });
        } catch (e) {
            logger.debug(
                'Sezzle Capturing error. Details - {0}',
                e
            );
            return { error: true };
        }
    }
    return { error: false };
}

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
exports.PostProcess = postProcess;
