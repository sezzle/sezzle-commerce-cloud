var PaymentMethod = require('./PaymentMethod');

var PaymentMgr = function () { };

PaymentMgr.getPaymentMethod = function (method) {
    if (!method) throw new Error('Invalid method argument');
    if (typeof method === 'object') {
        return new PaymentMethod(method.ID);
    }
    return new PaymentMethod(method);
};
PaymentMgr.getApplicablePaymentMethods = function () { };
PaymentMgr.getPaymentCard = function () { };
PaymentMgr.getActivePaymentMethods = function () { };
PaymentMgr.prototype.paymentMethod = null;
PaymentMgr.prototype.applicablePaymentMethods = null;
PaymentMgr.prototype.paymentCard = null;
PaymentMgr.prototype.activePaymentMethods = null;
PaymentMgr.prototype.getPaymentProcessor = function () {};

module.exports = PaymentMgr;
