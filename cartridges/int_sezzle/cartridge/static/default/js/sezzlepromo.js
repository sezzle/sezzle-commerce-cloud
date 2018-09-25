(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
    	factory()();
  }
}(this, function () {
    return function () {
    	$(document).on('initSezzle', function(){
    		
    		var $this = $(this),
    			$promo = $this.find('.js-sezzle-promo'),
    			$text = $promo.find('.js-sezzle-text');
    			
    		if($promo.length){
	    		sezzle.ui.ready(function() {
	        		sezzle.ui.payments.get_estimate({
	    	    		'months' :  parseInt($promo.data('sezzle-month')),
	    	    		'apr' : $promo.data('sezzle-apr'),
	    	    		'amount' : parseInt($promo.data('sezzle-amount'))
	    	    	}, function (estimates) {
	    	    		var text = $promo.data('sezzle-text'),
	    	    			dollars = 0|(estimates.payment / 100),
	        	    	 	cents = (estimates.payment % 100),
	        	    	    cents = cents < 10 ? "0"+cents : cents+"";   	    		
	    	    		$text.text(text.replace("{dollars}", dollars).replace("{cents}", cents));
	    	        });
	        	});
	        }	
    	}).trigger('initSezzle');
    	    	
    	$(document).ajaxComplete(function(event, request, settings) {
    		if (settings.url.indexOf('Product-Variation') !== -1) {
    			$(document).trigger('initSezzle');
    		} 
    	});

    	$(document).on('click', '.js-sezzle-text', function(e) {
        	event.preventDefault();
        	new sezzle.widgets.learn_more();
    	});
    };
}));