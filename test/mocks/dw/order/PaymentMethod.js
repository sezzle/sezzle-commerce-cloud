var PaymentProcessor = require('./PaymentProcessor');

var PaymentMethod = function (ID) {
    this.ID = ID;
    this.paymentProcessor = new PaymentProcessor();
};

PaymentMethod.prototype.getName = function () {};
PaymentMethod.prototype.getID = function () { return this.ID; };
PaymentMethod.prototype.getDescription = function () {};
PaymentMethod.prototype.isActive = function () {};
PaymentMethod.prototype.getImage = function () {};
PaymentMethod.prototype.isApplicable = function () {};
PaymentMethod.prototype.getPaymentProcessor = function () { return this.paymentProcessor; };
PaymentMethod.prototype.getActivePaymentCards = function () {};
PaymentMethod.prototype.getApplicablePaymentCards = function () {};
PaymentMethod.prototype.name = null;
PaymentMethod.prototype.ID = null;
PaymentMethod.prototype.description = null;
PaymentMethod.prototype.image = null;
PaymentMethod.prototype.paymentProcessor = null;
PaymentMethod.prototype.activePaymentCards = null;
PaymentMethod.prototype.applicablePaymentCards = null;

module.exports = PaymentMethod;
