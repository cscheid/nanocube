var emlapack = require('./lib/emlapack.js');

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

function fasterColormap(domain, range)
{
    var length = range.length - 1, last = range[range.length - 1];
    return function(v) {
        v = Math.min(domain[1], Math.max(domain[0], v));
        var u = (v - domain[0]) / (domain[1] - domain[0]);
        
        if (u === 1.0) {
            return { r: last.r, g: last.g, b: last.b, a: last.a };
        }

        var u_long = u * length;
        var i = ~~(u_long), f = u_long - i;
        return { r: range[i].r * (1-f) + range[i+1].r * f,
                 g: range[i].g * (1-f) + range[i+1].g * f,
                 b: range[i].b * (1-f) + range[i+1].b * f };
    };
}

function init(config)
{
    var log = true;

    var colors = colorbrewer.Spectral[9].slice().reverse().map(function(d) {
        var r = d3.rgb(d);
        r.a = 255;
        return r;
    });
    var d3_colormap = function() { return { r: 0, g: 0, b: 0, a: 0 }; };
    var opacityMap = d3.scale.linear()
            .range([0, 1, 1])
            .clamp(true);
    
    function count(v) { return v && v.count; }

    var count_extent_tracker = track_extent(count);
    // var slope_extent_tracker = track_three_sigmas_extent(slope, count);
    
    function colormap(v) {
        var c = count(v);
        var cmin = count_extent_tracker.extent()[0], cmax = count_extent_tracker.extent()[1];
        var c2 = c;
        if (log) {
            cmin = Math.log(cmin + 1);
            cmax = Math.log(cmax + 1);
            c = Math.log(c + 1);
        }
        var t = d3_colormap(c2);
        return { r: +t.r, g: +t.g, b: +t.b, a: opacityMap(c)*255 };
    }

    function updateColorMap() {
        var cmin = count_extent_tracker.extent()[0];
        var cmax = count_extent_tracker.extent()[1];

        d3_colormap = fasterColormap([cmin, cmax], colors);
        if (log) {
            cmin = Math.log(cmin + 1);
            cmax = Math.log(cmax + 1);
        }
        opacityMap.domain([cmin, cmin * 2/3 + cmax * 1/3, cmax]);
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
                    var cmin = count_extent_tracker.extent()[0], cmax = count_extent_tracker.extent()[1];
                    if (log) {
                        cmin = Math.log(cmin + 1);
                        cmax = Math.log(cmax + 1);
                    }
                    opacityMap.domain([cmin, cmin * 2/3 + cmax * 1/3, cmax]);
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

lapack = {
    dsyev: (function setupDsyev() {
        var dsyev = emlapack.cwrap('dsyev_', null, ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number']);
        
        var pjobz    = emlapack._malloc(1);
        var puplo    = emlapack._malloc(1);
        var pn       = emlapack._malloc(4);
        var plda     = emlapack._malloc(4);
        var plwork   = emlapack._malloc(4);
        var pinfo    = emlapack._malloc(4);
        var pworkopt = emlapack._malloc(4);

        return function(jobz, uplo, aIn) {
            var n = ~~Math.sqrt(aIn.length);
            emlapack.setValue(pjobz,   jobz.charCodeAt(0), 'i8');
            emlapack.setValue(puplo,   uplo.charCodeAt(0), 'i8');
            emlapack.setValue(pn,      n, 'i32');
            emlapack.setValue(plda,    n, 'i32');
            emlapack.setValue(plwork, -1, 'i32');
            var pw = emlapack._malloc(n * 8);
            var pa = emlapack._malloc(n * n * 8);
            var a = new Float64Array(emlapack.HEAPF64.buffer, pa, n * n);
            var w = new Float64Array(emlapack.HEAPF64.buffer, pw, n);
            a.set(aIn);
            dsyev(pjobz, puplo, pn, pa, plda, pw, pworkopt, plwork, pinfo);
            var workopt = emlapack.getValue(pworkopt, 'double'),
                pwork   = emlapack._malloc(workopt * 8);
            emlapack.setValue(plwork, workopt, 'i32');
            dsyev(pjobz, puplo, pn, pa, plda, pw, pwork, plwork, pinfo);

            var result = {
                vec: new Float64Array(a),
                val: new Float64Array(w),
                info: emlapack.getValue(pinfo, 'i32')
            };

            emlapack._free(pwork);
            emlapack._free(pa);
            emlapack._free(pw);
            return result;
        };
    })()
};

// function setupEmlapack() {
//     var dsyev = emlapack.cwrap('dsyev_', null, ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number']),
//         n = 5,
//         pjobz = emlapack._malloc(1),
//         puplo = emlapack._malloc(1),
//         pn = emlapack._malloc(4),
//         pa = emlapack._malloc(n * n * 8),
//         plda = emlapack._malloc(4),
//         pw = emlapack._malloc(n * 8),
//         plwork = emlapack._malloc(4),
//         pinfo = emlapack._malloc(4),
//         pworkopt = emlapack._malloc(4);

//     debugger;
    
//     emlapack.setValue(pjobz, 'V'.charCodeAt(0), 'i8');
//     emlapack.setValue(puplo, 'L'.charCodeAt(0), 'i8');
//     emlapack.setValue(pn,      n, 'i32');
//     emlapack.setValue(plda,    n, 'i32');
//     emlapack.setValue(plwork, -1, 'i32');

//     var a = new Float64Array(emlapack.HEAPF64.buffer, pa, n * n);
//     var w = new Float64Array(emlapack.HEAPF64.buffer, pw, n);

//     // a.set([ 1.96,    0,     0,   0, 0,
//     //        -6.49,  3.8,     0,   0, 0,
//     //        -0.47, -6.39, 4.17,   0, 0,
//     //        -7.2,   1.5, -1.51, 5.7, 0,
//     //        -0.65, -6.34, 2.67, 1.8, -7.1]);

//     a.set([ 1, 0.5, 0, 0, 0,
//             0,   1, 0, 0, 0,
//             0,   0, 0, 0, 0,
//             0,   0, 0, 0, 0,
//             0,   0, 0, 0, 0]);

//     dsyev(pjobz, puplo, pn, pa, plda, pw, pworkopt, plwork, pinfo);

//     var workopt = emlapack.getValue(pworkopt, 'double'),
//         pwork   = emlapack._malloc(workopt * 8);
//     emlapack.setValue(plwork, workopt, 'i32');

//     dsyev(pjobz, puplo, pn, pa, plda, pw, pwork, plwork, pinfo);

//     console.log(w);
// }

// screw you, browserify, we're going to write into the global object.

window.main = function() {
    // debugger;
    // console.log(lapack.dsyev('V', 'L', [ 1, 0.5, 0, 0, 0,
    //                                      0,   1, 0, 0, 0,
    //                                      0,   0, 0, 0, 0,
    //                                      0,   0, 0, 0, 0,
    //                                      0,   0, 0, 0, 0]));
    d3.json("config_sdss_types.json", function(error, data) {
        init(data);
    });
};
