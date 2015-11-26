var resetTabCharts  
var _data = {};
var original_data
var _council_bounds = {};
var _region_bounds = {};
var _auth_dict = {};
var _region_dict = {};
var _title_text = {};
var small_chart_height = 170;

var donut_inner = 43
var donut_outer = 70
var donut_height = 150

var valueAccessor =function(d){return d.value < 1 ? 0 : d.value}
var percapAccessor = function(d){return population[d.key] ? d.value/population[d.key].Pop_at_30Jun13 : 0} 

var getkeys;
var population = {};
//---------------------CLEANUP functions-------------------------

function cleanup(d) {
 // trimAll(d)
  d.year = +d['Year: Beginning March']
  d.students = +d["Students (∑ Values)"]
  
  if (d['Qualification: Level 3 or above'] != "Below Level 3 (Without UE)"){d.qualification = d['Qualification: Level 3 or above']}
  else if (d['Qualification: Level 2 or above'] != "Below NCEA Level 2"){d.qualification = d['Qualification: Level 2 or above']}
  else {d.qualification = d['Qualification: Level 1 or above']}
  
  if (+d['Student: Age'].charAt(4) == 2){d['Student: Age']= "Age 20+"}
  
  d['Region: Territorial Authority'] = d['Region: Territorial Authority'].replace("Lower Hutt", "Hutt")

 
d['Region: Regional Council']=d['Region: Regional Council'].replace("Hawkes","Hawke's")
 return d;
}
//---------------------------crossfilter reduce functions---------------------------

// we only use the built in reduceSum(<what we are summing>) here

//----------------------------Accessor functions-------------------------------------

// because we are only using default reduce functions, we don't need any accessor functions either 

//-------------------------Load data and dictionaries ------------------------------

//Here queue makes sure we have all the data from all the sources loaded before we try and do anything with it. It also means we don't need to nest D3 file reading loops, which could be annoying. 

queue()
    .defer(d3.csv,  "data/school_leavers.csv")
    .defer(d3.csv,  "data/nzdotstat_subnational_population_2013.csv")
    .defer(d3.csv,  "dictionaries/NMS_authority_dict.csv")
    .defer(d3.csv,  "dictionaries/Region_dict.csv")
    .defer(d3.csv,  "dictionaries/titles.csv")
    .defer(d3.json, "gis/council_boundaries.singlepart.simp100.WGS84.geojson")
    .defer(d3.json, "gis/region_boundaries_singlepart_simp_p001.geojson")
    .await(showCharts);

