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
var sezzle = require('*/cartridge/scripts/sezzle.ds');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
 
 
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var PaymentMgr = require('dw/order/PaymentMgr');
var Order = require('dw/order/Order');
var PaymentMgr = require('dw/order/PaymentMgr');
var sezzleHelper = require('*/cartridge/scripts/utils/sezzleHelper');
var OrderModel = require('*/cartridge/models/order');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var hooksHelper = require('*/cartridge/scripts/helpers/hooks');

/**
 * Handle successful response from Sezzle
 */
server.get(
		'Success',
		server.middleware.https,
	    csrfProtection.generateToken,
	    function(req, res, next) {
	// Creates a new order.
	var currentBasket = BasketMgr.getCurrentBasket();
	if(!currentBasket){
		res.redirect(URLUtils.url('Cart-Show').toString());
	   return next();
	}
	
	
	var sezzleCheck = sezzleHelper.CheckCart(currentBasket);
	
	if (sezzleCheck.status.error){
    	res.render('/error', {
            message: Resource.msg('error.confirmation.error', 'confirmation', null)
        });
        return next();
    }
	

	
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
    var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', currentBasket, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
    
    var orderPlacementStatus = COHelpers.placeOrder(order, fraudDetectionStatus);

    if (orderPlacementStatus.error) {
        return next(new Error('Could not place order'));
    }
    
    sezzleHelper.PostProcess(order);

    COHelpers.sendConfirmationEmail(order, req.locale.id);
    
    var config = {
            numberOfLineItems: '*'
        };
        var orderModel = new OrderModel(order, { config: config });
        if (!req.currentCustomer.profile) {
            var passwordForm = server.forms.getForm('newPasswords');
            passwordForm.clear();
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: false,
                passwordForm: passwordForm
            });
        } else {
            res.render('checkout/confirmation/confirmation', {
                order: orderModel,
                returningCustomer: true
            });
        }
        return next();
});

server.post('Update', function(req, res, next){
	if (!dw.web.CSRFProtection.validateRequest()){
		res.json({error: true});
		return next();
	}
	var hookName = "dw.int_sezzle_sfra.payment_instrument." + sezzle.data.VCNPaymentInstrument().toLowerCase();
	var basket = BasketMgr.getCurrentBasket();
	var paymentMethodSezzle = PaymentMgr.getPaymentMethod(SEZZLE_PAYMENT_METHOD);
	res.setContentType('application/json');
    // TODO: Maybe will need fix for removing payment instrument
	Transaction.wrap(function(){
		//basket.removePaymentInstrument(paymentMethodSezzle);
	});
	if (dw.system.HookMgr.hasHook(hookName)){
		var paymentInstrument = dw.system.HookMgr.callHook(hookName, "add", basket);
		if (!paymentInstrument){
			res.json({error: true});
			return next();
		} else {
			Transaction.wrap(function(){
				paymentInstrument.custom.sezzleed = true;
			});
		} 
	} else {
		res.json({error: true});
		return next();
	};

	res.json({error: false});
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
	var vcndata = sezzle.basket.getCheckout(basket, 1);
	var enabled = sezzle.data.getSezzleVCNStatus() == 'on' ? true : false;
	var sezzleselected = true;
	var errormessages = sezzle.data.getErrorMessages();

	res.json({
		sezzleTotal:sezzleTotal,
		vcndata:vcndata,
		enabled:enabled,
		sezzleselected:sezzleselected,
		errormessages:errormessages
	});
    next();
});

/**
 * Checks authentication and synchronization DW Basket and Sezzle Basket
 */

/**
 * Redirects customer to sezzle's checkout if sezzle is enabled and there is no
 * gift certificates in basket
 */



/**
 * 
 * Places sezzle tracking script to orderconfirmation page
 */
server.get('Tracking', function(req, res, next) {
	 
		var orderId = request.httpParameterMap.orderId ? request.httpParameterMap.orderId.stringValue : false;
		if (orderId){
			var obj = sezzle.order.trackOrderConfirmed(orderId);
			res.setContentType('text/html')
			res.render('order/trackingscript', {
				sezzleOnlineAndAnalytics: sezzle.data.getAnalyticsStatus(),
				orderInfo : JSON.stringify(obj.orderInfo),
				productInfo: JSON.stringify(obj.productInfo)
	        });
		}
	
	 next(); 
})

module.exports = server.exports();

