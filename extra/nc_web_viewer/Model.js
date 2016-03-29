/*global _ */
var MAXCACHE=150;
var hourbSizes = [1,12,24,7*24];
var colors = colorbrewer.Set1[9];

function Model(opt){
    this.listeners = {};
    this.nanocube = opt.nanocube;
    this.options = _.defaults(opt, {
        processValues: {},
        valueFunction: _.identity,
        tileValueFunction: _.identity
    });

    this.query_cache = {};
    this.selcolors = {};

    this._totalCount = {};
    this.initVars();

    this.highlightedValue = undefined;
    this.clickedValue = undefined;

    this.cache_off = false;
};

Model.prototype.highlightValue = function(newValue)
{
    var oldValue = this.highlightedValue;
    this.highlightedValue = newValue;
    
    if (newValue !== oldValue) {
        this._highlightChanged();
    }
};

Model.prototype.clickValue = function(newValue)
{
    var oldValue = this.clickedValue;
    this.clickedValue = newValue;
    
    if (newValue !== oldValue) {
        this._clickChanged();
    }
};

// FIXME clearly a hack for mid-refactoring
Model.prototype.initViews = function() {
    var variables = this.nanocube.schema.fields.filter(function(f){
        return f.type.match(/^nc_dim/);
    });

    //loop through the schema and create the variables
    var that = this;
    variables.forEach(function(v){
        var vref;
        var t = v.type.match(/nc_dim_(.+)_(.+)/);

        switch(t[1]){
        case 'cat': //Create a categorical var and barchart
            if ($('#'+v.name).length < 1){
                return;
            }
            vref = that.cat_vars[v.name];
            //init the gui component (move it elsewhere?)
            vref.widget = new GroupedBarChart({
                name: v.name,
                logaxis: that.options.config['div'][v.name]['logaxis'],
                tickFormat: null,
                model: that
            });

            //set selection and click callback
            vref.widget.setSelection(vref.constraints[0].selection);
            vref.widget.setClickCallback(function(d){
                if (typeof d != "undefined") {
                    var single = !d3.event.shiftKey; 
                    vref.constraints[0].toggle(d.addr,single);
                    d3.event.stopPropagation();
                } else {
                    vref.alpha_order = !vref.alpha_order;
                }
                that.redraw();
            });
            that.jsonQuery(vref);
            break;

        case 'time': //Create a temporal var and timeseries
            if ($('#'+v.name).length < 1){
                return;
            }
            vref = that.temporal_vars[v.name];

            //init gui FIXME REMOVE FROM MODEL
            vref.widget = new Timeseries({
                name: v.name,
                tickFormat: null,
                xScaleFactory: that.options.timeSeriesXFactory,
                xAccessor: that.options.timeSeriesXAccessor
            });
            vref.widget.brush_callback = function(start,end){
                console.log("Brush callback");
                vref.constraints[0].setSelection(start,end,vref.date_offset);
                that.redraw(vref);
            };
            that.jsonQuery(vref);

            vref.widget.update_display_callback=function(start,end){
                console.log("Update display");
                vref.constraints[0].setRange(start,end,vref.date_offset);
                that.redraw();
            };
            break;
        default:
            break;
        }
    });

};

//Init Variables according to the schema
Model.prototype.initVars = function(){
    var variables = this.nanocube.schema.fields.filter(function(f){
        return f.type.match(/^nc_dim/);
    });
    this.spatial_vars = {};
    this.cat_vars = {};
    this.temporal_vars = {};

    //loop through the schema and create the variables
    var that = this;
    variables.forEach(function(v){
        var vref={};
        var t = v.type.match(/nc_dim_(.+)_(.+)/);

        switch(t[1]){
        case 'quadtree':  //Create a spatial var and map
            if ($('#'+v.name).length < 1){
                return;
            }
            
            vref  = new SpatialVar(v.name);
            that.spatial_vars[v.name] = vref;

            vref.maxlevel = +t[2];
            if (that.options.heatmapmaxlevel != undefined){
                vref.maxlevel = Math.min(that.options.heatmapmaxlevel,
                                         vref.maxlevel);
            }

            //Create the map and heatmap
            // var ret = that.createMap(vref);
            // vref.map=ret.map;
            // vref.heatmap=ret.heatmap;
            // if(that.options.smooth != undefined){
            //     vref.heatmap.smooth = that.options.smooth;
            // }
            break;

        case 'cat': //Create a categorical var and barchart
            if ($('#'+v.name).length < 1){
                return;
            }

            vref  = new CatVar(v.name,v.valnames,
                               that.options.config['div'][v.name]['displaynumcat'],
                               that.options.config['div'][v.name]['alpha_order'],
                               that.options.valueFunction);

            that.cat_vars[v.name] = vref;
            break;

        case 'time': //Create a temporal var and timeseries
            if ($('#'+v.name).length < 1){
                return;
            }

            //Get the time information
            var tinfo = that.nanocube.timeinfo;

            vref  = new TimeVar(v.name, tinfo.date_offset,
                                tinfo.start,tinfo.end,
                                tinfo.bin_to_hour,
                                that.options.valueFunction);
            that.temporal_vars[v.name] = vref;

            // var nbins = tinfo.end-tinfo.start+1;
            // //set the timeseries to the finest resolution
            // while (tinfo.bin_to_hour >= hourbSizes[0]){
            //     hourbSizes.shift();
            // }
            // that.setTimeBinSize(tinfo.bin_to_hour,vref);
            
            break;
        default:
            break;
        }
    });
    that.updateInfo();
};

