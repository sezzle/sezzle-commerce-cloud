var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var Request = require('../../../../../mocks/dw/system/Request');
var Session = require('../../../../../mocks/dw/system/Session');
var system = require('../../../../../mocks/dw/system');
var web = require('../../../../../mocks/dw/web');
var LocalServiceRegistry = require('../../../../../mocks/dw/svc/LocalServiceRegistry');
var Site = require('../../../../../mocks/dw/system/Site');
var StringUtils = require('../../../../../mocks/dw/util/StringUtils');

global.request = new Request();
global.res = {
    render: function () {}
};
global.session = new Session();
global.dw = {
    system: system
};

Array.prototype.iterator = function () { return new Iterator(this); };
Array.prototype.toArray = function () { return this; };

String.prototype.getValue = function () { return this; };

global.empty = function (obj) {
    if (obj === null || obj === undefined || obj === '' || (typeof (obj) !== 'function' && obj.length !== undefined && obj.length === 0)) {
        return true;
    }
    return false;
};

var sezzleData = proxyquire('../../../../../../cartridges/int_sezzle_sg/cartridge/scripts/data/sezzleData', {
    'dw/system': system,
    'dw/web': web,
    'dw/system/Site': Site
});

var initSezzleServices = proxyquire('../../../../../../cartridges/int_sezzle_sg/cartridge/scripts/init/initSezzleServices', {
    'dw/util/StringUtils': StringUtils,
    'dw/system/Site': Site,
    'dw/svc/LocalServiceRegistry': LocalServiceRegistry,
    '*/cartridge/scripts/utils/sezzleUtils': {
        responseParser: function () {
            return {
                error: false,
                response: {}
            };
        }
    }
});

var sezzleAPI = proxyquire('../../../../../../cartridges/int_sezzle_sg/cartridge/scripts/api/sezzleAPI', {
    'dw/system': system,
    '*/cartridge/scripts/data/sezzleData': sezzleData,
    '*/cartridge/scripts/init/initSezzleServices': initSezzleServices
});

describe('int_sezzle_sg/cartridge/scripts/api/sezzleApi', function () {
    it('is Object', function () {
        assert.isObject(sezzleAPI);
    });

    context('method auth', function () {
        it('should return auth object', function () {
            var actual = sezzleAPI.authenticate();
            assert.isObject(actual);
            assert.include(actual, {
                name: 'sezzle.authenticate',
                public_key: 'TestSezzlePublicKey',
                private_key: 'TestSezzlePrivateKey'
            });
            assert.containsAllKeys(actual, [
                'createRequest',
                'parseResponse',
                'getRequestLogMessage',
                'getResponseLogMessage',
            ]);
        });
    });

    context('method capture', function () {
        it('should return caputre event object', function () {
            var actual = sezzleAPI.capture('1234', '123');
            var authentication = {
                response: {
                    token: '1234'
                }
            };
            assert.isObject(actual);
            assert.include(actual, {
                name: 'sezzle.capture',
                authToken: authentication.response.token
            });
            assert.containsAllKeys(actual, [
                'createRequest',
                'parseResponse',
                'getRequestLogMessage',
                'getResponseLogMessage'
            ]);
        });
    });
    //
    // context('method void', function () {
    //     it('should return charge void event object', function () {
    //         var actual = affirmAPI.void('chargeId');
    //         assert.isObject(actual);
    //         assert.include(actual, {
    //             name: 'affirm.void'
    //         });
    //         assert.containsAllKeys(actual, 'createRequest', 'parseResponse', 'filterLogMessage');
    //     });
    // });
    //
    // context('method refund', function () {
    //     it('should return charge by chargeID', function () {
    //         var actual = affirmAPI.refund('chargeId');
    //         assert.isObject(actual);
    //         assert.include(actual, {
    //             name: 'affirm.refund'
    //         });
    //         assert.containsAllKeys(actual, 'createRequest', 'parseResponse', 'filterLogMessage');
    //     });
    // });
    //
    // context('method update', function () {
    //     it('should return charge update event object', function () {
    //         var actual = affirmAPI.update('chargeId', { updateData: 'updateData' });
    //         assert.isObject(actual);
    //         assert.include(actual, {
    //             name: 'affirm.update',
    //             updateData: 'updateData'
    //         });
    //         assert.containsAllKeys(actual, 'createRequest', 'parseResponse', 'filterLogMessage');
    //     });
    // });
});
