/**
 * This script used for init and configure Sezzle services
 *
 */
 
/**
 * Get Auth Header
 * 
 * @param {dw.system.Site} currentSite
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
 * @param {dw.svc} svc
 * @param {Object} args
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
};

/**
 * Init services
 * 
 * @param {string} serviceName
 * @returns {Service} called service
 */
function initService(serviceName) {
    var service = require('dw/svc/LocalServiceRegistry').createService(serviceName, {
    	createRequest: commonCreateRequest,
    	parseResponse: require('~/cartridge/scripts/utils/sezzleUtils').responseParser,
    	getRequestLogMessage: function (request) {
            return prepareLogData(request);
        },
        getResponseLogMessage: function (response) {
            return prepareLogData(response.text);
        }
    });
    return service;
};

/**
 * Prepare Log data
 * 
 * @param {string} data
 * @returns {string} printable data
 */
function prepareLogData(data) {
	if (data === null) {
        return 'Data of response or request is null';
    } else {
    	var obj = JSON.parse(data);
    	var result = printValues(obj);
    	return result;
	}
};

/**
 * Print values
 * 
 * @param {Object} obj
 * @returns {string} printable data
 */
function printValues(obj) {
	var result = '\n';
    for(var k in obj) {
    	obj[k] = filterSensitiveData(k, obj[k]);	
        if(obj[k] instanceof Object) {
            result += printValues(obj[k]);
        } else {
        	result += decodeURIComponent(k + ' = ' + obj[k]) + '\n';
        };
    }
    return result;
};

/**
 * Filter sensitive data
 * 
 * @param {string} key
 * @param {string} value
 * @returns {string} value
 */
function filterSensitiveData(key, value) {
	var identifiers = ["public_key","private_key","billing","shipping","token","authToken","merchant_uuid"];
	if (identifiers.indexOf(key) !== -1) {
    	return "****";	
    } else {
    	return value;
	}
}

module.exports.initService = initService;
