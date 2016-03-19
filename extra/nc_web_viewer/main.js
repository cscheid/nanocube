function track_extent(accessor)
{
    var min, max, held = false;
    var result = {
        hold: function() {
            
        },
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
    var log = true;
    var d3_colormap = d3.scale.linear()
            .range([d3.hcl(-160, 40, 50),
                    d3.hcl(0, 0, 50),
                    d3.hcl(20, 40, 50)]);
    var opacityMap = d3.scale.linear()
            .range([0, 1, 1])
            .clamp(true);
    
    function count(v) { return v.count; }
    function slope(v) { return v.parameters[0]; }

    var count_extent_tracker = track_extent(count);
    var slope_extent_tracker = track_extent(slope);
    
    function colormap(v) {
        var s = slope(v), c = count(v);
        var smin = slope_extent_tracker.extent()[0], smax = slope_extent_tracker.extent()[1];
        var cmin = count_extent_tracker.extent()[0], cmax = count_extent_tracker.extent()[1];
        
        var absmax = Math.max(Math.abs(smin), Math.abs(smax));
        d3_colormap.domain([-absmax, 0, absmax]);

        if (log) {
            cmin = Math.log(cmin + 1);
            cmax = Math.log(cmax + 1);
            c = Math.log(c + 1);
        }
        opacityMap.domain([cmin, cmin * 2/3 + cmax * 1/3, cmax]);
        var t = d3.rgb(d3_colormap(s));
        return { r: +t.r, g: +t.g, b: +t.b, a: opacityMap(c)*255 };
    }

    var modelOptions = {
        coarseLevels: 1,
        mapOptions: {
            resetBounds: function() {
                count_extent_tracker.reset();
                return slope_extent_tracker.reset();
            },
            updateBounds: function(data) {
                return count_extent_tracker.update(data) ||
                    slope_extent_tracker.update(data);
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
