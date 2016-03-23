// // This is the function that takes the raw nanocube values
// // and processes them into a model.
function processValues(v) {
    // We're mutating results from the request cache, which is *fine*,
    // except that we don't want to do it more than once.
    if (v.val.count !== void 0) {
        return;
    }
    v.val = CalculatePCA(v.val);
};

function track_extent(accessor)
{
    var min, max;
    var all_data = [];
    var result = {
        reset: function() {
            min = Infinity;
            max = -Infinity;
            all_data = [];
        }, update: function(d) {
            var old_max = max;
            var old_min = min;
            var new_extent = d3.extent(d, function(d) { return accessor(d.v); });
            var new_min = new_extent[0], new_max = new_extent[1];
            min = Math.min(new_min, old_min);
            max = Math.max(new_max, old_max);
            return ((new_max !== old_max && old_max !== -Infinity) ||
                    (new_min !== old_min && old_min !==  Infinity));
        }, extent: function() {
            return [min, max];
        }
    };
    result.reset();
    return result;
}

// function track_three_sigmas_extent(accessor, weight_accessor)
// {
//     var count = 0, sum_x = 0, sum_xx = 0;
//     var result = {
//         reset: function() {
//             count = sum_x = sum_xx = 0;
//         }, update: function(d) {
//             var lst = _.sortBy(d, function(d) {
//                 return accessor(d.v);
//             });
//             // console.log("slope: ", lst[0].v.parameters[0], "count: ", lst[0].v.count, lst[0].v);
//             // console.log("slope: ", lst[lst.length-1].v.parameters[0], "count: ", lst[lst.length-1].v.count, lst[lst.length-1].v);
//             count  += d3.sum(d.map(function(d) {
//                 return weight_accessor(d.v);
//             }));
//             sum_x  += d3.sum(d.map(function(d) {
//                 return accessor(d.v) * weight_accessor(d.v);
//             }));
//             sum_xx += d3.sum(d.map(function(d) { return Math.pow(accessor(d.v), 2) * weight_accessor(d.v); }));
//             return true;
//         }, extent: function() {
//             if (count === 0) {
//                 return [-Infinity, Infinity];
//             }
//             var avg = sum_x / count;
//             var variance = sum_xx / count - avg * avg, stdev = Math.sqrt(variance);
//             return [avg - 3 * stdev, avg + 3 * stdev];
//         }
//     };
//     result.reset();
//     return result;
// }

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
    
    function count(v) { return v && v.count; }

    var count_extent_tracker = track_extent(count);
    // var slope_extent_tracker = track_three_sigmas_extent(slope, count);
    
    function colormap(v) {
        var c = count(v);
        var cmin = count_extent_tracker.extent()[0], cmax = count_extent_tracker.extent()[1];
        if (log) {
            cmin = Math.log(cmin + 1);
            cmax = Math.log(cmax + 1);
            c = Math.log(c + 1);
        }
        opacityMap.domain([cmin, cmin * 2/3 + cmax * 1/3, cmax]);
        var t = d3.rgb(d3_colormap(count(v)));
        return { r: +t.r, g: +t.g, b: +t.b, a: opacityMap(c)*255 };
    }

    function updateColorMap() {
        var cmax = count_extent_tracker.extent()[1];
        var rangeLength = d3_colormap.range().length;
        d3_colormap.domain(d3.range(rangeLength).map(function(d) { return (d / (rangeLength-1)) * cmax; }));
    }

    var selColor = d3.rgb(255, 128, 0);
    var modelOptions = {
        coarseLevels: 1,
        mapOptions: {
        },
        valueFunction: function(v) {
            return v.count;
        },
        processValues: processValues,
        countFunction: count
    };

    var model;
    var sp_view, heatmap; 
    initPage(config);
    initNanocube(config, modelOptions, function(model_) {
        model = model_;
        // model.cat_vars["SPECTYPEHAMMER"].key_function = function(k) {
        //     return carrier_names[k] || k;
        // };
        sp_view = spatial_view({
            divId: "location",
            variable: model.spatial_vars.location,
            config: config,
            model: model,
            processValues: modelOptions.processValues,
            selectionColor: selColor,
            nanocubeLayer: {
                coarseLevels: 4,
                opacity: 1.0,
                model: model,
                valueEnter: ui.update,
                valueLeave: ui.update,
                mapOptions: {
                    colormap: colormap,
                    resetBounds: function() {
                        return count_extent_tracker.reset();
                    },
                    updateBounds: function(data) {
                        var r = count_extent_tracker.update(data);
                        if (r) {
                            updateColorMap();
                        }
                        // if (changedCount) {
                        //     updateSlopeColorMap(slope_extent_tracker);
                        //     leg.redraw();
                        // }
                        return r;
                    }
                }
            }
        });
        // geomap = sp_view.geoMap;
        heatmap = sp_view.nanocubeLayer;
        model.initViews();
        model.on("resultsChanged", ui.update);
        model.on("highlightChanged", ui.update);
    });

    //////////////////////////////////////////////////////////////////////////
    
    // var leg = new ColorLegend({
    //     element: d3.select("body")
    //         .append("div")
    //         .attr("style", "position: fixed; top: 1em; left: 5em"),
    //     scale: d3_colormap
    // });

    //////////////////////////////////////////////////////////////////////////
    // React UI

    function increaseRadius() { sp_view.radius(sp_view.radius() + 1); };
    function decreaseRadius() { sp_view.radius(sp_view.radius() - 1); };
    function increaseHeatmapOpacity() { sp_view.heatMapOpacity(sp_view.heatMapOpacity() + 0.1); }
    function decreaseHeatmapOpacity() { sp_view.heatMapOpacity(sp_view.heatMapOpacity() - 0.1); }

    function totalCountReactDiv() {
        var totalCount = (model && model.totalCount()) || {
            total: "-"
        };
        return ui.div({ id: "total" },
                      ui.text(" Total: "),
                      ui.text(totalCount.total));
    };
    
    function highlightCount() {
        var caption = "-";
        if (!_.isUndefined(model && model.highlightedValue)) {
            caption = String(model.highlightedValue.count);
        }
        return ui.div(null, ui.text("Count: " + caption));
    }
    ui.add(function() {
        return ui.group(
            // ui.state({ state: model && model.highlightedValue,
            //            watchers: [function(v) { leg.updateHairLine(slope(v)); }]
            //          }),
            totalCountReactDiv(),
            highlightCount(),
            ui.hr(),
            React.createElement("div", null, ui.checkBox({
                change: function(state) {
                    log = state;
                    console.log("heatmap redraw");
                    heatmap.redraw();
                }, label: "Log-scale colormap",
                checked: log
            })),
            ui.hr(),
            React.createElement("div", null, ui.checkBox({
                change: function(evt) {
                    heatmap.toggleShowCount();
                }, label: "Show heatmap grid"
            })),
            ui.incDecButtons({
                increase: decreaseRadius,
                decrease: increaseRadius,
                label: "Heatmap resolution"
            }),
            ui.incDecButtons({
                increase: increaseHeatmapOpacity,
                decrease: decreaseHeatmapOpacity,
                label: "Heatmap opacity"
            })
        );
    }, document.getElementById('react-ui-main'));

    // d3.select("#location")
    //     .on("keypress", ui.key({
    //         // Coarsening
    //         ",": increaseRadius,
    //         ".": decreaseRadius,
    //         // Opacities
    //         "<": decreaseHeatmapOpacity,
    //         ">": increaseHeatmapOpacity,
    //         "d": decreaseGeoOpacity,
    //         "b": increaseGeoOpacity,
    //         // other
    //         "g": function() { heatmap.toggleShowCount(); },
    //         "l": function() {
    //             log = !log;
    //             heatmap.redraw();
    //             ui.update();
    //         }
    //     }));
}

function main() {
    d3.json("config_sdss_types.json", function(error, data) {
        init(data);
    });
}
