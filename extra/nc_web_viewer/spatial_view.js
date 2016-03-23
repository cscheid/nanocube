/*global L, _ */

spatial_view = (function() {
    
var spatial_view = function(opts)
{
    var colors = colorbrewer.Set1[9].slice();
    
    opts.model.selcolors = {}; // FIXME
    var selcolors = opts.model.selcolors;
    selcolors[opts.variable.dim] = opts.selectionColor;

    opts = _.defaults(opts || {}, {});
    opts.geoMap = _.defaults(opts.geoMap || {}, {
        tilesURL: "http://{s}.tile.osm.org/{z}/{x}/{y}.png",
        opacity: 1.0
    });
    var leaflet = new L.map(opts.divId, {
        maxZoom: Math.min(18, opts.variable.maxlevel + 1)
    });
    var mapTile, heatMap;
    var model;
    
    // the previous code implemented an implicit spatial restriction 
    // on the active viewport. We don't want this.
    //
    // var that = this;
    // map.on('moveend', function(e){
    //     var b = map.getBounds();
    //     var level = map.getZoom();
    //     var tilelist = boundsToTileList(b,Math.min(level+8, spvar.maxlevel));
    //     spvar.setCurrentView(tilelist);
    //     that.redraw(spvar);
    //     that.updateInfo();
    // });
  
    if (opts.geoMap) {
        mapTile = new L.tileLayer(opts.geoMap.tilesURL, opts.geoMap);
        mapTile.addTo(leaflet);
    }

    if (opts.nanocubeLayer) {
        heatMap = new L.NanocubeLayer(_.defaults(opts.nanocubeLayer || {}, {
            opacity: 1.0,
            model: opts.model,
            variable: opts.variable,
            noWrap: true,
            processValues: opts.processValues,
            coarseLevels: 1
        }));
        heatMap.addTo(leaflet);
    }
    
    model = opts.model;
    opts.model.on("queryChanged", function() {
        debugger;
        heatMap && heatMap.redraw();
    });

    //////////////////////////////////////////////////////////////////////////

    var geoOpacity = opts.geoMap.opacity,
        heatMapOpacity = opts.nanocubeLayer.opacity;
    
    var result = {
        leaflet: leaflet,
        geoMap: mapTile,
        nanocubeLayer: heatMap,
        radius: function(v) {
            if (_.isUndefined(v))
                return heatMap.coarselevels;
            heatMap.coarselevels = Math.max(0, Math.min(8, v));
            heatMap.redraw();
            return result;
        }, geoOpacity: function(v) {
            if (_.isUndefined(v))
                return geoOpacity;
            geoOpacity = Math.max(0.0, Math.min(1.0, v));
            return mapTile.setOpacity(geoOpacity);
        }, heatMapOpacity: function(v) {
            if (_.isUndefined(v))
                return heatMapOpacity;
            heatMapOpacity = Math.max(0.0, Math.min(1.0, v));
            return heatMap.setOpacity(heatMapOpacity);
        },

        //////////////////////////////////////////////////////////////////////
        // Drawing rects, etc.

        // FIXME: view shouldn't be mutating model.
        removeObsolete: function(k) {
            _.each(model.temporal_vars, function(temporal_var, v) {
                temporal_var.removeObsolete(k);
            });
            _.each(model.cat_vars, function(cat_var, v) {
                cat_var.removeObsolete(k);
            });
        },

        //Colors
        nextColor: function() {
            var c =colors.shift();
            colors.push(c);
            return c;
        },

        //Add Rectangles and polygons controls
        addDraw: function(map,spvar){
            spvar.map = map;
            //Leaflet draw interactions
            map.drawnItems = new L.FeatureGroup();
            map.drawnItems.addTo(map);

            map.editControl = new L.Control.Draw({
                draw: {
                    rectangle: true,
                    polyline: false,
                    circle: false,
                    marker: false,
                    polygon: { allowIntersection: false }
                },
                edit: {
                    featureGroup: map.drawnItems
                }
            });
            map.editControl.setDrawingOptions({
                rectangle:{shapeOptions:{color: this.nextColor(), weight: 2,
                                         opacity:.9}},
                polygon:{shapeOptions:{color: this.nextColor(), weight: 2,
                                       opacity:.9}}
            });

            map.editControl.addTo(map);

            //Leaflet created event
            var that = this;
            map.on('draw:created', function (e) {
                that.drawCreated(e,spvar);
            });

            map.on('draw:deleted', function (e) {
                that.drawDeleted(e,spvar);
            });

            map.on('draw:editing', function (e) {
                that.drawEditing(e,spvar);
            });

            map.on('draw:edited', function (e) {
                that.drawEdited(e,spvar);
            });
        },

        //Functions for drawing / editing / deleting shapes
        drawCreated: function(e,spvar){
            //add the layer
            spvar.map.drawnItems.addLayer(e.layer);
            //update the contraints
            var coords = e.layer.toGeoJSON().geometry.coordinates[0];
            coords = coords.map(function(e){ return L.latLng(e[1],e[0]);});
            coords.pop();
            var tilelist = genTileList(coords,
                                       Math.min(spvar.maxlevel,e.target._zoom+8));
            var color = e.layer.options.color;
            selcolors[e.layer._leaflet_id] = color;
            spvar.addSelection(e.layer._leaflet_id, tilelist, color);
            //events for popups
            var that = this;
            e.layer.on('mouseover', function(){
                //update polygon count before opening popup
                that.updatePolygonCount(e.layer, spvar);
                e.layer.openPopup();
            });
            e.layer.on('mouseout', function(){e.layer.closePopup();});
            //set next color
            if (e.layerType == 'rectangle'){
                spvar.map.editControl.setDrawingOptions({
                    rectangle:{shapeOptions:{color: this.nextColor(),weight: 2,
                                             opacity:.9}}
                });
            }
            if (e.layerType == 'polygon'){
                spvar.map.editControl.setDrawingOptions({
                    polygon:{shapeOptions:{color: this.nextColor(),weight: 2,
                                           opacity:.9}}
                });
            }
            model.redraw(spvar,false); // FIXME
        },
        
        //draw count on the polygon
        updatePolygonCount: function(layer, spvar){
            var q = model.totalcount_query(spvar.constraints[layer._leaflet_id]);
            var that = model;
            q.run_query().done(function(json){
                that.options.processValues(json.root);
                var countstr ="Count: 0";
                if (json != null) {
                    var count = that.options.countFunction(json.root.val);
                    countstr ="Count: ";
                    countstr += count.toString().replace(/\B(?=(\d{3})+(?!\d))/g,",");
                }
                var geojson = layer.toGeoJSON();
                var bbox = bboxGeoJSON(geojson);
                var bboxstr = "Bbox: ";
                bboxstr += "(("+bbox[0][0].toFixed(3)+","+bbox[0][1].toFixed(3)+"),";
                bboxstr += "("+bbox[1][0].toFixed(3)+","+bbox[1][1].toFixed(3)+"))";
                layer.bindPopup(countstr+"<br />" +bboxstr);
            });
        },

        drawDeleted: function(e,spvar) {
            var layers = e.layers;
            var that = this;
            layers.eachLayer(function(layer) {
                spvar.deleteSelection(layer._leaflet_id);
                delete selcolors[layer._leaflet_id];
                that.removeObsolete(layer._leaflet_id);
            });
            model.redraw(); // FIXME
        },

        drawEdited: function(e,spvar){
            var layers = e.layers;
            layers.eachLayer(function (layer) {
                var coords = layer.toGeoJSON().geometry.coordinates[0];
                coords = coords.map(function(e){ return L.latLng(e[1],e[0]); });
                coords.pop();
                var tilelist = genTileList(coords, Math.min(spvar.maxlevel,
                                                            e.target._zoom+8));
                spvar.updateSelection(layer._leaflet_id,tilelist);
            });
            model.redraw(spvar,false); // FIXME
        },

        drawEditing: function(e,spvar) {
            var obj = e.layer._shape || e.layer._poly;
            var coords = obj._latlngs; // no need to convert
            var tilelist = genTileList(coords, Math.min(spvar.maxlevel,
                                                        e.target._zoom+8));
            spvar.updateSelection(obj._leaflet_id,tilelist);
            model.redraw(spvar,false); // FIXME
        }

    };

    //Drawing Rect and Polygons
    result.addDraw(leaflet, opts.variable, false);

    //set the initial view
    for (var sp in opts.config.latlonbox.min){
        leaflet.fitBounds([opts.config.latlonbox.min[sp],
                           opts.config.latlonbox.max[sp]]);
    }
    
    return result;
};

return spatial_view;
    
}());
