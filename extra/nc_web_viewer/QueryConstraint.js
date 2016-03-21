//Categorical Variable
function CatConstraint(dim){
    this.dim = dim;
    this.selection=[];
}

CatConstraint.prototype.add = function(q){
    if (this.selection.length < 1 ){
        return q;
    }
    return q.dim(this.dim).findAndDive(this.selection);    
};

CatConstraint.prototype.toggle = function(addr,single){
    var idx = this.selection.indexOf(addr);
    if (idx == -1){ //add unselected cat to selection
	if(single){
	    this.selection.length=0; //clear array
	}
        this.selection.push(addr);
    }
    else{
        this.selection.splice(idx,1);
    }
};

CatConstraint.prototype.addSelf = function(q){
    return q.drilldown().dim(this.dim).findAndDive();
};

//Temporal Variable
function TemporalConstraint(dim,start,end,bintohour){
    this.dim = dim;
    this.start = start; 
    this.nbins = end-start+1;
    this.selection_start = start; 
    this.selected_bins = this.nbins;
    this.bintohour = bintohour;
    this.binsize = 1;
}

TemporalConstraint.prototype.binSize = function(binsize){
    this.binsize = binsize;
};

TemporalConstraint.prototype.add = function(q){
    var nbins = this.selected_bins;
    return q.dim(this.dim).tseries(this.selection_start,nbins,1);
};

TemporalConstraint.prototype.addSelf = function(q){
    var minbinsize = Math.ceil(this.nbins/$('#'+this.dim).width()*1.5);
    var binsize = Math.max(minbinsize,this.binsize);

    this.start = Math.max(this.start,0);
    var nbins = Math.ceil(this.nbins / binsize);

    return q.drilldown().dim(this.dim).tseries(this.start,
                                               binsize,
                                               nbins);
};

TemporalConstraint.prototype.convertTime = function(t,date_offset){
    var diff = t - date_offset;
    var hours = diff / (60*60*1000);
    return hours/this.bintohour;
};

TemporalConstraint.prototype.setSelection = function(start,end,offset){
    if ((start == 0)  && (end ==0)){ //reset
        this.selection_start = this.start;
        this.selected_bins = this.nbins;
    }
    else{ //set to hours
        start = Math.floor(this.convertTime(start,offset));
        end = Math.floor(this.convertTime(end,offset));
        this.selection_start = start;
        this.selected_bins = end-start+1;
    }
};

TemporalConstraint.prototype.setRange = function(start,end,offset){
    start = Math.floor(this.convertTime(start,offset));
    end = Math.floor(this.convertTime(end,offset));
    this.start = start;
    this.nbins = end-start+1;

    this.selection_start = Math.max(this.start,this.selection_start);
    this.selection_bins = Math.min(this.nbins, this.selection_bins);
};

//Spatial Variable
function SpatialConstraint(dim){
    this.boundary = [];
    this.dim = dim;
}

SpatialConstraint.prototype.add = function(q){
    if (this.boundary.length < 3){
        return q;
    }
    return q.dim(this.dim).polygonQuery(this.boundary);
};

SpatialConstraint.prototype.addSelf = function(q){
    return q;
};
