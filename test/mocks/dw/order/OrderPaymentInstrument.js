var PaymentTransaction = require('./PaymentTransaction');
var OrderPaymentInstrument = function (ID, money) {
    this.paymentTransaction = new PaymentTransaction(money);
    this.ID = ID;
    this.custom = {};
};

OrderPaymentInstrument.prototype.getPaymentMethod = function () {
    return 'SEZZLE';
};

module.exports = OrderPaymentInstrument;
