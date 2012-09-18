'use strict';

var fs           = require('fs')
  , path         = require('path')
  , carrier      = require('carrier')
  , spawn        = require('child_process').spawn
  ;

var MONGO_LOG_REGEXP = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]+ [0-9:]+ (.+)$/;
var mprocess;

var api = {
  mongodbProcess : {
    shutdown : function (callback) {
      if (mprocess) mprocess.kill();
      console.error('MongoDB killed.');
    }
  }
};

function spawnMongo(options, next) {
  var logger = options.logger;
  logger.info('starting MongoDB');

  mprocess = spawn('mongod',
                  [
                    '--dbpath', options.dbpath,
                    '--nohttpinterface'
                  ],
                  {stdio : [process.stdin, 'pipe', 'pipe']});

  mprocess.on('exit', function (code, signal) {
    logger.info('mongod exited with signal %s and returned code %s', signal, code);
  });

  carrier.carry(mprocess.stdout, function (line) {
    logger.debug(line.replace(MONGO_LOG_REGEXP, '$3'));

    if (line.match(/waiting for connections on/)) return next(null, api);
  });

  carrier.carry(mprocess.stderr, function (line) {
    logger.error(line);
  });
}

module.exports = function setup(options, imports, register) {
  var dbpath = options.dbpath;

  fs.exists(dbpath, function (exists) {
    if (!exists) {
      fs.mkdir(dbpath, '0755', function (err) {
        if (err) return register(err);

        spawnMongo(options, register);
      });
    }
    else {
      spawnMongo(options, register);
    }
  });
};
