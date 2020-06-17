(function () {
    /**
     * Library for providing access to DW site preferences and resources
     *
     * @constructor
     * @this {Data}
     * @returns Data instance
     */
    var Data = function () {
    var system = require('dw/system');
    var web = require('dw/web');
    var currentSite = system.Site.getCurrent();
    var Site = require('dw/system/Site').getCurrent();
    var test = Site.getCustomPreferenceValue('SezzleMode');
    var mode = !empty(currentSite.getCustomPreferenceValue('SezzleMode')) ?
                    currentSite.getCustomPreferenceValue('SezzleMode').getValue() :
                    'sandbox';
        /**
         * Return Sezzle public key
         *
         * @returns {string} public key
         */
        this.getPublicKey = function () {
            return currentSite.getCustomPreferenceValue('SezzlePublicKey');
        };
        /**
         * Return Sezzle private key
         *
         * @returns {string} private key
         */
        this.getPrivateKey = function () {
            return currentSite.getCustomPreferenceValue('SezzlePrivateKey');
        };
        /**
        * Return StoreFront Path
        *
        * @returns {string} storeFront Path
        */
        this.get = function () {
            return currentSite.getCustomPreferenceValue('StoreFrontPath');
        };
        /**
         * Return Sezzle Online Status preference
         *
         * @returns {boolean} Promo text
         */
        this.getSezzleOnlineStatus = function () {
            return !empty(currentSite.getCustomPreferenceValue('SezzleOnline')) ?
                    currentSite.getCustomPreferenceValue('SezzleOnline') :
                    false;
        };
        /**
         * Return Sezzle Merchant UUID
         *
         * @returns {string} merchant uuid
         */
        this.getMerchantUUID = function () {
            return currentSite.getCustomPreferenceValue('SezzleMerchantUUID');
        };
        /**
         * Return Sezzle Widget is allowed in PDP or not
         *
         * @returns {boolean} status
         */
        this.isWidgetScriptAllowedInPDP = function () {
            return currentSite.getCustomPreferenceValue('SezzleAllowWidgetInPDP');
        };
        /**
         * Return Sezzle Widget is allowed in Cart Page or not
         *
         * @returns {boolean} status
         */
        this.isWidgetScriptAllowedInCart = function () {
            return currentSite.getCustomPreferenceValue('SezzleAllowWidgetInCartPage');
        };
        /**
         * Return Sezzle Tokenize Status
         *
         * @returns {string} tokenize status
         */
        this.getTokenizeStatus = function () {
            return currentSite.getCustomPreferenceValue('SezzleTokenize');
        };
        /**
         * Return Sezzle Payment Action preference
         *
         * @returns {string} Promo text
         */
        this.getSezzlePaymentAction = function () {
            return currentSite.getCustomPreferenceValue('SezzlePaymentAction');
        };
        /**
         * Return Sezzle V1 URL path from resource file
         *
         * @returns {string} URL path
         */
        this.getV1URLPath = function () {
            return web.Resource.msg('sezzle.' + mode + '.v1.url', 'sezzle', null);
        };
        /**
         * Return Sezzle V2 URL path from resource file
         *
         * @returns {string} URL path
         */
        this.getV2URLPath = function () {
            return web.Resource.msg('sezzle.' + mode + '.v2.url', 'sezzle', null);
        };
        /**
         * Return Sezzle JS path from resource file
         *
         * @returns {string} JS path
         */
        this.getJSPath = function () {
            return web.Resource.msg('sezzle.' + mode + '.js', 'sezzle', null);
        };
        /**
         * Return status of promo message on cart page
         *
         * @returns {boolean} cart promo status
         */
        this.getCartPromoMessageStatus = function () {
            return !!currentSite.getCustomPreferenceValue('SezzleCartPromoMessage');
        };
        /**
         * Return status of promo message on PLP pages
         *
         * @returns {boolean} plp promo status
         */
        this.getPLPPromoMessageStatus = function () {
            return !!currentSite.getCustomPreferenceValue('SezzlePLPPromoMessage');
        };
        /**
         * Return status of promo message on product page
         *
         * @returns {boolean} pdp promo status
         */
        this.getProductPromoMessageStatus = function () {
            return !!currentSite.getCustomPreferenceValue('SezzleProductMessage');
        };
        /**
         * Return financing program to cart total mapping
         *
         * @returns {array} array of string
         */
        this.getCartTotalMapping = function () {
            return currentSite.getCustomPreferenceValue('SezzleFPTotalRange');
        };
        /**
         * Return default financing program
         *
         * @returns {string} default financing program
         */
        this.getDefaultFinancingProgram = function () {
            return currentSite.getCustomPreferenceValue('SezzleDefaultFP');
        };
        /**
         * Return financing program to customer group mapping
         *
         * @returns {array} array of string
         */
        this.getCustomerGroupMapping = function () {
            return currentSite.getCustomPreferenceValue('SezzleFPCustomerGroup');
        };
        /**
		 * @description Due to CyberSource changes payment can be disabled from the BM (Requirement 09.12.2017)
		 * @returns {Boolean}
		 */
		this.getSezzlePaymentOnlineStatus = function() {
			return currentSite.getCustomPreferenceValue('SezzlePaymentOnlineStatus');
		};
        /**
         * Return financing program to date mapping
         *
         * @returns {array} array of string
         */
        this.getDateRangeMapping = function () {
            return currentSite.getCustomPreferenceValue('SezzleFPDateRange');
        };
        /**
         * Return sezzle minimal applying total
         *
         * @returns {Number} minimal applying total
         */
        this.getSezzleMinTotal = function () {
            return currentSite.getCustomPreferenceValue('SezzleMinTotal');
        };
        /**
         * Return sezzle minimal applying total
         *
         * @returns {Number} minimal applying total
         */
        this.getSezzlePaymentMinTotal = function () {
            return currentSite.getCustomPreferenceValue('SezzlePaymentMinTotal');
        };
        /**
         * Return sezzle maximal applying total
         *
         * @returns {Number} maximal applying total
         */
        this.getSezzlePaymentMaxTotal = function () {
            return currentSite.getCustomPreferenceValue('SezzlePaymentMaxTotal');
        };
        this.getErrorMessages = function () {
            return JSON.stringify({
                'closed': web.Resource.msg('sezzle.error.closed', 'sezzle', ''),
                'default': web.Resource.msg('sezzle.error.default', 'sezzle', '')
            });
        }
    };
    module.exports = new Data();
}());