(function () {
    /**
     * Creates library-wrapper for Sezzle API
     *
     * @constructor
     * @this {Api}
     */
    var V2Api = function () {
        var self = this;
        var sezzleData = require('*/cartridge/scripts/data/sezzleData');
        var logger = require('dw/system').Logger.getLogger('Sezzle', '');
        var service = require('*/cartridge/scripts/init/initSezzleServices');
        var sezzleUtils = require('*/cartridge/scripts/utils/sezzleUtils');

        /**
         * Authenticate the merchant by public and private key
         *
         * @returns {Object} response object
         */
        self.authenticate = function () {
            try {
                if (sezzleUtils.getAuthToken() !== '') {
                    return sezzleUtils.getAuthToken();
                }
                var sezzleService = service.initService('sezzle.authenticate');
                var publicKey = sezzleData.getPublicKey();
                var privateKey = sezzleData.getPrivateKey();

                sezzleService.URL = sezzleData.getV2URLPath() + 'authentication';
                var resp = sezzleService.call({
                    public_key: publicKey,
                    private_key: privateKey
                });
                var response = resp.object.response;
                sezzleUtils.setAuthToken(response);
                return response.token;
            } catch (e) {
                logger.debug('Api:authenticate. - {0}', e);
                return {
                    error: true
                };
            }
        };

        /**
         * Capture charge by order UUID
         *
         * @param {dw.order.Order} order Order
         * @param {string} amount Amount
         * @param {boolean} isPartialCapture Is Partial Capture
         * @returns {Object} response object
         */
        self.capture = function (order, amount, isPartialCapture) {
            try {
                var obj = {
                    authToken: self.authenticate(),
                    capture_amount: {
                        amount_in_cents: amount,
                        currency: order.getCurrencyCode()
                    },
                    partial_capture: isPartialCapture
                };

                var sezzleService = service.initService('sezzle.capture');
                sezzleService.URL = order.custom.SezzleCapturePaymentLink;
                return sezzleService.call(obj).object;
            } catch (e) {
                logger.debug('Api:capture. - {0}', e);
                return {
                    error: true
                };
            }
        };

        /**
         * Get customer UUID by token
         *
         * @param {string} token Token
         * @returns {Object} response object
         */
        self.getCustomerUUID = function (token) {
            try {
                var obj = {
                    authToken: self.authenticate(),
                    httpMethod: 'GET'
                };

                var sezzleService = service.initService('sezzle.getcustomeruuid');
                sezzleService.URL = sezzleData.getV2URLPath() + 'token/' + token + '/session';
                return sezzleService.call(obj).object;
            } catch (e) {
                logger.debug('Api:getCustomerUUID. - {0}', e);
                return {
                    error: true
                };
            }
        };

        /**
         * Get order by order UUID
         *
         * @param {dw.order.Order} order Order
         * @returns {Object} response object
         */
        self.getOrderByOrderUUID = function (order) {
            try {
                var obj = {
                    authToken: self.authenticate(),
                    httpMethod: 'GET'
                };

                var sezzleService = service.initService('sezzle.getorderbyorderuuid');
                sezzleService.URL = order.custom.SezzleGetOrderLink;
                return sezzleService.call(obj).object;
            } catch (e) {
                logger.debug('Api:getOrderByOrderUUID. - {0}', e);
                return {
                    error: true
                };
            }
        };

        /**
         * Create order by customer uuid
         *
         * @param {Object} requestObj Request Object
         * @returns {Object} order response object
         */
        self.createOrderByCustomerUUID = function (requestObj) {
            try {
                var payloadObj = requestObj;
                payloadObj.authToken = self.authenticate();
                var sezzleService = service.initService('sezzle.createorderbycustomeruuid');
                sezzleService.URL = payloadObj.link;
                return sezzleService.call(payloadObj).object;
            } catch (e) {
                logger.debug('Api:createOrderByCustomerUUID. - {0}', e);
                return {
                    error: true
                };
            }
        };

        /**
         * Refund payment by order UUID
         *
         * @param {dw.order.Order} order Order
         * @param {string} amount Amount
         * @returns {Object} response object
         */
        self.refund = function (order, amount) {
            try {
                var obj = {
                    authToken: self.authenticate(),
                    amount_in_cents: amount,
                    currency: order.getCurrencyCode()
                };

                var sezzleService = service.initService('sezzle.refund');
                sezzleService.URL = order.custom.SezzleRefundPaymentLink;
                return sezzleService.call(obj).object;
            } catch (e) {
                logger.debug('Api:refund. - {0}', e);
                return {
                    error: true
                };
            }
        };

        /**
         * Release payment by order UUID
         *
         * @param {dw.order.Order} order Order
         * @param {string} amount Amount
         * @returns {Object} response object
         */
        self.release = function (order, amount) {
            try {
                var obj = {
                    authToken: self.authenticate(),
                    amount_in_cents: amount,
                    currency: order.getCurrencyCode()
                };
                var sezzleService = service.initService('sezzle.release');
                sezzleService.URL = order.custom.SezzleReleasePaymentLink;
                return sezzleService.call(obj).object;
            } catch (e) {
                logger.debug('Api:release. - {0}', e);
                return {
                    error: true
                };
            }
        };

        /**
         * Update order reference id
         *
         * @param {dw.order.Order} order Order
         * @returns {Object} response object
         */
        self.updateOrder = function (order) {
            try {
                var obj = {
                    authToken: self.authenticate(),
                    reference_id: order.orderNo,
                    httpMethod: 'PATCH'
                };

                var sezzleService = service.initService('sezzle.updateorder');
                sezzleService.URL = order.custom.SezzleUpdateOrderLink;
                return sezzleService.call(obj).object;
            } catch (e) {
                logger.debug('Api:updateOrder. - {0}', e);
                return {
                    error: true
                };
            }
        };

        /**
         * Get customer by customer uuid
         *
         * @param {dw.customer.Profile} profile Profile
         * @returns {Object} response object
         */
        self.getCustomer = function (profile) {
            try {
                var obj = {
                    authToken: self.authenticate(),
                    httpMethod: 'GET'
                };

                var sezzleService = service.initService('sezzle.getcustomer');
                sezzleService.URL = profile.custom.SezzleGetCustomerLink;
                return sezzleService.call(obj).object;
            } catch (e) {
                logger.debug('Api:getCustomer. - {0}', e);
                return {
                    error: true
                };
            }
        };

        /**
         * Create Checkout Session
         *
         * @param {Object} checkoutObject Checkout Request Object
         * @returns {Object} response object
         */
        self.createSession = function (checkoutObject) {
            try {
                var payloadObj = checkoutObject;
                payloadObj.authToken = self.authenticate();
                var sezzleService = service.initService('sezzle.createsession');
                sezzleService.URL = sezzleData.getV2URLPath() + 'session';
                return sezzleService.call(payloadObj).object;
            } catch (e) {
                logger.debug('Api:createSession. - {0}', e);
                return {
                    error: true
                };
            }
        };
    };

    module.exports = new V2Api();
}());
