/* global empty */
(function () {
    /**
     * Creates library for working with Order
     * Middleware layer between Sezzle API and orders
     *
     * @constructor
     * @this {Order}
     */
    var Order = function () {
        var logger = require('dw/system').Logger.getLogger('Sezzle', 'sezzle');
        var OrderMgr = require('dw/order/OrderMgr');
        var OrderModel = require('dw/order/Order');
        var Money = require('dw/value/Money');
        var data = require('~/cartridge/scripts/data/sezzleData');
        var v2 = require('~/cartridge/scripts/api/v2');
        var v1 = require('~/cartridge/scripts/api/v1');
		var sezzleUtils = require('*/cartridge/scripts/utils/sezzleUtils');

        /**
         * Updates PaymentInstrument and Order system objects
         *
         * @param {dw.order.Order} order demnadware order instance
         * @param {Object} response response from Sezzle
         */
        this.updateAttributes = function (order, response) {
            try {
                var orderObj = order;
                orderObj.custom.SezzleExternalId = response.reference_id;
                orderObj.custom.SezzlePaymentAction = (response.order_uuid && response.order_uuid !== 'undefined') ? String(data.getSezzlePaymentAction()) : 'CAPTURE';
                orderObj.custom.SezzleOrderUUID = (response.order_uuid && response.order_uuid !== 'undefined') ? response.order_uuid : '';
                orderObj.custom.SezzleOrderAmount = new Money(response.amount, orderObj.currencyCode).divide(100);
                if (!empty(response.order_links)) {
                    orderObj.custom.SezzleGetOrderLink = response.order_links.get_order;
                    orderObj.custom.SezzleUpdateOrderLink = response.order_links.update_order;
                    orderObj.custom.SezzleCapturePaymentLink = response.order_links.capture_payment;
                    orderObj.custom.SezzleRefundPaymentLink = response.order_links.refund_payment;
                    orderObj.custom.SezzleReleasePaymentLink = response.order_links.release_payment;
                }
                logger.info('Sezzle attributes has been updated in the Order object');
            } catch (e) {
                logger.error('sezzleOrder.updateAttributes.- {0}', e);
            }
        };

        /**
         * Capture payment
         *
         * @param {dw.order.Order} order Order
         * @param {dw.value.Money} amount Capture Amount
		 * @returns {boolean} status
         */
        this.captureOrder = function (order, amount) {
			var captureAmount = amount.multiply(100).getValue();
        	return v2.capture(order, captureAmount, false);
        };

        /**
         * Get Token Details
         *
         * @param {string} token Token
         * @returns {Object} token details response
         */
        this.getTokenDetails = function (token) {
            return v2.getCustomerUUID(token);
        };

        /**
         * Create order by customer uuid
         *
         * @param {Object} requestObject Request Object
         * @returns {Object} order response
         */
        this.createOrder = function (requestObject) {
            return v2.createOrderByCustomerUUID(requestObject);
        };

        /**
         * Get order by order uuid
         *
         * @param {dw.order.Order} order Order
         * @returns {Object} order response
         */
        this.getOrderByOrderUUID = function (order) {
            return v2.getOrderByOrderUUID(order);
        };

        /**
         * Update order by order uuid
         *
         * @param {dw.order.Order} order Order
         */
        this.updateOrder = function (order) {
            v2.updateOrder(order);
        };

        /**
         * Full refund captured orders. Used in Sezzle job.
         *
         * @see pipeline "SezzleJob"
         */
        this.refundOrders = function () {
            try {
                OrderMgr.processOrders(function (order) {
                    var orderObj = order;
                    var response = null;
                    var authAmountStr = orderObj.custom.SezzleOrderAmount || '0.00';
                    var authAmountInFloat = parseFloat(authAmountStr.replace(orderObj.currencyCode, ''));
                    var authAmountInCents = new Money(authAmountInFloat, orderObj.currencyCode).multiply(100).getValue();
                    if ((orderObj.custom.SezzleOrderAmount === orderObj.custom.SezzleCapturedAmount)
                            && authAmountInCents > 0) {
                        if (!orderObj.custom.SezzleOrderUUID) {
                            response = v1.refund(orderObj.custom.SezzleExternalId);
                        } else {
                            response = v2.refund(orderObj, authAmountInCents);
                        }
						if (response) {
                            if (!orderObj.custom.SezzleOrderUUID) {
                                orderObj.custom.SezzleStatus = 'REFUNDED';
                            }
                            orderObj.custom.SezzleRefundedAmount = orderObj.totalGrossPrice.toString();
                        }
                    }
                }, 'status = {0} AND custom.SezzleRefundedAmount = null',
                OrderModel.ORDER_STATUS_CANCELLED);
                logger.info('Payment has been successfully refunded by Sezzle');
            } catch (e) {
                logger.error('sezzleOrder.refundOrders.- {0}', e);
            }
        };
    };

    module.exports = new Order();
}());
