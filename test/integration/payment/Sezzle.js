'use strict';

var assert = require('chai').assert;
var https = require('https');
var config = require('../it.config');
var chai = require('chai');
var chaiSubset = require('chai-subset');
chai.use(chaiSubset);

/**
 * Performs a GET request and resolves with the response body, rejecting on non-2xx status
 * @param {string} url - request URL
 * @returns {Promise<string>} response body
 */
function get(url) {
    return new Promise(function (resolve, reject) {
        https.get(url, { rejectUnauthorized: false }, function (res) {
            var body = '';
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                body += chunk;
            });
            res.on('end', function () {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error('Request failed with status ' + res.statusCode));
                }

                return resolve(body);
            });
        }).on('error', reject);
    });
}

describe('Get request data for Sezzle Checkout Object', function () {
    this.timeout(45000);

    it('should return Sezzle Checkout Object', function () {
        return get(config.baseUrl + '/Sezzle-CheckoutObject')
            .then(function (response) {
                var responseJSON = JSON.parse(response);
                if (!responseJSON.action) {
                    throw new Error('error in fetching response');
                } else {
                    assert.equal(responseJSON.action, 'Sezzle-CheckoutObject', 'Invalid Request');
                }
            });
    });
});
