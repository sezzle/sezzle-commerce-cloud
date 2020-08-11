
var parametersMap = {};
var Request = function () {
    this.httpParameterMap = parametersMap;
};

Request.prototype.setupTestHttpParameterMap = function (paramObj) {
    Object.keys(paramObj).forEach(function (key) {
        parametersMap[key] = { stringValue: paramObj[key] };
    });
    parametersMap = paramObj;
};
Request.prototype.resetTestParameterMap = function () {
    parametersMap = {};
};

Request.prototype.getLocale = function () {};
Request.prototype.getCustom = function () {};
Request.prototype.getSession = function () {};
Request.prototype.isHttpSecure = function () {};
Request.prototype.getRequestID = function () {};
Request.prototype.isHttpRequest = function () {};
Request.prototype.getHttpCookies = function () {};
Request.prototype.addHttpCookie = function () {};
Request.prototype.getHttpPath = function () {};
Request.prototype.getHttpProtocol = function () {};
Request.prototype.getHttpQueryString = function () {};
Request.prototype.getHttpLocale = function () {};
Request.prototype.getHttpReferer = function () {};
Request.prototype.getHttpUserAgent = function () {};
Request.prototype.getHttpRemoteAddress = function () {};
Request.prototype.getHttpHost = function () {};
Request.prototype.getHttpParameters = function () {};
Request.prototype.getHttpHeaders = function () {};
Request.prototype.getGeolocation = function () {};
Request.prototype.locale = null;
Request.prototype.custom = null;
Request.prototype.session = null;
Request.prototype.requestID = null;
Request.prototype.httpCookies = null;
Request.prototype.httpPath = null;
Request.prototype.httpProtocol = null;
Request.prototype.httpQueryString = null;
Request.prototype.httpLocale = null;
Request.prototype.httpReferer = null;
Request.prototype.httpUserAgent = null;
Request.prototype.httpRemoteAddress = null;
Request.prototype.httpHost = null;
Request.prototype.httpParameters = null;
Request.prototype.httpHeaders = null;
Request.prototype.geolocation = null;

module.exports = Request;
