(function () {
    /**
	 * Library for providing access to DW site preferences and resources
	 *
	 * @constructor
	 * @this {Data}
	 */
    var Data = function () {
        var system = require('dw/system'),
            web = require('dw/web'),
            currentSite = system.Site.getCurrent(),
            mode = !empty(currentSite.getCustomPreferenceValue('SezzleMode'))
                ? currentSite.getCustomPreferenceValue('SezzleMode').getValue()
                : 'sandbox';

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
        this.getStoreFrontPath = function () {
            return currentSite.getCustomPreferenceValue('StoreFrontPath');
        };

        /**
		 * Return Sezzle Online Status preference
		 *
		 * @returns {boolean} Promo text
		 */
        this.getSezzleOnlineStatus = function () {
            return !empty(currentSite.getCustomPreferenceValue('SezzleOnline'))
                ? currentSite.getCustomPreferenceValue('SezzleOnline')
                : false;
        };

        /**
		 * Return Sezzle Payment Action preference
		 *
		 * @returns {string} Promo text
		 */
        this.getSezzlePaymentAction = function () {
            return web.Resource.msg('payment.action', 'sezzle', null);
        };

        /**
		 * Return Sezzle URL path from resource file
		 *
		 * @returns {string} URL path
		 */
        this.getURLPath = function () {
            return web.Resource.msg('sezzle.' + mode + '.url', 'sezzle', null);
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
		 * @description Due to CyberSource changes payment can be disabled from the BM (Requirement 09.12.2017)
		 * @returns {Boolean}

		this.getSezzlePaymentOnlineStatus = function() {
			return currentSite.getCustomPreferenceValue('SezzlePaymentOnlineStatus');
		};
		*/

        /**
		 * Return sezzle minimal applying total
		 *
		 * @returns {number} minimal applying total
		 */
        this.getSezzleMinTotal = function () {
            return currentSite.getCustomPreferenceValue('SezzleMinTotal');
        };

        /**
		 * Return sezzle minimal applying total
		 *
		 * @returns {number} minimal applying total
		 */
        this.getSezzlePaymentMinTotal = function () {
            return web.Resource.msg('payment.minTotal', 'sezzle', '');
        };

        /**
		 * Return sezzle maximal applying total
		 *
		 * @returns {number} maximal applying total
		 */
        this.getSezzlePaymentMaxTotal = function () {
            return web.Resource.msg('payment.maxTotal', 'sezzle', '');
        };

        this.getErrorMessages = function () {
            return JSON.stringify({
                closed: web.Resource.msg('sezzle.error.closed', 'sezzle', ''),
                default: web.Resource.msg('sezzle.error.default', 'sezzle', '')
            });
        };
    };

    module.exports = new Data();
}());
