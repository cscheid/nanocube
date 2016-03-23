///////////////////////////////////////////////////////////////////////////////
// Global variables
///////////////////////////////////////////////////////////////////////////////

CalculatePCA = (function() {

var nanocube_server_url = 'http://hdc.cs.arizona.edu/nanocube/10040/';
//var nanocube_server_url = 'http://localhost:29512/';
var quadtree_level = 15;
var variable_schema = ['count', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0*0', '0*1', '0*2', '0*3', '0*4', '0*5', '0*6', '0*7', '0*8', '0*9', '1*1', '1*2', '1*3', '1*4', '1*5', '1*6', '1*7', '1*8', '1*9', '2*2', '2*3', '2*4', '2*5', '2*6', '2*7', '2*8', '2*9', '3*3', '3*4', '3*5', '3*6', '3*7', '3*8', '3*9', '4*4', '4*5', '4*6', '4*7', '4*8', '4*9', '5*5', '5*6', '5*7', '5*8', '5*9', '6*6', '6*7', '6*8', '6*9', '7*7', '7*8', '7*9', '8*8', '8*9', '9*9'];

// auto setup of other values
var G_Feature_Dimensions = Math.floor((Math.sqrt(8*(variable_schema.length)+1)-3) / 2);
var G_Schema_Map = {};
for(var i = 0; i < variable_schema.length; i ++) {
    G_Schema_Map[String(variable_schema[i])] = i;
}

// ///////////////////////////////////////////////////////////////////////////////
// // Common Functions to Setup the Page and Help Plot Heatmaps
// ///////////////////////////////////////////////////////////////////////////////

// var plots = {};
// var xExtent = [-7,16];
// var yExtent = [-10,13];
// var navHistory= []; // Store the history so that we can go back
// var navTileX = 0;
// var navTileY = 0;
// var navLevel = 0;
// var diveLevel = 5;

// // Change Dive Level
// $(document).ready(function(){
//     var sel = d3.select('#levelChange');
//     var levels = [];
//     for(var i = 0; i < 10; i ++) {
//         levels.push(i);
//     }
//     sel.selectAll('option').data(levels).enter()
//     .append('option')
//     .attr('value', function(d){ return d;})
//     .text(function(d){ return d;});

//     sel.on('change', function(d){
//         diveLevel = this.value;
//         plotAll();
//     });

//     document.getElementById('levelChange').value=5;
//     diveLevel = 5;
//     plotAll();

// });

// function plotAll() {
//     var q = nanocube_server_url+
//         '/count.a("location",dive(tile2d('+navTileX+','+navTileY+','+navLevel+'),'+
//             diveLevel+'),"img")';
//     nc.query(q, function(d){
//         // TODO: if the data sent back is empty, return to last valid query
//         //plotHeatmap(d, CovMatColorMap, RepackWithPCA);
        
//         for(var i = 1; i < 5; i ++) {
//             for(var j = 1; j < 5; j ++) {
//                 plotHeatmap(d, covMat, RepackWithPCA, [i,j]);
//             }
//             d3.select('#heatmap').append('div')
//                 .attr('clear','both');
//         }
//     });
// }

// function CreateHeatmap(cellStyleFunc, dataTransformFunc){
//     var plot = {};

//     plot.plotWidth = 250;
//     plot.plotHeight = 250;

//     var margin = { top: 0, right: 0, bottom: 0, left: 0 };
//     var viewBoxWidth = 500;
//     var viewBoxHeight = 500;

//     var contentWidth = viewBoxWidth-margin.left-margin.right;
//     var contentHeight = viewBoxHeight-margin.top-margin.bottom;

//     // plot heatmap
//     plot.svgSel = d3.select("#heatmap")
//         .append("svg")
//         .style("padding", "4px 5px")
//         .attr("width", plot.plotWidth)
//         .attr("height", plot.plotHeight)
//         .attr('viewBox', '0 0 '+viewBoxWidth+' '+viewBoxHeight)
//         .attr('id', 'plot');

//     plot.svgSel.append("rect")
//     .attr("x", 0)
//     .attr("y", 0)
//     .attr("height", 500)
//     .attr("width", 500)
//     .style("stroke", "#ccc")
//     .style("fill", "#f5f5f5")
//     .style("stroke-width", 1);

//     plot.xScale = d3.scale.linear().domain(xExtent).range([0, contentWidth]);
//     plot.yScale = d3.scale.linear().domain(yExtent).range([contentHeight, 0]);


//     plot.setRectPosition = function (sel) {
//         var gridXSize = (plot.xScale(xExtent[1])-plot.xScale(xExtent[0]))/Math.pow(2,diveLevel);
//         var gridYSize = (plot.yScale(yExtent[0]-plot.yScale(yExtent[1])))/Math.pow(2,diveLevel);
//         sel.attr("x", function(d) {
//             return d.x*gridXSize;
//         })
//         .attr("y", function(d) {
//             return contentHeight-(d.y+1)*gridYSize;
//         })
//         .attr("width", ~~gridXSize + 1)
//         .attr("height", ~~gridYSize + 1);
//     };

//     plot.rectSel = plot.svgSel.append("g")
//         .attr("transform", "translate(" + margin.left + "," + margin.top+ ")");

//     return plot;
// }

// function plotHeatmap(data,
//                      cellStyleFunc, // How to render each cell
//                      dataTransformFunc=function(d){return d;}, // Optional. Never change the original data.
//                      args=null
//                     )
// {
//     if(!plots[cellStyleFunc.name+args[0]+args[1]]) {
//         plots[cellStyleFunc.name+args[0]+args[1]] = CreateHeatmap(cellStyleFunc,
//                                                   dataTransformFunc);
//     }
//     data = dataTransformFunc(data);
//     data = data.root.children;

//     //vExtent = [Infinity, -Infinity];
//     //for(var i = 1; i < data.length; i ++) {
//         //if(data[i].val.cov_matrix !== null) {
//             //for(var row = 1; row < data[i].val.cov_matrix.length; row++) {
//                 //for(var col = 0; col < data[i].val.cov_matrix[row].length; col++) {
//                     //if(typeof data[i].val.cov_matrix[row][col] !== "undefined") {
//                         //vExtent[0] = Math.min(vExtent[0], data[i].val.cov_matrix[row][col]);
//                         //vExtent[1] = Math.max(vExtent[1], data[i].val.cov_matrix[row][col]);
//                     //}
//                 //}
//             //}
//         //}
//     //}
//     vExtent = [-100,100]; //set a fixed range

//     var plot = plots[cellStyleFunc.name+args[0]+args[1]];
//     var xScale = plot.xScale.domain(xExtent);
//     var yScale = plot.yScale.domain(yExtent);

//     plot.rectSel.selectAll('rect').remove();
//     plot.rectSel.selectAll('rect')
//     .data(data).enter().append('rect')
//     .call(plot.setRectPosition)
//     .call(cellStyleFunc, data, args);

//     var xScale = plot.xScale.domain(xExtent);
//     var yScale = plot.yScale.domain(yExtent);

//     //plot.xAxisGroup.transition().call(plot.xAxis).call(plot.setAxisStyle);
//     //plot.yAxisGroup.transition().call(plot.yAxis).call(plot.setAxisStyle);
// }

// function navBtnClick(btn){
//     if(navLevel > 0) {
//         if(btn.value == 'left') {
//             var newX = navTileX - 1;
//             navTileX = Math.max(0, newX);
//         }
//         if(btn.value == 'right') {
//             var newX = navTileX + 1;
//             navTileX = Math.min(Math.pow(2,navLevel)-1, newX);
//         }
//         if(btn.value == 'down') {
//             var newY = navTileY - 1;
//             navTileY = Math.max(0, newY);
//         }
//         if(btn.value == 'up') {
//             var newY = navTileY + 1;
//             navTileY = Math.min(Math.pow(2,navLevel)-1, newY);
//         }
//         if(btn.value == 'zoomout') {
//             if(navHistory.length > 0) {
//                 var lastOp = navHistory[navHistory.length-1];
//                 navTileX = lastOp.navTileX;
//                 navTileY = lastOp.navTileY;
//                 navLevel = lastOp.navLevel;
//                 xExtent = lastOp.xExtent;
//                 yExtent = lastOp.yExtent;
//                 navHistory.pop();
//             }
//         }
//         if(btn.value == 'reset') {
//             navHistory = [];
//             navTileX = 0;
//             navTileY = 0;
//             navLevel = 0;
//             diveLevel = 5;
//             xExtent = [-7,16];
//             yExtent = [-10,13];
//             diveLevel = 5;
//             document.getElementById('levelChange').value=5;
//         }
//         plotAll();
//     }
// }

// ///////////////////////////////////////////////////////////////////////////////
// // Different Color Mapping Strategies
// ///////////////////////////////////////////////////////////////////////////////
// var vExtent = [Infinity, -Infinity];
// function covMat(rectSel, data, args) {
//     var totalCount = d3.sum(data, function(d) { return d.val.count; });
//     var totalCov = d3.sum(data, function(d) { return (d.val.cov_matrix && d.val.cov_matrix[args[0]][args[1]]) || 0; });
//     var overallAvg = 0; // totalCov/totalCount;
    
//     // Calculate scale every time
//     var cExtent = d3.extent(data, function(d){
//         return d.val.count;
//     });
//     cExtent[0]=0;
//     cExtent[1]=1000;
//     var opacityScale = d3.scale.linear()
//         .domain(cExtent).range([0.1, 1]);

//     //var vExtent = d3.extent(data, function(d){
//         //return d.val.cov_matrix[args[0]][args[1]];
//     //});

//     // ['#8c510a', '#d5d5d5', '#01665e']
//     // ['#8c510a', '#d5d5d5', '#01665e']
    
//     var valueScale = d3.scale.linear()
//             .domain([vExtent[0], overallAvg, vExtent[1]]).range(['#d53e4f', '#ffffbf', '#3288bd']);

//     rectSel.call(setCellStyle);
    
//     function setCellStyle(sel) {
//         sel.attr("fill", function(d){
//             if(d.val.cov_matrix !== null) {
//                 var v = d.val.cov_matrix[args[0]][args[1]];
//                 v = Math.max(v, vExtent[0]);
//                 v = Math.min(v, vExtent[1]);
//                 var color = d3.rgb(valueScale(v));
//                 var opacity = (args[0] > args[1]) ? 0.2 : 1.0;
//                 var result = "rgba(" + color.r + "," + color.g + "," + color.b + "," + opacity + ")";
//                 return result;
//             } else {
//                 return 'white';
//             }
//         })
//         .attr('opacity', function(d){
//             if(d.val.cov_matrix === null) {
//                 return 0;
//             }
//             //return opacityScale(d.val.count);
//         })
//         .on('click', function(d){ console.log(d); });
//     }
// }

// ///////////////////////////////////////////////////////////////////////////////
// // Helper Functions
// ///////////////////////////////////////////////////////////////////////////////

// if (!String.prototype.format) {
//   String.prototype.format = function() {
//     var args = arguments;
//     return this.replace(/{(\d+)}/g, function(match, number) {
//       return typeof args[number] != 'undefined'
//         ? args[number]
//         : match
//       ;
//     });
//   };
// }

// function svg2img(svgID){
//     var svg  = document.getElementById(svgID);
//     var xml  = new XMLSerializer().serializeToString(svg);
//     var data = "data:image/svg+xml;base64," + btoa(xml);
//     var img  = new Image();

//     img.setAttribute('src', data);
//     document.body.appendChild(img);
// }

// // PCA related
// function RepackWithPCA(original_data) {

//     // Deep copy. TODO: more elegent way
//     var data = JSON.parse(JSON.stringify(original_data));

//     if('val' in data.root) {
//         data.root.val = CalculatePCA(data.root.val);
//         return data;
//     } else if('children' in data.root) {
//         for(var i = 0; i < data.root.children.length; i ++) {
//             data.root.children[i].val = CalculatePCA(data.root.children[i].val);
//         }
//         return data;
//     }

//     function CalculatePCA(vec) {
//         var d = G_Feature_Dimensions;
//         var s = G_Schema_Map;

//         if(typeof vec === 'undefined') {
//             return null;
//         }

//         var covMat = new Array(d);
//         for(var i = 0; i < d; i ++) {
//             covMat[i] = new Array(d);
//         }

//         // build the upper triangular area
//         var count = vec[s.count];
//         if(count == 1) {
//             return {'cov_matrix': null,
//                 'eig_value': null,
//                 'eig_vector':null,
//                 'count': 1};
//         } else {
//             for(var row = 0; row < d; row ++) {
//                 for(var col = row; col < d; col ++) {
//                     var sum_x = vec[s[String(row)]];
//                     var sum_y = vec[s[String(col)]];
//                     var sum_xy = vec[s[String(row)+'*'+String(col)]];
//                     covMat[row][col] = (sum_xy-sum_x*sum_y/count)/(count-1);
//                 }
//             }
//         }

//         // fill the lower triangular area
//         for(var row = 1; row < d; row ++) {
//             for(var col = 0; col < row; col ++) {
//                 covMat[row][col] = covMat[col][row];
//             }
//         }

//         // if count < dimensions, PCA won't work
//         if(vec[s.count] < d) {
//             return {'cov_matrix': covMat,
//                 'eig_value': null,
//                 'eig_vector':null,
//                 'count': vec[s.count]};
//         }

//         // calculate eigen value and eigen vector
//         var eig = numeric.eig(covMat);
//         var eig_value = eig.lambda.x;
//         var eig_vector = eig.E.x;
//         var list = [];
//         for(var i = 0; i < eig_value.length; i ++) {
//             list.push({'value':eig_value[i], 'vector':eig_vector[i]});
//         }
//         list.sort(function(a, b) {
//             return -(a.value - b.value);
//         });
//         for(var i = 0; i < eig_value.length; i ++) {
//             eig_value[i] = list[i].value;
//             eig_vector[i] = list[i].vector;
//         }

//         var results = {'cov_matrix': covMat,
//             'eig_value': eig_value,
//             'eig_vector': eig_vector,
//             'count': vec[s.count]};
//             return results;
//     }
// }


function CalculatePCA(vec) {
    var d = G_Feature_Dimensions;
    var s = G_Schema_Map;

    if(typeof vec === 'undefined') {
        return null;
    }

    var covMat = new Array(d);
    for(var i = 0; i < d; i ++) {
        covMat[i] = new Float64Array(d);
    }

    // build the upper triangular area
    var count = vec[s.count];
    if(count == 1) {
        return {'cov_matrix': null,
                'eig_value': null,
                'eig_vector':null,
                'count': 1};
    } else {
        for(var row = 0; row < d; row ++) {
            for(var col = row; col < d; col ++) {
                var sum_x = vec[s[String(row)]];
                var sum_y = vec[s[String(col)]];
                var sum_xy = vec[s[String(row)+'*'+String(col)]];
                covMat[row][col] = (sum_xy-sum_x*sum_y/count)/(count-1);
            }
        }
    }

    // fill the lower triangular area
    for(var row = 1; row < d; row ++) {
        for(var col = 0; col < row; col ++) {
            covMat[row][col] = covMat[col][row];
        }
    }

    // if count < dimensions, PCA won't work
    if(vec[s.count] < d) {
        return {'cov_matrix': covMat,
                'eig_value': null,
                'eig_vector':null,
                'count': vec[s.count]};
    }

    // calculate eigen value and eigen vector
    var eig = numeric.eig(covMat);
    var eig_value = eig.lambda.x;
    var eig_vector = eig.E.x;
    var list = [];
    for(var i = 0; i < eig_value.length; i ++) {
        list.push({'value':eig_value[i], 'vector':eig_vector[i]});
    }
    list.sort(function(a, b) {
        return -(a.value - b.value);
    });
    for(var i = 0; i < eig_value.length; i ++) {
        eig_value[i] = list[i].value;
        eig_vector[i] = list[i].vector;
    }

    var results = {'cov_matrix': covMat,
                   'eig_value': eig_value,
                   'eig_vector': eig_vector,
                   'count': vec[s.count]};
    return results;
}

    return CalculatePCA;
})();
