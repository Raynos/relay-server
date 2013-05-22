var net = require("net")
var argv = require("optimist").argv
var setInterval = require("timers").setInterval
var setTimeout = require("timers").setTimeout
var fs = require("fs")
var split = require("split")
var console = require("console")
var process = require("process")
var Buffer = require("buffer").Buffer

var b = new Buffer("lulz \n")

// Create TCP server
//
// Each connection gets stored in an array
// Every message written to the socket gets rewritten to all
// connected sockets
//
// Instead of writing each message immediately we buffer up
// messages into a larger buffer and send it at once after 50ms
var server = (function () {
    var sockets = []
    var chunks = []

    var server = net.createServer(function (socket) {
        sockets.push(socket)

        socket.on("data", function (chunk) {
            if (chunks.length === 0) {
                chunks.push(chunk)

                setTimeout(function () {
                    var allChunks = Buffer.concat(chunks)

                    for (var i = 0; i < sockets.length; i++) {
                        sockets[i].write(allChunks)
                    }

                    chunks.length = 0
                }, 50)
            } else {
                chunks.push(chunk)
            }
        })

        socket.once("close", function () {
            sockets.splice(sockets.indexOf(socket), 1)
        })
    })

    return server
}())

var TCP_PORT = Math.round(Math.random() * 10000) + 2000

server.listen(TCP_PORT)

// We configure our clients to run ::
// rate -> The rate at which they send messages
// volume -> The amount of messages they send at every tick
// clients -> The amount of TCP clients opened
var rate = argv.rate || 1
var volume = argv.volume || 1
var clients = argv.clients || 50

var volumeCheck = rate * volume * clients

// Create a list of `clients` numbers
var list = []
for (var i = 0; i < clients; i++) {
    list[i] = i
}

// for each index
list.forEach(function (index) {
    var lineCount = 0

    // create a client. Delay the execution of the periodic sending
    // so that they don't all send messages at roughly the same
    // time
    // Then get them to send a single buffer (containing a string)
    // `volume` amount of times
    var client = net.connect(TCP_PORT, function () {
        setTimeout(function () {
            setInterval(function () {
                for (var i = 0; i < volume; i++) {
                    client.write(b)
                }
            }, 1000 / rate)
        }, (1000 / clients) * index)
    })

    // the data is line seperated. So we use split to parse it
    // and then just log the lineCount when it reaches a certain
    // size
    client.pipe(split()).on("data", function () {
        ++lineCount

        if ((lineCount % volumeCheck) === 0 && index === 0) {
            console.log("lineCount", lineCount)
        }
    })
})

// print stats for this thing
console.log("RUNNING", {
    clients: clients,
    volume: volume,
    rate: rate
})

// every second print memory usage. Memory does not leak
// Also peek in /proc/ and print the cpu usage
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
                var percentage = 10000 * (delta / 10000)

                callback(null, percentage)
            })
        }, 1000)
    })
}
