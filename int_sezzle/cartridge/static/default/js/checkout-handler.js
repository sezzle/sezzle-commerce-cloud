//$(function(){
//	$(document).on("click", ".order-summary-footer button.button-fancy-large", function(e){
//		if (!$('#vcn-data').data('sezzleselected') || window.vcn_approved){
//			return true;
//		}
//		var checkoutObject = $('#vcn-data').data('vcndata');
//		var public_key = $('#vcn-data').data('publickey');
//		var private_key = $('#vcn-data').data('privatekey');
//
//		
//		if (checkoutObject.metadata.mode == 'modal'){
//				e.preventDefault();
//				sezzle.checkout(checkoutObject);
//				sezzle.checkout.open({
//					onFail: function(error) {
//						window.location.assign(checkoutObject.merchant.user_cancel_url);
//					},
//					onSuccess: function(data) {
//						var csrftoken = $('#vcn-data').data('csrfname') + '=' + $('#vcn-data').data('csrftoken');
//						var url = checkoutObject.merchant.user_confirmation_url + '?checkout_token=' + data.checkout_token + '&' + csrftoken;
//						window.location.assign(url);
//					}
//				 });
//			} else {
//				e.preventDefault();
//				var csrftoken = $('#vcn-data').data('csrfname') + '=' + $('#vcn-data').data('csrftoken');
//				checkoutObject.checkout_complete_url = checkoutObject.checkout_complete_url + '?order_reference_id=' + checkoutObject.order_reference_id + '&' + csrftoken;
////				sezzle.checkout(checkoutObject);
//				console.log("redirecting to sezzle site")
//				var url = "https://sandbox.checkout.sezzle.com/?id=2"
//				var checkout_create_url = "https://staging.gateway.sezzle.com/v1/checkouts/"
//				var checkout_auth_url = "https://staging.gateway.sezzle.com/v1/authentication/"
//				// window.location.assign(url)
////				sezzle.checkout.post();
//					var auth_object = {
//					'public_key' : public_key,
//					'private_key' : private_key,
//				}
//					$.ajax({
//						url: checkout_auth_url,
//						data: JSON.stringify(auth_object),
//						dataType: "json",
//						method: "POST",
//						contentType: 'application/json',
//						success: function(response){
//							console.log(response)
//							
//							
//							$.ajax({
//								url: checkout_create_url,
//								data: JSON.stringify(checkoutObject),
//								dataType: "json",
//								method: "POST",
//								contentType: 'application/json',
//								headers: {
//							        'Authorization':'Bearer ' + response.token,
//							    },
//								success: function(response){
//									console.log(response)
//									window.location.assign(response.checkout_url)
//									
//								},
//								error: function(error){
//			                        console.log(error)
//									$("table.item-list").before("<div class=\"error-form\">Error in establishing connection with Sezzle VCN service!</div>");
//									return;
//								}
//							});
//						},
//						error: function(error){
//	                        console.log(error)
//							$("table.item-list").before("<div class=\"error-form\">Error in establishing connection with Sezzle VCN service!</div>");
//							return;
//						}
//					});
//				
//			}
//		});
//	
//	if (typeof sezzle !== "undefined"){
//		sezzle.ui.ready(
//		    function() {
//		        sezzle.ui.error.on("close", function(){
//		            window.location.replace($('#vcn-data').data('errorurl'));
//		        });
//		    }
//		);
//	}
//	
//});