'use strict';

var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

function proxyModel() {
    return proxyquire('../../../cartridges/storefront-reference-architecture/cartridges/app_storefront_base/cartridge/models/address.js', {});
}

module.exports = proxyModel();
