/*global L, _ */

function spatial_view(opts)
{
    opts = _.defaults(opts || {}, {});
    opts.geoMap = _.defaults(opts.geoMap || {}, {
        tilesURL: "http://{s}.tile.osm.org/{z}/{x}/{y}.png",
        opacity: 1.0
    });
    var leaflet = new L.map(opts.divId, {
        maxZoom: Math.min(18, opts.variable.maxlevel + 1)
    });
    var mapTile, heatMap;
    
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

    //set the initial view
    for (var sp in opts.config.latlonbox.min){
        leaflet.fitBounds([opts.config.latlonbox.min[sp],
                           opts.config.latlonbox.max[sp]]);
    }

    opts.model.on("queryChanged", function() {
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
        }
    };
    
    return result;
}
