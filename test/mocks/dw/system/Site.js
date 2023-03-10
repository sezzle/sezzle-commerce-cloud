/**
 * Represents the current site mock
 */

var Site = function () {};

var customPreferencesDefault = {
    SezzleOnline: true,
    SezzleMode: 'sandbox',
    SezzleModalEnable: 'SezzleModalEnable',
    SezzlePublicKey: 'TestSezzlePublicKey',
    SezzlePrivateKey: 'TestSezzlePrivateKey',
    SezzlePaymentAction: 'AUTH',
    SezzlePLPPromoMessage: true,
    SezzleProductMessage: true,
    SezzleCartPromoMessage: true,
    SezzleAnalytics: false,
    SezzleFPTotalRange: ['100|200|GoldPriceFinProgram'],
    SezzleDefaultFP: '50.0',
    SezzleFPCustomerGroup: ['Registered|PremiumFinProgram'],
    SezzlePaymentOnlineStatus: false,
    SezzleFPDateRange: ['2019-01-01|2021-01-01|ThisYearFinProgram'],
    SezzleVCNIntegration: 'off',
    SezzleMinTotal: 50,
    SezzlePaymentMinTotal: 50,
    SezzlePaymentMaxTotal: 200,
    SezzleVCNPaymentInstrument: 'BASIC_CREDIT',
    SezzleFPMapping: ['DefaultFinProgram|DUMMYCODEGGG|DUMMYCODENX3', 'PremiumFinProgram|DUMMYCODEPRF|DUMMYCODEPR3', 'ThisYearFinProgram|DUMMYCODETYF|DUMMYCODETY3', 'GoldPriceFinProgram|DUMMYCODEGPF|DUMMYCODEGP3']
};
var customPreferences = Object.assign({}, customPreferencesDefault);

Site.changeCustomPrefForTesting = function (key, value) {
    customPreferences[key] = value;
};
Site.restoreDefaultCustom = function () {
    customPreferences = Object.assign({}, customPreferencesDefault);
};

Site.prototype.getCurrencyCode = function () {};
Site.prototype.getName = function () {};
Site.prototype.getID = function () {};
Site.getCurrent = function () { return new Site(); };
Site.prototype.getPreferences = function () {};
Site.prototype.getHttpHostName = function () {};
Site.prototype.getHttpsHostName = function () {};

Site.prototype.getCustomPreferenceValue = function (strKey) {
    var value = customPreferences[strKey];
    if (typeof (value) === 'string') {
        value.value = customPreferences[strKey];
    }
    return value;
};
Site.prototype.setCustomPreferenceValue = function (strKey, value) { customPreferences[strKey] = value; };

Site.prototype.getDefaultLocale = function () {};
Site.prototype.getAllowedLocales = function () {};
Site.prototype.getAllowedCurrencies = function () {};
Site.prototype.getDefaultCurrency = function () {};
Site.prototype.getTimezone = function () {};
Site.prototype.getTimezoneOffset = function () {};
// Site.getCalendar = function(){return new require('../util/Calendar')();};
Site.prototype.isOMSEnabled = function () {};
Site.prototype.currencyCode = null;
Site.prototype.name = null;
Site.prototype.ID = null;
Site.current = new Site();
Site.prototype.preferences = null;
Site.prototype.httpHostName = null;
Site.prototype.httpsHostName = null;
Site.prototype.customPreferenceValue = null;
Site.prototype.defaultLocale = null;
Site.prototype.allowedLocales = null;
Site.prototype.allowedCurrencies = null;
Site.prototype.defaultCurrency = null;
Site.prototype.timezone = null;
Site.prototype.timezoneOffset = null;
Site.prototype.calendar = null;

module.exports = Site;
