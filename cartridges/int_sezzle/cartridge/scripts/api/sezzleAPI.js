(function () {
    /**
	 * Creates library-wrapper for Sezzle API
	 *
	 * @constructor
	 * @this {Api}
	 */
    var Api = function () {
        var self = this,
            sezzleData = require('*/cartridge/scripts/data/sezzleData'),
            logger = require('dw/system').Logger.getLogger('Sezzle', ''),
            service = require('*/cartridge/scripts/init/initSezzleServices');

        /**
		 * Authenticate the merchant by public and private key
		 *
		 * @returns {Object} auth token object
		 */
        self.authenticate = function () {
            try {
                var sezzleService = service.initService('sezzle.authenticate');
                var public_key = sezzleData.getPublicKey();
                var private_key = sezzleData.getPrivateKey();

                sezzleService.URL = sezzleData.getURLPath() + 'authentication/';
                var resp = sezzleService.call({
                    public_key: public_key,
                    private_key: private_key
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
		 * @param {string} order_reference_id ref
		 * @param {string} order_number order number
		 * @returns {Object} status
		 */
        self.capture = function (order_reference_id, order_number) {
            try {
                var authentication = self.authenticate();
                var obj = {
                    authToken: authentication.response.token
                };

                var sezzleService = service.initService('sezzle.capture');
                sezzleService.URL = sezzleData.getURLPath() + 'checkouts/' + order_reference_id + '/complete' + '?order_no=' + order_number;
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
		 * @param {string} order_reference_id Ref ID
		 * @returns {Object} status
         * */
        self.refund = function (order_reference_id) {
            try {
                var authentication = self.authenticate();
                var obj = {
                    authToken: authentication.response.token,
                    is_full_refund: true

                };
                var sezzleService = service.initService('sezzle.refund');

                sezzleService.URL = sezzleData.getURLPath() + 'orders/' + order_reference_id + '/refund';

                return sezzleService.call(obj).object;
            } catch (e) {
                logger.debug('Sezzle. File - sezzleAPI. Error - {0}', e);
                return {
                    error: false
                };
            }
        };

        /**
		 * Initiate a checkout - fetch the checkout url
		 *
		 * @param {Object} checkoutObject Checkout Object
		 * @returns {Object} object with checkout url
		 */
        self.initiateCheckout = function (checkoutObject) {
            try {
                var authentication = self.authenticate();
                checkoutObject.authToken = authentication.response.token;
                logger.debug('Token', checkoutObject.authToken);
                var sezzleService = service.initService('sezzle.initiatecheckout');

                sezzleService.URL = sezzleData.getURLPath() + 'checkouts/';
                return sezzleService.call(checkoutObject).object;
            } catch (e) {
                logger.debug('Sezzle. File - sezzleAPI. Error - {0}', e);
                return {
                    error: false
                };
            }
        };
    };

    module.exports = new Api();
}());
