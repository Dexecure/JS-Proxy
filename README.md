#JS-Proxy

A man-in-the-middle proxy which captures JavaScript on the fly and gives lets you modify it using a callback. 

The callback function is called for each node returned by [falafel](https://github.com/substack/node-falafel)

    var proxy = require('js-proxy');
    var options = {};
    options.port = 9003;
    options.preprocess = function(input){
	 // add in your preprocessing logic here
        return input;
     };
    options.postprocess = function(input){
	 // add in your postprocessing logic here
        return input;
    };
    options.instrument = function(node) {
	    if(node.type == "Program") {
	   	node.update("'use strict;';\n" + node.source());
	    }
     }
     proxy.start(options);