//Redraw
Model.prototype.redraw = function(calling_var,sp) {
    var that = this;
    var spatial = true;
    if (sp != undefined){
        spatial = sp;
    }

    //temporal
    _.each(that.temporal_vars, function(thisvref, v) {
        if(calling_var != thisvref){ that.jsonQuery(thisvref); }
    });

    //categorical
    _.each(that.cat_vars, function(thisvref, v) {
        if(calling_var != thisvref){ that.jsonQuery(thisvref); }
    });

    this.updateInfo();
    this._queryChanged();
};

Model.prototype._resultsChanged = function()
{
    _.each(this.listeners["resultsChanged"], function(f) { f(); });
};

Model.prototype._queryChanged = function()
{
    _.each(this.listeners["queryChanged"], function(f) { f(); });
};

Model.prototype._highlightChanged = function()
{
    _.each(this.listeners["highlightChanged"], function(f) { f(); });
};

Model.prototype._clickChanged = function()
{
    _.each(this.listeners["clickChanged"], function(f) { f(); });
};

//Tile queries for Spatial Variables
Model.prototype.tileQuery = function(vref,tile,drill,callback){
    var q = this.nanocube.query();
    var that = this;
    _.each(that.temporal_vars, function(temporal_var, v) {
        q = temporal_var.constraints[0].add(q);
    });

    _.each(that.cat_vars, function(cat_var, v) {
        q = cat_var.constraints[0].add(q);
    });

    // Object.keys(that.spatial_vars).forEach(function(v){
    //     var spvref = that.spatial_vars[v];
    //     if(vref != spvref){
    //         q = spvref.view_const.add(q);
    //     }
    // });

    q = q.drilldown().dim(vref.dim).findTile(tile,drill);

    var qstr = q.toString('count');
    var data = this.getCache(qstr);

    if (data != null){ //cached
        callback(data);
    }
    else{
        q.run_query()
            .done(function(data) {
                callback(data);
                that.setCache(qstr,data);
            });
    }
};

//Caching Functions
Model.prototype.setCache = function(qstr,data){

    this.query_cache[qstr] = data;
    var keys = Object.keys(this.query_cache);

    if (keys.length > MAXCACHE){
        var rand = keys[Math.floor(Math.random() * keys.length)];
        delete this.query_cache[keys[rand]];
    }
};

Model.prototype.getCache = function(qstr){

    if (!this.cache_off && (qstr in this.query_cache)){
        return this.query_cache[qstr];
    }
    else{
        return null;
    }
};

//JSON Queries for Cat and Time Variables
Model.prototype.jsonQuery = function(v){
    var queries = this.queries(v);
    var that = this;
    
    _.each(queries, function(q, k) {
        var qstr = q.toString('count');
        var json = that.getCache(qstr);
        var color = that.selcolors[k]; // HACK, this is coming from spatial_view.

        if (json != null) { // cached
            v.update(json,k,color,q);
        } else {
            q.run_query().done(function(json){
                switch (json.layers.length) {
                case 0:
                    that.options.processValues(json.root);
                    break;
                case 1:
                    json.root.children.forEach(that.options.processValues);
                    break;
                default:
                    throw new Error("Don't know how to process query with more than 1 layer.");
                }
                v.update(json,k,color,q);
                that.setCache(qstr,json);
            });
        }
    });
};

//Panel
Model.prototype.panelFuncs = function(maptiles, heatmap) {
    // //panel btns
    // var that = this;

    // $("#tbinsize-btn-dec").on('click', function(){
    //     var k = Object.keys(that.temporal_vars);
    //     var tvar = that.temporal_vars[k[0]];
    //     var hr = hourbSizes.pop();
    //     hourbSizes.unshift(tvar.binSizeHour());
    //     that.setTimeBinSize(hr, tvar); //shift in reverse
    //     return that.redraw(); //refresh
    // });

    // $("#tbinsize-btn-inc").on('click', function(){
    //     var k = Object.keys(that.temporal_vars);
    //     var tvar = that.temporal_vars[k[0]];
    //     var hr = hourbSizes.shift();
    //     hourbSizes.push(tvar.binSizeHour());
    //     that.setTimeBinSize(hr, tvar); //shift forward
    //     return that.redraw(); //refresh
    // });
};

