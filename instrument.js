var falafel = require("falafel-turbo");

var instrument = function instrument(input, options) {

    options = options || {};
    if (options.preprocess) {
        input = preprocess(input, options);
    }

    var output2 = falafel(input, {
        'range': true
    }, function (node) {
        options.instrument(node);
    });

    if (options.postprocess) {
        output2 = postprocess(output2, options);
    }

    if(output2 == undefined) {
        //parse error
        return input;
    }
    return output2.toString();
};

exports.instrument = instrument;