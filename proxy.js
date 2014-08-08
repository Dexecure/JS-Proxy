var start = function(options) {
    var httpProxy = require('http-proxy');
    var url = require('url');
    var path = require("path");
    var instrument = require(path.join(__dirname, './instrument.js'));
    var instrument_html = require(path.join(__dirname, './instrument_html.js'));
    var zlib = require('zlib');
    var port = parseInt(options.port);

    var cluster = require('cluster');
    var threads = process.argv.slice(2)[0];
    if (!threads)
        threads = 1;
    if (cluster.isMaster) {
        for (i = 0; i < threads; i++) {
            cluster.fork();
        }
    } else {
        httpProxy.createServer(function(req, res, next) {

            var _writeHead = res.writeHead;
            var _process = false;
            var _isJS = false;
            var _isHTML = false;
            var _code, _headers, _contentType;
            var _content;

            delete req.headers['accept-encoding'];

            res.writeHead = function() {
                _code = arguments[0] + '';
                _headers = this._headers;
                if (this.getHeader('content-type')) {
                    _contentType = this.getHeader('content-type');
                    if (_contentType.match(/javascript/)) {
                        _isJS = true;
                    } else if (_contentType.match(/text\/html/)) {
                        _isHTML = true;
                    }
                }
                if (_isHTML || _isJS) {
                    _process = true;
                    var headerBuffer = new Buffer(_headers);
                    _content = new Buffer(headerBuffer.length);
                    headerBuffer.copy(_content);
                }
                if (!_process) {
                    _writeHead.apply(res, arguments);
                }
            };
            var _write = res.write;
            res.write = function(data) {
                if (_process) {
                    _content = Buffer.concat([_content, data]);
                } else {
                    _write.call(res, data);
                }
            };

            var _end = res.end;
            res.end = function() {

                function callback(err, buffer) {
                    if (!err) {
                        res.removeHeader("Content-Encoding");
                        if (_isJS) {
                            processedContent = _instrumentJS(buffer.toString(), options);
                        } else if (_isHTML) {
                            processedContent = _instrumentHTML(buffer.toString(), options);
                        } else {
                            processedContent = buffer.toString();
                        }
                        finish();
                    } else {
                        console.log("gzip/deflate error " + err.message);
                    }
                }

                function finish() {
                    _headers['content-length'] = Buffer.byteLength(processedContent, 'utf8');
                    _writeHead.call(res, _code, _headers);
                    _write.call(res, processedContent);
                    _end.apply(res, arguments);
                }

                if (_process) {
                    var processedContent = '';
                    if (this.getHeader("Content-Encoding") === "gzip") {
                        zlib.unzip(_content, callback);
                    } else if (this.getHeader("Content-Encoding") === "deflate") {
                        zlib.inflateRaw(_content, callback);
                    } else {
                        if (_isJS) {
                            processedContent = _instrumentJS(_content.toString(), options);
                        } else if (_isHTML) {
                            processedContent = _instrumentHTML(_content.toString(), options);
                        } else {
                            processedContent = buffer.toString();
                        }
                        finish();
                    }
                } else {
                    _end.apply(res, arguments);
                }
            };
            next();
        }, function(req, res) {
            var proxy = new httpProxy.RoutingProxy();
            var buffer = httpProxy.buffer(req);
            var urlObj = url.parse(req.url);
            req.headers.host = urlObj.host;
            req.url = urlObj.path;
            proxy.proxyRequest(req, res, {
                host: urlObj.hostname,
                port: urlObj.port ? urlObj.port : 80,
                buffer: buffer
            });
        }).listen(port, function() {
            console.log("Waiting for requests...");
        });

    }

    function _instrumentJS(str, options) {
        return instrument.instrument(str, options).toString();
    }

    function _instrumentHTML(str, options) {
        return instrument_html.instrument_html(str, options);
    }
};

module.exports.start = start;