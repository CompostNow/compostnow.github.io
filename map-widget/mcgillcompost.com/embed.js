// Embed Map
(function() {
	"use strict";
	
	var mapUrl = 'embed.html?r=3';
	if (window.location.hostname != 'localhost' && window.location.port != 8000) mapUrl = 'https://compostnow.github.io/map-widget/mcgillcompost.com/' + mapUrl;
	document.write('<iframe id="compost-map" src="'+mapUrl+'" style="width: 100%; height: 100%; min-height: 475px; border: none" frameborder="0">Your browser does not support frames.</iframe>');
})();