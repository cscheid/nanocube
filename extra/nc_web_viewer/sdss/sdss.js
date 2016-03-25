var emlapack = require('./lib/emlapack.js');

// // This is the function that takes the raw nanocube values
// // and processes them into a model.
function processValues(v) {
    // We're mutating results from the request cache, which is *fine*,
    // except that we don't want to do it more than once.
    if (v.val.count !== void 0) {
        return;
    }
    v.val = Fitting.Averages(v.val);
};

function track_extent(accessor)
{
    var min, max;
    var all_data = [];
    var extent = [];
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
            extent = [min, max];
            return ((new_max !== old_max && old_max !== -Infinity) ||
                    (new_min !== old_min && old_min !==  Infinity));
        }, extent: function() {
            return extent;
        }
    };
    result.reset();
    return result;
}

function track_three_sigmas_extent(accessor, weight_accessor)
{
    var count = 0, sum_x = 0, sum_xx = 0;
    var extent = [-1, 1];
    var result = {
        reset: function() {
            count = sum_x = sum_xx = 0;
        }, update: function(d) {
            debugger;
            count  += d3.sum(d.map(function(d) {
                return weight_accessor(d.v);
            }));
            sum_x  += d3.sum(d.map(function(d) {
                return accessor(d.v) * weight_accessor(d.v);
            }));
            sum_xx += d3.sum(d.map(function(d) { return Math.pow(accessor(d.v), 2) * weight_accessor(d.v); }));
            var avg = sum_x / count;
            var variance = sum_xx / count - avg * avg, stdev = Math.sqrt(variance);
            extent = [avg - 3 * stdev, avg + 3 * stdev];
            return true;
        }, extent: function() {
            return extent;
        }
    };
    result.reset();
    return result;
}

function fasterOpacityMap(domain, range)
{
    var length = range.length - 1, last = range[range.length - 1];
    return function(v) {
        v = Math.min(domain[1], Math.max(domain[0], v));
        var u = (v - domain[0]) / (domain[1] - domain[0]);
        
        if (u >= 1.0) {
            return last;
        } else if (u < 0) {
            return range[0];
        }

        var u_long = u * length;
        var i = ~~(u_long), f = u_long - i;
        return range[i] * (1-f) + range[i+1] * f;
    };
}

function fasterColormap(domain, range)
{
    var length = range.length - 1, last = range[range.length - 1];
    return function(v, obj) {
        v = Math.min(domain[1], Math.max(domain[0], v));
        var u = (v - domain[0]) / (domain[1] - domain[0]);
        
        if (u >= 1.0) {
            obj.r = last.r;
            obj.g = last.g;
            obj.b = last.b;
            obj.a = last.a;
        } else if (u < 0) {
            obj.r = range[0].r;
            obj.g = range[0].g;
            obj.b = range[0].b;
            obj.a = range[0].a;
        } else {
            var u_long = u * length;
            var i = ~~(u_long), f = u_long - i;
            obj.r = range[i].r * (1-f) + range[i+1].r * f;
            obj.g = range[i].g * (1-f) + range[i+1].g * f;
            obj.b = range[i].b * (1-f) + range[i+1].b * f;
        }
    };
}

