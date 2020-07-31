'use strict';

var Status = require('dw/system/Status');

/**
 * Print values
 * 
 * @param {Object} args
 * @returns {dw.system.Status} refund status
 */
function execute(args) {
    try {
        require('*/cartridge/scripts/sezzle').order.refundOrders();
        return new Status(Status.OK);
    } catch (e) {
        return new Status(Status.ERROR);
    }
}

exports.execute = execute;