function showCharts(err, data, _population, auth_dict, region_dict, title_text, council_bounds, region_bounds) {

//We use dictionary .csv's to store things we might want to map our data to, such as codes to names, names to abbreviations etc.
  
//titles.csv is a special case of this, allowing for the mapping of text for legends and titles on to the same HTML anchors as the charts. This allows clients to update their own legends and titles by editing the csv rather than monkeying around in the .html or paying us to monkey around with the same.    
  
  var councilNames = [];
  
  for (i in title_text){
        entry = title_text[i]
        //trimAll(entry)
        name = entry.id
        _title_text[name]=entry;     
  }
  
  for (i in auth_dict) {
    entry = auth_dict[i]
    trimAll(entry)
    name = entry.Name
    councilNames.push(name);
    _auth_dict[entry.Name]=entry;
  } 

    for (i in region_dict) {
    entry = region_dict[i]
    trimAll(entry)
    name = entry.Map_region
    _region_dict[name]=entry;
  }
  
//  for (i in _population) {
//    entry = _population[i]
//    trimAll(entry)
//    name = titleCase(entry.Area)
//    population[name]=entry;
//  }
  
  for (i in data) {
    data[i] = cleanup(data[i]);
  }
  
  
  _data = data;
  _council_bounds = council_bounds;
  _region_bounds = region_bounds;    

//------------Puts legends and titles on the chart divs and the entire page---------------   
  apply_text(_title_text)

//---------------------------------FILTERS-----------------------------------------
  ndx = crossfilter(_data); // YAY CROSSFILTER! Unless things get really complicated, this is the only bit where we call crossfilter directly. 

//--------------------------Count of records---------------------------------------  
  
  
  dc.dataCount(".dc-data-count")
    .dimension(ndx)
    .group(ndx.groupAll());  
  
//---------------------------ORDINARY CHARTS --------------------------------------
     
  year = ndx.dimension(function(d) {return d.year});
  year_group = year.group().reduceSum(function(d){return d.students});
 
  year_chart = dc.barChart('#year')
    .dimension(year)
    .group(year_group)
    .valueAccessor(valueAccessor)
    .x(d3.scale.linear().domain([2008,2015]))
    //.xUnits() will often look something like ".xUnits(dc.units.fp.precision(<width of bar>))", but here is 1, so we dont need to bother.
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(false)
    .elasticY(true)
    .centerBar(true)
    
  year_chart.xAxis().ticks(4).tickFormat(d3.format('d'));
  year_chart.yAxis().ticks(4).tickFormat(integer_format)

  decile = ndx.dimension(function(d) {return d['School: Decile']});
  decile_group = decile.group().reduceSum(function(d){return d.students});
 
  decile_chart = dc.rowChart('#decile')
    .dimension(decile)
    .group(decile_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(2*small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return +d.key.split(' ')[1]})
    .title(function(d){return d.key+': '+title_integer_format(d.value)})

  decile_chart.xAxis().ticks(4).tickFormat(integer_format)
  decile_chart.on('pretransition.dim', dim_zero_rows)
  
  ethnicity = ndx.dimension(function(d) {return d['Student: Ethnicity']});
  ethnicity_group = ethnicity.group().reduceSum(function(d){return d.students});
 
  ethnicity_chart = dc.pieChart('#ethnicity')
    .dimension(ethnicity)
    .group(ethnicity_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors) //colors set in utils
    .innerRadius(40)
    .radius(70)
    .title(function(d){return d.key+': '+title_integer_format(d.value)})
    
  ethnicity_chart.on('pretransition.dim', dim_zero_rows)
  
  gender = ndx.dimension(function(d) {return d['Student: Gender']});
  gender_group = gender.group().reduceSum(function(d){return d.students});
 
  gender_chart = dc.pieChart('#gender')
    .dimension(gender)
    .group(gender_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors) //colors set in utils
    .innerRadius(40)
    .radius(70)
    .title(function(d){return d.key+': '+title_integer_format(d.value)})
    
  gender_chart.on('pretransition.dim', dim_zero_rows)
  
  type = ndx.dimension(function(d) {return d['School: Type']});
  type_group = type.group().reduceSum(function(d){return d.students});
 
  type_chart = dc.rowChart('#type')
    .dimension(type)
    .group(type_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height*2)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .title(function(d){return d.key+': '+title_integer_format(d.value)})
    

  type_chart.xAxis().ticks(4).tickFormat(integer_format);
  type_chart.on('pretransition.dim', dim_zero_rows) 
  
  age = ndx.dimension(function(d) {return d['Student: Age']});
  age_group = age.group().reduceSum(function(d){return d.students});
 
  age_chart = dc.rowChart('#age')
    .dimension(age)
    .group(age_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return d.key})
    .title(function(d){return d.key+': '+title_integer_format(d.value)})
    

  age_chart.xAxis().ticks(4).tickFormat(integer_format);
  age_chart.on('pretransition.dim', dim_zero_rows) 
  
  student_year = ndx.dimension(function(d) {return d['Student: Year Level']});
  student_year_group = student_year.group().reduceSum(function(d){return d.students});
 s_order = ["Year 10", "Year 11","Year 12","Year 13", "Other/Unknown"]
  
  student_year_chart = dc.rowChart('#student_year')
    .dimension(student_year)
    .group(student_year_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return s_order.indexOf(d.key)})
    .title(function(d){return d.key+': '+title_integer_format(d.value)})
    

  student_year_chart.xAxis().ticks(4).tickFormat(integer_format);
  student_year_chart.on('pretransition.dim', dim_zero_rows) 
  
  qualification = ndx.dimension(function(d) {return d.qualification});
  qualification_group = qualification.group().reduceSum(function(d){return d.students});
 
  q_order = ["UE award or Level 3", "NCEA Level 2 or Above", "NCEA Level 1 or Above", "Below NCEA Level 1"]
  
  qualification_chart = dc.rowChart('#qualification')
    .dimension(qualification)
    .group(qualification_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return q_order.indexOf(d.key)})
    .title(function(d){return d.key+': '+title_integer_format(d.value)})
    

  qualification_chart.xAxis().ticks(4).tickFormat(integer_format);
  qualification_chart.on('pretransition.dim', dim_zero_rows) 
  
