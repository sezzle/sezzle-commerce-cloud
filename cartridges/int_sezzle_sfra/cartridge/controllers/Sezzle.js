'use strict';

/**
 * Controller that renders the home page.
 *
 * @module controllers/Sezzle
 */
var SEZZLE_PAYMENT_METHOD = 'Sezzle';
var Resource = require('dw/web/Resource');
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

server.get('Redirect', function(req, res, next) {
	var logger = require('dw/system').Logger.getLogger('Sezzle', '');
	logger.debug('Sezzle Redirecting');
	var basket = BasketMgr.getCurrentBasket();
	var checkoutObject = sezzle.basket.initiateCheckout(basket);
	res.render('sezzle/sezzleredirect', {
		SezzleRedirectUrl: checkoutObject['redirect_url']
    });
	
	session.custom.sezzleToken=sezzle.utils.getQueryString("id", checkoutObject['redirect_url'])
	session.custom.sezzled = true;
	session.custom.sezzleAmount = checkoutObject['amount_in_cents']
	session.custom.referenceId = checkoutObject['order_reference_id']
	return next();
});

/**
 * Handle successful response from Sezzle
 */
server.get('Success', function(req, res, next) {
	// Creates a new order.
	var currentBasket = BasketMgr.getCurrentBasket();
	var logger = require('dw/system').Logger.getLogger('Sezzle', '');
	
	var sezzleCheck = sezzleHelper.CheckCart(currentBasket);
	
	
	
    var order = COHelpers.createOrder(currentBasket);
    if (!order) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }
    
    var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);
    if (handlePaymentResult.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }
    
    var orderPlacementStatus = COHelpers.placeOrder(order);

    if (orderPlacementStatus.error) {
        return next(new Error('Could not place order'));
    }
    
    sezzleHelper.PostProcess(order);
    
    logger.debug('Order Successfully Created');
    
    var config = {
            numberOfLineItems: '*'
        };
        var orderModel = new OrderModel(order, { config: config });
        if (!req.currentCustomer.profile) {
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: false
            });
        } else {
        	COHelpers.sendConfirmationEmail(order, req.locale.id);
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: true
            });
        }
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

