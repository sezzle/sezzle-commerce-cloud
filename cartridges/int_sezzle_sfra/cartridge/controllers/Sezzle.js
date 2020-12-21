'use strict';

/**
 * Controller that renders the home page.
 *
 * @module controllers/Sezzle
 */
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');
var server = require('server');
var BasketMgr = require('dw/order/BasketMgr');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var Transaction = require('dw/system/Transaction');
var sezzleHelper = require('*/cartridge/scripts/utils/sezzleHelper');
var sezzle = require('*/cartridge/scripts/sezzle');
var OrderModel = require('*/cartridge/models/order');
var logger = require('dw/system').Logger.getLogger('Sezzle', 'sezzle');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

/**
 * Handle redirection to Sezzle
 */
server.get('Redirect', function (req, res, next) {
    logger.info('Sezzle Redirecting');
    var basket = BasketMgr.getCurrentBasket();
    var checkoutObject = sezzle.basket.initiateCheckout(basket);
    var redirectURL = checkoutObject.checkout.checkout_url;
    var sezzleOrderUUID = checkoutObject.checkout.order_uuid;
    var isCheckoutApproved = checkoutObject.checkout.approved;
    var error = false;
    var erMsg = '';
    session.privacy.sezzleErrorMessage = '';
    if (!isCheckoutApproved) {
        error = true;
        erMsg = 'Sezzle has not approved your checkout. Please contact Sezzle Customer Support.';
        session.privacy.sezzleErrorMessage = erMsg;
        redirectURL = URLUtils.url('Checkout-Begin').toString() + '?stage=payment';
    } else if (redirectURL == undefined && sezzleOrderUUID == undefined) {
        error = true;
        erMsg = 'Something went wrong while redirecting. Please try again.';
        session.privacy.sezzleErrorMessage = erMsg;
        redirectURL = URLUtils.url('Checkout-Begin').toString() + '?stage=payment';
    }

    if (erMsg != '') {
        logger.error('Redirection - {0}', erMsg);
    }

    res.render('sezzle/sezzleRedirect', {
        SezzleRedirectUrl: redirectURL
    });


    if (!error) {
        session.privacy.sezzled = true;
        session.privacy.sezzleOrderAmount = checkoutObject.checkout.amount_in_cents;
        session.privacy.referenceId = checkoutObject.checkout.reference_id;
        session.privacy.orderUUID = sezzleOrderUUID;
        var orderLinks = checkoutObject.checkout.order_links;

        if (orderLinks) {
            for (var k = 0; k < orderLinks.length; k++) { // eslint-disable-line no-plusplus
                var link = orderLinks[k],
                    rel = link.rel,
                    method = link.method;
                switch (rel) {
                    case 'self':
                        if (method == 'GET') {
                            session.privacy.getOrderLink = link.href;
                        } else if (method == 'PATCH') {
                            session.privacy.updateOrderLink = link.href;
                        }
                        break;
                    case 'capture':
                        session.privacy.capturePaymentLink = link.href;
                        break;
                    case 'refund':
                        session.privacy.refundPaymentLink = link.href;
                        break;
                    case 'release':
                        session.privacy.releasePaymentLink = link.href;
                        break;
                    default:
                        break;
                }
            }
            logger.info('Order Links has been successfully gathered into session');
        }

        if (checkoutObject.tokenize) {
            session.privacy.token = checkoutObject.tokenize.token || '';
            session.privacy.tokenExpiration = checkoutObject.tokenize.token_expiration || '';
            session.privacy.customerUUID = checkoutObject.tokenize.customer_uuid || '';
            session.privacy.customerUUIDExpiration = checkoutObject.tokenize.customer_uuid_expiration || '';
            logger.info('Tokenize records has been successfully gathered into session');
        }
    }
    return next();
});

/**
 * Handle successful response from Sezzle
 */
