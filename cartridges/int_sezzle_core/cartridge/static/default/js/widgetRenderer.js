$(document).ready(function() {
  var currentLocation = window.location.href;
  var price = $('.sales>.value').text();
  var widgetAlignment = 'center';
  if (currentLocation.indexOf('cart') >= 0) {
	  var price = $('.grand-total').text();
	  widgetAlignment = 'right';
  }
  if (price) {
	  var renderSezzle = new AwesomeSezzle({ 
	      amount: price,
	      alignment: widgetAlignment
	  });
	  renderSezzle.init();
	  console.log('Sezzle Widget has been rendered.');
	  return;
  } 
  console.log('Sezzle Widget is not rendering because of no price.');
  return;
});
  