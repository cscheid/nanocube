//Categorical Variable
function CatVar(dim, valnames, displaynumcat, alpha_order, value_function){
    //Display 25 categories by default
    displaynumcat=(typeof displaynumcat==="undefined")? 25:displaynumcat;    
    alpha_order=(typeof alpha_order==="undefined")? true:alpha_order;

    this.dim = dim;
    
    //setup constraint
    this.constraints = {};
    this.constraints[0] = new CatConstraint(dim);

    //setup categorical variable
    this.keyaddr = valnames;
    this.addrkey = {};

    var that = this;
    Object.keys(this.keyaddr).forEach(function(k){ 
        that.addrkey[that.keyaddr[k]]=k; 
    });

    //Set number of variables for display
    this.displaynumcat = Math.min(displaynumcat,
                                  Object.keys(this.keyaddr).length);

    //Sort in alphabetical order ... or not ...
    this.alpha_order = alpha_order;
    this.value_function = value_function;
}

CatVar.prototype.jsonToList=function(json){
    if (json == null|| (typeof json.root.children=='undefined') ){
        //nothing to do
        return [];
    }
    var that = this;
    var data = json.root.children.map(function(d){
        return { value: +that.value_function(d.val), addr: +d.path[0]  };
    });

    var that = this;
    data.sort(function(a,b) {return -(a.value-b.value);});
    data = data.slice(0,this.displaynumcat);
    if (!this.alpha_order){
        return data;
    }

    data.sort(function(a,b) {
        var key_a = that.addrkey[a.addr];
        var key_b = that.addrkey[b.addr];

        try{
            if (!isNaN(key_a) && !isNaN(key_b)){
                return key_a - key_b;
            }
            else{
                return key_a.localeCompare(key_b);
            }
        }
        catch(e){
            return 0;
        }
    });
    return data;
};

CatVar.prototype.update=function(json,id,color,q){
    var that = this;
    var data = that.jsonToList(json);

    //turn addr to keys
    data.forEach(function(d){d.cat=that.addrkey[d.addr];});
    
    //set the gui element and redraw()
    if ('widget' in that){
        that.widget.setData(data,id,color);
        that.widget.redraw();
    }
};

CatVar.prototype.removeObsolete=function(k){
    if ('widget' in this){
        this.widget.removeData(k);
    }
};

//Temporal Variable
function TimeVar(dim,date_offset,start,end,bin_to_hour, value_function){
    this.dim = dim;
    this.bin_to_hour = bin_to_hour;
    this.date_offset = date_offset;

    //setup constraint
    this.constraints = {};
    this.constraints[0] = new TemporalConstraint(dim,start,end,bin_to_hour);
    this.constraints[0].dim = dim; //this is ugly

    this.value_function = value_function;
}

TimeVar.prototype.setBinSize=function(binsize){
    this.constraints[0].binSize(binsize);
};

TimeVar.prototype.binSizeHour=function(){
    return this.constraints[0].binsize*this.bin_to_hour;
};

TimeVar.prototype.jsonToList=function(json, bucketsize){
    if (json.root.children == null){ //nothing to do
        return [];
    }
    var that = this;
    var globaloffset = that.constraints[0].start;
    var data = json.root.children.map(function(d){
        var start = d.path[0]*bucketsize + globaloffset;
        var startdate = new Date(that.date_offset);
        
        //Set time in milliseconds from 1970
        startdate.setTime(startdate.getTime()+
                          start*that.bin_to_hour*3600*1000);
        return {date:startdate, value: +that.value_function(d.val)};
    });
    
    return data.sort(function(a,b) {return a.date-b.date;});
};

TimeVar.prototype.removeObsolete=function(k){
    if ('widget' in this){
        this.widget.removeData(k);
    }
};


TimeVar.prototype.update=function(json,id,color,q){
    var that = this;
    var data = that.jsonToList(json,q.timebucketsize);
    
    //update the gui element and redraw()
    if ('widget' in that){
        that.widget.setData({data: data, color: color},id);
        that.widget.redraw();
    }
};

//Spatial Variable
function SpatialVar(dim){
    this.dim = dim;

    //setup constraint
    this.constraints = {};
}

SpatialVar.prototype.jsonToList = function(json){
    return [];
};

SpatialVar.prototype.addSelection = function(key,boundary,color){
    this.constraints[key] = new SpatialConstraint(this.dim);
    this.constraints[key].boundary = boundary;
    this.constraints[key].color = color;
};

SpatialVar.prototype.updateSelection = function(key,boundary){
    this.constraints[key].boundary = boundary;
};

SpatialVar.prototype.deleteSelection = function(key){
    delete this.constraints[key];
};

SpatialVar.prototype.update=function(){};
