/**
 * This script provides utility functions shared across other Sezzle related scripts.
 *
 */
(function () {
	var Utils = function () {
		let self = this,
			values = require('dw/value'),
			web = require('dw/web'),
			system = require('dw/system'),
			sezzleData = require('~/cartridge/scripts/data/sezzleData'),
			Money = require('dw/value/Money');

		/**
		 * Calculate non-gift certificate amount
		 *
		 * @param {dw.order.Basket}  basket
		 * @returns {dw.value.Money} simple object with name and shipping address
		 */
		self.calculateNonGiftCertificateAmount = function (basket) {
			let basketTotal = basket.getTotalGrossPrice(),
				giftCertTotal = new values.Money(0.0, basket.currencyCode),
				giftCertificatePaymentInstrs = basket.getGiftCertificatePaymentInstruments().iterator();

			while (!empty(giftCertificatePaymentInstrs) && giftCertificatePaymentInstrs.hasNext()) {
				let orderPI = giftCertificatePaymentInstrs.next();
				giftCertTotal = giftCertTotal.add(orderPI.getPaymentTransaction().getAmount());
			}

			return basketTotal.subtract(giftCertTotal);
		};

		/**
		 * Compare line items from basket and from sezzle response.
		 * If they are not identical, add error to status object
		 *
		 * @param {dw.order.Basket}  basket
		 * @param {Object} SezzleResponse charge object
		 * @param {dw.system.Status} status basket
		 */
		self.checkLineItems = function (basket, SezzleResponse, status) {
			let productLineItems = basket.getProductLineItems().iterator();

			while (!empty(productLineItems) && productLineItems.hasNext()) {
				let productLineItem = productLineItems.next();

				if (productLineItem.getProductID() in SezzleResponse.details.items) {
					let product = SezzleResponse.details.items[productLineItem.getProductID()],
						productLineItemPrice = productLineItem.optionProductLineItem ?
												productLineItem.getBasePrice().multiply(100).getValue() :
												productLineItem.product.getPriceModel().getPrice().multiply(100).getValue();

					if (product.unit_price !== productLineItemPrice) {
						status.addItem(
										new system.StatusItem(
															system.Status.ERROR,
															'',
															web.Resource.msgf(
																				'basket.missing.product.price',
																				'sezzle',
																				null,
																				productLineItem.getProductID(),
																				productLineItem.optionProductLineItem ?
																				productLineItem.getBasePrice().toFormattedString() :
																				productLineItem.product.getPriceModel().getPrice().toFormattedString()
																			),
															'')
										);
					}
					if (product.qty !== productLineItem.getQuantityValue()) {
						status.addItem(
										new system.StatusItem(
																system.Status.ERROR,
																'',
																web.Resource.msgf(
																					'basket.missing.product.quantity',
																					'sezzle',
																					null,
																					productLineItem.getProductID(),
																					productLineItem.getQuantityValue()
																				),
																''
															)
										);
					}
				} else {
					status.addItem(
									new system.StatusItem(
															system.Status.ERROR,
															'',
															web.Resource.msgf(
																				'basket.missing.product',
																				'sezzle',
																				null,
																				productLineItem.getProductID()
																			),
															''
														)
									);
				}
			}
		};

		/**
		 * Compare taxes from basket and from sezzle response.
		 * If they are not identical, add error to status object
		 *
		 * @param {dw.order.Basket}  basket
		 * @param {Object} SezzleResponse charge object
		 * @param {dw.system.Status} status basket
		 */
		self.checkTaxation = function (basket, SezzleResponse, status) {
			let basketTax = basket.getTotalTax().multiply(100).getValue();
			if (basketTax !== SezzleResponse.details.tax_amount) {
				status.addItem(
								new system.StatusItem(
														system.Status.ERROR,
														'',
														web.Resource.msgf(
																			'basket.missing.tax',
																			'sezzle',
																			null,
																			basket.getTotalTax().toFormattedString()
																		),
														''
													)
								);
			}
		};

		/**
		 * Compare total price from basket and from sezzle response.
		 * If they are not identical, add error to status object
		 *
		 * @param {dw.order.Basket}  basket
		 * @param {Object} SezzleResponse charge object
		 * @param {dw.system.Status} status basket
		 */
		self.checkTotalPrice = function (basket, SezzleResponse, status) {
			let totalPrice = self.calculateNonGiftCertificateAmount(basket).multiply(100).getValue();
			if (totalPrice !== SezzleResponse.details.total) {
				status.addItem(
					new system.StatusItem(
						system.Status.ERROR,
						'',
						web.Resource.msgf(
							'basket.missing.total',
							'sezzle',
							null,
							self.calculateNonGiftCertificateAmount(basket).toFormattedString()
						),
						''
					)
				);
			}
		};

		/**
		 * Check addresses
		 *
		 * @param {dw.order.Basket}  basket
		 * @param {Object} SezzleResponse charge object
		 * @param {dw.system.Status} status basket
		 */
		self.checkAddresses	= function (basket, SezzleResponse, status) {
		};

		/**
		 * Parse the response
		 *
		 * @param {dw.svc}  svc
		 * @param {Object} client
		 * @param {Object} response
		 */
		self.responseParser = function (svc, client) {
			var response;
			response = {
				error : true,
				response : JSON.parse(client.text)
			}

			switch (client.statusCode) {
				case 200:
					response = {
						error : false,
						response : JSON.parse(client.text)
					};
					break;
				case 201:
					response = {
						error : false,
						response : JSON.parse(client.text)
					};
					break;
				case 400:
				case 401:
				case 404:
					response = {
						error : true,
						response : JSON.parse(client.text)
					};
					break;
			}
			return response;
		};
		
		/**
		 * Generate UUID
		 *
		 * @returns {string} uuid
		 */
		self.generateUUID = function () {
		  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		    return v.toString(16);
		  });
		};
			
		/**
		 * Get formatted timestamp from string datetime
		 *
		 * @param {string}  timestampStr
		 * @returns {Date} date
		 */	
		self.getFormattedDateTimestamp = function (timestampStr) {
			timestampStr = timestampStr.split('.');
			timestampStr = timestampStr[0];
			timestampStr = timestampStr.replace('Z', ' ');
			timestampStr = timestampStr.replace('T', ' ');
			timestampStr = timestampStr.replace('-', '/');
			timestampStr = timestampStr.replace('-', '/');
			var timestamp = Date.parse(timestampStr);
			return timestamp;
		};
		
		/**
		 * Get Query String from URL
		 *
		 * @param {string}  field
		 * @param {string}  url
		 * @returns {string} query string
		 */
		self.getQueryString = function ( field, url ) {
			var href = url;
			var reg = new RegExp( '[?&]' + field + '=([^&#]*)', 'i' );
			var string = reg.exec(href);
			return string ? string[1] : null;
		};

		/**
		 * Check total basket range
		 *
		 * @param {dw.order.Basket}  basket
		 * @returns {boolean} status
		 */
		self.checkBasketTotalRange = function(basket){
			var basketTotal;
			if (basket.totalGrossPrice.available){
				basketTotal = basket.totalGrossPrice;
			} else {
				basketTotal = basket.getAdjustedMerchandizeTotalPrice(true).add(basket.giftCertificateTotalPrice);
			}
			var paymentMinTotal = sezzleData.getSezzlePaymentMinTotal(),
				paymentMaxTotal = sezzleData.getSezzlePaymentMaxTotal();
			if (paymentMinTotal && basketTotal.value < paymentMinTotal){
				return false;
			}
			if (paymentMaxTotal && basketTotal.value > paymentMaxTotal){
				return false;
			}
			return true;
		};
		
		/**
		 * Validate and get auth token 
		 *
		 * @returns {string} token
		 */
		self.getAuthToken = function(){
			if (session.privacy.sezzleAuthToken == "" || sezzleData.getMerchantUUID() != session.privacy.sezzleMerchantUUID) {
				return "";	
			} else if (session.privacy.sezzleAuthTokenExpiration != "") {
				var authExpirationTimestamp = self.getFormattedDateTimestamp(session.privacy.sezzleAuthTokenExpiration);
				var currentTimestamp = Date.now();
				if (currentTimestamp > authExpirationTimestamp) {
					return "";
				}
			}
			return session.privacy.sezzleAuthToken;
		};
		
		/**
		 * Set auth token for future use 
		 */
		self.setAuthToken = function(object){
			session.privacy.sezzleAuthToken = object.token;
			session.privacy.sezzleAuthTokenExpiration = object.expiration_date;
			session.privacy.sezzleMerchantUUID = object.merchant_uuid;
		};
	};

	module.exports = new Utils();
}());