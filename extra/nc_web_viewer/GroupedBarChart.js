/*global $,d3 */

function GroupedBarChart(opts){
    opts = _.defaults(opts, {
        tickFormat: ',.1s'
    });
    var name = opts.name;
    var logaxis = opts.logaxis;

    var margin = {top:20,right:10,left:30,bottom:30};
    var id = '#'+name;

    //setup the d3 margins from the css margin variables
    margin.left = Math.max(margin.left, parseInt($(id).css('margin-left')));
    margin.right = Math.max(margin.right, parseInt($(id).css('margin-right')));
    margin.top = Math.max(margin.top, parseInt($(id).css('margin-top')));
    margin.bottom = Math.max(margin.bottom, 
                             parseInt($(id).css('margin-bottom')));
    
    $(id).css('margin','0px 0px 0px 0px');
    $(id).css('margin-left','0px');
    $(id).css('margin-right','0px');
    $(id).css('margin-top','0px');
    $(id).css('margin-bottom','0px');

    this.data = {};
    this.selection=null;

    this.id = id;
    this.model = opts.model;

    var width = $(id).width() - margin.left - margin.right;
    var height = $(id).height()- margin.top - margin.bottom;
    
    //add svg to the div
    this.svg = d3.select(id).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g").attr("transform","translate(" + margin.left + "," 
                          + margin.top + ")");

    //add title
    var title = this.svg.append("text").attr('y',-5).text(name)
	.append("svg:title").text(function(d) { return "Click dimension title to toggle between alphabetical sorting and numerical sorting."; });
    
    //axis
    this.x  = d3.scale.linear().range([0,width]);
    if (logaxis){
	this.x  = d3.scale.log().range([0,width]);
    }
    
    this.y0  = d3.scale.ordinal().rangeRoundBands([0,height],0.05);//cat
    this.y1  = d3.scale.ordinal();//selections

    this.xAxis = d3.svg.axis()
        .scale(this.x)
        .orient("bottom")
	.ticks(3, opts.tickFormat);

    
    this.yAxis = d3.svg.axis()
        .scale(this.y0)
        .orient("left");
    
    //add axis to the svg
    this.svgxaxis = this.svg.append("g")
        .attr("class", "axis x")
        .attr("transform", "translate(0," 
              + (height+3) + ")");
    
    this.svgyaxis = this.svg.append("g")
        .attr("class", "axis y")
        .attr("transform", "translate(-3,0)");
}

GroupedBarChart.prototype.updateAxis = function(data){    
    // var xmin = 0.1 * d3.min(data, function(d){return d.value;});
    var xmin = d3.min(data, function(d){return d.value;});
    var xmax = d3.max(data, function(d){return d.value;});

    var x_center = (xmin + xmax) / 2;
    xmin -= (x_center - xmin) / 10;
    xmax += (xmax - x_center) / 10;
    
    this.x.domain([xmin,xmax]);
    var cats = data.map(function(d){return d.cat;});
    this.y0.domain(cats);
    this.y1.domain(data.map(function(d){return d.color;}))
        .rangeRoundBands([0, this.y0.rangeBand()]);
    
    
    this.svgxaxis.call(this.xAxis);
    this.svgyaxis.call(this.yAxis);
    
    //Make Axis Label's clickable
    var that = this;
    this.svgyaxis.selectAll('.tick').on('click',function(d){
	var obj = $.grep(data, function(e){return e.cat==d;})[0];
	that.click_callback(obj);
    });
};

GroupedBarChart.prototype.setData = function(data,id,color){
    this.data[id] = {color:color, data: data};
};

GroupedBarChart.prototype.setSelection = function(sel){
    this.selection = sel;
};

GroupedBarChart.prototype.removeData = function(id){
    if (id in this.data){ delete this.data[id]; }
};

GroupedBarChart.prototype.flattenData = function(data){
    return Object.keys(data).reduce(function(prev,curr){ 
        var row = Object.keys(data[curr].data).map(function(k){
            return { addr: data[curr].data[k].addr, 
                     cat: data[curr].data[k].cat,
                     color: data[curr].color,
                     value: data[curr].data[k].value,
                     fullValue: data[curr].data[k].fullValue
                   };
        });
        return prev.concat(row);
    }, []);
};


GroupedBarChart.prototype.setClickCallback = function(cb){
    this.click_callback = cb;
};

GroupedBarChart.prototype.redraw = function(){
    var flatdata = this.flattenData(this.data);
    this.updateAxis(flatdata);
    var that = this;

    this.svg.on('click', this.click_callback);

    //remove the bars
    this.svg.selectAll('.bar')
        .data([])
        .exit()
        .remove();

    function get_left(d) {
        var v1 = that.x(0);
        var v2 = that.x(d.value);
        var l = Math.min(v1, v2), r = Math.max(v1, v2);
        if (l < 0)
            l = 0;
        return l;
    }
    function get_right(d) {
        var v1 = that.x(0);
        var v2 = that.x(d.value);
        var r = Math.max(v1, v2);
        var width = that.x.range()[1] - that.x.range()[0];
        if (r > width)
            r = width;
        return r;
    }
    //add the bars back
    this.svg.selectAll('.bar')
        .data(flatdata).enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', function(d) {
            return get_left(d);
            
            // var w = that.x(d.value) - that.x(0);
            // if (w < 0)
            //     return 0;
            // else
            //     return that.x(0);
        })
        .attr('y', function(d){return that.y0(d.cat) //category
                               +that.y1(d.color);}) //selection group
        .attr('height',function(d){return that.y1.rangeBand();})
        .attr('width',function(d){
            var l = get_left(d), r = get_right(d);
            return r - l;
        })
        .on('click', this.click_callback) //toggle callback
        .style('fill', function(d){
            if (that.selection.length < 1  //no selection (everything)
                || (that.selection.indexOf(d.addr)!=-1)){//addr in selection
                return d.color;
            }
            else{
                return 'gray';
            }
        })
        .on("mouseenter", function(d) {
            that.model.highlightValue(d.fullValue);
        })
        .on("mouseleave", function() {
            that.model.highlightValue(undefined);
        })
        .append("svg:title") //tooltip
        .text(function(d) { return d3.format(',')(d.value); });   
};
