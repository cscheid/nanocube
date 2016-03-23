/*global d3 */

function ColorLegend(opts)
{
    var margin = {top:20,right:10,left:30,bottom:30};
    opts = _.defaults(opts || {}, {
        width: 500,
        height: 60
    });
    
    this.svg = opts.element.append("svg")
        .attr("width", opts.width)
        .attr("height", opts.height);

    var xScale = d3.scale.linear().range([10, opts.width + 10]);
    var colorScaleDomain = opts.scale.domain();

    this.opts = opts;
    this.colorPreScale = d3.scale.linear().range(
        [colorScaleDomain[0], colorScaleDomain[colorScaleDomain.length-1]]);

    var steps = 50;

    var data = d3.range(steps).map(function(d) { return d / (steps - 1); });
    var that = this;

    this.svg.append("g").selectAll("rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", function(d) { return xScale(d); })
        .attr("width", function(d) { return ~~(xScale(1 / (steps - 1)) - xScale(0) + 1); })
        .attr("height", 30)
        .attr("y", 10)
        .attr("fill", function(d) { return opts.scale(that.colorPreScale(d)); });

    this.axisScale = d3.scale.linear().domain(colorScaleDomain);
    this.axisScale.range(xScale.range());
    this.axisScale.ticks(3);
    this.axis = d3.svg.axis()
        .scale(this.axisScale)
        .orient("bottom");

    this.axisGroup = this.svg
        .append("g")
        .classed("color-legend", true)
        .attr("transform", "translate(0,40)");
    this.axisGroup.call(this.axis);

    this.hairLine = this.svg
        .append("g")
        .append("line")
        .attr("y1", 10)
        .attr("y2", 40)
        .attr("x1", 200)
        .attr("x2", 200)
        .attr("stroke", "black")
        .attr("display", "none");

    this.updateHairLine = function(v) {
        if (_.isUndefined(v)) {
            this.hairLine.attr("display", "none");
        } else {
            var x = this.colorPreScale.invert(xScale(v));
            this.hairLine.attr("display", null).attr("x1", x).attr("x2", x);
        }
    };
}

ColorLegend.prototype.redraw = function()
{
    var colorScaleDomain = this.opts.scale.domain();
    this.colorPreScale.range(
        [colorScaleDomain[0], colorScaleDomain[colorScaleDomain.length-1]]);
    var that = this;

    this.svg.selectAll("rect")
        .attr("fill", function(d) { return that.opts.scale(that.colorPreScale(d)); });
    this.axisScale.domain([colorScaleDomain[0],
                           colorScaleDomain[colorScaleDomain.length-1]]);
    this.axisGroup.call(this.axis);
};
