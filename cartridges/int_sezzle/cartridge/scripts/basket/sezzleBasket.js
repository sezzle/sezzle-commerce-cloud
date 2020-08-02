(function () {
    /**
	 * Creates library for working with Basket
	 *
	 * @constructor
	 * @this {Basket}
	 */
    var Basket = function () {
        var self = this,
            web = require('dw/web'),
            system = require('dw/system'),
            PaymentMgr = require('dw/order/PaymentMgr'),
            ProductMgr = require('dw/catalog/ProductMgr'),
            sezzleUtils = require('*/cartridge/scripts/utils/sezzleUtils'),
            sezzleData = require('*/cartridge/scripts/data/sezzleData');
        sezzleAPI = require('*/cartridge/scripts/api/sezzleAPI');

        self.utils = sezzleUtils;

        /**
		 * Build shipping address object based on Basket
		 *
		 * @param {dw.order.Basket} basket Basket
		 * @returns {Object} simple object with name and shipping address
		 */
        self.getShippingAddress = function (basket) {
            var shippingAddress = basket.getDefaultShipment().getShippingAddress();
            return {
                'name': {
                    'first': shippingAddress.getFirstName(),
                    'last': shippingAddress.getLastName(),
                    'full': shippingAddress.getFullName()
                },
                'address': {
                    'line1': shippingAddress.getAddress1(),
                    'line2': shippingAddress.getAddress2(),
                    'city': shippingAddress.getCity(),
                    'state': shippingAddress.getStateCode(),
                    'zipcode': shippingAddress.getPostalCode(),
                    'country': shippingAddress.getCountryCode().getValue()
                }
            };
        };

        /**
		 * Build billing address object based on Basket
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @returns {Object} simple object with name and billing address
		 */
        self.getBillingAddress = function (basket) {
            var billingAddress = basket.getBillingAddress();
            if (empty(billingAddress)){
                return null;
            }
            return {
                'name': {
                    'first': billingAddress.getFirstName(),
                    'last': billingAddress.getLastName(),
                    'full': billingAddress.getFullName()
                },
                'address': {
                    'line1': billingAddress.getAddress1(),
                    'line2': billingAddress.getAddress2(),
                    'city': billingAddress.getCity(),
                    'state': billingAddress.getStateCode(),
                    'zipcode': billingAddress.getPostalCode(),
                    'country': billingAddress.getCountryCode().getValue()
                },
                'phone_number': billingAddress.getPhone(),
                'email': basket.getCustomerEmail()
            };
        };

        /**
		 * Build items object based on Basket
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @returns {Object} simple object contained product data
		 */
        self.getItems = function (basket) {
            var items = [],
                productLineItems = basket.getProductLineItems().iterator();

            while (!empty(productLineItems) && productLineItems.hasNext()) {
                let productLineItem = productLineItems.next();
				
                var product = ProductMgr.getProduct(productLineItem.productID);
                var categoriesCollection = product.getAllCategoryAssignments().iterator();
                //If no assigned categories to product and it is not a master then get categories by master
                if(!categoriesCollection.hasNext() && !product.master){
                    categoriesCollection = product.masterProduct.getAllCategoryAssignments().iterator()
                }
			 	var categoryNames = [];
			 	
			 	while(categoriesCollection.hasNext()){
			 		var category = 	categoriesCollection.next();
			 		var arr = [];
			 		
                    function checkForParentCategory(obj) {
                        if (('parent' in obj) && obj.parent != null) {
                            arr.push(obj.displayName);
                            checkForParentCategory(obj.parent)
                        }
                    }
			 		checkForParentCategory(category.category);
			 		categoryNames.push(arr.reverse());
			 	}
                var item_price = productLineItem.optionProductLineItem ?
                    productLineItem.getBasePrice().multiply(100).getValue() :
                    productLineItem.product.getPriceModel().getPrice().multiply(100).getValue();
                items.push({
                    'name' : productLineItem.getProductName(),
                    'sku' : productLineItem.getProductID(),
                    'price' : {'amount_in_cents' : item_price, 'currency' :'USD'},
                    'quantity' : productLineItem.getQuantityValue(),
                    'item_image_url' : !empty(productLineItem.product) ?
                        productLineItem.product.getImage('medium').getHttpURL().toString() :
                        '',
                    'item_url' : !empty(productLineItem.product) ?
                        web.URLUtils.abs('Product-Show', 'pid', productLineItem.product.getID()).toString() :
                        '',
                    'categories' : categoryNames
                });
            }

            return items;
        };

        /**
		 * Checks possibility of using Sezzle payment method
		 * Removes one if it cann't be accepted
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @param {dw.util.Collection} ApplicablePaymentMethods basket
		 * @returns {Object} simple object contained product data
		 */
        self.validatePayments = function (basket, ApplicablePaymentMethods) {
            if (!basket.getGiftCertificateLineItems().empty || !sezzleData.getSezzleOnlineStatus() || !sezzleUtils.checkBasketTotalRange('object' in basket ? basket.object : basket)) {
                let sezzlePaymentMethod = PaymentMgr.getPaymentMethod('Sezzle');

                ApplicablePaymentMethods.remove(sezzlePaymentMethod);
            }

            return ApplicablePaymentMethods;
        };

        /**
		 * Build object with confirmation and cancel URLs
		 *
		 * @returns {Object} simple object contained URLs
		 */
        self.getMerchant = function () {
            return {
                'user_confirmation_url': web.URLUtils.https('Sezzle-Success').toString(),
                'user_cancel_url': web.URLUtils.https('COBilling-Start').toString(),
                'user_confirmation_url_action': 'GET'
            };
        };

        /**
		 * Build object with configuration data
		 *
		 * @returns {Object} simple object contained configuration data
		 */
        self.getConfig = function () {
            return {};
        };

        /**
         * @param {dw.order.Basket}  basket Basket
         * @returns {[]} simple object contained configuration data
         */
        self.getDiscounts = function (basket) {
            var discount = {
				
            };

            return [];
        };

        /**
		 * Build object with metadata
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @returns {Object} simple object contained metadata
		 */
        self.getMetadata = function (basket) {
            var compatibilityMode = (system.System.compatibilityMode / 100).toString();
            compatibilityMode = compatibilityMode.split('.').map(function(val, i){
                if(i != 1) {
                    return val;
                }
                return val.replace("0", "");
            }).join('.');
            return {
                'shipping_type': basket.getDefaultShipment().getShippingMethod().getDisplayName(),
                'platform_version': compatibilityMode,
                'platform_type': web.Resource.msg('metadata.platform_type', 'sezzle', null),
                'platform_sezzle': web.Resource.msg('metadata.platform_sezzle', 'sezzle', null),
            };
        };

        /**
		 * Return shipping amount in cents
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @returns {number} shipping amount in cents
		 */
        self.getShippingAmmout = function (basket) {
            return basket.getDefaultShipment().getShippingTotalPrice().multiply(100).getValue();
        };

        /**
		 * Return tax amount in cents
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @returns {number} tax amount in cents
		 */
        self.getTaxAmount = function (basket) {
            return basket.getTotalTax().multiply(100).getValue();
        };

        /**
		 * Return total amount in cents
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @returns {number} total amount in cents
		 */
        self.getTotal = function (basket) {
            return sezzleUtils.calculateNonGiftCertificateAmount(basket).multiply(100).getValue();
        };

        /**
		 * Create Sezzle payment instrument
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @returns {dw.order.PaymentInstrument} payment instrument
		 */
        self.createPaymentInstrument = function (basket) {
            self.removePaymentInstrument(basket);
            var amount = sezzleUtils.calculateNonGiftCertificateAmount(basket);
            return basket.createPaymentInstrument('Sezzle', amount);
        };

        /**
		 * Remove Sezzle payment instrument
		 *
		 * @param {dw.order.Basket}  basket Basket
		 */
        self.removePaymentInstrument = function (basket) {
            var paymentInstruments = basket.getPaymentInstruments('Sezzle').iterator();

            while (!empty(paymentInstruments) && paymentInstruments.hasNext()) {
                let paymentInstrument = paymentInstruments.next();
                basket.removePaymentInstrument(paymentInstrument);
            }
        };
		
		

        /**
		 * Build object with checkout data and fetch the checkout url
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @returns {string} checkout data object in JSON format
		 */
        self.initiateCheckout = function (basket) {
            var order_ref_id = sezzleUtils.generateUUID();
            var checkoutObject = {
                'merchant' : self.getMerchant(),
                'config' : self.getConfig(),
                'items' : self.getItems(basket),
                'billing' : self.getBillingAddress(basket),
                'shipping': self.getShippingAddress(basket),
                'discounts' : self.getDiscounts(basket),
                'metadata' : self.getMetadata(basket),
                'shipping_amount' : {'amount_in_cents' : self.getShippingAmmout(basket), 'currency': 'USD'},
                'tax_amount' : {'amount_in_cents' : self.getTaxAmount(basket), 'currency': 'USD'},
                'amount_in_cents' : self.getTotal(basket),
                'currency_code' : "USD",
                'order_description' : "Commerce cloud order",
                'order_reference_id' : order_ref_id,
                'checkout_complete_url' : self.getMerchant().user_confirmation_url + "?order_reference_id="+order_ref_id,
                'checkout_cancel_url' : self.getMerchant().user_cancel_url,
                'requires_shipping_info' : false,
                'merchant_completes' : true	
            };
            checkoutResponse = sezzleAPI.initiateCheckout(checkoutObject) 
            checkoutObject['redirect_url'] = checkoutResponse.response.checkout_url;
            return checkoutObject;
        };
    };

    module.exports = new Basket();
}());
