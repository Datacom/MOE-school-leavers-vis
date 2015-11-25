function tagAddFor(field) {
  return function (p, v) {
    v[field].forEach (function(val, idx) {
       p[val] = (p[val] || 0) + 1; //increment counts
    });
    return p;
  }
}

function tagRemoveFor(field) {
  return function(p, v) {
    v[field].forEach (function(val, idx) {
       p[val] = (p[val] || 0) - 1; //decrement counts
    });
    return p;
  }
}

function tagInitial() {
  return {};  
}


function createTagDimAndGroup(cf, field) {
  var tags = cf.dimension(function(d){ return d[field];});
  var tagsGroup = tags.groupAll().reduce(tagAddFor(field), tagRemoveFor(field), tagInitial).value();
  // hack to make dc.js charts work
  tagsGroup.all = function() {
    var newObject = [];
    for (var key in this) {
      if (this.hasOwnProperty(key) && key != "all" && key != 'top') {
        newObject.push({
          key: key,
          value: this[key]
        });
      }
    }
    newObject = _.sortBy(newObject,function (d) { return - d.value })
    return newObject;
  }
  
  tagsGroup.top = function(x) {
    newObject = tagsGroup.all()
    return (newObject.length > x)?newObject.slice(0,x):newObject;
  }
  
  
  filterHandlerFor = function(chart) {
    return function(dimension, filter) {
      dimension.filter(function(d) {return chart.filter() != null ? d.indexOf(chart.filter()) >= 0 : true;}); // perform filtering
        return filter; // return the actual filter value
    }
  }
  
  return {dim:tags, group:tagsGroup, filterHandlerFor:filterHandlerFor}
}

//dim_group = createTagDimAndGroup(ndx, 'objects_struck')
//
//var chart = dc.rowChart('#chart')
//chart.dimension(dim_group.dim)
//  .group(dim_group.group)
//  .filterHandler(dim_group.filterHandlerFor(chart))
//
//
