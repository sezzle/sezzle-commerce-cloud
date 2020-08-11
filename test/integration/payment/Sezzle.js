var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');
var chai = require('chai');
var chaiSubset = require('chai-subset');
chai.use(chaiSubset);

describe('Get request data for Sezzle Checkout Object', function () {
    this.timeout(45000);

    var myRequest = {
        url: '',
        method: 'POST',
        rejectUnauthorized: false,
        resolveWithFullResponse: true,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    };

    it('should return Sezzle Checkout Object', function () {
        myRequest = {
            url: config.baseUrl + '/Sezzle-CheckoutObject',
            method: 'GET',
            rejectUnauthorized: false
        };


        return request(myRequest)
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
