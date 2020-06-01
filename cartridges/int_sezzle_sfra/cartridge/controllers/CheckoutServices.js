'use strict';

var page = module.superModule;

var server = require('server');

var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var logger = require('dw/system').Logger.getLogger('Sezzle', '');

server.extend(page);


/**
 *  Handle Ajax payment (and billing) form submit
 */
server.prepend(
    'SubmitPayment',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        logger.debug('****Checkout Start****');
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
            viewData = {};
        
        if (paymentMethodID != 'Sezzle') {
        	return next();
        }


        // Verify billing form data
        billingFormErrors = COHelpers.validateBillingForm(paymentForm.addressFields);

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
                    var CustomerMgr = require('dw/customer/CustomerMgr');
                    var HookMgr = require('dw/system/HookMgr');
                    var Resource = require('dw/web/Resource');
                    var PaymentMgr = require('dw/order/PaymentMgr');
                    var Transaction = require('dw/system/Transaction');
                    var AccountModel = require('*/cartridge/models/account');
                    var OrderModel = require('*/cartridge/models/order');
                    var URLUtils = require('dw/web/URLUtils');
                    var array = require('*/cartridge/scripts/util/array');
                    var Locale = require('dw/util/Locale');
                    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
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

                        if (paymentMethodID === 'Sezzle' && req.currentCustomer.profile) {
                            currentBasket.setCustomerEmail(req.currentCustomer.profile.email);
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
                                billingForm.email.htmlValue],
                            function () {});
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
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var URLUtils = require('dw/web/URLUtils');
        var sezzleData = require('*/cartridge/scripts/data/sezzleData.ds');
        var paymentMethod = '';

        var currentBasket = BasketMgr.getCurrentBasket(),

            paymentInstruments = currentBasket.paymentInstruments;

        for (var i = 0; i < paymentInstruments.length; i++) {
            var paymentInstrument = paymentInstruments[i];

            paymentMethod = paymentInstrument.paymentMethod;
        }

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
        
        var customerNo = currentBasket.getCustomerNo();
        if (customerNo == null && sezzleData.getTokenizeStatus()) {
        	logger.debug('Guest user blocked as it is a tokenize checkout');
        	res.json({
                error: true,
                cartError: false,
                fieldErrors: [],
                serverErrors: ['Sezzle does not allow tokenize checkout for guest user.'],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
        	
            return next();
        	
        }

        if (paymentMethod === 'Sezzle') {
            logger.debug('Selected payment method : {0}',
                paymentMethod);
            res.json({
                error: false,
                continueUrl: URLUtils.url('Sezzle-Redirect').toString()
            });
            this.emit('route:Complete',
                req,
                res);
        }
    });

module.exports = server.exports();
