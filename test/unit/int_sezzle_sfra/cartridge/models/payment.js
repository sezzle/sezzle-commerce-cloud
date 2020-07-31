var assert = require('chai').assert;
var Basket = require('../../../../mocks/dw/order/Basket');
var PaymentMgr = require('../../../../mocks/dw/order/PaymentMgr');
var PaymentInstrument = require('../../../../mocks/dw/order/PaymentInstrument');
var collections = require('../../../../mocks/cartridge/scripts/util/collections');
var Customer = require('../../../../mocks/dw/customer/Customer');

var payment = proxyquire('../../../../../cartridges/int_sezzle_sfra/cartridge/models/payment', {
    'dw/order/PaymentMgr': PaymentMgr,
    'dw/order/PaymentInstrument': PaymentInstrument,
    '*/cartridge/scripts/util/collections': collections
});

describe('int_affirm_sfra/cartridge/models/payment', function () {
    it('is Function', function () {
        assert.isFunction(payment);
    });

    it('should set to a global variable Payment Cards, Payment Instruments, Payment Methods', function () {
        var basket = new Basket();
        var customer = new Customer('testUser');
        var countryCode = '1123453';
        var testGlobal = {
            payment: payment
        };
        testGlobal.payment(basket, customer, countryCode);
        assert.isNotEmpty(testGlobal.applicablePaymentMethods);
        assert.isNotEmpty(testGlobal.applicablePaymentCards);
        assert.isNotEmpty(testGlobal.selectedPaymentInstruments);
    });
});