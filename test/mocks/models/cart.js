'use strict';

var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

var TotalsModel = require('./totals');
var ProductLineItemsModel = require('./productLineItems');

var ShippingHelpers = require('../helpers/shippingHelpers');

var URLUtils = require('../dw.web.URLUtils');
var ArrayList = require('../dw.util.Collection');
var Money = require('../dw.value.Money');

function proxyModel() {
    return proxyquire('../../../../storefront-reference-architecture/cartridges/app_storefront_base/cartridge/models/cart', {
        '*/cartridge/scripts/util/collections': {},
        'dw/campaign/PromotionMgr': {
            getDiscounts: function () {
                return {
                    getApproachingOrderDiscounts: function () {
                        return new ArrayList([{
                            getDistanceFromConditionThreshold: function () {
                                return new Money();
                            },
                            getDiscount: function () {
                                return {
                                    getPromotion: function () {
                                        return {
                                            getCalloutMsg: function () {
                                                return 'someString';
                                            }
                                        };
                                    }
                                };
                            }
                        }]);
                    },
                    getApproachingShippingDiscounts: function () {
                        return new ArrayList([{
                            getDistanceFromConditionThreshold: function () {
                                return new Money();
                            },
                            getDiscount: function () {
                                return {
                                    getPromotion: function () {
                                        return {
                                            getCalloutMsg: function () {
                                                return 'someString';
                                            }
                                        };
                                    }
                                };
                            }
                        }]);
                    }
                };
            }
        },
        '*/cartridge/models/totals': TotalsModel,
        '*/cartridge/models/productLineItems': ProductLineItemsModel,
        '*/cartridge/scripts/checkout/shippingHelpers': ShippingHelpers,
        'dw/web/URLUtils': URLUtils,
        'dw/util/StringUtils': {
            formatMoney: function () {
                return 'formatted money';
            }
        },
        'dw/web/Resource': {
            msg: function () {
                return 'someString';
            },
            msgf: function () {
                return 'someString';
            }
        },
        'dw/system/HookMgr': {
            callHook: function () {
                return { error: false, message: 'some message' };
            }
        }
    });
}

module.exports = proxyModel();
