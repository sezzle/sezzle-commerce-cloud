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
        var logger = require('dw/system').Logger.getLogger('Sezzle', '');
        var service = require('*/cartridge/scripts/init/initSezzleServices');

        /**
         * Authenticate the merchant by public and private key
         *
         * @returns {Object} auth token object
         */
        self.authenticate = function () {
            try {
                var sezzleService = service.initService('sezzle.authenticate');
                var publicKey = sezzleData.getPublicKey();
                var privateKey = sezzleData.getPrivateKey();

                sezzleService.URL = sezzleData.getV1URLPath() + 'authentication/';
                var resp = sezzleService.call({
                    public_key: publicKey,
                    private_key: privateKey
                });
                return resp.object;
            } catch (e) {
                logger.debug('Sezzle. File - sezzleAPI. Error - {0}', e);
                return {
                    error: false
                };
            }
        };

        /**
         * Capture charge by order reference ID
         *
         * @param {string} orderReferenceID ref
         * @returns {Object} status
         */
        self.capture = function (orderReferenceID) {
            try {
                var authentication = self.authenticate();
                var obj = {
                    authToken: authentication.response.token
                };

                var sezzleService = service.initService('sezzle.capture');
                sezzleService.URL = sezzleData.getV1URLPath() + 'checkouts/' + orderReferenceID + '/complete';
                return sezzleService.call(obj).object;
            } catch (e) {
                logger.debug('Sezzle. File - sezzleAPI. Error - {0}', e);
                return {
                    error: false
                };
            }
        };

        /**
         * Refund payment by order reference ID
         *
         * @param {string} orderReferenceID Ref ID
         * @returns {Object} status
         * */
        self.refund = function (orderReferenceID) {
            try {
                var authentication = self.authenticate();
                var obj = {
                    authToken: authentication.response.token,
                    is_full_refund: true

                };
                var sezzleService = service.initService('sezzle.refund');

                sezzleService.URL = sezzleData.getV1URLPath() + 'orders/' + orderReferenceID + '/refund';

                return sezzleService.call(obj).object;
            } catch (e) {
                logger.debug('Sezzle. File - sezzleAPI. Error - {0}', e);
                return {
                    error: false
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
                var authentication = self.authenticate();
                var payloadObj = checkoutObject;
                payloadObj.authToken = authentication.response.token;
                logger.debug('Token', payloadObj.authToken);
                var sezzleService = service.initService('sezzle.initiatecheckout');

                sezzleService.URL = sezzleData.getV1URLPath() + 'checkouts/';
                return sezzleService.call(payloadObj).object;
            } catch (e) {
                logger.debug('Sezzle. File - sezzleAPI. Error - {0}', e);
                return {
                    error: false
                };
            }
        };
    };

    module.exports = new V1Api();
}());
