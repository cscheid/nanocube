function initPage(config){
    //set the title
    $(document).attr('title', config.title);

    var contents = [];
    for (var d in config.div){
	//insert the divs
	$("#maincontent").prepend("<div id="+ d +"></div>");

	var div = $("#"+d);
	//set CSS
	div.css(config.div[d]);

	if(div.height() <  1){
	    contents.push(div);
	}
    }

    if ('css' in config){
	var s = document.styleSheets[document.styleSheets.length-1];
	config.css.forEach(function(d){
	    s.insertRule(d,s.cssRules.length);
	});
    }    
    
    $(window).on("resize load orientationchange", function(){
	contents.forEach(function(div){
	    //this will not work for multi maps
	    div.height($("#nc-container").height());
	    div.width($("#nc-container").width());
	});
    });

    $(window).resize(); //force resize on the first call
}


function initNanocube(config){
    var nc = new Nanocube({
	url:config.url,
	ready: function(nc){
	    //create the model
	    var model = new Model({
		nanocube: nc,
		config: config,
		tilesurl:config.tilesurl,
		heatmapmaxlevel:config.heatmapmaxlevel,
                value_function: function(v) { return v.count; }
	    });

	    //set the initial view
	    for(var sp in config.latlonbox.min){
		model.spatial_vars[sp]
		    .map.fitBounds([config.latlonbox.min[sp],
				    config.latlonbox.max[sp]]);
	    }
	},
        process_values: function(v) {
            // We're mutating results from the request cache, which is *fine*,
            // except that we don't want to do it twice.
            if (v.val.count !== void 0) {
                return;
            }
            v.val = nc_regression.fit(v.val);
        }
    });
};
