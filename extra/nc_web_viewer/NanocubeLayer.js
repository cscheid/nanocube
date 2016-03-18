L.NanocubeLayer = L.TileLayer.Canvas.extend({
    initialize: function(options){
	L.TileLayer.Canvas.prototype.initialize.call(this, options);
	this.model = options.model;
	this.variable = options.variable;
	this.colormap = d3.scale.linear()
	    .domain(options.colormap.domain)
	    .range(options.colormap.colors);

	this.coarselevels = 1;
	this.smooth = false;

	this.show_count = false;
	this.log = true;
        this.process_values = options.processValues;
        this.value_function = options.valueFunction;
    }
});

L.NanocubeLayer.prototype.toggleLog = function(){
    this.log = !this.log;
    this.redraw();
};

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
        debugger;
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
    console.log("Min: ", this.min, "Max: ", this.max, "this:", this);
    this.model.tileQuery(this.variable, tile, drill, function(json){
	var result = that.processJSON(json);
        if (result === null) {
            canvas._data = null;
            return;
        }
        if (isNaN(result.max) || isNaN(result.min)) {
            console.error("Bad min and max for tile");
            return;
        }
        canvas._data = result.data;
        var old_max = that.max, old_min = that.min;
	that.max = Math.max(that.max, result.max);
	that.min = Math.min(that.min, result.min);
        
        if ((that.max !== old_max && old_max !== -Infinity) ||
            (that.min !== old_min && old_min !== Infinity)) {
            // this requires a rerender of *all* tiles.
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

L.NanocubeLayer.prototype.renderTile = function(canvas, size, tilePoint,zoom){
    var data = canvas._data;
    var ctx = canvas.getContext('2d');

    if (data == null){
	var imgBlankData = ctx.createImageData(canvas.width,canvas.height);
	ctx.putImageData(imgBlankData,0,0);

	if (this.show_count){//draw grid box
	    this.drawGridCount(ctx,tilePoint,zoom,data);
	}
	return;
    }


    var imgData=ctx.createImageData(size,size);
    var pixels = imgData.data;
    var length = pixels.length;

    if (! this.smooth){ //blocky rendering
	ctx.imageSmoothingEnabled = false;
	ctx.webkitImageSmoothingEnabled = false;
	ctx.mozImageSmoothingEnabled = false;
    }

    //set color
    var that = this;
    var minv = that.min;
    var maxv = that.max;
    if (that.log){
	minv = Math.log(minv+1);
	maxv = Math.log(maxv+1);
    }
    minv*=0.9;

    data.forEach(function(d){
	if(d.v < 1e-6){
	    return;
	}

	var v = d.v;
	if (that.log){
	    v = Math.log(v+1);
	}

	v = (v-minv)/(maxv-minv);

	//try to parse rgba
	var color = that.colormap(v);
	var m = color.match(/rgba\((.+),(.+),(.+),(.+)\)/);
	if(m){
	    color = {r:+m[1],g:+m[2],b:+m[3],a:+m[4]*255};
	}
	else{
	    color = d3.rgb(that.colormap(v));
	    color.a = 2*255*v;
	}

	var idx = (imgData.height-1-d.y)*imgData.width + d.x;
	pixels[idx*4]=color.r;
	pixels[idx*4+1]=color.g ;
	pixels[idx*4+2]=color.b;
	pixels[idx*4+3]=color.a;
    });

    //set image
    var sc = canvas.width*1.0/size;

    //clear the canvas
    imgBlankData = ctx.createImageData(canvas.width,canvas.height);
    ctx.putImageData(imgBlankData,0,0);

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
    if (json.root.children === null ||
        json.root.children.length === 0) {
	return null;
    }
    json.root.children.forEach(this.process_values);

    var data = json.root.children.map(function(d){
        var v = that.value_function(d.val);
	if ('path' in d) {
	    return { x: d.path[0], y: d.path[1], v: v };
	} 
	else{
	    return { x: d.x, y: d.y, v: v };
	}
    });

    var extent = d3.extent(data, function(item) { return item.v; });

    return { min: extent[0], max: extent[1], data: data };
};



L.NanocubeLayer.prototype._addTilesFromCenterOut = function (bounds){
    this.max = -Infinity;
    this.min = Infinity;
    L.TileLayer.Canvas.prototype._addTilesFromCenterOut.call(this, bounds);
};
