function track_extent(accessor)
{
    var min, max;
    var result = {
        reset: function() {
            min = Infinity;
            max = -Infinity;
        }, update: function(d) {
            var old_max = max;
            var old_min = min;
            var new_extent = d3.extent(d, function(d) { return accessor(d.v); });
            var new_min = new_extent[0], new_max = new_extent[1];
            min = Math.min(new_min, old_min);
            max = Math.max(new_max, old_max);
            return ((new_max !== old_max && old_max !== -Infinity) ||
                    (new_min !== old_min && old_min !== Infinity));
            
        }, extent: function() {
            return [min, max];
        }
    };
    result.reset();
    return result;
}

function getURLParameter(sParam){
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++){
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam){
	    return sParameterName[1];
        }
    }
    throw new Error("missing URL parameter " + sParam);
};

function init(config)
{
    var log = false;
    var d3_colormap = d3.scale.linear()
        .domain([0, 0.333, 0.666, 1])
        .range(["red", "red", "yellow", "white"]);
    var opacityMap = d3.scale.linear()
            .domain([0, 0.333])
            .range([0, 1])
            .clamp(true);
    
    function count(v) { return v.count; }

    var count_extent_tracker = track_extent(count);
    
    function colormap(v) {
        v = v.count;
        var vmin = count_extent_tracker.extent()[0], vmax = count_extent_tracker.extent()[1];
        if (log) {
            vmin = Math.log(vmin + 1);
            vmax = Math.log(vmax + 1);
            v = Math.log(v + 1);
        }
        var normalized_v = (v - vmin) / (vmax - vmin);
        var t = d3.rgb(d3_colormap(normalized_v));
        return { r: +t.r, g: +t.g, b: +t.b, a: opacityMap(normalized_v)*255 };
    }

    var modelOptions = {
        coarseLevels: 1,
        mapOptions: {
            resetBounds: function() {
                return count_extent_tracker.reset();
            },
            updateBounds: function(data) {
                return count_extent_tracker.update(data);
            }, on: function(event) {
                switch (event) {
                case "toggleLog":
                    log = !log;
                    break;
                }
            }, colormap: colormap
            , selColor: d3.rgb(255, 128, 0)
        },
        valueFunction: function(v) {
            return v.count;
        },
        processValues: function(v) {
            // We're mutating results from the request cache, which is *fine*,
            // except that we don't want to do it more than once.
            if (v.val.count !== void 0) {
                return;
            }
            v.val = nc_regression.fit(v.val);
        },
        countFunction: count
    };

    initPage(config);
    initNanocube(config, modelOptions);
}

function main() {
    var conf = getURLParameter('config') ||
            window.location.hash.substring(1) || 'config';
    
    $.getJSON(conf+".json", init)
        .fail(function(){throw new Error("Fail to get or parse "+conf);});
}
