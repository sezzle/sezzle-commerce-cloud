'use strict';

var loggerMock = {
    debug: function (text) {
        return text;
    },
    error: function (text) {
        return text;
    },
    getLogger: function () {
        return this;
    },
    info: function (text) {
        return text;
    }
};

module.exports = loggerMock;
