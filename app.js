//requires
var gdal = require("gdal");
var fs = require('fs');
var turf = require('turf');
var turf_isobands = require('turf-isobands');
var program = require('commander');

var total_startTime = new Date().getTime();
var total_endTime;

//args
program
    .version('0.0.1')
    .usage('[options] ')
    .option('-z, --gridsize <float>', 'Size of grid in Kilometers', parseFloat)
    .option('-p, --numberpoints <int>', 'Size of grid in Kilometers', parseInt)
    .option('-g, --gridtype <String>', 'set the grid type <hex or box>', String)
    .option('-i, --inimage <String>', 'Directory containing scene data', String)
    .option('-o, --outdirectory <String>', 'Directory for all output', String)
    .parse(process.argv);

//get arguments into varriables
var inimage = program.inimage;
var numberpoints = program.numberpoints;
var gridsize = program.gridsize;
var outdirectory = program.outdirectory;
var gridtype = program.gridtype;

var gridUnits = 'kilometers';

var useCenter = false;

//set user grid centroid if number of po
if(numberpoints===0){
   useCenter = true;
}

//get band to append to scene name.  - i.e. cloud == _BQA , nir = _B5
//this is what is appended to the secene name in the in directory.
var getBandEnder = function(bandtype){
  var type = '';
  switch (bandtype) {
    //this is only available for landsat 8 data
    //will have to communicate with python fmask for
    //other landsat products
    //for now only dealing Landsat 8 - willl expand later
    case 'cloud':
      //this is the quality band contains a 16bit number for clouds and other info
      type = 'BQA';
      break;
    case 'nir':
      type = 'B5';
      break;
    case 'swir1':
      type = 'B6';
      break;
    case 'swir2':
      type = 'B7';
      break;
    case 'tir1':
      type = 'B10';
      break;
    case 'tir1':
      type = 'B11';
      break;
    case 'red':
      type = 'B4';
      break;
    case 'green':
      type = 'B3';
      break;
    case 'blue':
      type = 'B2';
      break;
    default:
      type = 'B3';
  }
  return type;
}


//get gdal pixels - needed to get a raster value at a x,y Coordinate
var getGDALdataset = function(rasterName){

  console.log(rasterName);
  //open raster in GDAL
  var dataSet = gdal.open(rasterName);;

  //return gdal pixels
  return dataSet;
}


//get gdal pixels - needed to get a raster value at a x,y Coordinate
var getGDALPixels = function(dataset){

  //get the pixels from the bands
  //assumes we are passing single band landsat image
  var bands = dataset.bands;
  var band = bands.get(1);
  var pixels = band.pixels;

  //return gdal pixels
  return pixels;
}

//write an output file
var writeFile = function(outdirectory,name,data){

  //write file
  fs.writeFileSync(outdirectory + '/' + name + '.geojson', JSON.stringify(data))
  return;
}

//add fields to data to statistics
var addSatisticFields = function(gridData){
  //loop grid and add properties to capture statistics for points
  for(var x=0;x<Object.keys(gridData.features).length;x++){
    gridData.features[x].properties.count=0;
    gridData.features[x].properties.sum=0;
    gridData.features[x].properties.average=0;
    gridData.features[x].properties.median=0;
    gridData.features[x].properties.min=0;
    gridData.features[x].properties.max=0;
    gridData.features[x].properties.deviation=0;
    gridData.features[x].properties.variance=0;
  }

 return gridData;
}

//tranform point to raster projection
var transformPtWGS = function(dataset,x,y){
  var srs = dataset.srs.toWKT();

  console.log(srs);
  //transform wgs84 point to pixel location
  //pass dataset to use dataset projection
  var transform = new gdal.CoordinateTransformation(gdal.SpatialReference.fromWKT(srs),gdal.SpatialReference.fromEPSG(4326));
  var transformedPT = transform.transformPoint(x,y);

  return transformedPT;
}



//tranform point to raster projection
var transformPt = function(dataset,x,y){

  //transform wgs84 point to pixel location
  //pass datasdet to use dataset projection
  var transform = new gdal.CoordinateTransformation(gdal.SpatialReference.fromEPSG(4326),dataset);
  var transformedPT = transform.transformPoint(x,y);

  return transformedPT;
}

//use gdal to get value of pixel at a Coordinate
var getPixelValue = function(dataset,pixels,x,y){

  //transform wgs84 point to pixel location
  var ptnew = transformPt(dataset,x,y)

  //get change value of point
  //var pixels = getGDALPixels(dataset)
  var value = pixels.get(ptnew.x,ptnew.y);

  return value;
}

var getCenterPts = function(grid){
  var pts = [];
  for(var i = 0; i < grid.features.length; i++) {
    var gridFeature = grid.features[i].geometry;
    gridFC = turf.featurecollection(gridFeature);
    pt = turf.centroid(gridFeature);
    //console.log(gridFC);
    pts.push(pt);
  }
  pts = turf.featurecollection(pts);
  return pts;
}

