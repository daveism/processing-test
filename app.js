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
    .option('-s, --sceneid <string>', 'Sceneid for landsat 8', String)
    .option('-z, --gridsize <float>', 'Size of grid in Kilometers', parseFloat)
    .option('-p, --numberpoints <int>', 'Size of grid in Kilometers', parseInt)
    .option('-g, --gridtype <String>', 'set the grid type <hex or box>', String)
    .option('-i, --indirectory <String>', 'Directory containing scene data', String)
    .option('-o, --outdirectory <String>', 'Directory for all output', String)
    .parse(process.argv);

    // .option('-d, --sceneidtow', 'Sceneid for landsat 8', String)

//get arguments into varriables
var sceneid = program.sceneid;
var indirectory = program.indirectory;
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
var writeFile = function(outdirectory,sceneid,name,data){

  //write file
  fs.writeFileSync(outdirectory + '/' + sceneid + '_' + name + '.geojson', JSON.stringify(data))
  return;
}

var getWRS2Code = function(sceneid){

  //get wrs to code for filter the scene's shape
  var wrs2code = sceneid.substr(3,6)

  return wrs2code;
}

var createBinaryString = function(nMask) {
  // nMask must be between -2147483648 and 2147483647
  for (var nFlag = 0, nShifted = nMask, sMask = ""; nFlag < 32; nFlag++, sMask += String(nShifted >>> 31), nShifted <<= 1);
  return sMask.substr(16,32);
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
    var cloudValue = getPixelValue(cloudDS,cloudPixels,x,y)
    var nirValue = getPixelValue(nirDS,nirPixels,x,y)
    var swir1Value = getPixelValue(swir1DS,swir1Pixels,x,y);
    var swir2Value = getPixelValue(swir2DS,swir2Pixels,x,y);
    //var tir1Value = getPixelValue(tir1DS,tir1Pixels,x,y);
    //var tir2Value = getPixelValue(tir2DS,tir2Pixels,x,y);
    var redValue = getPixelValue(redDS,redPixels,x,y)
    var greenValue = getPixelValue(greenDS,greenPixels,x,y);
    var blueValue = getPixelValue(blueDS,bluePixels,x,y);

    //calc ndvi
    var ndvi = (nirValue - redValue) / (nirValue + redValue);

    //calc ndmi
    var ndmi = (nirValue - swir1Value) / (nirValue + swir1Value);

    //calc swir
    var swir =  (swir2Value -  swir1Value) / Math.abs(swir1Value)

    var cloudVal = 0;
    var cirrusVal = 0;
    var waterVal = 0;
    var shadowVal = 0;
    var vegetationVal = 0;
    var droppedVal = 0;
    var bits = "";
    var isCloud = false;
    var isCirrus = false;

    if(cloudValue){
      var base =  createBinaryString(cloudValue);
      cloudValue = base;

      bits = gitBinaryType(base,'cloud');
      isCloud = checkCondition(bits);
      cloudVal = makeValue(isCloud);

      bits = gitBinaryType (base,'cirrus');
      isCirrus = checkCondition(bits);
      cirrusVal = makeValue(isCirrus);

      bits = gitBinaryType(base,'water')
      isWater = checkCondition(bits);
      waterVal = makeValue(isWater);

      bits = gitBinaryType(base,'shadow')
      isShadow = checkCondition(bits);
      shadowVal = makeValue(isShadow);

      bits = gitBinaryType(base,'vegetation')
      isVegetation = checkCondition(bits);
      vegetationVal = makeValue(isVegetation);

      bits = gitBinaryType(base,'dropped')
      isDropped = checkCondition(bits);
      droppedVal = makeValue(isDropped);

    }

    var properties = {
      //id:id,
      //x:x,
      //y:y,
      //qa:cloudValue,
      nir:nirValue,
      swir1:swir1Value,
      swir2:swir2Value,
      //tir1:tir1Value,
      //tir2:tir2Value,
      red:redValue,
      green:greenValue,
      blue:blueValue,
      rgb:'(' + (redValue/255).toFixed(0) + ',' + (blueValue/255).toFixed(0) + ',' +  (greenValue/255).toFixed(0) + ')',
      cloud:cloudVal,
      cirrus:cirrusVal,
      shadow:shadowVal,
      water:waterVal,
      vegetation:vegetationVal,
      dropped:droppedVal,
      swir:parseFloat((swir*100).toFixed(2)),
      ndmi:parseFloat((ndmi*100).toFixed(2)),
      ndvi:parseFloat((ndvi*100).toFixed(2))
    }

    if (cloudVal === 0 && cirrusVal === 0){
      //create a new point with a property (attribute) of the change value
      var pt = turf.point([x,y], properties);
      return pt;
  }else{
    return null;
  }
}

