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
            creditCardErrors = {},
            viewData = {};


        // Verify billing form data
        billingFormErrors = COHelpers.validateBillingForm(paymentForm.addressFields);

        if (!req.form.storedPaymentUUID) {
            // Verify credit card form data
            creditCardErrors = COHelpers.validateCreditCard(paymentForm);
        }

        if (Object.keys(billingFormErrors).length) {
            // Respond with form data and errors
            res.json({
                form: paymentForm,
                fieldErrors: [billingFormErrors],
                serverErrors: [],
                error: true
            });
        } else if (paymentMethodID === 'CREDIT_CARD' && Object.keys(creditCardErrors).length) {
            // Respond with form data and errors
            res.json({
                form: paymentForm,
                fieldErrors: [creditCardErrors],
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

            if (paymentMethodID === 'CREDIT_CARD' && paymentForm.creditCardFields) {
                viewData.paymentInformation = {
                    cardType: {
                        value: paymentForm.creditCardFields.cardType.value,
                        htmlName: paymentForm.creditCardFields.cardType.htmlName
                    },
                    cardNumber: {
                        value: paymentForm.creditCardFields.cardNumber.value,
                        htmlName: paymentForm.creditCardFields.cardNumber.htmlName
                    },
                    securityCode: {
                        value: paymentForm.creditCardFields.securityCode.value,
                        htmlName: paymentForm.creditCardFields.securityCode.htmlName
                    },
                    expirationMonth: {
                        value: parseInt(
                            paymentForm.creditCardFields.expirationMonth.selectedOption,
                            10
                        ),
                        htmlName: paymentForm.creditCardFields.expirationMonth.htmlName
                    },
                    expirationYear: {
                        value: parseInt(paymentForm.creditCardFields.expirationYear.value,
                            10),
                        htmlName: paymentForm.creditCardFields.expirationYear.htmlName
                    }
                };
            }


            if (paymentMethodID === 'CREDIT_CARD' && req.form.storedPaymentUUID) {
                viewData.storedPaymentUUID = req.form.storedPaymentUUID;
            }

            if (paymentMethodID === 'CREDIT_CARD' && paymentForm.creditCardFields) {
                viewData.saveCard = paymentForm.creditCardFields.saveCard.checked;
            }

            /* Currently phone is hardcoded to credit card form so we will take phone from shipping address */
            var shippingAddress = currentBasket.defaultShipment;

            viewData.phone = { value: shippingAddress.phone };

            if (paymentMethodID === 'CREDIT_CARD') {
                viewData.email = {
                    value: paymentForm.email.value
                };
            }

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

                    var billingAddress = currentBasket;
                    var billingForm = server.forms.getForm('billing');
                    var result;
                    paymentMethodID = billingData.paymentMethod.value;

                    if (paymentMethodID === 'CREDIT_CARD' && billingForm.creditCardFields) {
                        billingForm.creditCardFields.cardNumber.htmlValue = '';
                        billingForm.creditCardFields.securityCode.htmlValue = '';
                    }

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
                        } else if (paymentMethodID === 'CREDIT_CARD') {
                            billingAddress.setPhone(billingData.phone.value);
                            currentBasket.setCustomerEmail(billingData.email.value);
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

                    if (paymentMethodID === 'CREDIT_CARD' && billingData.storedPaymentUUID
            && req.currentCustomer.raw.authenticated
            && req.currentCustomer.raw.registered
                    ) {
                        var paymentInstruments = req.currentCustomer.wallet;
                        var paymentInstrument = array.find(paymentInstruments,
                            function (item) {
                                return billingData.storedPaymentUUID === item.UUID;
                            });

                        billingData.paymentInformation.cardNumber.value = paymentInstrument
                            .creditCardNumber;
                        billingData.paymentInformation.cardType.value = paymentInstrument
                            .creditCardType;
                        billingData.paymentInformation.securityCode.value = req.form.securityCode;
                        billingData.paymentInformation.expirationMonth.value = paymentInstrument
                            .creditCardExpirationMonth;
                        billingData.paymentInformation.expirationYear.value = paymentInstrument
                            .creditCardExpirationYear;
                        billingData.paymentInformation.creditCardToken = paymentInstrument
                            .raw.creditCardToken;
                    }

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

                    if (!billingData.storedPaymentUUID
            && req.currentCustomer.raw.authenticated
            && req.currentCustomer.raw.registered
            && billingData.saveCard
            && (paymentMethodID === 'CREDIT_CARD')
                    ) {
                        var customer = CustomerMgr.getCustomerByCustomerNumber(req.currentCustomer.profile.customerNo),

                            saveCardResult = COHelpers.savePaymentInstrumentToWallet(
                                billingData,
                                currentBasket,
                                customer
                            );

                        req.currentCustomer.wallet.paymentInstruments.push({
                            creditCardHolder: saveCardResult.creditCardHolder,
                            maskedCreditCardNumber: saveCardResult.maskedCreditCardNumber,
                            creditCardType: saveCardResult.creditCardType,
                            creditCardExpirationMonth: saveCardResult.creditCardExpirationMonth,
                            creditCardExpirationYear: saveCardResult.creditCardExpirationYear,
                            UUID: saveCardResult.UUID,
                            creditCardNumber: Object.hasOwnProperty.call(
                                saveCardResult,
                                'creditCardNumber'
                            )
                                ? saveCardResult.creditCardNumber
                                : null,
                            raw: saveCardResult
                        });

                        // Calculate the basket
                        Transaction.wrap(function () {
                            basketCalculationHelpers.calculateTotals(currentBasket);
                        });

                        // Re-calculate the payments.
                        var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(currentBasket);

                        if (calculatedPaymentTransaction.error) {
                            res.json({
                                form: paymentForm,
                                fieldErrors: [],
                                serverErrors: [Resource.msg('error.technical',
                                    'checkout',
                                    null)],
                                error: true
                            });

                            return;
                        }
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
        var paymentMethod = '';

        var currentBasket = BasketMgr.getCurrentBasket(),

            paymentInstruments = currentBasket;

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
        return next();
    });


module.exports = server.exports();
