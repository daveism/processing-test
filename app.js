//requires
var gdal = require("gdal");
var fs = require('fs');
var turf = require('turf');

//import data
var dataset = gdal.open("../test_mosiac/southeast_mosaic_ndmi.tif");

//get extent of change mosaic
var geoTransform = dataset.geoTransform
var minx = geoTransform[0];
var maxy = geoTransform[3];
var maxx = minx + geoTransform[1]*dataset.rasterSize.x
var miny = maxy + geoTransform[5]*dataset.rasterSize.y
var datasetBox = [minx, miny, maxx, maxy];

//get change mosaic exent
var datasetPoly = turf.bboxPolygon(datasetBox);
var bbox = turf.extent(datasetPoly);
fs.writeFileSync('./bbox.geojson', JSON.stringify(bbox));

//get chnage mosaic extent as a polygon (random requires this)
var poly = turf.bboxPolygon(bbox);
fs.writeFileSync('./poly.geojson', JSON.stringify(poly));

//get a set of random points
var points = turf.random('points', 10000, {bbox: bbox});
fs.writeFileSync('./points.geojson', JSON.stringify(points));
var bands = dataset.bands;
var band = bands.get(1);
var pixels = band.pixels;

//create hexagon grid
var cellWidth = 25;
var units = 'kilometers';
var hexgrid = turf.hexGrid(bbox, cellWidth, units);

//loop hex and add properties to capture statistics about random points
for(var x=0;x<Object.keys(hexgrid.features).length;x++){
  hexgrid.features[x].properties.count=0;
  hexgrid.features[x].properties.sum=0;
  hexgrid.features[x].properties.average=0;
  hexgrid.features[x].properties.median=0;
  hexgrid.features[x].properties.min=0;
  hexgrid.features[x].properties.max=0;
  hexgrid.features[x].properties.deviation=0;
  hexgrid.features[x].properties.variance=0;
}
fs.writeFileSync('./hexgrid.geojson', JSON.stringify(hexgrid))

//ceate an empty features array for inserting points
var features = [];

//loop points to get change value at each random point
for(var i = 0; i < points.features.length; i++) {

  //get indivual point
  var x = points.features[i].geometry.coordinates[0];
  var y = points.features[i].geometry.coordinates[1]

  //transform wgs84 point to pixel location
  var transform = new gdal.CoordinateTransformation(gdal.SpatialReference.fromEPSG(4269),dataset);
  var ptnew = transform.transformPoint(x,y);

  //get change value of point
  var val = pixels.get(ptnew.x,ptnew.y);

  //create a new point with a property (attribute) of the change value
  var pt = turf.point([x,y], {value: val});

  //add new point to new feature
  features.push(pt);
}

//create a featurecollection for output as geojson
var fc = turf.featurecollection(features);
fs.writeFileSync('./randomptswithvalues.geojson', JSON.stringify(fc));

//setup statistics for points in hexgrid
var aggregations = [
  {
    aggregation: 'sum',
    inField: 'value',
    outField: 'sum'
  },
  {
    aggregation: 'average',
    inField: 'value',
    outField: 'average'
  },
  {
    aggregation: 'median',
    inField: 'value',
    outField: 'median'
  },
  {
    aggregation: 'min',
    inField: 'value',
    outField: 'min'
  },
  {
    aggregation: 'max',
    inField: 'value',
    outField: 'max'
  },
  {
    aggregation: 'deviation',
    inField: 'value',
    outField: 'deviation'
  },
  {
    aggregation: 'variance',
    inField: 'value',
    outField: 'variance'
  },
  {
    aggregation: 'count',
    inField: '',
    outField: 'count'
  }
];

//run statistics
var aggregated = turf.aggregate(hexgrid, fc, aggregations);

//loop hex and fix non-number values
for(var x=0;x<Object.keys(aggregated.features).length;x++){

  if (!aggregated.features[x].properties.count){
    aggregated.features[x].properties.count = 0;
  }

  if (!aggregated.features[x].properties.sum){
    aggregated.features[x].properties.sum = 0;
  }

  if (!aggregated.features[x].properties.average){
    aggregated.features[x].properties.average = 0;
  }

  if (!aggregated.features[x].properties.median){
    aggregated.features[x].properties.median = 0;
  }

  if (!aggregated.features[x].properties.min){
    aggregated.features[x].properties.min = 0;
  }

  if (!aggregated.features[x].properties.max){
    aggregated.features[x].properties.max = 0;
  }

  if (!aggregated.features[x].properties.deviation){
    aggregated.features[x].properties.deviation = 0;
  }

  if (!aggregated.features[x].properties.variance){
    aggregated.features[x].properties.variance = 0;
  }

}

//write hexgrid with statistics
fs.writeFileSync('./hexgridvalues.geojson', JSON.stringify(aggregated))

//break data into 20 classes based on jenks method
var breaks = turf.jenks(fc, 'value', 20);

//create isolines
var isolined = turf.isolines(fc, 'value', 10, breaks);
fs.writeFileSync('./isolines.geojson', JSON.stringify(isolined));
