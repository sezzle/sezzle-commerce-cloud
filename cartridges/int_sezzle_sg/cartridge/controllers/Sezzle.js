'use strict';

/**
 * Controller that renders the home page.
 *
 * @module controllers/Sezzle
 */
var SEZZLE_PAYMENT_METHOD = 'Sezzle';
var Resource = require('dw/web/Resource');
var sezzleData = require('*/cartridge/scripts/data/sezzleData');
var storeFrontPath = sezzleData.getStoreFrontPath();
var fullStoreFrontPath = Resource.msg('sezzle.controllers.cartridge', 'sezzle', storeFrontPath);
var app = require(fullStoreFrontPath + '/cartridge/scripts/app');
var guard = require(fullStoreFrontPath + '/cartridge/scripts/guard');
var BasketMgr = require('dw/order/BasketMgr');
var ISML = require('dw/template/ISML');
var sezzle = require('*/cartridge/scripts/sezzle');
var CurrentForms = session.getForms();
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var OrderModel = require('dw/order/Order');
var OrderMgr = require('dw/order/OrderMgr');
var logger = require('dw/system').Logger.getLogger('Sezzle', 'sezzle');

/* Script Modules */
var app = require('*/cartridge/scripts/app');

var Cart = app.getModel('Cart');
var Order = app.getModel('Order');

var PaymentMgr = require('dw/order/PaymentMgr');
var PaymentProcessor = app.getModel('PaymentProcessor');
var sezzleHelper = require('*/cartridge/scripts/utils/sezzleHelper');

/**
 * Redirects the user to Sezzle's checkout
 */
function redirect() {
    logger.info("****Checkout Started****");
    logger.info('Selected Payment Method Id - {0}', CurrentForms.billing.paymentMethods.selectedPaymentMethodID.value);
    if (!CurrentForms.billing.paymentMethods.selectedPaymentMethodID.value.equals(SEZZLE_PAYMENT_METHOD)) {
		return false;
	}
    var basket = BasketMgr.getCurrentBasket();
	var checkoutObject = sezzle.basket.initiateCheckout(basket, 'SG');
    var redirectURL = checkoutObject.checkout.checkout_url;
    var sezzleOrderUUID = checkoutObject.checkout.order_uuid;
    var isCheckoutApproved = checkoutObject.checkout.approved;
    var erMsg = '';
    session.privacy.sezzleErrorMessage = '';
    if (!isCheckoutApproved) {
        erMsg = 'Sezzle has not approved your checkout. Please try again.';
        session.privacy.sezzleErrorMessage = erMsg;
    } else if (redirectURL == undefined && sezzleOrderUUID == undefined) {
        erMsg = 'Something went wrong while redirecting. Please try again.';
        session.privacy.sezzleErrorMessage = erMsg;
    }

    if (erMsg !== '') {
        logger.error('Redirection - {0}', erMsg);
		return {
            error: true,
            RedirectError: new Status(Status.ERROR, erMsg)
        };
    }

	ISML.renderTemplate('sezzle/sezzleRedirect',
    {
        SezzleRedirectUrl: redirectURL
    });

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

    return {
		error: false
	};
}

function init(basket, applicablePaymentMethods) {
    return sezzle.basket.validatePayments(basket,
        applicablePaymentMethods);
}

function postProcess(order) {
    try {
        Transaction.wrap(function () {
            var isCaptured = sezzle.order.captureOrder(order, 'v1');
			if (!isCaptured) {
				throw new Error('Capture Payment Error');
			}
            order.custom.SezzleCapturedAmount = order.totalGrossPrice.toString();
            order.custom.SezzleStatus = 'CAPTURE';
        });
    } catch (e) {
        logger.error('Sezzle Capturing error. Details - {0}', e);
        return { error: true };
    }
    return { error: false };
}

function handlePayments(order) {

    if (order.getTotalNetPrice().value !== 0.00) {

        var paymentInstruments = order.getPaymentInstruments();

        if (paymentInstruments.length === 0) {
            return {
                missingPaymentInfo: true
            };
        }
        /**
         * Sets the transaction ID for the payment instrument.
         */
        var handlePaymentTransaction = function () {
            paymentInstrument.getPaymentTransaction().setTransactionID(order.getOrderNo());
        };

        for (var i = 0; i < paymentInstruments.length; i++) {
            var paymentInstrument = paymentInstruments[i];

            if (PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor() === null) {

                Transaction.wrap(handlePaymentTransaction);

            } else {

                var authorizationResult = PaymentProcessor.authorize(order, paymentInstrument);

                if (authorizationResult.not_supported || authorizationResult.error) {
                    return {
                        error: true
                    };
                }
            }
        }
    }

    return {};
}

/**
 * Handle successful response from Sezzle
 */
