var falafel = require("falafel-turbo");

var instrument = function instrument(input, options) {

    options = options || {};
    if (options.preprocess) {
        input = preprocess(input, options);
    }

    var output2 = falafel(input, {
        'range': true
    }, function(node) {
        var i;
        for (i = 0; i < options.modules.length; i++) {
            require(options.modules[i])(node, options);
        }
    });

    if (options.postprocess) {
        output2 = postprocess(output2, options);
    }

    return output2.toString();
};

exports.instrument = instrument;