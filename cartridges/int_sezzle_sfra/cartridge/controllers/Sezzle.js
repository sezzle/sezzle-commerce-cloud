'use strict';

/**
 * Controller that renders the home page.
 *
 * @module controllers/Sezzle
 */
var SEZZLE_PAYMENT_METHOD = 'Sezzle';
var Resource = require('dw/web/Resource');
var PaymentTransaction = require('dw/order/PaymentTransaction');
var URLUtils = require('dw/web/URLUtils');
var server = require('server');
var BasketMgr = require('dw/order/BasketMgr');
var ISML = require('dw/template/ISML');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var sezzleSFRAHelper = require('*/cartridge/scripts/checkout/checkoutHelpers');
 
 
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var PaymentMgr = require('dw/order/PaymentMgr');
var Order = require('dw/order/Order');
var PaymentMgr = require('dw/order/PaymentMgr');
var sezzleHelper = require('*/cartridge/scripts/utils/sezzleHelper');
var sezzle = require('*/cartridge/scripts/sezzle.ds');
var OrderModel = require('*/cartridge/models/order');
var sezzleData = require('*/cartridge/scripts/data/sezzleData.ds');
var logger = require('dw/system').Logger.getLogger('Sezzle', '');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

/**
 * Handle redirection to Sezzle
 */
server.get('Redirect', function(req, res, next) {
	logger.debug("Sezzle Redirecting");
	var basket = BasketMgr.getCurrentBasket();
	var checkoutObject = sezzle.basket.initiateCheckout(basket);
	var redirectURL = checkoutObject['checkout']['checkout_url'];
	var sezzleOrderUUID = checkoutObject['checkout']['order_uuid']
	var isCheckoutApproved = checkoutObject['checkout']['approved'];
	var error = false;
	session.privacy.sezzleErrorMessage = "";
	if (!isCheckoutApproved) {
		error = true;
		session.privacy.sezzleErrorMessage = "Sezzle has not approved your checkout. Please contact Sezzle Customer Support.";
		redirectURL = URLUtils.url('Checkout-Begin').toString() + "?stage=payment";
	} else if (redirectURL == undefined && sezzleOrderUUID == undefined) {
		error = true;
		session.privacy.sezzleErrorMessage = "Something went wrong while redirecting. Please try again.";
		redirectURL = URLUtils.url('Checkout-Begin').toString() + "?stage=payment";
	}
	
	res.render('sezzle/sezzleredirect', {
		SezzleRedirectUrl: redirectURL
    });
	
	
	if (!error) {
		session.privacy.sezzled = true;
		session.privacy.sezzleOrderAmount = checkoutObject['checkout']['amount_in_cents']
		session.privacy.referenceId = checkoutObject['checkout']['reference_id']
		session.privacy.orderUUID = sezzleOrderUUID;
		var orderLinks = checkoutObject['checkout']['order_links'];
		
		if (orderLinks) {
			for (var k in orderLinks) {
				var link = orderLinks[k],
					rel = link.rel,
					method = link.method;
				switch (rel) {
					case 'self' :
						if (method == 'GET') {
							session.privacy.getOrderLink = link.href;
						} else if (method == 'PATCH') {
							session.privacy.updateOrderLink = link.href;
						}
						break;
					case 'capture' :
						session.privacy.capturePaymentLink = link.href;
						break;
					case 'refund' :
						session.privacy.refundPaymentLink = link.href;
						break;
					case 'release' :
						session.privacy.releasePaymentLink = link.href;
						break;
					default :
						break;
				}
			}
		}
		
		if (checkoutObject.tokenize) {
			session.privacy.token = checkoutObject['tokenize']['token'] ? checkoutObject['tokenize']['token'] : '';
			session.privacy.tokenExpiration = checkoutObject['tokenize']['token_expiration'] ? checkoutObject['tokenize']['token_expiration'] : '';
			session.privacy.customerUUID = checkoutObject['tokenize']['customer_uuid'] ? checkoutObject['tokenize']['customer_uuid'] : '';
			session.privacy.customerUUIDExpiration = checkoutObject['tokenize']['customer_uuid_expiration'] ? checkoutObject['tokenize']['customer_uuid_expiration'] : '';
		}
	}
	return next();
});

/**
 * Handle successful response from Sezzle
 */
server.get('Success', function(req, res, next) {
	var basket : Basket = BasketMgr.getCurrentBasket();
	if (!basket) {
		res.redirect(URLUtils.url('Home-Show'));
        return next();
	}
	// Creates a new order.
	var reportingUrlsHelper = require('*/cartridge/scripts/reportingUrls');
	var currentBasket = BasketMgr.getCurrentBasket();
	var sezzleCheck = sezzleHelper.CheckCart(currentBasket);
	logger.debug("Cart successfully checked and moving forward {0}",sezzleCheck.status.error);
	
    var order = COHelpers.createOrder(currentBasket);
    if (!order) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }
    logger.debug("Order Created");
    
    var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);
    if (handlePaymentResult.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }
    logger.debug("Payment handled successfully");
    
    var orderPlacementStatus = COHelpers.placeOrder(order, {status: 'success'});

    if (orderPlacementStatus.error) {
        return next(new Error('Could not place order'));
    }
    
    logger.debug("Order placed successfully in Salesforce");

	var customerUUID = request.httpParameterMap["customer-uuid"].stringValue;
	if (customerUUID != null) {
		var tokenizeObject = {
				'token': session.privacy.token,
				'token_expiration': session.privacy.tokenExpiration,
				'customer_uuid': session.privacy.customerUUID,
				'customer_uuid_expiration': session.privacy.customerUUIDExpiration
		}
		sezzleHelper.StoreTokenizeRecord(order, tokenizeObject);
		logger.debug("Tokenize record successfully stored in Order and Profile");
	}
	
    
    var result = sezzleHelper.PostProcess(order);
    if (!result) {
    	res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }
    
    var passwordForm;
    var config = {
            numberOfLineItems: '*'
        };
        var orderModel = new OrderModel(order, { config: config });
        if (!req.currentCustomer.profile) {
        	logger.debug("Guest order has been created");
        	passwordForm = server.forms.getForm('newPasswords');
            passwordForm.clear();
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: false,
                passwordForm: passwordForm
            });
        } else {
        	logger.debug("Registered customer order has been created");
        	COHelpers.sendConfirmationEmail(order, req.locale.id);
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: true
            });
        }
        logger.debug("****Checkout completed****");
        return next();
});


server.get('CheckoutObject', function(req, res, next){
	var basket = BasketMgr.getCurrentBasket();
	if (!basket){
		res.json();
		return next();
	}
	else if (basket.getAllProductLineItems().isEmpty()){
		res.json();
		return next();
	}
	var sezzleTotal = basket.totalGrossPrice.value;
	var sezzleselected = true;
	var errormessages = sezzle.data.getErrorMessages();

	res.json({
		sezzleTotal:sezzleTotal,
		sezzleselected:sezzleselected,
		errormessages:errormessages
	});
    next();
});


module.exports = server.exports();

