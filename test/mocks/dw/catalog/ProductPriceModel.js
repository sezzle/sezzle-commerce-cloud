var Money = require('../value/Money');
var PriceBookMgr = require('../catalog/PriceBookMgr');

var ProductPriceModel = function (price) {
    this.price = new Money(price, 'USD');
};

ProductPriceModel.prototype.getPrice = function () { return this.price; };
ProductPriceModel.prototype.getPriceInfo = function () {};
ProductPriceModel.prototype.getBasePriceQuantity = function () {};
ProductPriceModel.prototype.getPriceTable = function () {};
ProductPriceModel.prototype.getPriceBookPrice = function (priceBookID) {
    return PriceBookMgr.getAllPriceBooks().find(function (pb) { return pb.ID === priceBookID; });
};
ProductPriceModel.prototype.getPriceBookPriceInfo = function () {};
ProductPriceModel.prototype.getPricePercentage = function () {};
ProductPriceModel.prototype.getMinPrice = function () {};
ProductPriceModel.prototype.getMaxPrice = function () { return this.price; };
ProductPriceModel.prototype.getMinPriceBookPrice = function () {};
ProductPriceModel.prototype.getMaxPriceBookPrice = function () {};
ProductPriceModel.prototype.isPriceRange = function () {};
ProductPriceModel.prototype.price = null;
ProductPriceModel.prototype.priceInfo = null;
ProductPriceModel.prototype.basePriceQuantity = null;
ProductPriceModel.prototype.priceTable = null;
ProductPriceModel.prototype.priceBookPrice = null;
ProductPriceModel.prototype.priceBookPriceInfo = null;
ProductPriceModel.prototype.pricePercentage = null;
ProductPriceModel.prototype.minPrice = null;
ProductPriceModel.prototype.maxPrice = null;
ProductPriceModel.prototype.minPriceBookPrice = null;
ProductPriceModel.prototype.maxPriceBookPrice = null;

module.exports = ProductPriceModel;
