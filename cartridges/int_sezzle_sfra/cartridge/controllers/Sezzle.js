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


var sezzleHelper = require('*/cartridge/scripts/utils/sezzleHelper');
var sezzle = require('*/cartridge/scripts/sezzle.ds');
var OrderModel = require('*/cartridge/models/order'),
    logger = require('dw/system').Logger.getLogger('Sezzle',
        '');

server.get('Redirect',
    function (req, res, next) {
        logger.debug('Sezzle Redirecting');
        var basket = BasketMgr.getCurrentBasket(),
            checkoutObject = sezzle.basket.initiateCheckout(basket);

        res.render('sezzle/sezzleredirect',
            {
                SezzleRedirectUrl: checkoutObject.redirect_url
            });

        session.privacy.sezzleToken = sezzle.utils.getQueryString('id',
            checkoutObject.redirect_url);
        session.privacy.sezzled = true;
        session.privacy.sezzleAmount = checkoutObject.amount_in_cents;
        session.privacy.referenceId = checkoutObject.order_reference_id;
        return next();
    });

/**
 * Handle successful response from Sezzle
 */
server.get('Success',
    function (req, res, next) {
        var basket = BasketMgr.getCurrentBasket();

        if (!basket) {
            res.redirect(URLUtils.url('Home-Show'));
            return next();
        }
        // Creates a new order.
        var currentBasket = BasketMgr.getCurrentBasket(),
            sezzleCheck = sezzleHelper.CheckCart(currentBasket);

        logger.debug('Cart successfully checked and moving forward {0}', sezzleCheck.status.error);

        var order = COHelpers.createOrder(currentBasket);

        if (!order) {
            res.json({
                error: true,
                errorMessage: Resource.msg('error.technical',
                    'checkout',
                    null)
            });

            return next();
        }
        logger.debug('Order Created');

        var handlePaymentResult = COHelpers.handlePayments(order,
            order.orderNo);

        if (handlePaymentResult.error) {
            res.json({
                error: true,
                errorMessage: Resource.msg('error.technical',
                    'checkout',
                    null)
            });

            return next();
        }
        logger.debug('Payment handled successfully');

        var orderPlacementStatus = COHelpers.placeOrder(order);

        if (orderPlacementStatus.error) {
            return next(new Error('Could not place order'));
        }

        var result = sezzleHelper.PostProcess(order);

        if (!result) {
            res.json({
                error: true,
                errorMessage: Resource.msg('error.technical',
                    'checkout',
                    null)
            });

            return next();
        }
        logger.debug('Order placed successfully in Salesforce');

        var passwordForm,

            config = {
                numberOfLineItems: '*'
            },
            orderModel = new OrderModel(order,
                { config: config });

        if (!req.currentCustomer.profile) {
            logger.debug('Guest order has been created');
            passwordForm = server.forms.getForm('newPasswords');
            passwordForm.clear();
            res.render('checkout/confirmation/confirmation',
                {
                    order: orderModel,
                    returningCustomer: false,
                    passwordForm: passwordForm
                });
        } else {
            logger.debug('Registered customer order has been created');
            COHelpers.sendConfirmationEmail(order,
                req.locale.id);
            res.render('checkout/confirmation/confirmation',
                {
                    order: orderModel,
                    returningCustomer: true
                });
        }
        logger.debug('****Checkout completed****');
        return next();
    });


server.get('CheckoutObject',
    function (req, res, next) {
        var basket = BasketMgr.getCurrentBasket();

        if (!basket) {
            res.json();
            return next();
        } if (basket.getAllProductLineItems().isEmpty()) {
            res.json();
            return next();
        }
        var sezzleTotal = basket.totalGrossPrice.value,
            sezzleselected = true,
            errormessages = sezzle.data.getErrorMessages();

        res.json({
            sezzleTotal: sezzleTotal,
            sezzleselected: sezzleselected,
            errormessages: errormessages
        });
        return next();
    });


module.exports = server.exports();
