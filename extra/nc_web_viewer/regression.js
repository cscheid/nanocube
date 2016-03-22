///////////////////////////////////////////////
// NanoCube query helpers
///////////////////////////////////////////////

var nc_regression = {};

nc_regression.fit_time = function () {
    $.getJSON('http://localhost:29512/count.a("carrier",dive([],1)).a("location",dive([1,2],8))', function(data) {
        return nc_regression.parseJSON(data);
    });
};

nc_regression.parseJSON = function(data){
	var returnJson = {"layers" : [], "root": {}};
    returnJson.layers = data.layers;
    nc_regression.parseRoot(data.root, returnJson.root);
    $("#result").text(JSON.stringify(returnJson, null, "   "));
    return returnJson;
};

nc_regression.parseRoot = function(dataRoot, returnRoot){
    if(dataRoot.children){
        returnRoot.children = [];
    }

    $.each(dataRoot.children, function(index, element){
        nc_regression.parseChildren(index, element, returnRoot.children);
    });
};

nc_regression.parseChildren = function(index, dataChild, returnChildren){
    var obj = {};
    obj.path = dataChild.path;
    if(dataChild.hasOwnProperty("children")){
        obj.children = [];
        $.each(dataChild.children, function(index, element){
            nc_regression.parseChildren(index, element, obj.children);
        });
    }else{
        obj.val = nc_regression.fit(dataChild.val);
    }
    returnChildren.splice(index, 0, obj);
};

var lambda = 0.00001;

nc_regression.fit = function(vector){
    var result = {};
    
    var count    = vector[5];
    var sumy     = vector[0];
    var sum_y_sq = vector[1];
    var sumx     = vector[2];
    var sum_x_sq = vector[3];
    var sumxy    = vector[4];

    var meany    = sumy / count;
    var meanx    = sumx / count;
    var meanx_sq = sum_x_sq / count;
    var meanxy   = sumxy / count;

    var old_denominator     = meanx_sq - (meanx * meanx);
    var old_slope           = (meanxy - (meanx * meany)) / old_denominator;
    var old_intercept       = meany - (old_slope * meanx);
    
    var denominator         = count * sum_x_sq - sumx * sumx + lambda * lambda + lambda * (count + sum_x_sq);
    var intercept_numerator = sumy  * sum_x_sq - sumxy * sumx + lambda * sumy;
    var slope_numerator     = count * sumxy    - sumx * sumy + lambda * sumxy;

    var slope = 0, y_intercept = 0;
    if (denominator !== 0) {
        slope       = slope_numerator/denominator;
        y_intercept = intercept_numerator/denominator;
    }

    var error = sum_y_sq - (2 * (y_intercept * sumy - slope * sumxy)) + (y_intercept * y_intercept * count) + (2 * slope * y_intercept * sumx) + (slope * slope * sum_x_sq);

    result.parameters = [slope, y_intercept];
    result.error = error;
    result.count = count;
    result.vector = vector;
    return result;
};

// nc_regression.fit_time();

