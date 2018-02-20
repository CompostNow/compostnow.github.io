(function() {
    "use strict";

    var jqLoaded = false, gmLoaded = false;
    var feedId = '1FgExPunpODQWdmGGlGBfO2YoqCgk3UNLAwnwmB2ToyA';
    var feedUrl = 'https://spreadsheets.google.com/feeds/list/'+feedId+'/1/public/values?alt=json';
    var map, locations;
    var lastZoom;
    var selectedLocation;
    var geocoder;
    var positionMarker;
    var distanceRingsMarker;

    var distanceRingsCenterPoints = {6: 49.346522949469744, 7: 98.69304589893949, 8: 197.38609179787898, 9: 394.77218359575795, 10: 526.362911461, 11: 421.090329169, 12: 842.180658338};

    function asyncLoadScript(alreadyLoaded, url, callback) {
        if (alreadyLoaded) {
            callback();
            return;
        }

        var script   = document.createElement('script'),
            head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;

        script.src = url;
        script.async = true;
        script.onload = script.onreadystatechange = function() {
            if(!script.readyState || /loaded|complete/.test( script.readyState ) ) {
                script.onload = script.onreadystatechange = null;
                script = undefined;

                callback();
            }
        }

        head.insertBefore(script, head.firstChild);
    }

    // Get jQuery if not already loaded
    asyncLoadScript(window.jQuery, 
        "//ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js", 
        handleFrameworkReady);

    // Get Google Maps if not already loaded
    asyncLoadScript(typeof google === 'object' && typeof google.maps === 'object', 
        "//maps.googleapis.com/maps/api/js?key=AIzaSyDwO35DrIZenuYV0NfJwLdbU4sKfv21raw", 
        handleApiReady);

    function handleFrameworkReady() {
        jqLoaded = true;
        load();
    }
    function handleApiReady() {
        gmLoaded = true;
        load();
    }

    function load() {
        if (!jqLoaded || !gmLoaded) {
            // Missing prerequisites
            return;
        }

        $(document).ready(function() {
            // Let's go!

            var mapContainer = $('#compost-map');

            // Load map
            var mapWrapper = mapContainer.find('.map-wrapper');
            initializeMap();

            // Adjust markers based on zoom
            google.maps.event.addListener(map, 'zoom_changed', function() {
                var zoom = map.getZoom();

                if (zoom < 5) {
                    map.setZoom(5);
                    return;
                }

                var newScale;
                if ((lastZoom > 7 || ! lastZoom) && zoom <= 7) {
                    newScale = 0.1;
                }
                else if (lastZoom < 10 && zoom >= 10) {
                    newScale = 0.6;
                }
                else if ((lastZoom < 8 || lastZoom > 9) && (zoom > 7 && zoom < 10)) {
                    newScale = 0.4;
                }

                lastZoom = zoom;

                updateDistanceRingsMarker();

                if (!newScale) return;

                $.each(locations, function(i, location) {

                    if (!location.marker) return;

                    var icon = JSON.parse(JSON.stringify(location.marker.getIcon()));
                    icon.scale = newScale;
                    location.marker.setIcon(icon);

                });
                
            });

            // Markers
            var icon = {
                path: 'M28.034,0C12.552,0,0,12.552,0,28.034S28.034,100,28.034,100s28.034-56.483,28.034-71.966S43.517,0,28.034,0z',
                anchor: new google.maps.Point(28.034, 100),
                fillColor: '#2b62bf',
                fillOpacity: 1,
                strokeColor: '#0046ad',
                strokeWeight: 2,
                scale: 0.4,
            };

            // Load data feed
            $.get(feedUrl, function(data) {
                locations = data.feed.entry;
                var location;
                var bounds = new google.maps.LatLngBounds();
                for (var i = 0; i < locations.length; i++) {    //TODO: Consider replacing with $.each();
                    location = locations[i];
                    location.getVal = function(key) {
                        return this['gsx$'+key] ? this['gsx$'+key]['$t'] : null;
                    };

                    var point = new google.maps.LatLng(location.getVal('lat'), location.getVal('lng'));
                    bounds.extend(point);

                    var marker = new google.maps.Marker({
                        position: point,
                        map: map,
                        title: location.getVal('name'),
                        icon: icon,
                    });

                    location.marker = marker;
                    google.maps.event.addListener(marker, 'click', function(location) {
                        return function() {
                            if (typeof(event) != 'undefined') event.stopPropagation();    //TODO: Test in FF: http://shades-of-orange.com/post/Stop-Propagation-of-Google-Maps-Marker-Click-Event-a-Solution!#id_bfb7183e-9e03-417c-a8dc-6f9ebe95892b
                            selectLocation(location);
                        }
                    }(location));
                }

                // Zoom on all markers
                map.fitBounds(bounds);

            }).fail(function(x, error, o) {
                // TODO: handle errors
            });

            // Add filters
            var filters = $('#compost-map .filters');

            // Filter near me
            filters.find('.near-me').click(function() {
                if (navigator.geolocation) {
                    var button = $(this);
                    filters.find('.near-zip').removeClass('active').val('');
                    button.addClass('active');
                    navigator.geolocation.getCurrentPosition(function(position) {
                        var point = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                        findNearPosition(point);
                    }, function() {
                        button.removeClass('active');
                        alert("We were unable to locate you. Please search by Zip code.");
                        filters.find('.near-zip').focus();
                    });
                } else {
                    alert("Your browser doesn't support geolocation. Please search by Zip code.");
                    filters.find('.near-zip').focus();
                }
            });

            // Filter near Zip code
            $.fn.restrict = function(regExp) {
                function restrictCharacters(myfield, e, restrictionType) {
                    var code = e.which;
                    var character = String.fromCharCode(code);
                    // if they pressed esc... remove focus from field...
                    if (code==27) { this.blur(); return false; }
                    // ignore if they are press other keys
                    // strange because code: 39 is the down key AND ' key...
                    // and DEL also equals .
                    if (!e.originalEvent.ctrlKey && code!=9 && code!=8 && code!=36 && code!=37 && code!=38 && (code!=39 || (code==39 && character=="'")) && code!=40) {
                        return character.match(restrictionType);
                    }
                }
                this.keypress(function(e){
                    if (!restrictCharacters(this, e, regExp)) {
                        e.preventDefault();
                    }
                });
            };
            filters.find('.near-zip').keyup(function() {
                var input = $(this);
                if (input.val().length == 5) {
                    filters.find('.near-me').removeClass('active');
                    input.addClass('active');
                    input.blur();

                    if (!geocoder) {
                        geocoder = new google.maps.Geocoder();
                    }
                    geocoder.geocode({'address': input.val()}, function(results, status) {
                        if (status == 'OK') {
                            findNearPosition(results[0].geometry.location);
                        }
                        else {
                            alert("Sorry, we couldn't pinpoint your Zip code.");
                        }
                    });
                }
            }).restrict(/\d/g);

            // Shorten zip code filter placeholder on small screens
            if (window.innerWidth <= 320) {
                filters.find('.near-zip').attr('placeholder', 'Zip');
            }

            // Handle type filtering
            filters.find('.buttons button').click(function() {
                var el = $(this);
                var type = el.data().type;

                if ('all' == type) {
                    el.addClass('active');
                    el.siblings().removeClass('active');
                    filterLocationType();
                }
                else {
                    //handle additive filters
                    if (el.hasClass('active')) {
                        if (el.siblings(':not(.filter-all).active').length == 0) {
                            // remove only filter, same as remiving all filters
                            el.siblings('.filter-all').click();
                        }
                        else {
                            // remove just this filter
                            el.removeClass('active');

                            var filters = [];
                            var activeSibilings = el.siblings(':not(.filter-all).active');
                            for (var i=0; i<activeSibilings.length; i++) {
                                filters.push($(activeSibilings[i]).data().type)
                            }
                            filterLocationType(filters);
                        }
                    }
                    else {
                        // add filter
                        el.siblings('.filter-all').removeClass('active');
                        el.addClass('active');

                        var filters = [type];
                        var activeSibilings = el.siblings(':not(.filter-all).active');
                        for (var i=0; i<activeSibilings.length; i++) {
                            filters.push($(activeSibilings[i]).data().type)
                        }
                        filterLocationType(filters);
                    }
                }
            });

            // Maximize map
            var onResize = function () {
                if (filters.width() >= 800) {
                    filters.addClass('wide');
                }
                else {
                    filters.removeClass('wide');
                }

                mapWrapper.height(mapContainer.parent().innerHeight() - (filters.height() + 15));
                google.maps.event.trigger(map, "resize");
            };
            onResize();
            $(window).resize(onResize);

            // Add details pane
            var detailsPane = $('#compost-map .details');

            detailsPane.find('.sta_certified_compost').click(function() {
                $('#compost-map .details .sta-popup').fadeIn();
            });
            detailsPane.find('span.close').click(function() {
                $(this).parent('.popup').hide();
            });
            detailsPane.find('.btn-website').click(function() {
                var url = selectedLocation.getVal('website');
                window.open(url, '_blank');
            });
            detailsPane.find('.btn-phone').click(function() {
                var phone = selectedLocation.getVal('phone');
                window.open('tel:'+phone, '_self');
            });
            detailsPane.find('.btn-email').click(function() {
                var email = selectedLocation.getVal('email');
                window.location.href = 'mailto:'+email;
            });
            detailsPane.find('.btn-facebook').click(function() {
                var url = selectedLocation.getVal('facebook');
                window.open(url, '_blank');
            });
            detailsPane.find('.btn-directions').click(function() {
                var position = '';
                if (positionMarker) {
                    position = positionMarker.getPosition().lat()+','+positionMarker.getPosition().lng();
                }

                var address = selectedLocation.getVal('fulladdress');
                window.open('https://www.google.com/maps/dir/'+position+'/'+address, '_blank');
            });

            $('#compost-map .details div.close').click(clearSelectedLocation);

            // Close details pane by clicking on map
            google.maps.event.addListener(map, 'click', clearSelectedLocation);

            // Add info button
            mapWrapper.find('.info svg').click(function() {
                $('#compost-map .info .info-popup').fadeIn();
            });
            mapWrapper.find('.info span.close').click(function() {
                $(this).parent('.popup').hide();
            });

        });
    }

    function initializeMap() {
        // Define map
        var mapOptions = {
            center: new google.maps.LatLng(35.78046, -78.63908),
            zoom: 8,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControlOptions: { style: google.maps.ZoomControlStyle.SMALL },
            styles: [{
                        "stylers": [
                            { "saturation": -75 }
                        ]
                    }],
        };
        map = new google.maps.Map($("#compost-map .map")[0], mapOptions);
    }

    function findNearPosition(position) {
        // zoom to nearby locations
        map.setCenter(position);
        map.setZoom(10);

        // add position marker to map & distance rings
        if (!positionMarker) {
            var positionIcon = {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#02bac8',
                fillOpacity: 1,
                strokeColor: '#00a1ad',
                strokeWeight: 10,
                strokeOpacity: 0.5,
                scale: 20,
            };

            positionMarker = new google.maps.Marker({
                position: position,
                clickable: false,
                map: map,
                title: 'Approximate position',
                icon: positionIcon,
                zIndex: 0,
            });

            distanceRingsMarker = new google.maps.Marker({
                position: position,
                clickable: false,
                map: null,
                zIndex: 0,
            });
            updateDistanceRingsMarker();
        }
        else {
            positionMarker.setPosition(position);
            distanceRingsMarker.setPosition(position);
        }
    }

    function updateDistanceRingsMarker() {
        if (distanceRingsMarker) {
            var zoom = map.getZoom();
            if (zoom < 6 || zoom > 12) {
                distanceRingsMarker.setMap(null);
            }
            else {
                var center = distanceRingsCenterPoints[zoom];
                distanceRingsMarker.setIcon({
                    url: 'distance-rings-z'+zoom+'.svg',
                    anchor: new google.maps.Point(center, center),
                });
                distanceRingsMarker.setMap(map);
            }
        }
    }

    function filterLocationType(filters) {
        var bounds = new google.maps.LatLngBounds();
        var show;
        for (var i = 0; i < locations.length; i++) {
            var location = locations[i];

            if (!filters) {
                show = true;
            }
            else {
                show = false;
                for (var j = 0; j < filters.length; j++) {
                    if (location.getVal('type'+filters[j]) == 'y') {
                        show = true;
                        break;
                    }
                }
            }

            if (show) {
                location.marker.setMap(map);
                bounds.extend(location.marker.position);
            }
            else {
                location.marker.setMap(null);
            }
        }
        map.fitBounds(bounds);

        if (selectedLocation && !selectedLocation.marker.getMap()) {
            clearSelectedLocation();
        }
    }

    function changeMarkerSelection(marker, isSelected) {
        var icon = JSON.parse(JSON.stringify(marker.getIcon()));
        icon.strokeWeight = isSelected ? 10 : 2;
        icon.strokeOpacity = isSelected ? 0.5 : 1;
        marker.setIcon(icon);
    }

    function clearSelectedLocation() {
        if ($("#compost-map .details").is(":visible")) {
            $("#compost-map .details").animate({width:'toggle'},350);
            changeMarkerSelection(selectedLocation.marker, false);
        }

        selectedLocation = null;

        $('.gm-style-iw + div').click();    // Close Google Places infowindows
    }

    function selectLocation(location) {
        if (selectedLocation) {
            changeMarkerSelection(selectedLocation.marker, false);
        }

        selectedLocation = location;

        changeMarkerSelection(location.marker, true);

        var data;

        // name & type
        $('#compost-map .details .name').text(location.getVal('name')).removeClass().addClass('name ');

        // address
        var address = location.getVal('addressline1');
        data = location.getVal('addressline2');
        if (data && '' != data) {
            address += '<br>'+data;
        }
        address += '<br>'+location.getVal('city') +', '+ location.getVal('state') + ' ' + location.getVal('zip');
        $('#compost-map .details .address').html(address);

        // website
        data = location.getVal('website');
        if (data) {
            var el = $('<a href="'+data+'" target="_blank"></a>');
            el.append(el[0].hostname.replace('www.', ''));
            $('#compost-map .details .website').html(el).show();
            $('#compost-map .details .btn-website').show();
        }
        else {
            $('#compost-map .details .website').hide();
            $('#compost-map .details .btn-website').hide();
        }

        // phone
        data = location.getVal('phone');
        if (data) {
            $('#compost-map .details .phone').text(data).show();
            //$('#compost-map .details .phone').html('<a href="tel:'+data+'">'+data+'</a>').show();
            $('#compost-map .details .btn-phone').show();
        }
        else {
            $('#compost-map .details .phone').hide();
            $('#compost-map .details .btn-phone').hide();
        }

        // email
        data = location.getVal('email');
        if (data) {
            $('#compost-map .details .btn-email').show();
        }
        else {
            $('#compost-map .details .btn-email').hide();
        }

        // facebook
        data = location.getVal('facebook');
        if (data) {
            $('#compost-map .details .btn-facebook').show();
        }
        else {
            $('#compost-map .details .btn-facebook').hide();
        }

        if (!$("#compost-map .details").is(":visible")) {
            $("#compost-map .details").animate({width:'toggle'},350);
            $('#compost-map .details .scroll')[0].scrollTop = 0;
        }

        // products
        $("#compost-map .details .products div").hide();
        data = location.getVal('typebag');
        if (data && 'y' == data.toLowerCase()) {
            $("#compost-map .details .products div[data-type='bag']").show();
        }
        data = location.getVal('typebulk');
        if (data && 'y' == data.toLowerCase()) {
            $("#compost-map .details .products div[data-type='bulk']").show();
        }
        data = location.getVal('typedeliveryonly');
        if (data && 'y' == data.toLowerCase()) {
            $("#compost-map .details .products div[data-type='delivery-only']").show();
        }

    }

})();