//create and write the Point with Values GeoJSON data
var createPointGeoJSON = function(data){

  //create a featurecollection for output as geojson
  var fc = turf.featurecollection(data);
  writeFile (outdirectory,sceneid,'points_withvalues',fc);

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
  var aggregated = fixNulls(aggregated);

  console.log("  Writing grid " + field);
  writeFile (outdirectory,sceneid,field + '_grid_values',aggregated);

  var et = new Date().getTime();
  var t = et - st;
  var tm = msToTime(t);
  console.log("Completed "  + field + " in " + tm);

  return aggregated;
}

//create an isoline geojson file
var createIsoLines = function(aggregate,field){
  var breaks = turf.jenks(aggregate, 'average', 10);
  var isoline = turf.isolines(fc, field, 25, breaks);
  writeFile (outdirectory,sceneid, field + '_isolines',isoline);

  return isoline;
}

//create an isoband geojson file
var createIsoBands = function(aggregate,field){
  var breaks = turf.jenks(aggregate, 'average', 10);
  var isoband = turf_isobands(fc, field, 25, breaks);
  writeFile (outdirectory,sceneid, field + '_isobands',isoband);

  return isoband;
}

//get GDAL dataset for bands
var cloudDS = getGDALdataset(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('cloud') + ".TIF");
var nirDS = getGDALdataset(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('nir') + ".TIF");
var swir1DS = getGDALdataset(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('swir1') + ".TIF");
var swir2DS = getGDALdataset(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('swir2') + ".TIF");
var tir1DS = getGDALdataset(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('tir1') + ".TIF");
var tir2DS = getGDALdataset(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('tir2') + ".TIF");
var redDS = getGDALdataset(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('red') + ".TIF");
var greenDS = getGDALdataset(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('green') + ".TIF");
var blueDS = getGDALdataset(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('blue') + ".TIF");

//get pixes for raster data
//needed for value
var cloudPixels = getGDALPixels(cloudDS);
var nirPixels = getGDALPixels(nirDS);
var swir1Pixels = getGDALPixels(swir1DS);
var swir2Pixels = getGDALPixels(swir2DS);
var tir1Pixels = getGDALPixels(tir1DS);
var tir2Pixels = getGDALPixels(tir2DS);
var redPixels = getGDALPixels(redDS);
var greenPixels = getGDALPixels(greenDS);
var bluePixels = getGDALPixels(blueDS);

//get the geojson for all scenes...
console.log('Getting Scene info');
var wrs2 = fs.readFileSync("wrs2codes.geojson");
wrs2 = JSON.parse(wrs2);

//get the wrs2code from the scene id
var wrs2code = getWRS2Code(sceneid);

//extract geojson for the indivual scene
var wrs2Scene = turf.filter(wrs2,'wrs2_code',wrs2code.toString());
writeFile (outdirectory,sceneid,'scene',wrs2Scene)

//get  or extent of the scene
var bbox = turf.extent(wrs2Scene)

//make bounding box a polygon so we export the geojson
var datasetPoly = turf.bboxPolygon(bbox);
var poly = turf.bboxPolygon(bbox);
writeFile (outdirectory,sceneid,'poly',poly);

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
writeFile (outdirectory,sceneid,'grid',grid_GeoJSON);

console.log('Getting Points');
if(useCenter){
  var points = getCenterPts(grid_GeoJSON);
}else{
  //get a set of random points
  var points = turf.random('points', numberpoints, {bbox: bbox});
}

//write points file
writeFile (outdirectory,sceneid,'points',points);

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

  isInside = isPointInScene(x, y, i, wrs2Scene.features[0]);

  if( isInside ){
    var pt = makePoint(i,x,y);

    //add new point to new feature
    if(pt){
      features.push(pt);
    }
 }

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

var ndmi_aggregated = createStatisticsGrid('ndmi')
var ndvi_aggregated = createStatisticsGrid('ndvi')
var swir_aggregated = createStatisticsGrid('swir')

Stats_endTime = new Date().getTime();
var Stats_Time = Stats_endTime - Stats_startTime;
var  Stats_timeMessage = msToTime(Stats_Time);

console.log();
console.log('Completed Statistics Grids in ' + Stats_timeMessage);
console.log();

//create isolines
console.log('Make Isolines');
createIsoLines(ndmi_aggregated, 'ndmi');
createIsoLines(ndvi_aggregated, 'ndvi');
createIsoLines(swir_aggregated, 'swir');

//create isobands
console.log('Make Isobands');
createIsoBands(ndmi_aggregated, 'ndmi');
createIsoBands(ndvi_aggregated, 'ndvi');
createIsoBands(swir_aggregated, 'swir');

total_endTime = new Date().getTime();
var total_Time = total_endTime - total_startTime;
var total_timeMessage = msToTime(total_Time);

console.log();
console.log('Completed in: ' + total_timeMessage);
console.log();

fc  = null;

cloudDS = null;
nirDS = null;
swir1DS = null;
swir2DS = null;
tir1DS = null;
tir2DS = null;
redDS = null;
greenDS = null;
blueDS = null;

cloudPixels = null;
nirPixels = null;
swir1Pixels = null;
swir2Pixels = null;
tir1Pixels = null;
tir2Pixels = null;
redPixels = null;
greenPixels = null;
bluePixels = null;
