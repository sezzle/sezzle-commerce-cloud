(function () {
    /**
	 * Creates library for working with Order
	 * Middleware layer between Sezzle API and orders
	 *
     * @constructor
     * @this {Order}
	 */
    var Order = function () {
        var logger = require('dw/system').Logger.getLogger('Sezzle', '');
        var OrderMgr = require('dw/order/OrderMgr');
        var OrderModel = require('dw/order/Order');
        var Money = require('dw/value/Money');
        var File = require('dw/io/File');
        var FileReader = require('dw/io/FileReader');
        var FileWriter = require('dw/io/FileWriter');
        var data = require('~/cartridge/scripts/data/sezzleData');
        var v2 = require('~/cartridge/scripts/api/v2');
        var filepath = File.IMPEX + File.SEPARATOR + 'sezzle' + File.SEPARATOR;
        var filename = 'sezzle.dat';

        /**
		 * Read date from file
		 *
		 * @returns {Date} Date instance
		 */
        function readDateFromFile() {
            var file = new File(filepath + filename);
            if (file.exists()) {
                var fileReader = new FileReader(file);
                var strDate = fileReader.readLine();
                fileReader.close();
                if (strDate) {
                    return new Date(Date.parse(strDate));
                }
            }
            return new Date(0);
        }

        /**
		 * Save date to file
		 *
		 * @param {Date} date Date
		 */
        function saveDateToFile(date) {
            var dir = new File(filepath);
            if (!dir.exists()) {
                dir.mkdirs();
            }
            var file = new File(filepath + filename);
            if (!file.exists()) {
                file.createNewFile();
            }
            var fileWriter = new FileWriter(file);
            fileWriter.writeLine(date.toISOString());
            fileWriter.flush();
            fileWriter.close();
        }

        /**
		 * Updates PaymentInstrument and Order system objects
		 *
		 * @param {dw.order.Order} order demnadware order instance
		 * @param {Object} response response from Sezzle
		 * @param {dw.order.PaymentProcessor} paymentProcessor payment processor instance
		 * @param {dw.order.PaymentInstrument} paymentInstrument payment instrument instance
		 */
        this.updateAttributes = function (order, response, paymentProcessor, paymentInstrument) {
            try {
                order.custom.SezzleExternalId = response.reference_id;
                order.custom.SezzlePaymentAction = String(data.getSezzlePaymentAction());
                order.custom.SezzleOrderUUID = response.order_uuid != 'undefined' ? response.order_uuid : '';
                order.custom.SezzleOrderAmount = new Money(response.amount, order.currencyCode).divide(100);
                if (!empty(response.order_links)) {
                    order.custom.SezzleGetOrderLink = response.order_links.get_order;
                    order.custom.SezzleUpdateOrderLink = response.order_links.update_order;
                    order.custom.SezzleCapturePaymentLink = response.order_links.capture_payment;
                    order.custom.SezzleRefundPaymentLink = response.order_links.refund_payment;
                    order.custom.SezzleReleasePaymentLink = response.order_links.release_payment;
                }
                logger.debug('Sezzle attributes has been updated in the Order object');
            } catch (e) {
                logger.debug('sezzleOrder.updateAttributes.- {0}', e);
            }
        };

        /**
		 * Capture payment
		 *
		 * @param {dw.order.Order} order Order
		 */
        this.captureOrder = function (order) {
            var captureAmount = order.totalGrossPrice.multiply(100).getValue();
            v2.capture(order, captureAmount, false);
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
                    var authAmountStr = order.custom.SezzleOrderAmount || '0.00';
			    	var authAmountInFloat = parseFloat(authAmountStr.replace(order.currencyCode, ''));
			    	var authAmountInCents = new Money(authAmountInFloat, order.currencyCode).multiply(100).getValue();
                    if ((order.custom.SezzleOrderAmount == order.custom.SezzleCapturedAmount)
						&& authAmountInCents > 0) {
                        var response = v2.refund(order, authAmountInCents);
                        if (response != null && !response.error) {
                            order.custom.SezzleRefundedAmount = order.totalGrossPrice.toString();
                        }
                    }
                }, 'status = {0} AND custom.SezzleRefundedAmount = null',
                OrderModel.ORDER_STATUS_CANCELLED);
                logger.debug('Payment has been successfully refunded by Sezzle');
            } catch (e) {
                logger.debug('sezzleOrder.refundOrders.- {0}', e);
            }
        };
    };

    module.exports = new Order();
}());
