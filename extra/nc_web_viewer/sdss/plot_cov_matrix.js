///////////////////////////////////////////////////////////////////////////////
// Global variables
///////////////////////////////////////////////////////////////////////////////

Fitting = (function() {

var nanocube_server_url = 'http://hdc.cs.arizona.edu/nanocube/10040/';
//var nanocube_server_url = 'http://localhost:29512/';
var quadtree_level = 15;
var variable_schema = ['count', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0*0', '0*1', '0*2', '0*3', '0*4', '0*5', '0*6', '0*7', '0*8', '0*9', '1*1', '1*2', '1*3', '1*4', '1*5', '1*6', '1*7', '1*8', '1*9', '2*2', '2*3', '2*4', '2*5', '2*6', '2*7', '2*8', '2*9', '3*3', '3*4', '3*5', '3*6', '3*7', '3*8', '3*9', '4*4', '4*5', '4*6', '4*7', '4*8', '4*9', '5*5', '5*6', '5*7', '5*8', '5*9', '6*6', '6*7', '6*8', '6*9', '7*7', '7*8', '7*9', '8*8', '8*9', '9*9'];

var G_Feature_Dimensions = Math.floor((Math.sqrt(8*(variable_schema.length)+1)-3) / 2);
var G_Schema_Map = {};
for(var i = 0; i < variable_schema.length; i ++) {
    G_Schema_Map[String(variable_schema[i])] = i;
}

var row_lookup = new Int32Array(G_Feature_Dimensions), col_lookup = row_lookup;
var cell_lookup = new Int32Array(G_Feature_Dimensions * G_Feature_Dimensions);

(function() {
    var d = G_Feature_Dimensions;
    for (var row = 0; row < d; row++) {
        row_lookup[row] = G_Schema_Map[String(row)];
        for (var col = row; col < d; col++) {
            cell_lookup[row + d * col] = G_Schema_Map[String(row)+'*'+String(col)];
        }
    }
})();
    
//////////////////////////////////////////////////////////////////////////
// auto setup of other values
    
function CalculatePCA(vec) {
    var i;
    var d = G_Feature_Dimensions;
    var s = G_Schema_Map, row, col;

    if(typeof vec === 'undefined') {
        return null;
    }

    var covMat = new Float64Array(d*d);
    // for(i = 0; i < d; i ++) {
    //     covMat[i] = new Float64Array(d);
    // }

    var count = vec[s.count];
    // build the upper triangular area
    // if(count == 1) {
    //     return {'cov_matrix': null,
    //             'eig_value': null,
    //             'eig_vector':null,
    //             'count': 1};
    // } else {
    for(row = 0; row < d; row ++) {
        for(col = row; col < d; col ++) {
            var ix = row + d * col;
            var sum_x = vec[row_lookup[row]];
            var sum_y = vec[col_lookup[col]];
            var sum_xy = vec[cell_lookup[ix]];
            covMat[ix] = (sum_xy-sum_x*sum_y/count)/(count);
            // covMat[ix] = (sum_xy-sum_x*sum_y/count)/(count-1);
            
            // E[(x - ux)(y - uy)] = E[xy - x uy - y ux + ux uy]
            //  = E[xy] - uy E[x] - ux E[y] + E[x]E[y]
            //  = E[xy] - 2E[x]E[y] + E[x][y]
            //  = E[xy] - E[x]E[y]
        }
    }
    // }

    // fill the lower triangular area
    for(row = 1; row < d; row ++) {
        for(col = 0; col < row; col ++) {
            covMat[row + d * col] = covMat[col + d * row];
        }
    }

    // // if count < dimensions, PCA won't work
    // if(vec[s.count] < d) {
    //     return {'cov_matrix': covMat,
    //             'eig_value': null,
    //             'eig_vector':null,
    //             'count': vec[s.count]};
    // }

    // calculate eigen value and eigen vector
    var eig = lapack.dsyev('V', 'L', covMat);
    var eig_value = eig.val;
    var eig_vector = eig.vec;
    var list = [];
    for(i = 0; i < eig_value.length; i ++) {
        console.log(d*i, d*i+d);
        list.push({
            'value': eig_value[i],
            'vector': eig_vector.subarray(d*i, d*i+d)
        });
    }
    list.sort(function(a, b) {
        return -(a.value - b.value);
    });
    eig_vector = new Array(d);
    for(i = 0; i < eig_value.length; i ++) {
        eig_value[i] = list[i].value;
        eig_vector[i] = list[i].vector;
    }

    var results = {'cov_matrix': covMat,
                   'eig_value': eig_value,
                   'eig_vector': eig_vector,
                   'count': vec[s.count]};
    return results;
}

    function CalculateAverages(vec) {
        return {
            'mean': vec.slice(1,11).map(function(d) { return d / vec[0]; }),
            'count': vec[G_Schema_Map.count]
        };
    }
    
    return {
        PCA: CalculatePCA,
        Averages: CalculateAverages
    };
})();
