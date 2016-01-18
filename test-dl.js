var https = require('https');
var fs = require('fs');
var gdal = require("gdal");

function download(url,filename){
  var complete = false;
  var dataset;
  var file = fs.createWriteStream(filename);
  var request = https.get(url, function(res) {
    var total = res.headers['content-length']; //total byte length
    var count = 0;
    dataset = res.on('data', function(data) {
        file.write(data);
        count += data.length;
        process.stdout.write(count/total*100   + "% \r");
        })
        .on('close',function() {
            file.end;
            console.log('finished downloading');
            dataset = getDataset(filename);
        });
      });
   d = request.on('finish', function () { return 'test'});
   console.log(d)
}

function getDataset(filename){
  console.log(filename + 'from getDataset');
  var dataSet = gdal.open(filename);
  return dataSet;
}
filename = "LC80180352015330LGN02_BQA.TIF"
url = "https://s3-us-west-2.amazonaws.com/landsat-pds/L8/018/035/LC80180352015330LGN02/LC80180352015330LGN02_BQA.TIF"
var f = download(url, filename);
console.log(f + 'from download');