//Generate queries with respect to different variables
Model.prototype.queries = function(vref){
    var q = this.nanocube.query();
    var that = this;

    //add constraints of the other variables
    _.each(that.temporal_vars, function(thisvref, v) {
        if (thisvref !== vref){
            q = thisvref.constraints[0].add(q);
        }
    });
    _.each(that.cat_vars, function(thisvref, v) {
        if (thisvref !== vref){
            q = thisvref.constraints[0].add(q);
        }
    });

    //add spatial view constraints
    // _.each(that.spatial_vars, function(thisvref, v) {
    //     q = thisvref.view_const.add(q);
    // });

    //add spatial selection constraints
    var res = {};
    _.each(that.spatial_vars, function(thisvref, v) {
        var hasAny = false;
        _.each(thisvref.constraints, function(constraint, c) {
            res[c]  = constraint.add(q.copy());
            hasAny = true;
        });
        if (!hasAny) {
            res["location"] = q.copy();
        }
    });

    _.each(res, function(v, c) {
        res[c] = vref.constraints[0].addSelf(v);
    });

    return res;
};

//Total Count
Model.prototype.totalcount_query = function(spconst){
    var q = this.nanocube.query();
    var that = this;
    //add constraints of the other variables
    _.each(that.temporal_vars, function(thisvref) {
        q = thisvref.constraints[0].add(q);
    });
    _.each(that.cat_vars, function(thisvref) {
        q = thisvref.constraints[0].add(q);
    });

    if (spconst !== undefined){
        q = spconst.add(q);
    }

    return q;
};

Model.prototype.totalCount = function() {
    return this._totalCount;
};

//Set the total count
Model.prototype.updateInfo = function(){
    var that = this;
    var q = this.totalcount_query();

    q.run_query().done(function(json){
        if (json === null){
            return;
        }
        //count
        var count = 0;
        if (typeof json.root.val != 'undefined'){
            that.options.processValues(json.root);
            count = that.options.countFunction(json.root.val);
        }
        var countstr = d3.format(",")(count);

        //Time
        var tvarname = Object.keys(that.temporal_vars)[0];
        var tvar  = that.temporal_vars[tvarname];

        if (!tvar){ //For defaulttime/ no time constraint
            $('#info').text('Total: ' + countstr);
            return;
        }

        var time_const = tvar.constraints[0];
        var start = time_const.selection_start;

        var startdate = new Date(tvar.date_offset);

        //Set time in milliseconds from 1970
        startdate.setTime(startdate.getTime()+
                          start*tvar.bin_to_hour*3600*1000);

        var dhours = time_const.selected_bins *tvar.bin_to_hour;

        var enddate = new Date(startdate);
        enddate.setTime(enddate.getTime()+dhours*3600*1000);
        that._totalCount = {
            startDate: startdate,
            endDate: enddate,
            total: countstr
        };
        that._resultsChanged();
    });
};

// //Set time aggregation
// Model.prototype.setTimeBinSize = function(hr, tvar){
//     var b2h = tvar.bin_to_hour;
//     //update on the time series plot
//     tvar.widget.setBinSizeTxt(hr);
//     tvar.setBinSize(Math.ceil(hr*1.0/b2h));
// };

Model.prototype.updateTimeStep = function(stepsize,window){
    var that = this;
    var nc = that.nanocube;
    $.getJSON(nc.getSchemaQuery()).done(function(json){
        nc.setSchema(json);
        nc.setTimeInfo().done(function(){
            nc.setTimeInfo().done(function(){
                var tvarname = Object.keys(that.temporal_vars)[0];
                var tvar = that.temporal_vars[tvarname];
                var time_const = tvar.constraints[0];

                var start = nc.timeinfo.start;
                var end = nc.timeinfo.end;

                var tbinfo = nc.getTbinInfo();
                tvar.date_offset = tbinfo.date_offset;
                tvar.bin_to_hour = tbinfo.bin_to_hour;
                time_const.bin_to_hour = tbinfo.bin_to_hour;

                if (stepsize < 0){ //reset
                    time_const.start=start;
                    time_const.end=end;
                    time_const.nbins=end-start+1;
                }
                else{ //advance
                    time_const.nbins = window;
                    time_const.end=end;
                    time_const.start = time_const.end-window;
                }

                time_const.setSelection(0,0);
                tvar.widget.x.domain([0,1]);
                that.redraw();
            });
        });
    });
};

Model.prototype.on = function(event, callback) {
    this.listeners[event] = (this.listeners[event] || []);
    this.listeners[event].push(callback);
};
