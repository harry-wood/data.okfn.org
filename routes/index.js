var fs = require('fs')
  , request = require('request')
  , marked = require('marked')
  , csv = require('csv')

  , tools = require('../lib/tools.js')
  , model = require('../lib/model.js')
  ;

var catalog = new model.Catalog();
exports.catalog = catalog;

// ========================================================
// Core content
// ========================================================

exports.home = function(req, res) {
  res.render('index.html', {
    title: 'Home'
  });
};

exports.about = function(req, res) {
  res.render('about.html', {});
};

exports.contribute = function(req, res) {
  res.render('contribute.html', {});
};

exports.standards = function(req, res) {
  res.render('/standards/index.html', {title: 'Standards'});
};

exports.standardsDataPackage = function(req, res) {
  fs.readFile('templates/standards/data-package.md', 'utf8', function(err, text) {
    var content = marked(text);
    res.render('base.html', {
      title: 'Data Package - Standards',
      content: content
    });
  });
};

exports.standardsSimpleDataFormat = function(req, res) {
  fs.readFile('templates/standards/simple-data-format.md', 'utf8', function(err, text) {
    var content = marked(text);
    res.render('base.html', {
      title: 'Simple Data Format - Standards',
      content: content
    });
  });
};

exports.standardsCsv = function(req, res) {
  fs.readFile('templates/standards/csv.md', 'utf8', function(err, text) {
    var content = marked(text);
    res.render('base.html', {
      title: 'CSV / Comma Separated Variables - Standards',
      content: content
    });
  });
};

// ========================================================
// Tools
// ========================================================

exports.tools = function(req, res) {
  res.render('/tools/index.html', {});
};

// /tools/creator.json?name=abc&title=
exports.toolsDpCreateJSON = function(req, res) {
  var out = {};
  tools.create(req.query, function(error, dp) {
    if (error) {
      res.send(500, error)
    } else {
      res.json(dp);
    }
  });
};

exports.toolsDpCreate = function(req, res) {
  res.render('tools/dp/create.html');
};

exports.toolsDpValidateJSON = function(req, res) {
  // handle base urls as well as full urls
  var dpurl = req.query.url.replace(/datapackage.json$/, '');
  var dpurl = dpurl.replace(/\/$/, '');
  dpurl += '/datapackage.json';
  request(dpurl, function(err, response, body) {
    if (err) {
      res.send(500, err.toString());
    } else {
      var out = tools.dpValidate(body);
      if (out.length == 0) {
        return res.json({
          valid: true
        });
      } else {
        res.json({
          valid: false,
          errors: out
        });
      }
    }
  });
};

exports.toolsDpView = function(req, res) {
  var url = req.query.url;
  if (!url) {
    res.render('tools/dp/view.html');
  } else {
    tools.load(url, function(err, dpkg) {
      if (err) {
        res.send('<p>There was an error.</p>\n\n' + err.message);
        return;
      }

      if (dpkg.resources && dpkg.resources.length > 0) {
        var resource = dpkg.resources[0];
        resource.backend = 'csv';
        dpkg.download_url = resource.url;
        resource.url = '/tools/dataproxy/?url=' + encodeURIComponent(resource.url);
        resource.fields = resource.schema.fields;
      }
      var dataViews = dpkg.views || [];
      res.render('tools/dp/view.html', {
        dataset: dpkg,
        raw_data_file: JSON.stringify(resource),
        dataViews: JSON.stringify(dataViews),
        url: url
      });
    });
  }
};

// proxy data
exports.toolsDataProxy = function(req, res) {
  var url = req.query.url;
  request.get(url).pipe(res);
}

// ========================================================
// Data section
// ========================================================

exports.data = function(req, res) {
  datasets = catalog.query();
  total = datasets.length;
  res.render('data/index.html', {
    total: total,
    datasets: datasets
  });
};

exports.dataJson = function(req, res) {
  datasets = catalog.query();
  total = datasets.length;
  res.json({
    total: total,
    datasets: datasets
  });
};

exports.dataSearch = function(req, res) {
  q = req.query.q || '';
  // datasets = catalog.query(q)
  datasets = [];
  total = datasets.length;
  res.render('data/search.html', {q: q, datasets: datasets, total: total});
};

exports.dataShowJSON = function(req, res) {
  var id = req.params.id;
  var dataset = catalog.get(id)
  if (!dataset) {
    res.send(404, 'Not Found');
  }
  res.json(dataset);
};

exports.dataShowCSV = function(req, res) {
  var id = req.params.id;
  var dataset = catalog.get(id)
  if (!dataset || !dataset.resources.length > 0) {
    res.send(404, 'Not Found');
  }
  var url = dataset.resources[0].url;
  request.get(url).pipe(res);
};

exports.dataShow = function(req, res) {
  var id = req.params.id;
  var dataset = catalog.get(id)
  if (!dataset) {
    res.send(404, 'Not Found');
  }
  if (dataset.resources && dataset.resources.length > 0) {
    // Get the primary resource for use in JS
    // deep copy and then "fix" in various ways
    var resource = JSON.parse(JSON.stringify(dataset.resources[0]));
    resource.dataset_name = dataset.id;
    resource.url = '/data/' + id + '.csv';
    dataset.download_url = resource.url;
    resource.backend = 'csv';
    resource.fields = resource.schema.fields;
  }
  var dataViews = dataset.views || [];
  res.render('data/dataset.html', {
    dataset: dataset,
    raw_data_file: JSON.stringify(resource),
    dataViews: JSON.stringify(dataViews)
  });
};

// ========================================================
// Community Data
// ========================================================

exports.communityDataView = function(req, res) {
  var username = req.params.username;
  var url = 'https://raw.github.com/' +
    [username, req.params.repo, 'master', 'datapackage.json'].join('/');
  tools.load(url, function(err, dpkg) {
    if (err) {
      res.send('<p>There was an error.</p>\n\n' + err.message);
      return;
    }

    if (dpkg.resources && dpkg.resources.length > 0) {
      var resource = dpkg.resources[0];
      resource.backend = 'csv';
      // direct link for the moment
      dpkg.download_url = resource.url;
      resource.url = '/tools/dataproxy/?url=' + encodeURIComponent(resource.url);
      resource.fields = resource.schema.fields;
    }
    var dataViews = dpkg.views || [];
    res.render('community/dataset.html', {
      username: username,
      dataset: dpkg,
      raw_data_file: JSON.stringify(resource),
      dataViews: JSON.stringify(dataViews),
      url: url
    });
  });
};

exports.communityUser = function(req, res) {
  var username = req.params.username;
  res.render('community/user.html', {
    username: username
  });
};

