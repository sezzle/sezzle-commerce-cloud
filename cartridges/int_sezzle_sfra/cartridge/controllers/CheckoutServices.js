'use strict';

var page = module.superModule;

var server = require('server');

var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var logger = require('dw/system').Logger.getLogger('Sezzle', 'sezzle');

server.extend(page);


/**
 *  Handle Ajax payment (and billing) form submit
 */
server.prepend(
    'SubmitPayment',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        logger.info('****Checkout Started****');
        var data = res.getViewData();
        var BasketMgr = require('dw/order/BasketMgr'),
            currentBasket = BasketMgr.getCurrentBasket();

        if (data && data.csrfError) {
            res.json();

            return next();
        }

        var paymentForm = server.forms.getForm('billing'),
            paymentMethodID = paymentForm.paymentMethod.value,
            billingFormErrors = {},
            contactInfoFormErrors = {},
            viewData = {};

        if (paymentMethodID !== 'Sezzle') {
            return next();
        }


        // Verify billing form data
        billingFormErrors = COHelpers.validateBillingForm(paymentForm.addressFields);
        contactInfoFormErrors = COHelpers.validateFields(paymentForm.contactInfoFields);

        if (Object.keys(contactInfoFormErrors).length) {
            res.json({
                form: paymentForm,
                fieldErrors: [contactInfoFormErrors],
                serverErrors: [],
                error: true
            });
            return next();
        }
        viewData.email = {
            value: paymentForm.contactInfoFields.email.value
        };

        viewData.phone = { value: paymentForm.contactInfoFields.phone.value };


        if (Object.keys(billingFormErrors).length) {
            // Respond with form data and errors
            res.json({
                form: paymentForm,
                fieldErrors: [billingFormErrors],
                serverErrors: [],
                error: true
            });
        } else {
            viewData.address = {
                firstName: { value: paymentForm.addressFields.firstName.value },
                lastName: { value: paymentForm.addressFields.lastName.value },
                address1: { value: paymentForm.addressFields.address1.value },
                address2: { value: paymentForm.addressFields.address2.value },
                city: { value: paymentForm.addressFields.city.value },
                postalCode: { value: paymentForm.addressFields.postalCode.value },
                countryCode: { value: paymentForm.addressFields.country.value }
            };

            if (Object.prototype.hasOwnProperty
                .call(paymentForm.addressFields,
                    'states')) {
                viewData.address.stateCode = { value: paymentForm.addressFields.states.stateCode.value };
            }

            viewData.paymentMethod = {
                value: paymentForm.paymentMethod.value,
                htmlName: paymentForm.paymentMethod.value
            };

            /* Currently phone is hardcoded to credit card form so we will take phone from shipping address */
            var shippingAddress = currentBasket.defaultShipment.shippingAddress;

            viewData.phone = { value: shippingAddress.phone };

            res.setViewData(viewData);

            this.on('route:BeforeComplete',
                function (req, res) { // eslint-disable-line no-shadow
                    var HookMgr = require('dw/system/HookMgr');
                    var Resource = require('dw/web/Resource');
                    var PaymentMgr = require('dw/order/PaymentMgr');
                    var Transaction = require('dw/system/Transaction');
                    var AccountModel = require('*/cartridge/models/account');
                    var OrderModel = require('*/cartridge/models/order');
                    var URLUtils = require('dw/web/URLUtils');
                    var Locale = require('dw/util/Locale');
                    var hooksHelper = require('*/cartridge/scripts/helpers/hooks'),

                        billingData = res.getViewData();

                    if (!currentBasket) {
                        delete billingData.paymentInformation;

                        res.json({
                            error: true,
                            cartError: true,
                            fieldErrors: [],
                            serverErrors: [],
                            redirectUrl: URLUtils.url('Cart-Show').toString()
                        });

                        return;
                    }

                    var billingAddress = currentBasket.billingAddress;
                    var billingForm = server.forms.getForm('billing');
                    var result;
                    paymentMethodID = billingData.paymentMethod.value;

                    Transaction.wrap(function () {
                        if (!billingAddress) {
                            billingAddress = currentBasket.createBillingAddress();
                        }

                        billingAddress.setFirstName(billingData.address.firstName.value);
                        billingAddress.setLastName(billingData.address.lastName.value);
                        billingAddress.setAddress1(billingData.address.address1.value);
                        billingAddress.setAddress2(billingData.address.address2.value);
                        billingAddress.setCity(billingData.address.city.value);
                        billingAddress.setPostalCode(billingData.address.postalCode.value);
                        if (Object.prototype.hasOwnProperty.call(billingData.address, 'stateCode')) {
                            billingAddress.setStateCode(billingData.address.stateCode.value);
                        }
                        billingAddress.setCountryCode(billingData.address.countryCode.value);

                        if (req.currentCustomer.profile && billingData.storedPaymentUUID) {
                            billingAddress.setPhone(req.currentCustomer.profile.phone);
                            currentBasket.setCustomerEmail(req.currentCustomer.profile.email);
                        }

                        if (paymentMethodID === 'Sezzle') {
                            if (req.currentCustomer.profile) {
                                currentBasket.setCustomerEmail(req.currentCustomer.profile.email);
                            } else {
                                currentBasket.setCustomerEmail(billingData.email.value);
                            }
                        }
                    });

                    // If there is no selected payment option and balance is greater than zero
                    if (!paymentMethodID && currentBasket.totalGrossPrice.value > 0) {
                        var noPaymentMethod = {};

                        noPaymentMethod[billingData.paymentMethod.htmlName] = Resource.msg('error.no.selected.payment.method',
                            'creditCard',
                            null);

                        delete billingData.paymentInformation;

                        res.json({
                            form: billingForm,
                            fieldErrors: [noPaymentMethod],
                            serverErrors: [],
                            error: true
                        });

                        return;
                    }

                    // Check to make sure there is a payment processor
                    if (!PaymentMgr.getPaymentMethod(paymentMethodID).paymentProcessor) {
                        throw new Error(Resource.msg(
                            'error.payment.processor.missing',
                            'checkout',
                            null
                        ));
                    }

                    var processor = PaymentMgr.getPaymentMethod(paymentMethodID).getPaymentProcessor();

                    if (HookMgr.hasHook('app.payment.processor.' + processor.ID.toLowerCase())) {
                        result = HookMgr.callHook(
                            'app.payment.processor.' + processor.ID.toLowerCase(),
                            'Handle',
                            currentBasket,
                            billingData.paymentInformation
                        );
                    } else {
                        result = HookMgr.callHook('app.payment.processor.default',
                            'Handle');
                    }

                    // Need to invalidate credit card fields
                    if (result.error) {
                        delete billingData.paymentInformation;

                        res.json({
                            form: billingForm,
                            fieldErrors: result.fieldErrors,
                            serverErrors: result.serverErrors,
                            error: true
                        });

                        return;
                    }

                    var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');

                    if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
                        req.session.privacyCache.set('usingMultiShipping',
                            false);
                        usingMultiShipping = false;
                    }

                    if (paymentMethodID !== 'Sezzle') {
                        hooksHelper('app.customer.subscription',
                            'subscribeTo',
                            [paymentForm.subscribe.checked,
                                paymentForm.contactInfoFields.email.htmlValue],
                            function () {
                            });
                    }

                    var currentLocale = Locale.getLocale(req.locale.id),

                        basketModel = new OrderModel(
                            currentBasket,
                            {
                                usingMultiShipping: usingMultiShipping,
                                countryCode: currentLocale.country,
                                containerView: 'basket'
                            }
                        ),

                        accountModel = new AccountModel(req.currentCustomer),
                        renderedStoredPaymentInstrument = COHelpers.getRenderedPaymentInstruments(
                            req,
                            accountModel
                        );

                    delete billingData.paymentInformation;

                    res.json({
                        renderedPaymentInstruments: renderedStoredPaymentInstrument,
                        customer: accountModel,
                        order: basketModel,
                        form: billingForm,
                        error: false
                    });
                });
        }

        return next();
    }
);


