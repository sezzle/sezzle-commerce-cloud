var PaymentTransaction = require('./PaymentTransaction');
var OrderPaymentInstrument = function (ID, money) {
    this.paymentTransaction = new PaymentTransaction(money);
    this.ID = ID;
    this.custom = {};
};

module.exports = OrderPaymentInstrument;
