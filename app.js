//requires
var gdal = require("gdal");
var fs = require('fs');
var turf = require('turf');
var turfb = require('turf-isobands');

function createBinaryString (nMask) {
  // nMask must be between -2147483648 and 2147483647
  for (var nFlag = 0, nShifted = nMask, sMask = ""; nFlag < 32; nFlag++, sMask += String(nShifted >>> 31), nShifted <<= 1);
  return sMask.substr(16,32);
}


//import data
var datasetOne = gdal.open("../Downloads/LC80180352015330LGN02/LC80180352015330LGN02_BQA.TIF");
var datasetTwo = gdal.open("../Downloads/LC80180352015330LGN02/LC80180352015330LGN02_BQA.TIF");


var wrs2 = fs.readFileSync("wrs2codes.geojson");
wrs2 = JSON.parse(wrs2);
var wrs2Scene = turf.filter(wrs2,'wrs2_code',"018035");
fs.writeFileSync('./myscene.geojson', JSON.stringify(wrs2Scene));

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
fs.writeFileSync('./bbox.geojson', JSON.stringify(bbox));

//get chnage mosaic extent as a polygon (random requires this)
var poly = turf.bboxPolygon(bbox);
fs.writeFileSync('./poly.geojson', JSON.stringify(poly));

//get a set of random points
var points = turf.random('points', 100000, {bbox: bbox});
fs.writeFileSync('./points.geojson', JSON.stringify(points));

//points = turf.pointGrid( bbox,50,'kilometers');
//fs.writeFileSync('./points.geojson', JSON.stringify(points));

var bandsOne = datasetOne.bands;
var bandOne = bandsOne.get(1);
var pixelsOne = bandOne.pixels;

var bandsTwo = datasetTwo.bands;
var bandTwo = bandsTwo.get(1);
var pixelsTwo = bandTwo.pixels;

//create hexagon grid
var cellWidth = 5;
var units = 'kilometers';
var hexgrid = turf.hexGrid(bbox, cellWidth, units);
var boxgrid = turf.squareGrid(bbox, cellWidth, units);

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
fs.writeFileSync('./boxgrid.geojson', JSON.stringify(boxgrid))

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
    var transform = new gdal.CoordinateTransformation(gdal.SpatialReference.fromEPSG(4326),datasetOne);
    var ptnew = transform.transformPoint(x,y);

    //get change value of point
    var valOne = pixelsOne.get(ptnew.x,ptnew.y);
    var valTwo= pixelsTwo.get(ptnew.x,ptnew.y);
    var ndvi = 0;
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
      ndvi = 1
    }
    if(isCirrus){
      ndvi = 1
    }
  }
        //if(ndvi===null){ndvi=0};
    //f (val>0){
    //create a new point with a property (attribute) of the change value
    if(ndvi===0){
      var pt = turf.point([x,y], {valueOne: valOne,valueTwo: valTwo,ndvi: ndvi});
      //add new point to new feature
      features.push(pt);
   }
    //}
    //console.log( parseFloat(((i+1)/Object.keys(hexgrid.features).length)*10).toFixed(2) )
 }
}

//create a featurecollection for output as geojson
var fc = turf.featurecollection(features);
fs.writeFileSync('./randomptswithvalues.geojson', JSON.stringify(fc));

//setup statistics for points in hexgrid
var aggregations = [
  {
    aggregation: 'sum',
    inField: 'valueOne',
    outField: 'sum'
  },
  {
    aggregation: 'average',
    inField: 'valueOne',
    outField: 'average'
  },
  {
    aggregation: 'median',
    inField: 'valueOne',
    outField: 'median'
  },
  {
    aggregation: 'min',
    inField: 'valueOne',
    outField: 'min'
  },
  {
    aggregation: 'max',
    inField: 'valueOne',
    outField: 'max'
  },
  {
    aggregation: 'deviation',
    inField: 'valueOne',
    outField: 'deviation'
  },
  {
    aggregation: 'variance',
    inField: 'valueOne',
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
fs.writeFileSync('./hexgridvalues.geojson', JSON.stringify(aggregated))

//break data into 20 classes based on jenks method
//var breaks = turf.jenks(fc, 'valOne', 10);

//create isolines
//var isolined = turf.isolines(fc, 'valOne', 10, breaks);
//fs.writeFileSync('./isolines.geojson', JSON.stringify(isolined));

//create isolines
//var isolined = turfb(fc, 'valOne', 10, breaks);
//fs.writeFileSync('./isobands.geojson', JSON.stringify(isolined));
