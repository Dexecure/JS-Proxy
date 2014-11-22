var join = require('path').join;
var cheerio = require('cheerio');
var instrument = require(join(__dirname, './instrument.js'));

function instrument_html(str, options) {
    if (str.length === 0) {
        return "";
    }

    //first checking if it is JSON
    try {
        JSON.parse(str);
        return str; //not instrumenting JSON
    } catch (ignore) {

    }
    //second checking if its JS
    var checking = instrument.instrument(str, options).toString(),
        $;
    if (checking === str) {
        $ = cheerio.load(str, {
            xmlMode: false,
            recognizeCDATA: true
        });
    } else {
        return checking.toString();
    }
    var initCode = "<script class='dex-ignore'>";
    initCode += "function dexreceiveMessage(event) {";
    initCode += "var data = JSON.parse(event.data);";
    initCode += "reportXSSIni1(data.sinkValue, data.source, data.sink, data.locationURL, '" + options.userid + "');";
    initCode += "}";
    initCode += "window.addEventListener('message', dexreceiveMessage, false);";
    initCode += "</script>";

    $.root().find('head').prepend(initCode);

    $('script').each(function () {
        if($(this).hasClass('dex-ignore')) {
            return;
        }
        var type = $(this).attr('type'),
            jsText = $(this).text(),
            temp = jsText;
        options.source = "ScriptTag";
        if (type === undefined || type.toLowerCase() === 'text/javascript') {
            temp = instrument.instrument(jsText, options).toString();
        }
        $(this).text(temp);
    });

    //instrumenting other sources of js
    var eventAttributes = ["onafterprint", "onbeforeprint", "onbeforeunload", "onerror", "onhaschange", "onload", "onmessage", "onoffline", "ononline", "onpagehide", "onpageshow", "onpopstate", "onredo", "onresize", "onstorage", "onundo", "onunload", "onblur", "onchange", "oncontextmenu", "onfocus", "onformchange", "onforminput", "oninput", "oninvalid", "onreset", "onselect", "onsubmit", "onkeydown", "onkeypress", "onkeyup", "onclick", "ondbclick", "ondrag", "ondragend", "ondragenter", "ondragleave", "ondragover", "ondragstart", "ondrop", "onmousedown", "onmousemove", "onmouseout", "onmouseover", "onmouseup", "onmousewheel", "onscroll", "onabort", "oncanplay", "oncanplaythrough", "ondurationchange", "onemptied", "onended", "onerror", "onloadeddata", "onloadedmetadata", "onloadstart", "onpause", "onplay", "onplaying", "onprogress", "onratechange", "onreadystatechange", "onseeked", "onseeking", "onstalled", "onsuspend", "ontimeupdate", "onvolumechange", "onwaiting"],
        text,
        prepend = "function I(){",
        append = "};",
        output = "";

    for (var i = 0; i < eventAttributes.length; i++) {
        $("[" + eventAttributes[i] + "]").each(function () {
            text = prepend + $(this).attr(eventAttributes[i]) + append;
            //instrumenting each attribute only once
            if (text.indexOf("iniFunction") != -1) {
                return;
            }
            text = text.trim();
            options.source = "EventAttribute";
            text = instrument.instrument(text, options).toString();
            text = text.substring(prepend.length, text.lastIndexOf("}"));
            $(this).attr(eventAttributes[i], text);
        });
    }

    return $.html(); //outer attributes will be missed
}

exports.instrument_html = instrument_html;