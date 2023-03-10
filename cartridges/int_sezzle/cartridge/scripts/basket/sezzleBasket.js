/* global empty */
(function () {
    /**
     * Creates library for working with Basket
     *
     * @constructor
     * @this {Basket}
     */
    var Basket = function () {
        var self = this;
        var web = require('dw/web');
        var system = require('dw/system');
        var PaymentMgr = require('dw/order/PaymentMgr');
        var sezzleUtils = require('*/cartridge/scripts/utils/sezzleUtils');
        var sezzleData = require('*/cartridge/scripts/data/sezzleData');
        var logger = require('dw/system').Logger.getLogger('Sezzle', 'sezzle');
        var v2 = require('*/cartridge/scripts/api/v2');
        var v1 = require('*/cartridge/scripts/api/v1');
        var sezzleOrder = require('*/cartridge/scripts/order/sezzleOrder');
        var Transaction = require('dw/system/Transaction');

        self.utils = sezzleUtils;

        /**
         * Build shipping address object based on Basket
         *
         * @param {dw.order.Basket}  basket Basket
         * @returns {Object} simple object with shipping address
         */
        self.getShippingAddress = function (basket) {
            var basketShippingAddress = basket.getDefaultShipment().getShippingAddress();
            return {
                name: basketShippingAddress.getFullName(),
                street: basketShippingAddress.getAddress1(),
                street2: basketShippingAddress.getAddress2(),
                city: basketShippingAddress.getCity(),
                state: basketShippingAddress.getStateCode(),
                postal_code: basketShippingAddress.getPostalCode(),
                country_code: basketShippingAddress.getCountryCode().getValue(),
                phone: basketShippingAddress.getPhone()
            };
        };

        /**
         * Build billing address object based on Basket
         *
         * @param {dw.order.Basket}  basket Basket
         * @returns {Object} simple object with billing address
         */
        self.getBillingAddress = function (basket) {
            var basketBillingAddress = basket.getBillingAddress();
            if (empty(basketBillingAddress)) {
                return null;
            }
            return {
                name: basketBillingAddress.getFullName(),
                street: basketBillingAddress.getAddress1(),
                street2: basketBillingAddress.getAddress2(),
                city: basketBillingAddress.getCity(),
                state: basketBillingAddress.getStateCode(),
                postal_code: basketBillingAddress.getPostalCode(),
                country_code: basketBillingAddress.getCountryCode().getValue(),
                phone: basketBillingAddress.getPhone()
            };
        };

        /**
         * Build items object based on Basket
         *
         * @param {dw.order.Basket}  basket Basket
         * @returns {Object} simple object contained product data
         */
        self.getItems = function (basket) {
            var items = [];
            var productLineItems = basket.getProductLineItems().iterator();

            while (!empty(productLineItems) && productLineItems.hasNext()) {
                var productLineItem = productLineItems.next();

                var itemPrice = productLineItem.optionProductLineItem
                    ? productLineItem.getBasePrice().multiply(100).getValue()
                    : productLineItem.product.getPriceModel().getPrice().multiply(100).getValue();
                items.push({
                    name: productLineItem.getProductName(),
                    sku: productLineItem.getProductID(),
                    price: { amount_in_cents: itemPrice, currency: basket.getCurrencyCode() },
                    quantity: productLineItem.getQuantityValue()
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
                var sezzlePaymentMethod = PaymentMgr.getPaymentMethod('Sezzle');

                ApplicablePaymentMethods.remove(sezzlePaymentMethod);
            }

            return ApplicablePaymentMethods;
        };

        /**
         * Build object with confirmation and cancel URLs
         *
         * @param {string} type SFRA/SG
         * @returns {Object} simple object contained URLs
         */
        self.getMerchant = function (type) {
            var cancelURL = web.URLUtils.https('Checkout-Begin').toString();
            if (type === 'SG') {
                cancelURL = web.URLUtils.https('COBilling-Start').toString();
            }
            return {
                user_confirmation_url: web.URLUtils.https('Sezzle-Success').toString(),
                user_cancel_url: cancelURL,
                user_confirmation_url_action: 'GET'
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
         *
         * @return {Array} Discounts
         */
        self.getDiscounts = function () {
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
            compatibilityMode = compatibilityMode.split('.').map(function (val, i) {
                if (i !== 1) {
                    return val;
                }
                return val.replace('0', '');
            }).join('.');
            return {
                shipping_type: basket.getDefaultShipment().getShippingMethod().getDisplayName(),
                platform_version: compatibilityMode,
                platform_type: web.Resource.msg('metadata.platform_type', 'sezzle', null),
                platform_sezzle: web.Resource.msg('metadata.platform_sezzle', 'sezzle', null)
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
            basket.createPaymentInstrument('Sezzle', amount);
            return basket;
        };

        /**
         * Remove Sezzle payment instrument
         *
         * @param {dw.order.Basket}  basket Basket
         */
        self.removePaymentInstrument = function (basket) {
            var paymentInstruments = basket.getPaymentInstruments('Sezzle').iterator();

            while (!empty(paymentInstruments) && paymentInstruments.hasNext()) {
                var paymentInstrument = paymentInstruments.next();
                basket.removePaymentInstrument(paymentInstrument);
            }
        };

        /**
         * Build object with checkout data and fetch the checkout url
         *
         * @param {dw.order.Basket}  basket Basket
         * @returns {Object} checkout data object in JSON format
         */
        self.initiateCheckout = function (basket, type) {
            var referenceID = sezzleUtils.generateUUID();
            var customerTokenRecord = self.getCustomerTokenRecord(basket.customer.profile);
            var returnObj = {};
            if (customerTokenRecord.customer_uuid !== undefined && customerTokenRecord.customer_uuid_expiration !== undefined) {
                logger.info('Tokenized Checkout');
                var createOrderLinkByCustomerUUID = basket.customer.profile.custom.SezzleCustomerCreateOrderLink;
                var requestObject = {
                    customer_uuid: customerTokenRecord.customer_uuid,
                    intent: 'AUTH',
                    reference_id: referenceID,
                    order_amount: {
                        amount_in_cents: self.getTotal(basket),
                        currency: basket.getCurrencyCode()
                    }
                };
                returnObj.checkout = {
                    amount_in_cents: self.getTotal(basket),
                    reference_id: referenceID,
                    approved: false
                };
                if (createOrderLinkByCustomerUUID !== '') {
                    requestObject.link = createOrderLinkByCustomerUUID;
                    var orderResponse = sezzleOrder.createOrder(requestObject);
                    if (orderResponse !== null && !orderResponse.error) {
                        returnObj.checkout.approved = orderResponse.response.authorization.approved;
                        returnObj.checkout.checkout_url = self.getMerchant(type).user_confirmation_url + '?order_reference_id=' + referenceID;
                        returnObj.checkout.order_uuid = orderResponse.response.uuid;
                        returnObj.checkout.order_links = orderResponse.response.links;
                        returnObj.tokenize = {
                            customer_uuid: customerTokenRecord.customer_uuid,
                            customer_uuid_expiration: customerTokenRecord.customer_uuid_expiration
                        };
                    }
                }
            } else {
                logger.info('Typical Checkout');
                var checkoutObject = {
                    cancel_url: {
                        href: self.getMerchant(type).user_cancel_url
                    },
                    complete_url: {
                        href: self.getMerchant(type).user_confirmation_url + '?order_reference_id=' + referenceID
                    },
                    customer: self.getCustomer(basket)
                };
                checkoutObject.order = self.getOrder(basket, referenceID);
                var checkoutResponse = v2.createSession(checkoutObject);
                returnObj.checkout = {
                    amount_in_cents: self.getTotal(basket),
                    reference_id: referenceID,
                    approved: false
                };
                if (checkoutResponse !== null && !checkoutResponse.error) {
                    if (checkoutResponse.response.order) {
                        returnObj.checkout.order_uuid = checkoutResponse.response.order.uuid;
                        returnObj.checkout.checkout_url = checkoutResponse.response.order.checkout_url;
                        returnObj.checkout.order_links = checkoutResponse.response.order.links;
                        returnObj.checkout.approved = true;
                    }
                    if (checkoutResponse.response.tokenize) {
                        returnObj.tokenize = {
                            token: checkoutResponse.response.tokenize.token,
                            token_expiration: checkoutResponse.response.tokenize.expiration,
                            approval_url: checkoutResponse.response.tokenize.approval_url
                        };
                    }
                }
            }
            return returnObj;
        };

        /**
         * V1 Checkout
         *
         * @param {dw.order.Basket}  basket Basket
         * @returns {Object} checkout data object in JSON format
		 * @deprecated
         */
        self.initiateV1Checkout = function (basket) {
            var orderRefID = sezzleUtils.generateUUID();
            var checkoutObject = {
                items: self.getItems(basket),
                billing_address: self.getBillingAddress(basket),
                shipping_address: self.getShippingAddress(basket),
                customer_details: {
                    email: basket.getCustomerEmail(),
                    first_name: basket.getCustomerNo() ? basket.getCustomer().getProfile().getFirstName() : basket.getBillingAddress().getFirstName(),
                    last_name: basket.getCustomerNo() ? basket.getCustomer().getProfile().getLastName() : basket.getBillingAddress().getLastName(),
                    phone: basket.getCustomerNo() ? basket.getCustomer().getProfile().getPhoneMobile() : basket.getBillingAddress().getPhone()
                },
                discounts: self.getDiscounts(),
                metadata: self.getMetadata(basket),
                shipping_amount: {
                    amount_in_cents: self.getShippingAmmout(basket),
                    currency: basket.getCurrencyCode()
                },
                tax_amount: { amount_in_cents: self.getTaxAmount(basket), currency: basket.getCurrencyCode() },
                amount_in_cents: self.getTotal(basket),
                currency_code: basket.getCurrencyCode(),
                order_description: 'Commerce cloud order',
                order_reference_id: orderRefID,
                checkout_complete_url: self.getMerchant('SG').user_confirmation_url + '?order_reference_id=' + orderRefID,
                checkout_cancel_url: self.getMerchant('SG').user_cancel_url,
                requires_shipping_info: false,
                merchant_completes: true
            };
            var checkoutResponse = v1.createCheckout(checkoutObject);
			if (checkoutResponse.error) {
				return checkoutObject;
			}
            checkoutObject.redirect_url = checkoutResponse.checkout_url;
            return checkoutObject;
        };

        /**
         * Get Customer Token Record from Profile
         *
         * @param {dw.customer.Profile}  profile Profile
         * @returns {Object} customer token record object in JSON format
         */
        self.getCustomerTokenRecord = function (profile) {
            if (profile) {
                var customerUUID = profile.custom.SezzleCustomerUUID;
                var customerUUIDExpiration = profile.custom.SezzleCustomerUUIDExpiration;
                var isCustomerTokenized = profile.custom.SezzleCustomerTokenizeStatus;
                if (customerUUID && customerUUIDExpiration && isCustomerTokenized) {
                    var currentTimestamp = Date.now();
                    var customerUUIDExpirationTimestamp = sezzleUtils.getFormattedDateTimestamp(customerUUIDExpiration);
                    if (currentTimestamp <= customerUUIDExpirationTimestamp) {
                        var customer = v2.getCustomer(profile);
                        if (customer !== null && !customer.error && customer.response.email) {
                            logger.info('Found customer token and moving forward');
                            return {
                                customer_uuid: customerUUID,
                                is_tokenized: isCustomerTokenized,
                                customer_uuid_expiration: customerUUIDExpiration
                            };
                        }
                    }
                    self.deleteCustomerToken(profile);
                    logger.info('Customer token has been expired and hence deleted the record from Profile');
                }
            }
            return {};
        };

        /**
         * Delete Customer Token Record from Profile
         *
         * @param {dw.customer.Profile}  profile Profile
         */
        self.deleteCustomerToken = function (profile) {
            var customerProfile = profile;
            Transaction.wrap(function () {
                customerProfile.custom.SezzleCustomerUUID = null;
                customerProfile.custom.SezzleCustomerTokenizeStatus = false;
                customerProfile.custom.SezzleCustomerUUIDExpiration = null;
                customerProfile.custom.SezzleCustomerCreateOrderLink = null;
                customerProfile.custom.SezzleGetCustomerLink = null;
            });
        };


        /**
         * Get customer
         *
         * @param {dw.order.Basket}  basket Basket
         * @returns {string} customer data object in JSON format
         */
        self.getCustomer = function (basket) {
            return {
                tokenize: sezzleData.getTokenizeStatus(),
                email: basket.getCustomerEmail(),
                first_name: basket.getCustomerNo() ? basket.getCustomer().getProfile().getFirstName() : basket.getBillingAddress().getFirstName(),
                last_name: basket.getCustomerNo() ? basket.getCustomer().getProfile().getLastName() : basket.getBillingAddress().getLastName(),
                phone: basket.getCustomerNo() ? basket.getCustomer().getProfile().getPhoneMobile() : basket.getBillingAddress().getPhone(),
                dob: basket.getCustomerNo() ? basket.getCustomer().getProfile().getBirthday() : '',
                billing_address: self.getBillingAddress(basket),
                shipping_address: self.getShippingAddress(basket)
            };
        };


        /**
         * Get order
         *
         * @param {dw.order.Basket}  basket Basket
         * @param {string} referenceID Order Reference ID
         * @returns {string} order data object in JSON format
         */
        self.getOrder = function (basket, referenceID) {
            return {
                intent: 'AUTH',
                reference_id: referenceID,
                description: 'Commerce cloud order',
                requires_shipping_info: false,
                items: self.getItems(basket),
                discounts: self.getDiscounts(),
                shipping_amount: {
                    amount_in_cents: self.getShippingAmmout(basket),
                    currency: basket.getCurrencyCode()
                },
                tax_amount: {
                    amount_in_cents: self.getTaxAmount(basket),
                    currency: basket.getCurrencyCode()
                },
                order_amount: {
                    amount_in_cents: self.getTotal(basket),
                    currency: basket.getCurrencyCode()
                }

            };
        };
    };

    module.exports = new Basket();
}());