function success() {
	var placeOrderResult = placeOrder();
    if (placeOrderResult.error) {
        logger.info("Order placement error. Redirecting to order review page.")
        app.getController('COSummary').Start({
            PlaceOrderError: placeOrderResult.PlaceOrderError
        });
        return {};
    } else if (placeOrderResult.order_created) {
        app.getController('COSummary').ShowConfirmation(placeOrderResult.Order);
        Transaction.wrap(function () {
			placeOrderResult.Order.setStatus(OrderModel.ORDER_STATUS_COMPLETED);
			placeOrderResult.Order.setPaymentStatus(OrderModel.PAYMENT_STATUS_PAID);
            logger.info("Order and payment status changed to Completed and Paid");
            logger.info("****Checkout Completed****");
		});
    }
}

function placeOrder() {
	var cart = Cart.get();

    if (!cart) {
        app.getController('Cart').Show();
        return {};
    }

	var sezzleCheck = sezzleHelper.CheckCart(cart);
	if (sezzleCheck.status.error) {
        Transaction.wrap(function () {
            var errorMsg = sezzleCheck.status.basket_changed ? 'basket.changed.error' : 'confirm.error.technical';
            return {
                error: true,
                PlaceOrderError: new Status(Status.ERROR, errorMsg)
            };
        });
	}
	logger.info("Cart checked and moving forward.");

    var COShipping = app.getController('COShipping');

    // Clean shipments.
    COShipping.PrepareShipments(cart);

    // Make sure there is a valid shipping address, accounting for gift certificates that do not have one.
    if (cart.getProductLineItems().size() > 0 && cart.getDefaultShipment().getShippingAddress() === null) {
        COShipping.Start();
        return {};
    }

    // Make sure the billing step is fulfilled, otherwise restart checkout.
    if (!session.forms.billing.fulfilled.value) {
        app.getController('COCustomer').Start();
        return {};
    }

    Transaction.wrap(function () {
        cart.calculate();
    });

    var COBilling = app.getController('COBilling');

    Transaction.wrap(function () {
        if (!COBilling.ValidatePayment(cart)) {
            COBilling.Start();
            return {};
        }
    });

    // Recalculate the payments. If there is only gift certificates, make sure it covers the order total, if not
    // back to billing page.
    Transaction.wrap(function () {
        if (!cart.calculatePaymentTransactionTotal()) {
            COBilling.Start();
            return {};
        }
    });

    // Creates a new order. This will internally ReserveInventoryForOrder and will create a new Order with status
    // 'Created'.
    var order = cart.createOrder();

    if (!order) {
        // TODO - need to pass BasketStatus to Cart-Show ?
        app.getController('Cart').Show();

        return {};
    }
    logger.info("Order created in SFCC");

    var handlePaymentsResult = handlePayments(order);

    if (handlePaymentsResult.error) {
        return Transaction.wrap(function () {
            OrderMgr.failOrder(order);
            return {
                error: true,
                PlaceOrderError: new Status(Status.ERROR, 'confirm.error.technical')
            };
        });

    } else if (handlePaymentsResult.missingPaymentInfo) {
        return Transaction.wrap(function () {
            OrderMgr.failOrder(order);
            return {
                error: true,
                PlaceOrderError: new Status(Status.ERROR, 'confirm.error.technical')
            };
        });
    }
    logger.info("Payment handled successfully in SFCC");

	var customerUUID = request.httpParameterMap['customer-uuid'].stringValue;
    var tokenizeObject = {
        token: session.privacy.token,
        token_expiration: session.privacy.tokenExpiration,
        customer_uuid: session.privacy.customerUUID,
        customer_uuid_expiration: session.privacy.customerUUIDExpiration,
        is_customer_tokenized: customerUUID != null
    };
    sezzleHelper.StoreTokenizeRecord(order, tokenizeObject);

	if (!sezzleHelper.PostProcess(order)) {
		return Transaction.wrap(function () {
			OrderMgr.failOrder(order);
            return {
                error: true,
                PlaceOrderError: new Status(Status.ERROR, 'payment.capture.error')
            };
		});
	}
	logger.info("Post Process successfully completed");

    var orderPlacementStatus = Order.submit(order);
	if (!orderPlacementStatus.error) {
        clearForms();
    }
	logger.info("Order placed successfully in SFCC");
    return orderPlacementStatus;
}

function clearForms() {
    // Clears all forms used in the checkout process.
    session.forms.singleshipping.clearFormElement();
    session.forms.multishipping.clearFormElement();
    session.forms.billing.clearFormElement();
}

/**
 * Redirects customer to sezzle's checkout if sezzle is enabled and there is no
 * gift certificates in basket
 */
exports.Redirect = redirect;
exports.Success = guard.ensure(['get'],
    success);
exports.PostProcess = postProcess;
exports.Init = init;
