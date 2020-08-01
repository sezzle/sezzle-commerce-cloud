/**
 * This script used for init and configure Sezzle services
 *
 */

/**
 * Get Auth Header
 *
 * @param {dw.system.Site} currentSite Current Site
 * @returns {string} auth header
 */
var getAuthHeader = function (currentSite) {
    var authString = currentSite.getCustomPreferenceValue('SezzlePublicKey')
            + ':' + currentSite.getCustomPreferenceValue('SezzlePrivateKey');
    return 'Basic ' + require('dw/util/StringUtils').encodeBase64(authString);
};

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
    var identifiers = ['public_key', 'private_key', 'billing', 'shipping', 'token', 'authToken', 'merchant_uuid'];
    if (identifiers.indexOf(key) != -1) {
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
    for (var k in obj) {
        obj[k] = filterSensitiveData(k, obj[k]);
        if (obj[k] instanceof Object) {
            result += printValues(obj[k]);
        } else {
            result += decodeURIComponent(k + ' = ' + obj[k]) + '\n';
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
    var result = printValues(obj);
    return result;
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
