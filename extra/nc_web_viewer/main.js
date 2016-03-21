function track_extent(accessor)
{
    var min, max, held = false;
    var all_data = [];
    var result = {
        hold: function() {
        },
        reset: function() {
            min = Infinity;
            max = -Infinity;
            all_data = [];
        }, update: function(d) {
            var old_max = max;
            var old_min = min;
            all_data.push.apply(all_data, d.map(function(d) { return accessor(d.v); }));
            all_data.sort();
            // var new_extent = d3.extent(d, function(d) { return accessor(d.v); });

            var new_min = all_data[~~(all_data.length/20)],
                new_max = all_data[~~(19*all_data.length/20)];
            min = Math.min(new_min, old_min);
            max = Math.max(new_max, old_max);
            console.log(min, max);
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
    var colors = colorbrewer.Spectral[9].slice().reverse();
    var d3_colormap = d3.scale.linear()
            .range(colors)
            .clamp(true);
    var opacityMap = d3.scale.linear()
            .range([0, 1, 1])
            .clamp(true);
    
    function count(v) { return v.count; }
    function slope(v) { return v.parameters[0]; }

    var count_extent_tracker = track_extent(count);
    var slope_extent_tracker = track_extent(slope);
    
    function colormap(v) {
        var s = slope(v), c = count(v);
        var cmin = count_extent_tracker.extent()[0], cmax = count_extent_tracker.extent()[1];

        if (log) {
            cmin = Math.log(cmin + 1);
            cmax = Math.log(cmax + 1);
            c = Math.log(c + 1);
        }
        opacityMap.domain([cmin, cmin * 2/3 + cmax * 1/3, cmax]);
        var t = d3.rgb(d3_colormap(s));
        return { r: +t.r, g: +t.g, b: +t.b, a: opacityMap(c)*255 };
    }

    function processValues(v) {
        // We're mutating results from the request cache, which is *fine*,
        // except that we don't want to do it more than once.
        if (v.val.count !== void 0) {
            return;
        }
        v.val = nc_regression.fit(v.val);
    };
    
    var modelOptions = {
        coarseLevels: 1,
        mapOptions: {
            resetBounds: function() {
                count_extent_tracker.reset();
                return slope_extent_tracker.reset();
            },
            updateBounds: function(data) {
                var changedCount = count_extent_tracker.update(data),
                    changedSlope = slope_extent_tracker.update(data);
                if (changedSlope) {
                    var smin = slope_extent_tracker.extent()[0], smax = slope_extent_tracker.extent()[1];
                    var absmax = Math.max(Math.abs(smin), Math.abs(smax));
                    d3_colormap.domain([-absmax, -absmax*0.75, -absmax * 0.5, -absmax * 0.25,
                                        0,
                                        absmax * 0.25, absmax * 0.5, absmax * 0.75,
                                        absmax]);
                    console.log(d3_colormap.domain(), absmax);
                    leg.redraw();
                }
                return changedSlope || changedCount;
            }, colormap: colormap
            , selColor: d3.rgb(255, 128, 0)
        },
        valueFunction: function(v) {
            return v.count;
        },
        processValues: processValues,
        countFunction: count
    };

    var model;
    var sp_view, geomap, heatmap;
    
    initPage(config);
    initNanocube(config, modelOptions, function(model_) {
        model = model_;
        sp_view = spatial_view({
            divId: "location",
            variable: model.spatial_vars.location,
            config: config,
            model: model,
            processValues: modelOptions.processValues,
            nanocubeLayer: {
                coarseLevels: 4,
                opacity: 1.0,
                model: model,
                mapOptions: modelOptions.mapOptions
            }
        });
        geomap = sp_view.geoMap;
        heatmap = sp_view.nanocubeLayer;
        model.on("resultsChanged", function() {
            ui.update();
        });
    });

    //////////////////////////////////////////////////////////////////////////
    // UI

    function increaseRadius() { sp_view.radius(sp_view.radius() + 1); };
    function decreaseRadius() { sp_view.radius(sp_view.radius() - 1); };
    function increaseGeoOpacity() { sp_view.geoOpacity(sp_view.geoOpacity() + 0.1); }
    function decreaseGeoOpacity() { sp_view.geoOpacity(sp_view.geoOpacity() - 0.1); }
    function increaseHeatmapOpacity() { sp_view.heatMapOpacity(sp_view.heatMapOpacity() + 0.1); }
    function decreaseHeatmapOpacity() { sp_view.heatMapOpacity(sp_view.heatMapOpacity() - 0.1); }

    function df(v) {
        var df = d3.time.format("%Y-%m-%d %H:%M");
        try {
            return df(v);
        } catch(e) { return "-"; }
    }
    
    ui.add(function() {
        var totalCount = (model && model.totalCount()) || {
            startDate: "-",
            endDate: "-",
            total: "-"
        };
        return ui.group(
            ui.div({ id: "total" },
                   ui.text(df(totalCount.startDate)),
                   ui.text(" - "),
                   ui.text(df(totalCount.endDate)),
                   ui.text(" Total: "),
                   ui.text(totalCount.total)),
            React.createElement("div", null, ui.checkBox({
                change: function(state) {
                    log = state;
                    console.log("heatmap redraw");
                    heatmap.redraw();
                }, label: "Log-scale colormap",
                checked: log
            })),
            React.createElement("div", null, ui.checkBox({
                change: function(evt) {
                    heatmap.toggleShowCount();
                }, label: "Show heatmap grid"
            })),
            ui.incDecButtons({
                increase: increaseGeoOpacity,
                decrease: decreaseGeoOpacity,
                label: "Geo map opacity"
            }),
            ui.incDecButtons({
                increase: decreaseRadius,
                decrease: increaseRadius,
                label: "Heatmap resolution"
            }),
            ui.incDecButtons({
                increase: increaseHeatmapOpacity,
                decrease: decreaseHeatmapOpacity,
                label: "Heatmap opacity"
            }));
    }, document.getElementById('react-ui-main'));

    d3.select("#location")
        .on("keypress", ui.key({
            // Coarsening
            ",": increaseRadius,
            ".": decreaseRadius,
            // Opacities
            "<": decreaseHeatmapOpacity,
            ">": increaseHeatmapOpacity,
            "d": decreaseGeoOpacity,
            "b": increaseGeoOpacity,
            // other
            "g": function() { heatmap.toggleShowCount(); },
            "l": function() {
                log = !log;
                heatmap.redraw();
                ui.update();
            }
        }));

    var leg = new ColorLegend({
        element: d3.select("body")
            .append("div")
            .attr("style", "position: fixed; top: 1em; left: 5em"),
        scale: d3_colormap
    });

    
        
}

function main() {
    d3.json("config_flights.json", function(error, data) {
        if (error) {
            throw new Error("Fail to get or parse config_flights.");
        }
        init(data);
    });
}
