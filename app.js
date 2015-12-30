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


//write output file
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



//get dataset gdal data
var cloudDS = gdal.open(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('cloud') + ".TIF");
var nirDS = gdal.open(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('nir') + ".TIF");
var swir1DS = gdal.open(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('swir1') + ".TIF");
var swir2DS = gdal.open(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('swir2') + ".TIF");
var tir1DS = gdal.open(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('tir1') + ".TIF");
var tir2DS = gdal.open(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('tir2') + ".TIF");
var redDS = gdal.open(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('red') + ".TIF");
var greenDS = gdal.open(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('green') + ".TIF");
var blueDS = gdal.open(indirectory + sceneid + "/" + sceneid + "_"+ getBandEnder('blue') + ".TIF");


var wrs2 = fs.readFileSync("wrs2codes.geojson");
wrs2 = JSON.parse(wrs2);
var wrs2code = getWRS2Code(sceneid);

var wrs2Scene = turf.filter(wrs2,'wrs2_code',wrs2code.toString());
writeFile (outdirectory,sceneid,'scene',wrs2Scene)
//fs.writeFileSync('./myscene.geojson', JSON.stringify(wrs2Scene));

var sceneExtent = turf.extent(wrs2Scene)

//get extent of change mosaic
// var geoTransform = dataset.geoTransform
// var minx = geoTransform[0];
// var maxy = geoTransform[3];
// var maxx = minx + geoTransform[1]*dataset.rasterSize.x
// var miny = maxy + geoTransform[5]*dataset.rasterSize.y
// var datasetBox = [minx, miny, maxx, maxy];

//get change mosaic exent
//var datasetPoly = turf.bboxPolygon(datasetBox);
var datasetPoly = turf.bboxPolygon(sceneExtent);
var bbox = turf.extent(datasetPoly);
//fs.writeFileSync('./bbox.geojson', JSON.stringify(bbox));
writeFile (outdirectory,sceneid,'bbox',bbox);


//get chnage mosaic extent as a polygon (random requires this)
var poly = turf.bboxPolygon(bbox);
//fs.writeFileSync('./poly.geojson', JSON.stringify(poly));
writeFile (outdirectory,sceneid,'poly',poly);


//get a set of random points
var points = turf.random('points', numberpoints, {bbox: bbox});
//fs.writeFileSync('./points.geojson', JSON.stringify(points));
writeFile (outdirectory,sceneid,'points',points);


//points = turf.pointGrid( bbox,50,'kilometers');
//fs.writeFileSync('./points.geojson', JSON.stringify(points));

var bandsOne = cloudDS.bands;
var bandOne = bandsOne.get(1);
var pixelsOne = bandOne.pixels;

var bandsTwo = nirDS.bands;
var bandTwo = bandsTwo.get(1);
var pixelsTwo = bandTwo.pixels;

//create hexagon grid
var hexgrid = turf.hexGrid(bbox, gridsize, gridUnits);
var boxgrid = turf.squareGrid(bbox, gridsize, gridUnits);

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
//fs.writeFileSync('./hexgrid.geojson', JSON.stringify(hexgrid))
writeFile (outdirectory,sceneid,'hexgrid',hexgrid);

//fs.writeFileSync('./boxgrid.geojson', JSON.stringify(boxgrid))
writeFile (outdirectory,sceneid,'boxgrid',boxgrid);

//ceate an empty features array for inserting points
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

    //transform wgs84 point to pixel location
    var transform = new gdal.CoordinateTransformation(gdal.SpatialReference.fromEPSG(4326),cloudDS);
    var ptnew = transform.transformPoint(x,y);

    //get change value of point
    var valOne = pixelsOne.get(ptnew.x,ptnew.y);
    var valTwo= pixelsTwo.get(ptnew.x,ptnew.y);
    var ndvi = 0;
    var cloudVal = 0;
    var bits = "";
    var isCloud = false;
    var isCirrus = false;

    if(valOne){
      var base =  createBinaryString(valOne)//valOne.toString(2) //createBinaryString(valOne); //(valTwo - valOne) / (valTwo + valOne)
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
        //if(ndvi===null){ndvi=0};
    //f (val>0){
    //create a new point with a property (attribute) of the change value
    //if(ndvi===0){
      var pt = turf.point([x,y], {valueOne: valOne,valueTwo: valTwo,cloud: cloudVal});
      //add new point to new feature
      features.push(pt);
   //}
    //}
    //console.log( parseFloat(((i+1)/Object.keys(hexgrid.features).length)*10).toFixed(2) )
 }
}

//create a featurecollection for output as geojson
var fc = turf.featurecollection(features);
//fs.writeFileSync('./randomptswithvalues.geojson', JSON.stringify(fc));
writeFile (outdirectory,sceneid,'points_withvalues',fc);


//setup statistics for points in hexgrid
var aggregations = [
  {
    aggregation: 'sum',
    inField: statfield,
    outField: 'sum'
  },
  {
    aggregation: 'average',
    inField: statfield,
    outField: 'average'
  },
  {
    aggregation: 'median',
    inField: statfield,
    outField: 'median'
  },
  {
    aggregation: 'min',
    inField: statfield,
    outField: 'min'
  },
  {
    aggregation: 'max',
    inField: statfield,
    outField: 'max'
  },
  {
    aggregation: 'deviation',
    inField: statfield,
    outField: 'deviation'
  },
  {
    aggregation: 'variance',
    inField: statfield,
    outField: 'variance'
  },
  {
    aggregation: 'count',
    inField: '',
    outField: 'count'
  }
];

//run statistics
console.log('Generating statistics');
var aggregated = turf.aggregate(hexgrid, fc, aggregations);

//loop hex and fix non-number values
console.log('Fix nulls');
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

aggregated = turf.remove(aggregated,'sum',0);

//write hexgrid with statistics
//fs.writeFileSync('./hexgridvalues.geojson', JSON.stringify(aggregated))
writeFile (outdirectory,sceneid,'hexgrid_values',aggregated);


//break data into 20 classes based on jenks method
var breaks = turf.jenks(fc, 'valueOne', 5);

//create isolines
var isolined = turf.isolines(fc, statfield, 10, breaks);
writeFile (outdirectory,sceneid,'isolines',isolined);
//fs.writeFileSync('./isolines.geojson', JSON.stringify(isolined));

//create isobands
var isolined = turf_isobands(fc, statfield, 10, breaks);
writeFile (outdirectory,sceneid,'isobands',isolined);
//fs.writeFileSync('./isobands.geojson', JSON.stringify(isolined));
