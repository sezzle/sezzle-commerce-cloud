/**
 * This script used for init and configure Sezzle services
 *
 */
/* global empty */
/**
 * Create Common Request
 *
 * @param {dw.svc} svc SVC
 * @param {Object} args Arguments
 * @returns {string} args object
 */
var commonCreateRequest = function (svc, args) {
    svc.setRequestMethod('POST');
    svc.addHeader('Content-Type', 'application/json');
    if (!empty(args)) {
        if (args.httpMethod) {
            svc.setRequestMethod(args.httpMethod);
        }
        if (args.authToken) {
            svc.addHeader('Authorization', 'Bearer ' + args.authToken);
        }
        return JSON.stringify(args);
    }
    return '';
};

/**
 * Filter sensitive data
 *
 * @param {string} key Key
 * @param {string} value Value
 * @returns {string} value
 */
function filterSensitiveData(key, value) {
    var identifiers = [
		'public_key',
		'private_key',
		'expiration_date',
		'billing_address',
		'shipping_address',
		'customer_details',
		'capture_expiration',
		'token',
		'authToken',
		'merchant_uuid',
		'customer',
		'uuid',
		'checkout_url',
		'links',
		'tokenize',
		'authorization',
		'expiration',
		'email',
		'first_name',
		'last_name',
		'phone',
		'dob'
	];
    if (identifiers.indexOf(key) !== -1) {
        return '****';
    }
    return value;
}

/**
 * Print values
 *
 * @param {Object} obj Object
 * @returns {string} printable data
 */
function printValues(obj) {
    var result = '\n';
    var reqObj = obj;
    for (var k in reqObj) { // eslint-disable-line no-plusplus
        reqObj[k] = filterSensitiveData(k, reqObj[k]);
        if (reqObj[k] instanceof Object) {
            result += printValues(reqObj[k]);
        } else {
            result += decodeURIComponent(k + ' = ' + reqObj[k]) + '\n';
        }
    }
    return result;
}

/**
 * Prepare Log data
 *
 * @param {string} data Data
 * @returns {string} printable data
 */
function prepareLogData(data) {
    if (data == null) {
        return 'Data of response or request is null';
    }
    var obj = JSON.parse(data);
    return printValues(obj);
}

/**
 * Init services
 *
 * @param {string} serviceName Service Name
 * @returns {Service} called service
 */
function initService(serviceName) {
    return require('dw/svc/LocalServiceRegistry').createService(serviceName, {
        createRequest: commonCreateRequest,
        parseResponse: require('~/cartridge/scripts/utils/sezzleUtils').responseParser,
        getRequestLogMessage: function (request) {
            return prepareLogData(request);
        },
        getResponseLogMessage: function (response) {
            return prepareLogData(response.text);
        }
    });
}

module.exports.initService = initService;
