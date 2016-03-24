L.NanocubeLayer = L.TileLayer.Canvas.extend({
    initialize: function(options){
        L.TileLayer.Canvas.prototype.initialize.call(this, options);
        this.model = options.model;
        this.variable = options.variable;
        this.coarselevels = options.coarseLevels;
        this.smooth = false;
        this.mapOptions = _.defaults(options.mapOptions, {
            resetBounds: _.identity,
            updateBounds: _.identity
        });
        this.show_count = false;
        this.process_values = options.processValues;
        this._on = { valueEnter: options.valueEnter || function() {},
                     valueLeave: options.valueLeave || function() {},
                     valueMove: options.valueMove   || function() {} };
        this.currentPixel = undefined;
    }
});

// FIXME this name is horrible.
L.NanocubeLayer.prototype.toggleShowCount = function(){
    this.show_count = !this.show_count;
    this.redraw();
};

L.NanocubeLayer.prototype.redraw = function(){
    if (this._map) {
        //this._reset({hard: false});  //no hard resetting
        this._update();
    }
    for (var i in this._tiles) {
        this._redrawTile(this._tiles[i]);
    }
    return this;
};

L.NanocubeLayer.prototype.drawTile = function(canvas, tilePoint, zoom){
    var drill = Math.min(this.variable.maxlevel-zoom,8) - this.coarselevels ;
    drill = Math.max(0,drill);
    drill = Math.min(8,drill);

    var size = Math.pow(2,drill);
    var ntiles = Math.pow(2,zoom);

    //fix negative tiles
    while(tilePoint.x < 0){
        tilePoint.x += ntiles;
    }

    while(tilePoint.y < 0){
        tilePoint.y += ntiles;
    }

    //fix overflow tiles
    while(tilePoint.x > ntiles){
        tilePoint.x -= ntiles;
    }

    while(tilePoint.y > ntiles){
        tilePoint.y -= ntiles;
    }

    //flip y for nanocubes
    var ty = (ntiles-1)-tilePoint.y;

    //query
    var tile = new Tile(tilePoint.x,ty,zoom);
    var that = this;

    this.model.tileQuery(this.variable, tile, drill, function(json){
        var data = that.processJSON(json);
        if (data === null) {
            canvas._data = null;
            canvas._dict = {};
            return;
        }
        canvas._data = data;
        canvas._dict = {};
        _.each(data, function(el) {
            var d2 = canvas._dict[el.x] || (canvas._dict[el.x] = {});
            d2[el.y] = el.v;
        });
        if (that.mapOptions.updateBounds(data)) {
            for (var i in that._tiles) {
                that.renderTile(that._tiles[i], size, that._tiles[i]._tilePoint,
                                that._map._zoom);
            }
        } else {
            that.renderTile(canvas,size,tilePoint,zoom);
        }
    });
    that.tileDrawn(canvas);
};

L.NanocubeLayer.prototype.renderTile = function(canvas, size, tilePoint, zoom){
    var data = canvas._data;
    var ctx = canvas.getContext('2d');
    var coarse = this.coarselevels;
    var that = this;
    console.log("renderTile", tilePoint);
    canvas.onmousemove = function(event) {
        var pixelX =        event.offsetX  >> coarse,
            pixelY = (255 - event.offsetY) >> coarse;
        var targetV = ((this._dict || {})[pixelX] || {})[pixelY];
        var prevPixel = that.currentPixel;
        that.currentPixel = targetV;
        that.model.highlightValue(targetV);
        if (targetV !== prevPixel) {
            if (_.isUndefined(targetV)) {
                that._on.valueLeave();
            } else {
                that._on.valueEnter(targetV);
            }
        }
        if (!_.isUndefined(targetV)) {
            that._on.valueMove(targetV);
        }
    };
    canvas.onmouseleave = function() {
        if (!_.isUndefined(that.currentPixel)) {
            that.currentPixel = undefined;
            that.model.highlightValue(undefined);
            that._on.valueLeave();
        }
    };

    if (data == null || data.length === 0){
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (this.show_count){//draw grid box
            this.drawGridCount(ctx,tilePoint,zoom,data);
        }
        return;
    }

    var imgData=ctx.createImageData(size,size);
    var pixels = imgData.data;
    var length = pixels.length;

    if (!this.smooth) { //blocky rendering
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
    }

    // The API for a nanocubeLayer colormap is now no longer very
    // nice: we pass in a color object and expect the caller to assign
    // to the fields RGBA in the range of 0 to 255.
    // 
    // This is not the nicest API, but we want to avoid pressure on
    // the garbage collection through object creation. The loop that
    // follows is on a hot path, as determined by profiling the code.
    var color = { r: 0, g: 0, b: 0, a: 0 };
    for (var i=0; i < data.length; ++i) {
        that.mapOptions.colormap(data[i].v, color);
        var idx = (imgData.height-1-data[i].y)*imgData.width + data[i].x;
        pixels[idx*4]=color.r;
        pixels[idx*4+1]=color.g;
        pixels[idx*4+2]=color.b;
        pixels[idx*4+3]=color.a;        
    }

    //set image
    var sc = canvas.width*1.0/size;

    //clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    //scale
    if (sc !== 1) {
        //create a proxy canvas
        var newCanvas = $('<canvas>')
                .attr("width", imgData.width)
                .attr("height", imgData.height)[0];
        newCanvas.getContext("2d").putImageData(imgData, 0, 0);

        ctx.drawImage(newCanvas,0,0,canvas.width,canvas.height);
    } else {
        ctx.putImageData(imgData,0,0);
    }

    if (this.show_count) { //draw grid box
        this.drawGridCount(ctx,tilePoint,zoom,data);
    }
};

L.NanocubeLayer.prototype.drawGridCount = function(ctx,tilePoint,zoom,data){
    debugger;
    ctx.lineWidth="0.5";
    ctx.strokeStyle="white";
    ctx.rect(0,0,ctx.canvas.width,ctx.canvas.height);
    ctx.stroke();

    var totalstr = "("+tilePoint.x + "," + tilePoint.y +","+zoom+")   ";
    if (data != null) {
        //Total count
        var total = data.reduce(function(prev,curr){return prev+curr.v;},0);
        totalstr +=  total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    ctx.font="10pt sans-serif";
    ctx.fillStyle="white";
    ctx.fillText(totalstr,10,20);
};


L.NanocubeLayer.prototype.processJSON = function(json) {
    var that = this;
    if (!json || !json.root || !json.root.children || json.root.children.length === 0)
        return null;
    json.root.children.forEach(this.process_values);

    var data = json.root.children.map(function(d){
        var v = d.val;
        if ('path' in d) {
            return { x: d.path[0], y: d.path[1], v: v };
        } 
        else{
            return { x: d.x, y: d.y, v: v };
        }
    });
    return data;
};



L.NanocubeLayer.prototype._addTilesFromCenterOut = function (bounds) {
    console.log("reset!");
    this.mapOptions.resetBounds();
    debugger;
    L.TileLayer.Canvas.prototype._addTilesFromCenterOut.call(this, bounds);
};