server.prepend('PlaceOrder',
    server.middleware.https,
    function (req, res, next) { // eslint-disable-line consistent-return
        var BasketMgr = require('dw/order/BasketMgr');
        var URLUtils = require('dw/web/URLUtils');
	    var Resource = require('dw/web/Resource');
	    var Transaction = require('dw/system/Transaction');
	    var URLUtils = require('dw/web/URLUtils');
	    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
	    var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
	    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
	    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
        var currentBasket = BasketMgr.getCurrentBasket();

        if (!currentBasket) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });

            return next();
        }

        var paymentInstruments = currentBasket.paymentInstruments;

        if (paymentInstruments.length <= 0) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: ['Payment method not selected.'],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });

            return next();
        }

        var paymentMethod = paymentInstruments[paymentInstruments.length - 1].paymentMethod;
        if (paymentMethod !== 'Sezzle') {
			return next();
		}

	    var validatedProducts = validationHelpers.validateProducts(currentBasket);
	    if (validatedProducts.error) {
	        res.json({
	            error: true,
	            cartError: true,
	            fieldErrors: [],
	            serverErrors: [],
	            redirectUrl: URLUtils.url('Cart-Show').toString()
	        });
	        return next();
	    }

	    if (req.session.privacyCache.get('fraudDetectionStatus')) {
	        res.json({
	            error: true,
	            cartError: true,
	            redirectUrl: URLUtils.url('Error-ErrorCode', 'err', '01').toString(),
	            errorMessage: Resource.msg('error.technical', 'checkout', null)
	        });

	        return next();
	    }

	    var validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
	    if (validationOrderStatus.error) {
	        res.json({
	            error: true,
	            errorMessage: validationOrderStatus.message
	        });
	        return next();
	    }

	    // Check to make sure there is a shipping address
	    if (currentBasket.defaultShipment.shippingAddress === null) {
	        res.json({
	            error: true,
	            errorStage: {
	                stage: 'shipping',
	                step: 'address'
	            },
	            errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
	        });
	        return next();
	    }

	    // Check to make sure billing address exists
	    if (!currentBasket.billingAddress) {
	        res.json({
	            error: true,
	            errorStage: {
	                stage: 'payment',
	                step: 'billingAddress'
	            },
	            errorMessage: Resource.msg('error.no.billing.address', 'checkout', null)
	        });
	        return next();
	    }

	    // Calculate the basket
	    Transaction.wrap(function () {
	        basketCalculationHelpers.calculateTotals(currentBasket);
	    });

	    // Re-validates existing payment instruments
	    var validPayment = COHelpers.validatePayment(req, currentBasket);
	    if (validPayment.error) {
	        res.json({
	            error: true,
	            errorStage: {
	                stage: 'payment',
	                step: 'paymentInstrument'
	            },
	            errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null)
	        });
	        return next();
	    }

	    // Re-calculate the payments.
	    var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
	    if (calculatedPaymentTransactionTotal.error) {
	        res.json({
	            error: true,
	            errorMessage: Resource.msg('error.technical', 'checkout', null)
	        });
	        return next();
	    }

        logger.info('Selected payment method : {0}',paymentMethod);
        res.json({
            error: false,
            continueUrl: URLUtils.url('Sezzle-Redirect').toString()
        });
        this.emit('route:Complete',
            req,
            res);

    });

module.exports = server.exports();