server.get(
    'Success',
    consentTracking.consent,
    server.middleware.https,
    csrfProtection.generateToken,
    function (req, res, next) {
		var sezzleData = require('*/cartridge/scripts/data/sezzleData');
        var reportingUrlsHelper = require('*/cartridge/scripts/reportingUrls');
        var Locale = require('dw/util/Locale');
		var OrderMgr = require('dw/order/OrderMgr');
		var Order = require('dw/order/Order');
		var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
	    var hooksHelper = require('*/cartridge/scripts/helpers/hooks');

        var currentBasket = BasketMgr.getCurrentBasket();
		if (!currentBasket) {
			res.render('/error', {
                message: Resource.msg('basket.changed.error', 'sezzle', null)
            });
            return next();
	    }

        var sezzleCheck = sezzleHelper.CheckCart(currentBasket);
		if (sezzleCheck.status.error) {
			var errorMsg = sezzleCheck.status.basket_changed
					? Resource.msg('basket.changed.error', 'sezzle', null)
					: Resource.msg('error.technical', 'checkout', null);
			res.render('/error', {
                message: errorMsg
            });
            return next();
		}
        logger.info('Cart successfully checked and moving forward {0}', sezzleCheck.status.error);

		// Creates a new order.
        var order = COHelpers.createOrder(currentBasket);
        if (!order) {
            res.render('/error', {
                message: Resource.msg('error.technical', 'checkout', null)
            });
            return next();
        }
        logger.info('Order Created');

        var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);
        if (handlePaymentResult.error) {
            res.render('/error', {
                message: Resource.msg('error.technical', 'checkout', null)
            });
            return next();
        }
        logger.info('Payment handled successfully');


		var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', currentBasket, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
	    if (fraudDetectionStatus.status === 'fail') {
	        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

	        // fraud detection failed
	        req.session.privacyCache.set('fraudDetectionStatus', true);

	        res.render('/error', {
                message: Resource.msg('error.technical', 'checkout', null)
            });
            return next();
	    }

        var customerUUID = request.httpParameterMap['customer-uuid'].stringValue;
        var tokenizeObject = {
            token: session.privacy.token,
            token_expiration: session.privacy.tokenExpiration,
            customer_uuid: session.privacy.customerUUID,
            customer_uuid_expiration: session.privacy.customerUUIDExpiration,
            is_customer_tokenized: customerUUID != null
        };
        sezzleHelper.StoreTokenizeRecord(order, tokenizeObject);

        var result = sezzleHelper.PostProcess(order);
        if (!result) {
			Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            res.render('/error', {
                message: Resource.msg('payment.capture.error', 'sezzle', null)
            });
            return next();
        }
        logger.info('Post process successfully completed');

		var orderPlacementStatus = COHelpers.placeOrder(order, { status: 'success' });

        if (orderPlacementStatus.error) {
            return next(new Error('Could not place order'));
        }
		logger.info('Order placed successfully in Salesforce');

		if (String(sezzleData.getSezzlePaymentAction()) === 'CAPTURE') {
			Transaction.wrap(function () { order.setStatus(Order.ORDER_STATUS_COMPLETED) });
		}

		if (req.currentCustomer.addressBook) {
        	// save all used shipping addresses to address book of the logged in customer
	        var allAddresses = addressHelpers.gatherShippingAddresses(order);
	        allAddresses.forEach(function (address) {
	            if (!addressHelpers.checkIfAddressStored(address, req.currentCustomer.addressBook.addresses)) {
	                addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
	            }
	        });
	    }

	    if (order.getCustomerEmail()) {
	        COHelpers.sendConfirmationEmail(order, req.locale.id);
	    }

	    // Reset usingMultiShip after successful Order placement
	    req.session.privacyCache.set('usingMultiShipping', false);

        var config = {
            numberOfLineItems: '*'
        };

        var currentLocale = Locale.getLocale(req.locale.id);
        var orderModel = new OrderModel(order, {
            config: config,
            countryCode: currentLocale.country,
            containerView: 'order'
        });

        var reportingURLs = reportingUrlsHelper.getOrderReportingURLs(order);

        var passwordForm;

        var CustomerMgr = require('dw/customer/CustomerMgr');
        var profile = CustomerMgr.searchProfile('email={0}', orderModel.orderEmail);
        if (profile) {
            Transaction.wrap(function () {
                order.setCustomer(profile.getCustomer());
            });
        }


        if (!req.currentCustomer.profile && !profile) {
            logger.info('Guest order has been created');
            passwordForm = server.forms.getForm('newPasswords');
            passwordForm.clear();
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: false,
                passwordForm: passwordForm,
                reportingURLs: reportingURLs
            });
        } else {
            logger.info('Registered customer order has been created');
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: true
            });
        }
        req.session.raw.custom.orderID = req.querystring.ID; // eslint-disable-line no-param-reassign
        logger.info('****Checkout completed****');
        return next();
    }
);


server.get('CheckoutObject', function (req, res, next) {
    var basket = BasketMgr.getCurrentBasket();
    if (!basket) {
        res.json();
        return next();
    }
    if (basket.getAllProductLineItems().isEmpty()) {
        res.json();
        return next();
    }
    var sezzleTotal = basket.totalGrossPrice.value;
    var sezzleselected = true;
    var errormessages = sezzle.data.getErrorMessages();

    res.json({
        sezzleTotal: sezzleTotal,
        sezzleselected: sezzleselected,
        errormessages: errormessages
    });
    return next();
});


module.exports = server.exports();