//----------------------------Map functions----------------------------------

  function zoomed() {
    projection
    .translate(d3.event.translate)
    .scale(d3.event.scale);
    var hidden = projection.scale() == 1600 && JSON.stringify(projection.translate()) == JSON.stringify([220,320]);
    d3.select('#resetPosition').classed('hidden',function(){return hidden})
    district_map.render();
    region_map.render();
    }
  
  zoom = d3.behavior.zoom()
    .translate(projection.translate())
    .scale(projection.scale())
    .scaleExtent([1600, 20000])
    .on("zoom", zoomed);

  
//------------------Map 1. Territorial local authorities 
  
  TLA = ndx.dimension(function(d) { return d['Region: Territorial Authority']});
  TLA_group = TLA.group().reduceSum(function(d){return d.students})
  
  d3.select("#district_map").call(zoom);

  function colourRenderlet1(chart) {
    ext = d3.extent(district_map.data(), district_map.valueAccessor());
    ext[0]=0.000001;
    district_map.colorDomain(ext);
    }  
  
district_map = dc.geoChoroplethChart("#district_map")
      .dimension(TLA)
      .group(TLA_group)
      //.valueAccessor(percapAccessor)
      .valueAccessor(valueAccessor)
      .projection(projection)
      .colorAccessor(function(d){return d + 1})
      .colorCalculator(function(d){return !d ? map_zero_colour : colourscale(d)})
      .transitionDuration(200)
      .height(600)
      .overlayGeoJson(_council_bounds.features, 'Territorial_Authority', function(d){return d.properties.TA2013_NAM.replace(' Council', '') })
      .colors(colourscale)
      .title(function(d) {return !d.value ? d.key + ": 0" : d.key + ": " + title_integer_format(d.value)})
      .on("preRender.color", colourRenderlet1)
      .on("preRedraw.color", colourRenderlet1)
  
//---------------------------------Map 2 Regions
  
  region = ndx.dimension(function(d) { return d['Region: Regional Council']});
  region_group = region.group().reduceSum(function(d){return d.students})
  
  d3.select("#region_map").call(zoom);

  function colourRenderlet(chart) {
    ext = d3.extent(region_map.data(), region_map.valueAccessor());
    ext[0]=0.000001;
    region_map.colorDomain(ext);
  }

  region_map = dc.geoChoroplethChart("#region_map")
      .dimension(region)
      .group(region_group)
      //.valueAccessor(percapAccessor)
      .valueAccessor(valueAccessor)
      .projection(projection)
      .colorAccessor(function(d){return d + 1})
      .colorCalculator(function(d){return !d ? map_zero_colour : colourscale(d)})
      .transitionDuration(200)
      .height(600)
      .overlayGeoJson(_region_bounds.features, 'Region', function(d) {return d.properties.REGC2013_N})
      .colors(colourscale)
      .title(function(d) {return !d.value ? d.key + ": 0" : d.key + ": " + title_integer_format(d.value)})
      .on("preRender.color", colourRenderlet)
      .on("preRedraw.color", colourRenderlet)
    

// We use D3.js to put stuff into the tabs. This array is what D3 needs to know about, and we stick it in the d3 data.
  
   var tabs = [
    {
      label:"District Map", 
      content:"district_map",
      chart:district_map, 
      resetFunction:function() {district_map.filterAll();dc.redrawAll()},
      type : 'choropleth'
    },{
      label:"Region Map", 
      content:"region_map",
      chart:region_map,
      resetFunction:function() {region_map.filterAll();dc.redrawAll()},
      type : 'choropleth'
    }
  ];
  
  make_tabs(tabs)
  
  district_map.on('filtered.resets', function(selection) {
      d3.selectAll('#tabs').selectAll('.reset').classed('hidden', function(d) { 
        return d.content != 'district_map' || !selection.hasFilter()
      })
      d3.selectAll('#tabs').selectAll('.tab').classed('hasFilter', function(d){return d.chart.hasFilter()})
  })
    
  region_map.on('filtered.resets', function(selection) {
      d3.selectAll('#tabs').selectAll('.reset').classed('hidden', function(d) { 
        return d.content != 'region_map' || !selection.hasFilter()
      })
      d3.selectAll('#tabs').selectAll('.tab').classed('hasFilter', function(d){return d.chart.hasFilter()})
  })  
  
  
  d3.selectAll(".inactive_at_start").classed("active", false);
  tabwidth = district_map.width()
  region_map.width(tabwidth)
  district_map.width(tabwidth)
  
  dc.renderAll();
  
  d3.select('body').classed({wait:false})
}
