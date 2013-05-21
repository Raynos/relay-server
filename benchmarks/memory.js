var net = require("net")
var uuid = require("uuid")
var setInterval = require("timers").setInterval
var setTimeout = require("timers").setTimeout
var split = require("split")
var console = require("console")
var argv = require("optimist").argv
var fs = require("fs")

var RelayServer = require("../index")

var HTTP_PORT = Math.round(Math.random() * 10000) + 2000
var TCP_PORT = Math.round(Math.random() * 10000) + 2000
var servers = RelayServer({}, { timeToLive: 500 })

var lineCount = 0

servers.http.listen(HTTP_PORT)
servers.tcp.listen(TCP_PORT)

var client = net.connect(TCP_PORT, function () {
    client.write(JSON.stringify({ uri: "/*" }) + "\n")

    setInterval(function () {
        for (var i = 0; i < (argv.volume || 1); i++) {
            client.write(JSON.stringify({
                uri: "/" + uuid(),
                verb: "POST",
                body: { id: uuid() }
            }) + "\n")
        }
    }, 1000 / (argv.rate || 20))
})

client.pipe(split()).on("data", function () {
    ++lineCount

    if (lineCount % (50 * (argv.volume || 1)) === 0) {
        console.log("lineCount", lineCount)
    }
})

setInterval(function () {
    var mems = process.memoryUsage()
    var mil = 1000 * 1000
    console.log("memory", {
        rss: Math.round(mems.rss / mil) + "MB",
        heapTotal: Math.round(mems.heapTotal / mil) + "MB",
        heapUsed: Math.round(mems.heapUsed / mil) + "MB",
    })

    getUsageDiff(function (err, percentage) {
        console.log("CPU percentage:", percentage)
    })
}, 1000)

var getUsage = function(cb){
    fs.readFile("/proc/" + process.pid + "/stat", function(err, data){
        var elems = data.toString().split(" ")
        var utime = +elems[13]
        var stime = +elems[14]

        cb(utime + stime);
    });
}

function getUsageDiff(callback) {
    getUsage(function (startTime) {
        setTimeout(function () {
            getUsage(function (endTime) {
                var delta = endTime - startTime
                var percentage = 100 * (delta / 10000)

                callback(null, percentage)
            })
        }, 1000)
    })
}
