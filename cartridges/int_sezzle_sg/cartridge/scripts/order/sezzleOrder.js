(function () {
    /**
	 * Creates library for working with Order
	 * Middleware layer between Sezzle API and orders
	 *
	 * @constructor
	 * @this {Order}
	 */
    var Order = function () {
        var logger = require('dw/system').Logger.getLogger('Sezzle', ''),
            OrderMgr = require('dw/order/OrderMgr'),
            OrderModel = require('dw/order/Order'),
            Money = require('dw/value/Money'),
            File = require('dw/io/File'),
            FileReader = require('dw/io/FileReader'),
            FileWriter = require('dw/io/FileWriter'),
            data = require('~/cartridge/scripts/data/sezzleData'),
            basket = require('~/cartridge/scripts/basket/sezzleBasket'),
            api = require('~/cartridge/scripts/api/sezzleAPI'),
            filepath = File.IMPEX + File.SEPARATOR + 'sezzle' + File.SEPARATOR,
            filename = 'sezzle.dat';

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
		 * @param {Object} response auth response from Sezzle
		 * @param {dw.order.PaymentProcessor} paymentProcessor payment processor instance
		 * @param {dw.order.PaymentInstrument} paymentInstrument payment isntrument instance
		 */
        this.updateAttributes = function (order, response, paymentProcessor, paymentInstrument) {
            try {
                paymentInstrument.paymentTransaction.transactionID = response.id;
                paymentInstrument.paymentTransaction.amount = new Money(response.amount, order.currencyCode).divide(100);
                paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);

                order.custom.SezzleExternalId = response.id;
                order.custom.SezzleStatus = 'AUTH';
                order.custom.SezzlePaymentAction = data.getSezzlePaymentAction();
            } catch (e) {
                logger.debug('Sezzle. File - sezzleOrder. Error - {0}', e);
            }
        };


        this.captureOrder = api.capture;
        /**
		 * Refund captured orders and update their sezzle status. Used in Sezzle job.
		 *
		 * @see pipeline "SezzleJob"
		 */
        this.refundOrders = function () {
            OrderMgr.processOrders(function (order) {
                try {
                    var response = api.refund(order.custom.SezzleExternalId);
                    if (response != null && !response.error) {
                        order.custom.SezzleStatus = 'REFUNDED';
                    }
                } catch (e) {
                    logger.debug('Sezzle. File - sezzleOrder. Error - {0}', e);
                }
            }, 'status = {0} AND custom.SezzleStatus = {1}', OrderModel.ORDER_STATUS_CANCELLED, 'CAPTURE');
        };
    };

    module.exports = new Order();
}());
