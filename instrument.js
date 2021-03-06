var falafel = require("falafel-turbo");

var instrument = function instrument(input, options) {

    options = options || {};
    if (options.preprocess) {
        input = options.preprocess(input, options);
    }

    var output2;
    if(options.parse) {
        output2 = falafel(input, {
            'range': true
        },
        function (node) {
            options.instrument(node, options);
        });
    } else {
        output2 = options.instrument(input, options);
    }

    if (options.postprocess) {
        output2 = options.postprocess(output2, options);
    }

    if (output2 === undefined) {
        //parse error
        return input;
    }
    return output2.toString();
};

exports.instrument = instrument;