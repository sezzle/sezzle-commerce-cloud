/**
 * This script provides utility functions shared across other Sezzle related scripts.
 *
 */
(function () {
    var Utils = function () {
        let self = this,
            values = require('dw/value'),
            web = require('dw/web'),
            system = require('dw/system'),
            dwutil = require('dw/util'),
            sezzleData = require('~/cartridge/scripts/data/sezzleData'),
            Calendar = require('dw/util/Calendar'),
            BasketMgr = require('dw/order/BasketMgr'),
            Money = require('dw/value/Money'),
            PromotionMgr = require('dw/campaign/PromotionMgr'),
            Promotion = require('dw/campaign/Promotion');

        /**
		 * Calculate non-gift certificate amount
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @returns {dw.value.Money} simple object with name and shipping address
		 */
        self.calculateNonGiftCertificateAmount = function (basket) {
            let basketTotal = basket.getTotalGrossPrice(),
                giftCertTotal = new values.Money(0.0, basket.currencyCode),
                giftCertificatePaymentInstrs = basket.getGiftCertificatePaymentInstruments().iterator();

            while (!empty(giftCertificatePaymentInstrs) && giftCertificatePaymentInstrs.hasNext()) {
                let orderPI = giftCertificatePaymentInstrs.next();
                giftCertTotal = giftCertTotal.add(orderPI.getPaymentTransaction().getAmount());
            }
            return basketTotal.subtract(giftCertTotal);
        };

        /**
		 * Compare line items from basket and from sezzle response.
		 * If they are not identical, add error to status object
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @param {Object} SezzleResponse charge object
		 * @param {dw.system.Status} status Status
		 */
        self.checkLineItems = function (basket, SezzleResponse, status) {
            let productLineItems = basket.getProductLineItems().iterator();

            while (!empty(productLineItems) && productLineItems.hasNext()) {
                let productLineItem = productLineItems.next();

                if (productLineItem.getProductID() in SezzleResponse.details.items) {
                    let product = SezzleResponse.details.items[productLineItem.getProductID()],
                        productLineItemPrice = productLineItem.optionProductLineItem ?
                            productLineItem.getBasePrice().multiply(100).getValue() :
                            productLineItem.product.getPriceModel().getPrice().multiply(100).getValue();

                    if (product.unit_price !== productLineItemPrice) {
                        status.addItem(
                            new system.StatusItem(
                                system.Status.ERROR,
                                '',
                                web.Resource.msgf(
                                    'basket.missing.product.price',
                                    'sezzle',
                                    null,
                                    productLineItem.getProductID(),
                                    productLineItem.optionProductLineItem ?
                                        productLineItem.getBasePrice().toFormattedString() :
                                        productLineItem.product.getPriceModel().getPrice().toFormattedString()
                                ),
                                '')
                        );
                    }
                    if (product.qty !== productLineItem.getQuantityValue()) {
                        status.addItem(
                            new system.StatusItem(
                                system.Status.ERROR,
                                '',
                                web.Resource.msgf(
                                    'basket.missing.product.quantity',
                                    'sezzle',
                                    null,
                                    productLineItem.getProductID(),
                                    productLineItem.getQuantityValue()
                                ),
                                ''
                            )
                        );
                    }
                } else {
                    status.addItem(
                        new system.StatusItem(
                            system.Status.ERROR,
                            '',
                            web.Resource.msgf(
                                'basket.missing.product',
                                'sezzle',
                                null,
                                productLineItem.getProductID()
                            ),
                            ''
                        )
                    );
                }
            }
        };

        /**
		 * Compare taxes from basket and from sezzle response.
		 * If they are not identical, add error to status object
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @param {Object} SezzleResponse charge object
		 * @param {dw.system.Status} status Status
		 */
        self.checkTaxation = function (basket, SezzleResponse, status) {
            let basketTax = basket.getTotalTax().multiply(100).getValue();
            if (basketTax !== SezzleResponse.details.tax_amount) {
                status.addItem(
                    new system.StatusItem(
                        system.Status.ERROR,
                        '',
                        web.Resource.msgf(
                            'basket.missing.tax',
                            'sezzle',
                            null,
                            basket.getTotalTax().toFormattedString()
                        ),
                        ''
                    )
                );
            }
        };

        /**
		 * Compare total price from basket and from sezzle response.
		 * If they are not identical, add error to status object
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @param {Object} SezzleResponse charge object
		 * @param {dw.system.Status} status Status
		 */
        self.checkTotalPrice = function (basket, SezzleResponse, status) {
            let totalPrice = self.calculateNonGiftCertificateAmount(basket).multiply(100).getValue();
            if (totalPrice !== SezzleResponse.details.total) {
                status.addItem(
                    new system.StatusItem(
                        system.Status.ERROR,
                        '',
                        web.Resource.msgf(
                            'basket.missing.total',
                            'sezzle',
                            null,
                            self.calculateNonGiftCertificateAmount(basket).toFormattedString()
                        ),
                        ''
                    )
                );
            }
        };

        /**
        * @param {dw.order.Basket}  basket Basket
        * @param {Object} SezzleResponse charge object
        * @param {dw.system.Status} status Status
        */
        self.checkAddresses	= function (basket, SezzleResponse, status) {
        };

        /**
         * @param {dw.svc} svc Svc
         * @param {Object} client Client
         * @return {Object} Response
         */
        self.responseParser = function (svc, client) {
            var response;
            			response = {
            				error : true,
            				response : JSON.parse(client.text)
            			}

            			switch (client.statusCode) {
            				case 200:
            					response = {
            						error : false,
            						response : JSON.parse(client.text)
            					};
            					break;
            				case 201:
            					response = {
            						error : false,
            						response : JSON.parse(client.text)
            					};
            					break;
            				case 400:
            				case 401:
            				case 404:
            					response = {
            						error : true,
            						response : JSON.parse(client.text)
            					};
            					break;
            			}
            			return response;
        };

        /**
		 * Check Basket for gift certificates
		 * If they are present, add error to status object
		 *
		 * @param {dw.order.Basket}  basket Basket
		 * @param {dw.system.Status} status Status
         * @return {dw.system.Status} Response
		 */
        self.checkGiftCertificates = function (basket, status) {
            if (!basket.getGiftCertificateLineItems().empty) {
                status.addItem(
                    new system.StatusItem(
                        system.Status.ERROR,
                        '',
                        web.Resource.msg(
                            'basket.giftcertificate.present',
                            'sezzle',
                            null
                        ),
                        ''
                    )
                );
            }
            return status;
        };

        /**
         *
         * @return {string} Response
         */
        self.generateUUID = function () {
			  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
			    return v.toString(16);
			  });
        }

        /**
         *
         * @param {string} field Field
         * @param {string} url URL
         * @return {any} Reponse
         */
        self.getQueryString = function ( field, url ) {
            var href = url;
            var reg = new RegExp( '[?&]' + field + '=([^&#]*)', 'i' );
            var string = reg.exec(href);
            return string ? string[1] : null;
        };

        /**
		 * Get financing program details by product object
		 *
		 * @param {dw.catalog.Product} product Product
		 * @param {string} nameOnly Name Only
         * @return {*} Response
		 */
        self.getFinancingProgramByProduct = function (product, nameOnly) {
            var defaultFinancingProgramName = sezzleData.getDefaultFinancingProgram();
            var financingProgram = {
                'name': product.custom.SezzleFPName,
                'mode': product.custom.SezzleFPMode,
                'priority': product.custom.SezzleFPPriority
            };
            if (empty(product.custom.SezzleFPName)){
                /** check for default FP name **/
                if (defaultFinancingProgramName){
                    financingProgram.name = defaultFinancingProgramName;
                }
                else{
                    return null;
                }
            }
            var currentTime = Date();
            if (!empty(product.custom.SezzleFPStartDate) && product.custom.SezzleFPStartDate < currentTime){
                return null;
            }
            if (!empty(product.custom.SezzleFPEndDate) && product.custom.SezzleFPEndDate > currentTime){
                return null;
            }

            if (empty(product.custom.SezzleFPName)){
                /** check for default FP name **/
                if (defaultFinancingProgramName){
                    financingProgram.name = defaultFinancingProgramName;
                }
                else{
                    return null;
                }
            }
            return nameOnly ? financingProgram.name : financingProgram;
        };

        /**
		 * Get financing program details by category object
		 *
		 * @param {dw.catalog.Category} category Category
		 * @param {Object} Financing program details or null
         * @return {*} Response
		 */
        self.getFinancingProgramByCategory = function (category) {
            var defaultFinancingProgramName = sezzleData.getDefaultFinancingProgram();
            var financingProgram = {
                'name': category.custom.SezzleFPName,
                'mode': category.custom.SezzleFPMode || 'Inclusive',
                'priority': category.custom.SezzleFPPriority || 0
            };
            if (empty(category.custom.SezzleFPName)){
                /** check for default FP name **/
                if (defaultFinancingProgramName){
                    financingProgram.name = defaultFinancingProgramName;
                }
                else{
                    return null;
                }
            }

            var currentTime = Date();
            if (!empty(category.custom.SezzleFPStartDate) && category.custom.SezzleFPStartDate < currentTime){
                return null;
            }
            if (!empty(category.custom.SezzleFPEndDate) && category.custom.SezzleFPEndDate > currentTime){
                return null;
            }
            if (empty(category.custom.SezzleFPName)){
                /** check for default FP name **/
                if (defaultFinancingProgramName){
                    financingProgram.name = defaultFinancingProgramName;
                }
                else{
                    return null;
                }
            }
            return financingProgram;
        };

        /**
		 * Get HasnMap collection contains online categories of product
		 *
		 * @param {dw.catalog.Product} product Product
         * @return {*} Response
		 */
        self.getOnlineCategoriesByProduct = function(product){
            var categoriesCollection = new dwutil.HashMap();
            if (empty(product.onlineCategories) && product.variant) {
                product = product.variationModel.master;
            }
            var productCategoriesIterator = product.onlineCategories.iterator();
            while(productCategoriesIterator.hasNext()){
                var prodCat = productCategoriesIterator.next();
                if (!categoriesCollection.containsKey(prodCat.ID)){
                    categoriesCollection.put(prodCat.ID, prodCat);
                }
            }
            return categoriesCollection;
        };

        /**
		 * Get HasnMap collection contains online categories of all products from basket
		 *
		 * @param {dw.order.Basket} basket Basket
         * @return {*} Response
		 */
        self.getOnlineCategoriesByBasket = function(basket){
            var categoriesCollection = new dwutil.HashMap();
            var productIterator = basket.getProductLineItems().iterator();
            while(productIterator.hasNext()){
                var pli = productIterator.next();
                var product = pli.product;
                if (product.variant) {
                    product = product.variationModel.master;
                }
                categoriesCollection.putAll(self.getOnlineCategoriesByProduct(product));
            }
            return categoriesCollection;
        };

        /**
         *
         * @param {any} pliCollection Collection
         * @return {[]} Response
         */
        self.getFPByPLICollection = function(pliCollection){
            var productIterator = pliCollection.iterator();
            var fpArray = [];
            while(productIterator.hasNext()){
                var pli = productIterator.next();
                var productFP = self.getFinancingProgramByProduct(pli.product);
                if (productFP !== null) {
                    fpArray.push(productFP);
                }
            }
            return fpArray;
        };

        /**
         *
         * @param {any} categoryCollection Category Collection
         * @return {[]} Response
         */
        self.getFPByCategoryCollection = function(categoryCollection){
            var keysIterator = categoryCollection.keySet().iterator(),
                fpArray = [];
            while (keysIterator.hasNext()){
                var category = categoryCollection.get(keysIterator.next());
                if (category){
                    var categoryFP = self.getFinancingProgramByCategory(category);
                    if (categoryFP !== null) {
                        fpArray.push(categoryFP);
                    }
                }
            }
            return fpArray;
        };

        /**
         *
         * @param {Array} fpArray FP Array
         * @return {null|*} Response
         */
        self.getApplicableFinancingProgram = function(fpArray){
            if (fpArray.length == 1){
                if (self.getPromoModalByFinProgramName(fpArray[0].name)){
                    return fpArray[0];
                } else {
                    //if fin program is not mapped
                    return null;
                }
            }
            fpArray = fpArray.sort(function(a,b){
                return a.priority - b.priority;
            });
            if (fpArray[0].priority == fpArray[1].priority && fpArray[0].name != fpArray[1].name){
                //conflict
                return null;
            }
            if (fpArray[0].mode == 'Exclusive'){
                return null;
            }
            if (self.getPromoModalByFinProgramName(fpArray[0].name)){
                return fpArray[0];
            }
            return null;
        };

        /**
		 * Returns applicable financing program name by cart total
         * @param {number} total Total
		 * @returns {string} financing program name
		 */
        self.getFinanceProgramByCartTotal = function(total){
            var map = sezzleData.getCartTotalMapping();
            for (var i = 0; i < map.length; i++){
                if (map[i].split('|').length < 3){
                    continue;
                }
                [minVal, maxVal, finProgram] = map[i].split('|');
                if (empty(minVal)){
                    minVal = Number.NEGATIVE_INFINITY;
                } else {
                    minVal = new Number(minVal);
                    if (isNaN(minVal)){
                        continue;
                    }
                }
                if (empty(maxVal)){
                    maxVal = Number.POSITIVE_INFINITY;
                } else {
                    maxVal = new Number(maxVal);
                    if (isNaN(maxVal)){
                        continue;
                    }
                }
                if (minVal <= total && maxVal >= total && self.getPromoModalByFinProgramName(finProgram)){
                    return finProgram;
                }
            }
            return '';
        };

        /**
		 * Returns applicable financing program name by cart total
		 * @returns {string} financing program name
		 */
        self.getFinanceProgramByDate = function(){
            function strToDate(str){
                var calendar = new Calendar();
                calendar.parseByFormat("2017-01-01", "yyyy-MM-dd");
                calendar.parseByFormat(str, "yyyy-MM-dd");
                return calendar.time;
            }
            var currentDate = new Date();
            var map = sezzleData.getDateRangeMapping();
            var minDate, maxDate, finProgram;
            for (var i = 0; i < map.length; i++){
                if (map[i].split('|').length < 3){
                    continue;
                }
                [minDate, maxDate, finProgram] = map[i].split('|');
                if (empty(minDate)){
                    minDate = new Date(0);
                } else {
                    minDate = strToDate(minDate);
                }
                if (empty(maxDate)){
                    maxDate = strToDate("2999-12-31");
                } else {
                    maxDate = strToDate(maxDate);
                }
                if (minDate <= currentDate && maxDate >= currentDate && self.getPromoModalByFinProgramName(finProgram)){
                    return finProgram;
                }
            }
            return '';
        };

        /**
		 * Returns applicable financing program name by cart total
         * @param {any} customerGroups Customer Groups
		 * @returns {string} financing program name
		 */
        self.getFinanceProgramByCustomerGroup = function(customerGroups){
            var cgIterator = customerGroups.iterator();
            var map = sezzleData.getCustomerGroupMapping();
            while(cgIterator.hasNext()){
                var customerGroup = cgIterator.next();
                for (var i = 0; i < map.length; i++){
                    if (map[i].split('|').length < 2){
                        continue;
                    }
                    [mapCG, finProgram] = map[i].split('|');
                    if (empty(mapCG)){
                        continue;
                    }
                    var mmm = mapCG;
                    if (mapCG == customerGroup.ID && self.getPromoModalByFinProgramName(finProgram)){
                        return finProgram;
                    }
                }
            }

            return '';
        };

        /**
		 * Get financing program details basket content
		 *
		 * @param {dw.order.Basket} basket Basket
         * @returns {*} Response
		 */
        self.getFPNameByBasket = function(basket){
            var fpArray = self.getFPByPLICollection(basket.getProductLineItems());
            var finProgram, cartTotal;

            if (fpArray.length){
                finProgram = self.getApplicableFinancingProgram(fpArray);
                if (finProgram){
                    return finProgram.name;
                }
            }

            var categoriesCollection = self.getOnlineCategoriesByBasket(basket);
            fpArray = self.getFPByCategoryCollection(categoriesCollection);
            if (fpArray.length){
                finProgram = self.getApplicableFinancingProgram(fpArray);
                if (finProgram){
                    return finProgram.name;
                }
            }

            //cart total
            if (basket.totalGrossPrice.available){
                cartTotal = basket.totalGrossPrice;
            } else {
                cartTotal = basket.getAdjustedMerchandizeTotalPrice(true);
            }
            finProgram = self.getFinanceProgramByCartTotal(cartTotal.getValue());
            if (finProgram){
                return finProgram;
            }

            finProgram = self.getFinanceProgramByCustomerGroup(customer.customerGroups);
            if (finProgram){
                return finProgram;
            }

            finProgram = self.getFinanceProgramByDate();
            if (finProgram){
                return finProgram;
            }

            return sezzleData.getDefaultFinancingProgram();
        };

        /**
         *
         * @param {number} categoryID Category ID
         * @param {dw.catalog.Product} product Product
         * @return {null|*|dw.catalog.Product.custom.SezzleFPName|{mode: *, name: *, priority: *}|string} Response
         */
        self.getFPNameForPLP = function(categoryID, product){
            var finProgram = self.getFinancingProgramByProduct(product, true);
            if (finProgram && self.getPromoModalByFinProgramName(finProgram)){
                return finProgram;
            }
            var categoriesCollection = new dwutil.HashMap();
            categoriesCollection.put(categoryID, require('dw/catalog/CatalogMgr').getCategory(categoryID));
            var fpArray = self.getFPByCategoryCollection(categoriesCollection);
            if (fpArray.length){
                finProgram = self.getApplicableFinancingProgram(fpArray);
                return finProgram && finProgram.name;
            }
            return '';
        };

        /**
         *
         * @param {dw.catalog.Product} product Product
         * @return {string|*} Response
         */
        self.getFPNameForPDP = function(product){
            var finProgram = self.getFinancingProgramByProduct(product, true);
            if (finProgram && self.getPromoModalByFinProgramName(finProgram)){
                return finProgram;
            }
            var categoriesCollection = self.getOnlineCategoriesByProduct(product);
            var fpArray = self.getFPByCategoryCollection(categoriesCollection);
            if (fpArray.length){
                finProgram = self.getApplicableFinancingProgram(fpArray);
                return finProgram && finProgram.name;
            }
            return '';
        };

        /**
         *
         * @param {string} fpname FP Name
         * @return {null|*} Response
         */
        self.getPromoModalByFinProgramName = function(fpname){
            var map = system.Site.current.getCustomPreferenceValue("SezzleFPMapping");
            for (var i = 0; i < map.length; i++){
                var elem = map[i].split("|");
                if (elem[0] == fpname){
                    return {
                        promoID: elem[1],
                        modalID: elem[2]
                    }
                }
            }
            return null;
        };

        /**
         *
         * @param {any} productSet Product Set
         * @return {*} Response
         */
        self.calculateProductSetPrice = function(productSet){
            var psProductsIterator = productSet.productSetProducts.iterator();
            var basket = BasketMgr.getCurrentOrNewBasket();
            var psPrice = new Money(0, basket.currencyCode);

            while(psProductsIterator.hasNext()){
                var psProduct = psProductsIterator.next();
                var psProductPriceModel = psProduct.priceModel;
                var promos = PromotionMgr.activeCustomerPromotions.getProductPromotions(psProduct);
                var promotionalPrice;
                if (!empty(promos)){
                    for (var promo in promos){
                        if (promo.getPromotionClass()!= null && promo.getPromotionClass().equals(Promotion.PROMOTION_CLASS_PRODUCT)) {
                            if (psProduct.optionProduct) {
                                promotionalPrice = promo.getPromotionalPrice(psProduct, psProduct.getOptionModel());
                            } else {
                                promotionalPrice = promo.getPromotionalPrice(psProduct);
                            }
                            break;
                        }
                    }
                }
                if (promotionalPrice && promotionalPrice.available){
                    psPrice = psPrice.add(promotionalPrice);
                } else if (psProductPriceModel.price.available){
                    psPrice = psPrice.add(psProductPriceModel.price);
                } else if (psProductPriceModel.minPrice.available){
                    psPrice = psPrice.add(psProductPriceModel.minPrice);
                }
            }
            return psPrice;
        };

        /**
         *
         * @param {dw.order.Basket} basket Basket
         * @return {boolean} Response
         */
        self.checkBasketTotalRange = function(basket){
            var basketTotal;
            if (basket.totalGrossPrice.available){
                basketTotal = basket.totalGrossPrice;
            } else {
                basketTotal = basket.getAdjustedMerchandizeTotalPrice(true).add(basket.giftCertificateTotalPrice);
            }
            var paymentMinTotal = sezzleData.getSezzlePaymentMinTotal(),
                paymentMaxTotal = sezzleData.getSezzlePaymentMaxTotal();
            if (paymentMinTotal && basketTotal.value < paymentMinTotal){
                return false;
            }
            if (paymentMaxTotal && basketTotal.value > paymentMaxTotal){
                return false;
            }
            return true;
        }
    };

    module.exports = new Utils();
}());