var setAggreations = function(statisticsField){
  //setup statistics for points in grid
  var agg = [
    {
      aggregation: 'sum',
      inField: statisticsField,
      outField: 'sum'
    },
    {
      aggregation: 'average',
      inField: statisticsField,
      outField: 'average'
    },
    {
      aggregation: 'median',
      inField: statisticsField,
      outField: 'median'
    },
    {
      aggregation: 'min',
      inField: statisticsField,
      outField: 'min'
    },
    {
      aggregation: 'max',
      inField: statisticsField,
      outField: 'max'
    },
    {
      aggregation: 'deviation',
      inField: statisticsField,
      outField: 'deviation'
    },
    {
      aggregation: 'variance',
      inField: statisticsField,
      outField: 'variance'
    },
    {
      aggregation: 'count',
      inField: '',
      outField: 'count'
    }
  ];

  return agg;

}
//gets duration based on start and end time milliseconds
var msToTime = function (duration) {
    'use strict';
    var milliseconds = duration,
        seconds = parseInt((duration / 1000) % 60),
        minutes = parseInt((duration / (1000 * 60)) % 60),
        hours = parseInt((duration / (1000 * 60 * 60)) % 24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
};

//make nulls 0 in statics
//this improves the ability for GIS to render
//the data
var fixNulls = function(data){

  for(var x=0;x<Object.keys(data.features).length;x++){

    if (!data.features[x].properties.count){
      data.features[x].properties.count = 0;
    }

    if (!data.features[x].properties.sum){
      data.features[x].properties.sum = 0;
    }

    if (!data.features[x].properties.average){
      data.features[x].properties.average = 0;
    }

    if (!data.features[x].properties.median){
      data.features[x].properties.median = 0;
    }

    if (!data.features[x].properties.min){
      data.features[x].properties.min = 0;
    }

    if (!data.features[x].properties.max){
      data.features[x].properties.max = 0;
    }

    if (!data.features[x].properties.deviation){
      data.features[x].properties.deviation = 0;
    }

    if (!data.features[x].properties.variance){
      data.features[x].properties.variance = 0;
    }

  }

  data = turf.remove(data,'sum',0);

  return data;
}

//check conidition of binary data
var checkCondition = function(binary){
   var condition = false;

   switch (binary) {
     case "10":
       condition = true;
       break;
     case "11":
       condition = true;
       break;
    case "01":
       condition = false;
       break;
    case "01":
       condition = false;
       break;
    case "0":
       condition = false;
       break;
    case "1":
       condition = true;
       break;
     default:
     condition = false;
   }


   return condition;
}

var gitBinaryType = function(binary,type){
  var newBinary = 0;

  switch (type) {
    case "cloud":
      newBinary = binary.substr(0,2);
      break;
    case "cirrus":
      newBinary = binary.substr(2,2);
      break;
   case "snow":
      newBinary = binary.substr(4,2);
      break;
   case "vegetation":
      newBinary = binary.substr(6,2);
      break;
   case "shadow":
      newBinary = binary.substr(8,2);
      break;
   case "water":
      newBinary = binary.substr(10,2);
      break;
   case "reserved":
      newBinary = binary.substr(12,1);
      break;
   case "terrian":
      newBinary = binary.substr(13,1);
      break;
   case "dropped":
      newBinary = binary.substr(14,1);
      break;
   case "designated":
      newBinary = binary.substr(15,1);
      break;
    default:
    newBinary = 0;
  }
  return newBinary;
}

var makeValue = function(condition){
  var val = 0;
  if(condition){
    val = 1;
  }

  return val;
}
//make a point with property attributes
var makePoint = function(id,x,y){

    //get pixel values for bands
    var imageValue = getPixelValue(inDataSet,inPixels,x,y)

    var properties = {
      id:id,
      x:x,
      y:y,
      value:imageValue
    }

    //create a new point with a property (attribute) of the change value
    var pt = turf.point([x,y], properties);
    return pt;
}

//create and write the Point with Values GeoJSON data
var createPointGeoJSON = function(data){

  //create a featurecollection for output as geojson
  var fc = turf.featurecollection(data);
  writeFile (outdirectory,'points_withvalues',fc);

  return fc;
}

//check if the current point is in the scene
var isPointInScene = function(x, y, index, scene){
  var isInside = true;

  //get indivual point
  var tmpPT = turf.point([x,y],{id:index});

  //check if point is inside the scene polygon
  isInside = turf.inside(tmpPT, scene);

  return isInside;
}

//creaete a grid of basic statiscs for a numerical field
var createStatisticsGrid = function(field){

  var st = new Date().getTime();
  console.log();
  console.log("Starting "  + field);
  console.log("  Running statistics for "  + field);
  var aggregations = setAggreations(field)
  var aggregated = turf.aggregate(grid_GeoJSON, fc, aggregations);

  console.log("  Fixing nulls for " + field);
  var aggregatedRet = fixNulls(aggregated);

  console.log("  Writing grid " + field);
  writeFile (outdirectory,field + '_grid_values',aggregatedRet);

  var et = new Date().getTime();
  var t = et - st;
  var tm = msToTime(t);
  console.log("Completed "  + field + " in " + tm);

  return aggregatedRet;
}

//create an isoline geojson file
var createIsoLines = function(pnts,field){
  var breaks = turf.jenks(pnts, field, 10);
  var isoline = turf.isolines(pnts, field, 10, breaks);
  writeFile (outdirectory, field + '_isolines',isoline);

  return isoline;
}

//create an isoband geojson file
var createIsoBands = function(pnts,field){
  var breaks = turf.jenks(pnts, field, 10);
  var isoband = turf_isobands(pnts, field, 10, breaks);
  writeFile (outdirectory, field + '_isobands',isoband);

  return isoband;
}


//get GDAL dataset for bands
//get GDAL data set
var inDataSet = getGDALdataset(inimage);

//get extent of change mosaic
var geoTransform = inDataSet.geoTransform
var minx = geoTransform[0];
var maxy = geoTransform[3];
var maxx = minx + geoTransform[1]*inDataSet.rasterSize.x
var miny = maxy + geoTransform[5]*inDataSet.rasterSize.y

var minBoxPt = transformPtWGS(inDataSet,minx,miny)
var maxBoxPt = transformPtWGS(inDataSet,maxx,maxy)

minx = minBoxPt.x
miny = minBoxPt.y

maxx = maxBoxPt.x
maxy = maxBoxPt.y

//make wgs84 bbounding box
var datasetBox = [minx, miny, maxx, maxy];
//var datasetBox = turf.size(datasetBox,-0.95)
//get pixes for raster data
//needed for value
var inPixels = getGDALPixels(inDataSet)



//get  or extent of the scene
var bbox = datasetBox;//turf.extent(wrs2Scene)

//make bounding box a polygon so we export the geojson
//var datasetPoly = turf.bboxPolygon(bbox);
var poly = turf.bboxPolygon(bbox);
writeFile (outdirectory,'poly',poly);

var datasetFeatures = turf.featurecollection(poly);


//extract geojson for the indivual scene
var imageBox = poly; //turf.filter(wrs2,'wrs2_code',wrs2code.toString());
writeFile (outdirectory,'imagebox',imageBox)

//create grid
var grid_GeoJSON;
console.log('Creating Grids');
if(gridtype==='box'){
  grid_GeoJSON = turf.squareGrid(bbox, gridsize, gridUnits);
}else{
  grid_GeoJSON = turf.hexGrid(bbox, gridsize, gridUnits);
}

//add statistics fields
grid_GeoJSON = addSatisticFields(grid_GeoJSON);

//write the grids without values populated
writeFile (outdirectory,'grid',grid_GeoJSON);

console.log('Getting Points');
if(useCenter){
  var points = getCenterPts(grid_GeoJSON);
}else{
  //get a set of random points
  var points = turf.random('points', numberpoints, {bbox: bbox});
}

//write points file
writeFile (outdirectory,'points',points);

//ceate an empty features array for inserting new points
var features = [];

var percentComplete = 0;

//loop points to get change value at each random point
console.log('Getting change value');
var points_startTime = new Date().getTime();
var points_endTime;
for(var i = 0; i < points.features.length; i++) {

  //get x,y
  var x = points.features[i].geometry.coordinates[0];
  var y = points.features[i].geometry.coordinates[1]

  //isInside = isPointInScene(x, y, i, datasetFeatures.features[0]);

  //if( isInside ){
    var pt = makePoint(i,x,y);

    //add new point to new feature
    if(pt){
      features.push(pt);
    }
 //}

  percentComplete = ((i/points.features.length)*100).toFixed(0);
  process.stdout.write("  values completed: " + percentComplete  + "% \r");

}
points_endTime = new Date().getTime();
var points_Time = points_endTime - points_startTime;
var points_timeMessage = msToTime(points_Time);
console.log('completed Values in ' + points_timeMessage);

//create the Point with values geojson
var fc = createPointGeoJSON(features)

//run statistics
console.log();
console.log('Generating statistics');

var Stats_startTime = new Date().getTime();
var Stats_endTime;

createStatisticsGrid('value')


Stats_endTime = new Date().getTime();
var Stats_Time = Stats_endTime - Stats_startTime;
var  Stats_timeMessage = msToTime(Stats_Time);

console.log();
console.log('Completed Statistics Grids in ' + Stats_timeMessage);
console.log();

//create isolines
console.log('Make Isolines');
createIsoLines(fc, 'value');

//create isobands
console.log('Make Isobands');
createIsoBands(fc, 'value');

total_endTime = new Date().getTime();
var total_Time = total_endTime - total_startTime;
var total_timeMessage = msToTime(total_Time);

console.log();
console.log('Completed in: ' + total_timeMessage);
console.log();

fc  = null;

inDataSet = null;
inPixels = null;
