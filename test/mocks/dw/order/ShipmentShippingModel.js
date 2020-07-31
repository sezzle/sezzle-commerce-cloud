var ShippingMethod = require('./ShippingMethod');
var ShipmentShippingModel = function () {};

ShipmentShippingModel.prototype.getApplicableShippingMethods = function () { return [new ShippingMethod('testDeliveryMethodID')]; };
ShipmentShippingModel.prototype.getInapplicableShippingMethods = function () { return []; };
ShipmentShippingModel.prototype.getShippingCost = function () {};
ShipmentShippingModel.prototype.applicableShippingMethods = null;
ShipmentShippingModel.prototype.inapplicableShippingMethods = null;
ShipmentShippingModel.prototype.shippingCost = null;

module.exports = ShipmentShippingModel;
