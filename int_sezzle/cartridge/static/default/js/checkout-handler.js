$(function(){
	$(document).on("click", ".order-summary-footer button.button-fancy-large", function(e){
		if (!$('#vcn-data').data('sezzleselected') || window.vcn_approved){
			return true;
		}
		var checkoutObject = $('#vcn-data').data('vcndata');

		if ($('#vcn-data').data('enabled')){
			var $thisBtn = $(this);
			e.preventDefault();
			delete checkoutObject.metadata.mode;
			sezzle.checkout.open_vcn({
				success: function(card_details) {
					$.ajax({
						url: $('#vcn-data').data('updateurl') + '?' + $('#vcn-data').data('csrfname') + '=' + $('#vcn-data').data('csrftoken'),
						data: card_details,
						dataType: "json",
						method: "POST",
						success: function(response){
							if (!response.error){
								window.vcn_approved = true;
								$thisBtn.click();
							} else if ($("div.error-form").length){
								$("div.error-form").text($('#vcn-data').data('errormessages')["default"]);
							} else {
								$("table.item-list").before("<div class=\"error-form\">" + $('#vcn-data').data('errormessages')["default"] + "</div>");
							}
						},
						error: function(error){
							$("table.item-list").before("<div class=\"error-form\">Error in establishing connection with Sezzle VCN service!</div>");
							return;
						}
					});
				},
				error: function(error) {
					if (error.reason == "canceled" || error.reason == "closed"){
						window.location.assign($('#vcn-data').data('errorurl'));
						return;
					}
					var errorText = "";
					var errorCollection = $('#vcn-data').data('errormessages');
					errorText = errorCollection[error.reason] || errorCollection["default"];
					if ($("div.error-form").length){
						$("div.error-form").text(errorText);
					} else {
						$("table.item-list").before("<div class=\"error-form\">" + errorText + "</div>");
					}
				},
				checkout_data: checkoutObject
			});
		} else if (checkoutObject.metadata.mode == 'modal'){
				e.preventDefault();
				sezzle.checkout(checkoutObject);
				sezzle.checkout.open({
					onFail: function(error) {
						window.location.assign(checkoutObject.merchant.user_cancel_url);
					},
					onSuccess: function(data) {
						var csrftoken = $('#vcn-data').data('csrfname') + '=' + $('#vcn-data').data('csrftoken');
						var url = checkoutObject.merchant.user_confirmation_url + '?checkout_token=' + data.checkout_token + '&' + csrftoken;
						window.location.assign(url);
					}
				 });
			} else {
				e.preventDefault();
				var csrftoken = $('#vcn-data').data('csrfname') + '=' + $('#vcn-data').data('csrftoken');
				checkoutObject.checkout_complete_url = checkoutObject.checkout_complete_url + '?order_reference_id=' + checkoutObject.order_reference_id + '&' + csrftoken;
				sezzle.checkout(checkoutObject);
				console.log("redirecting to sezzle site")
				var url = "https://sandbox.checkout.sezzle.com/?id=2"
				var checkout_create_url = "https://staging.gateway.sezzle.com/v1/checkouts/"
				var checkout_auth_url = "https://staging.gateway.sezzle.com/v1/authentication/"
				// window.location.assign(url)
//				sezzle.checkout.post();
					var auth_object = {
					'public_key' : public_key,
					'private_key' : private_key,
				}
					$.ajax({
						url: checkout_auth_url,
						data: JSON.stringify(auth_object),
						dataType: "json",
						method: "POST",
						contentType: 'application/json',
						success: function(response){
							console.log(response)
							
							
							$.ajax({
								url: checkout_create_url,
								data: JSON.stringify(checkoutObject),
								dataType: "json",
								method: "POST",
								contentType: 'application/json',
								headers: {
							        'Authorization':'Bearer ' + response.token,
							    },
								success: function(response){
									console.log(response)
									window.location.assign(response.checkout_url)
									
								},
								error: function(error){
			                        console.log(error)
									$("table.item-list").before("<div class=\"error-form\">Error in establishing connection with Sezzle VCN service!</div>");
									return;
								}
							});
						},
						error: function(error){
	                        console.log(error)
							$("table.item-list").before("<div class=\"error-form\">Error in establishing connection with Sezzle VCN service!</div>");
							return;
						}
					});
				
			}
		});
	
	if (typeof sezzle !== "undefined"){
		sezzle.ui.ready(
		    function() {
		        sezzle.ui.error.on("close", function(){
		            window.location.replace($('#vcn-data').data('errorurl'));
		        });
		    }
		);
	}
	
});