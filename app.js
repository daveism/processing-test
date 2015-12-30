//requires
var gdal = require("gdal");
var fs = require('fs');
var turf = require('turf');
var turf_isobands = require('turf-isobands');
var program = require('commander');


//args
program
    .version('0.0.1')
    .usage('[options] ')
    .option('-s, --sceneid <string>', 'Sceneid for landsat 8', String)
    .option('-z, --gridsize <float>', 'Size of hexgrid in Kilometers', parseFloat)
    .option('-p, --numberpoints <int>', 'Size of hexgrid in Kilometers', parseInt)
    .option('-t, --statfield <String>', 'set the field to calculate statistics for', String)
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
var statfield = program.statfield;

var gridUnits = 'kilometers';

var useCenter = false;

//set user hexgrid centroid if number of po
// if(numberpoints===0){
//   useCenter = true;
// }

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
var getPixelValue = function(dataset,x,y){

  //transform wgs84 point to pixel location
  var ptnew = transformPt(dataset,x,y)

  //get change value of point
  var pixels = getGDALPixels(dataset)
  var value = pixels.get(ptnew.x,ptnew.y);

  return value;
}


var setAggreations = function(statisticsField){
  //setup statistics for points in grid
  var aggregations = [
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

  return aggregations;

}

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
// var cloudPixels = getGDALPixels(cloudDS);
// var nirPixels = getGDALPixels(nirDS);
// var swir1Pixels = getGDALPixels(swir1DS);
// var swir2Pixels = getGDALPixels(swir2DS);
// var tir1Pixels = getGDALPixels(tir1DS);
// var tir2Pixels = getGDALPixels(tir2DS);
// var redPixels = getGDALPixels(redDS);
// var greenPixels = getGDALPixels(greenDS);
// var bluePixels = getGDALPixels(blueDS);

//get the geojson for all scenes...
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

//get a set of random points
var points = turf.random('points', numberpoints, {bbox: bbox});
writeFile (outdirectory,sceneid,'points',points);

//create hexagon grid
var hexgrid = turf.hexGrid(bbox, gridsize, gridUnits);
var boxgrid = turf.squareGrid(bbox, gridsize, gridUnits);

//add statistics fields
hexgrid = addSatisticFields(hexgrid);
boxgrid =  addSatisticFields(boxgrid);

//write the grids without values populated
writeFile (outdirectory,sceneid,'hexgrid',hexgrid);
writeFile (outdirectory,sceneid,'boxgrid',boxgrid);

//ceate an empty features array for inserting new points
var features = [];

//loop points to get change value at each random point
console.log('Getting change value');
for(var i = 0; i < points.features.length; i++) {
  //get indivual point
  var x = points.features[i].geometry.coordinates[0];
  var y = points.features[i].geometry.coordinates[1]
  var tmpPT = turf.point([x,y],{id:i});
  //console.log(wrs2Scene.features.length)
   if( turf.inside(tmpPT, wrs2Scene.features[0])){

    //get pixel values for bands
    var cloudValue = getPixelValue(cloudDS,x,y)
    var nirValue = getPixelValue(nirDS,x,y)
    var swir1Value = getPixelValue(swir1DS,x,y);
    var swir2Value = getPixelValue(swir2DS,x,y);
    var tir1Value = getPixelValue(tir1DS,x,y);
    var tir2Value = getPixelValue(tir2DS,x,y);
    var redValue = getPixelValue(redDS,x,y)
    var greenValue = getPixelValue(greenDS,x,y);
    var blueValue = getPixelValue(blueDS,x,y);

    //calc ndvi
    var ndvi = (nirValue - redValue) / (nirValue + redValue);

    //calc ndmi
    var ndmi = (nirValue - swir1Value) / (nirValue + swir1Value);

    //calc swir 
    var swir =  (swir2Value -  swir1Value) / Math.abs(swir1Value)

    var cloudVal = 0;
    var bits = "";
    var isCloud = false;
    var isCirrus = false;

    if(cloudValue){
      var base =  createBinaryString(cloudValue)
      //valOne.toString(2) //createBinaryString(valOne); //(valTwo - valOne) / (valTwo + valOne)
      if(base[0] ){
        bits = base[0]
      }else{
        bits = "0"
      }

      if(base[1]){
        bits = bits + base[1]
      }else{
        bits = bits + "0"
      }

      switch (bits) {
        case "10":
          isCloud = true;
          break;
        case "11":
          isCloud = true;
          break;
       case "01":
          isCloud = false;
          break;
       case "01":
          isCloud = false;
          break;
      default:
        isCloud = false;
      }

      if(base[2]){
        bits = base[2]
      }else{
        bits = "0"
      }

      if(base[3]){
        bits = bits + base[3]
      }else{
        bits = bits + "0"
      }

      switch (bits) {
        case "10":
          isCirrus = true;
          break;
        case "11":
          isCirrus = true;
          break;
       case "01":
          isCirrus = false;
          break;
       case "01":
          isCirrus = false;
          break;
        default:
        isCirrus = false;
      }

    if(isCloud){
      cloudVal = 1
    }
    if(isCirrus){
      cloudVal = 1
    }
  }

  //var properties = {id:i,value:value,ndvi:ndvi,ndmi:ndmi,swir:swir,cloud:cloud,shadow:shadow,water:water,dropped:dropped,vegetation:vegetation};
 var properties = {
   id:i,
   x:x,
   y:y,
   qa:cloudValue,
   nir:nirValue,
   swir1:swir1Value,
   swir2:swir2Value,
   tir1:tir1Value,
   tir2:tir2Value,
   red:redValue,
   green:greenValue,
   blue:blueValue,
   cloud:cloudVal,
   swir:swir,
   ndmi:ndmi,
   ndvi:ndvi
 }
        //if(ndvi===null){ndvi=0};
    if (cloudVal === 0){
    //create a new point with a property (attribute) of the change value
    //if(ndvi===0){
      var pt = turf.point([x,y], properties);
      //add new point to new feature
      features.push(pt);
   //}
  }
    //console.log( parseFloat(((i+1)/Object.keys(hexgrid.features).length)*10).toFixed(2) )
 }
}

//create a featurecollection for output as geojson
var fc = turf.featurecollection(features);
//fs.writeFileSync('./randomptswithvalues.geojson', JSON.stringify(fc));
writeFile (outdirectory,sceneid,'points_withvalues',fc);

//run statistics
console.log('Generating statistics');
var aggregations = '';
var aggregated = '';

console.log(' Hex NDMI');
aggregations = setAggreations('ndmi')
ndmi_aggregated = turf.aggregate(hexgrid, fc, aggregations);

console.log(' Hex NDVI');
aggregations = setAggreations('ndvi')
ndvi_aggregated = turf.aggregate(hexgrid, fc, aggregations);

console.log(' Hex SWIR');
aggregations = setAggreations('swir')
swir_aggregated = turf.aggregate(hexgrid, fc, aggregations);

//loop hex and fix non-number values
console.log('Fix nulls');
ndmi_aggregated = fixNulls(ndmi_aggregated);
ndvi_aggregated = fixNulls(ndvi_aggregated);
swir_aggregated = fixNulls(swir_aggregated);

//write hexgrid with statistics
console.log('Write Grids');
writeFile (outdirectory,sceneid,'ndmi_hexgrid_values',ndmi_aggregated);
writeFile (outdirectory,sceneid,'ndvi_hexgrid_values',ndvi_aggregated);
writeFile (outdirectory,sceneid,'swir_hexgrid_values',swir_aggregated);

//break data into 20 classes based on jenks method
console.log('Make Clasess');
var ndmi_breaks = turf.jenks(fc, 'ndmi', 10);
var ndvi_breaks = turf.jenks(fc, 'ndmi', 10);
var swir_breaks = turf.jenks(fc, 'ndmi', 10);

//create isolines
console.log('Make Isolines');
var ndmi_isolined = turf.isolines(fc, 'ndmi', 10, ndmi_breaks);
writeFile (outdirectory,sceneid,'ndmi_isolines',ndmi_isolined);

var ndvi_isolined = turf.isolines(fc, 'ndvi', 10, ndvi_breaks);
writeFile (outdirectory,sceneid,'ndvi_isolines',ndvi_isolined);

var swir_isolined = turf.isolines(fc, 'swir', 10, swir_breaks);
writeFile (outdirectory,sceneid,'swir_isolines',swir_isolined);

//create isobands
console.log('Make Isobands');
var ndmi_isolined = turf_isobands(fc, 'ndmi', 10, ndmi_breaks);
writeFile (outdirectory,sceneid,'ndmi_isobands',ndmi_isolined);

var ndvi_isolined = turf_isobands(fc, 'ndvi', 10, ndvi_breaks);
writeFile (outdirectory,sceneid,'ndvi_isobands',ndvi_isolined);

var swir_isolined = turf_isobands(fc, 'ndmi', 10, swir_breaks);
writeFile (outdirectory,sceneid,'swir_isobands',swir_isolined);
