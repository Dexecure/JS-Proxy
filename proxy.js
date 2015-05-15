var start = function (options) {
    var i,
        httpProxy = require('http-proxy'),
        url = require('url'),
        path = require("path"),
        instrument = require(path.join(__dirname, './instrument.js')),
        instrument_html = require(path.join(__dirname, './instrument_html.js')),
        zlib = require('zlib'),
        port = parseInt(options.port, 10),
        cluster = require('cluster'),
        threads = parseInt(options.threads, 10);

    if (!threads) {
        threads = 1;
    }

    if (cluster.isMaster) {
        for (i = 0; i < threads; i++) {
            cluster.fork();
        }
    } else {
        httpProxy.createServer(function (req, res, next) {

            var _writeHead = res.writeHead,
                _process = false,
                _isJS = false,
                _isHTML = false,
                _code,
                _headers,
                _contentType,
                _content,
                _write = res.write,
                _end = res.end,
                processedContent = '';
            var userid =  "";

            delete req.headers['accept-encoding'];

            res.writeHead = function (code) {
                _code = code.toString();
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

            res.write = function (data) {
                if (_process) {
                    _content = Buffer.concat([_content, data]);
                } else {
                    _write.call(res, data);
                }
            };

            res.end = function () {

                var _instrumentJS = function (str, options) {
                    options.source = "ExternalJS";
                    options.userid = userid;
                    return instrument.instrument(str, options).toString();
                };

                var _instrumentHTML = function (str, options) {
                    options.userid = userid;
                    return instrument_html.instrument_html(str, options);
                };

                var processContent = function (content) {
                    res.removeHeader("Content-Encoding");
                    if (_isJS) {
                        processedContent = _instrumentJS(content, options);
                    } else if (_isHTML) {
                    
                        require("../Proxy-Server/socketMessage.js").sendMessage("dummy", {
                            stage: 1,
                            data: Buffer.byteLength(content, 'utf8')
                        });
                    
                        processedContent = _instrumentHTML(content, options);
                    } else {
                        processedContent = content;
                    }
                    
                    //finish up
                    _headers['content-length'] = Buffer.byteLength(processedContent, 'utf8');
                    _writeHead.call(res, _code, _headers);
                    _write.call(res, processedContent);
                    _end.apply(res, []);
                };

                if (_process) {
                    if (this.getHeader("Content-Encoding") === "gzip") {
                        zlib.unzip(_content, function(err, buffer) {
                            processContent(buffer.toString());
                        });
                    } else if (this.getHeader("Content-Encoding") === "deflate") {
                        zlib.inflateRaw(_content, function(err, buffer) {
                            processContent(buffer.toString());
                        });
                    } else {
                        processContent(_content.toString());
                    }
                } else {
                    _end.apply(res, []);
                }
            };
            next();
        }, function (req, res) {
            var proxy = new httpProxy.RoutingProxy(),
                buffer = httpProxy.buffer(req),
                urlObj = url.parse(req.url);
            req.headers.host = urlObj.host;
            req.url = urlObj.path;
            proxy.proxyRequest(req, res, {
                host: urlObj.hostname,
                port: urlObj.port || 80,
                buffer: buffer
            });
        }).listen(port, function () {
            console.log("Waiting for requests...");
        });

    }
};

module.exports.start = start;