function init(config)
{
    var log = true;

    // var colors = [d3.hcl(-100,70,60), d3.hcl(0,0,40), d3.hcl(50,70,60)].map(function(d) {
    // var colors = colorbrewer.RdBu[3].slice().map(function(d) {
    var colors = colorbrewer.Spectral[9].slice().reverse().map(function(d) {
    // var colors = colorbrewer.YlOrBr[9].slice().reverse().map(function(d) {
        var r = d3.rgb(d);
        r.a = 255;
        return r;
    });
    var colorMap = function(v, obj) { obj.r = obj.g = obj.b = obj.a = 0; };
    var d3_colormap = d3.scale.linear().range(colorbrewer.Spectral[9].slice().reverse());
    var opacityMap = function() { return 1.0; };
    
    function weight(v) {
        if (!v) return undefined;
        return v.count / d3.mean(v.mean.slice(6,10)); // .map(function(d) { return 
        // return v && v.count;
    }
    function count(v) { return v && v.count; }
    function total_variance(v) {
        if (!v) return undefined;
        var result = 0;
        for (var i=0; i<v.eig_value.length; ++i)
            result += v.eig_value[i];
        return result;
    };
    var which_variable = 0;
    function average(v) {
        if (!v) return undefined;
        // if (which_variable % 2) {
        //     return v.mean[1] - v.mean[2];
        // } else {
        //     return v.mean[3] - v.mean[4];
        // }
        return v.mean[which_variable];
    }
 
    // function average(v) {
    //     return v &&
    // };
    var compared_value = undefined;
    function similarity(v) {
        var s = 0;
        for(var i = 0; i < 10; i ++) {
            s += v.mean[i]-compared_value.mean[i];
        }
        return s;
    }

    var weight_extent_tracker = track_extent(weight);

    var correction = 0.6;
    var extent_tracker = track_three_sigmas_extent(average, count);
    var count_extent_tracker = track_extent(count);
    var similarity_extent_tracker = track_extent(similarity);
    
    function colormap(v, obj) {
        var c = average(v);
        colorMap(c, obj);

        var c2 = weight(v);
        if (log) {
            c2 = Math.pow(c2, 0.333 * correction); // log(c2 + 1);
        }
        obj.a = opacityMap(c2) * 255;
    }

    function updateColorMap() {
        var cmin = extent_tracker.extent()[0];
        var cmax = extent_tracker.extent()[1];
        // cmax = cmax * correction + cmin * (1 - correction);
        colorMap = fasterColormap([cmin, cmax], colors);
        d3_colormap.domain(d3.range(colors.length).map(function(d) {
            return (d / (colors.length - 1)) * (cmax - cmin) + cmin;
        }));
        
        if (log) {
            cmin = weight_extent_tracker.extent()[0];
            cmax = weight_extent_tracker.extent()[1];
            cmin = cmin = Math.pow(cmin, 0.333 * correction); // log(cmin + 1);
            cmax = cmax = Math.log(cmax, 0.333 * correction); // log(cmax + 1);
            opacityMap = fasterOpacityMap([cmin, cmax], [0, 1]);
        } else {
            opacityMap = fasterOpacityMap(weight_extent_tracker.extent(), [0, 1, 1, 1]);
        }


        leg.redraw();
    }

    function similarityColormap(v, obj) {
        var c = similarity(v);
        colorMap(c, obj);

        var c2 = count(v);
        if (log) {
            c2 = Math.log(c2 + 1);
        }
        obj.a = opacityMap(c2) * 255;
    }

    var similarityRange = 5;
    function updateSimilarityColorMap() {
        //var cmin = similarity_extent_tracker.extent()[0];
        //var cmax = similarity_extent_tracker.extent()[1];
        //cmax = cmax * correction + cmin * (1 - correction);
        //colorMap = fasterColormap([cmin, cmax], colors);
        var similarColor = d3.rgb('#b2182b');
        var differentColor = d3.rgb('#999999');
        colorMap = function(c, obj) {
            if( c > -similarityRange && c < similarityRange) {
                obj.r = similarColor.r;
                obj.g = similarColor.g;
                obj.b = similarColor.b;
            } else {
                obj.r = differentColor.r;
                obj.g = differentColor.g;
                obj.b = differentColor.b;
            }
        };
        
        if (log) {
            cmin = count_extent_tracker.extent()[0];
            cmax = count_extent_tracker.extent()[1];
            cmin = Math.log(cmin + 1);
            cmax = Math.log(cmax + 1);
            opacityMap = fasterOpacityMap([cmin, cmax], [0, 1, 1, 1]);
        } else {
            opacityMap = fasterOpacityMap(count_extent_tracker.extent(), [0, 1, 1, 1]);
        }
    }

    var selColor = d3.rgb(255, 128, 0);
    var modelOptions = {
        coarseLevels: 1,
        mapOptions: {
        },
        valueFunction: average, // total_variance,
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
                        return extent_tracker.reset();
                    },
                    updateBounds: function(data) {
                        var v1 = weight_extent_tracker.update(data);
                        var v2 = extent_tracker.update(data);
                        var r = v1 || v2;
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
        model.on("clickChanged", function(){
            compared_value = model.clickedValue;
            heatmap.mapOptions = {
                colormap: similarityColormap,
                resetBounds: function() {
                    return similarity_extent_tracker.reset();
                },
                updateBounds: function(data) {
                    var v1 = count_extent_tracker.update(data);
                    var v2 = similarity_extent_tracker.update(data);
                    var r = v1 || v2;
                    if (r) {
                        updateSimilarityColorMap();
                    }
                    return r;
                }
            }
            heatmap.redraw();
        });
    });

    //////////////////////////////////////////////////////////////////////////
    
    var leg = new ColorLegend({
        element: d3.select("body")
            .append("div")
            .attr("style", "position: fixed; top: 1em; left: 5em"),
        scale: d3_colormap
    });

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

    var fmt = d3.format(",.3f");
    
    function highlightCovarianceDiv() {
        var caption = "-";
        var lst = [];
        var v;
        if (!_.isUndefined(model && model.highlightedValue)) {
            v = model.highlightedValue;
            lst.push(ui.div(null, ui.text("Covariance: ")));
            var covar = [];
            for (var i=0; i<10; ++i)
                covar.push(_.toArray(v.cov_matrix.slice(i*10, i*10+10)).map(fmt));
            lst.push(ui.div(null, ui.table(covar)));
            lst.push(ui.div(null, ui.text("Total Variance: " + fmt(total_variance(v)))));
            lst.push(ui.div(null, ui.text("Count: " + v.count)));
        } else {
            lst.push(ui.div(null, ui.text("---")));
        }
        return ui.group(lst);
    }
    
    function highlightAverageDiv() {
        if (!_.isUndefined(model && model.highlightedValue)) {
            var v = model.highlightedValue;
            return ui.group(
                ui.div(null, ui.text("Variable: " + String(which_variable))),
                ui.div(null, ui.text("Average: " + String(average(v)))),
                ui.div(null, ui.text("Count: " + String(count(v)))),
                ui.div(null, ui.text("Weight: " + String(weight(v))))
            );
        } else {
            return ui.group(
                ui.div(null, ui.text("---"))
            );
        }
    }
    
    ui.add(function() {
        return ui.group(
            ui.state({ state: model && model.highlightedValue,
                       watchers: [function(v) { leg.updateHairLine(average(v)); }]
                     }),
            totalCountReactDiv(),
            highlightAverageDiv(),
            ui.hr(),
            React.createElement("div", null, ui.checkBox({
                change: function(state) {
                    log = state;
                    updateColorMap();
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

    d3.select("#location")
        .on("keypress", ui.key({
            // Coarsening
            ",": increaseRadius,
            ".": decreaseRadius,
            // Opacities
            "<": decreaseHeatmapOpacity,
            ">": increaseHeatmapOpacity,
            // "d": decreaseGeoOpacity,
            // "b": increaseGeoOpacity,
            // other
            "g": function() { heatmap.toggleShowCount(); },
            "l": function() {
                log = !log;
                updateColorMap();
                heatmap.redraw();
                ui.update();
            }, "]": function() {
                which_variable = (which_variable + 1) % 10;
                extent_tracker.reset();
                heatmap.redraw();
                ui.update();
            }, "[": function() {
                which_variable = (which_variable + 9) % 10;
                extent_tracker.reset();
                heatmap.redraw();
                ui.update();
            }, "}": function() {
                correction *= 1.25;
                updateColorMap();
                heatmap.redraw();
                ui.update();
            }, "{": function() {
                correction /= 1.25;
                updateColorMap();
                heatmap.redraw();
                ui.update();
            }
        }));
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

// screw you, browserify, we're going to write into the global object.

window.main = function() {
    // debugger;
    // console.log(lapack.dsyev('V', 'L', [ 1, 0.5, 0, 0, 0,
    //                                      0,   1, 0, 0, 0,
    //                                      0,   0, 0, 0, 0,
    //                                      0,   0, 0, 0, 0,
    //                                      0,   0, 0, 0, 0]));
    // d3.json("config_sdss_types.json", function(error, data) {
    d3.json("config_sdss.json", function(error, data) {
        init(data);
    });
};
