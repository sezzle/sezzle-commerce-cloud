/**
 *  Just assemble Sezzle libraries into one
 *
 */

(function () {
    module.exports = {
        basket: require('*/cartridge/scripts/basket/sezzleBasket'),
        data: require('*/cartridge/scripts/data/sezzleData'),
        order: require('*/cartridge/scripts/order/sezzleOrder'),
        utils: require('*/cartridge/scripts/utils/sezzleUtils'),
        api: require('*/cartridge/scripts/api/sezzleAPI')
    };
}());
