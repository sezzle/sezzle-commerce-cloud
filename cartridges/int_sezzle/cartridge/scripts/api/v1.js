(function () {
    /**
     * Creates library-wrapper for Sezzle API
     *
     * @constructor
     * @this {Api}
     */
    var V1Api = function () {
        var self = this;
        var sezzleData = require('*/cartridge/scripts/data/sezzleData');
        var logger = require('dw/system').Logger.getLogger('Sezzle', 'sezzle');
        var service = require('*/cartridge/scripts/init/initSezzleServices');

        /**
         * Authenticate the merchant by public and private key
         *
         * @returns {Object} auth token object
         */
        self.authenticate = function () {
            var sezzleService = service.initService('sezzle.authenticate');
            var publicKey = sezzleData.getPublicKey();
            var privateKey = sezzleData.getPrivateKey();

            sezzleService.URL = sezzleData.getV1URLPath() + 'authentication/';
            var resp = sezzleService.setThrowOnError().call({
                public_key: publicKey,
                private_key: privateKey
            });
            return resp.object.response.token;
        };

        /**
         * Capture charge by order reference ID
         *
         * @param {string} orderReferenceID ref
         * @returns {string} Captured At Time
         */
        self.capture = function (orderReferenceID) {
            try {
                var obj = {
                    authToken: self.authenticate()
                };

                var sezzleService = service.initService('sezzle.capture');
                sezzleService.URL = sezzleData.getV1URLPath() + 'checkouts/' + orderReferenceID + '/complete';
                return sezzleService.setThrowOnError().call(obj).object.response;
            } catch (e) {
                logger.error('Api.capture - {0}', e);
                return {
                    error: true
                };
            }
        };

        /**
         * Refund payment by order reference ID
         *
         * @param {string} orderReferenceID Ref ID
         * @returns {string} Refund ID
         * */
        self.refund = function (orderReferenceID) {
            try {
                var obj = {
                    authToken: self.authenticate(),
                    is_full_refund: true

                };
                var sezzleService = service.initService('sezzle.refund');

                sezzleService.URL = sezzleData.getV1URLPath() + 'orders/' + orderReferenceID + '/refund';

                return sezzleService.setThrowOnError().call(obj).object.response;
            } catch (e) {
                logger.error('Api.refund - {0}', e);
                return {
                    error: true
                };
            }
        };

        /**
         * Create a checkout - fetch the checkout url
         *
         * @param {Object} checkoutObject Checkout Object
         * @returns {Object} object with checkout url
         */
        self.createCheckout = function (checkoutObject) {
            try {
                var payloadObj = checkoutObject;
                payloadObj.authToken = self.authenticate();
                logger.info('Token', payloadObj.authToken);
                var sezzleService = service.initService('sezzle.initiatecheckout');

                sezzleService.URL = sezzleData.getV1URLPath() + 'checkouts/';
                return sezzleService.setThrowOnError().call(payloadObj).object.response;
            } catch (e) {
                logger.error('Api.createCheckout - {0}', e);
                return {
                    error: true
                };
            }
        };
    };

    module.exports = new V1Api();
}());
