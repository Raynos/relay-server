var http = require("http")
var net = require("net")
var url = require("url")
var Buffer = require("buffer").Buffer
var Router = require("routes")
var sendError = require("send-data/error")
var after = require("after")
var split = require("split")

var TimePurgedQueue = require("./lib/time-purged-queue")

var SECOND = 1000
var MINUTE = 60 * SECOND

module.exports = RelayServer

/*
    type RouteHandler := (req, res, { params, splats }, Callback<{
        method: String,
        uri: String,
        body: Any
    }>)

    RelayServer := (routes: Object<String, RouteHandler>, options: {
        notFound: (req, res) => void,
        errorHandler: (req, res) => void
    }) => { http: HttpServer, tcp: NetServer }
*/
function RelayServer(routes, options) {
    options = options || {}
    var timeToLive = options.timeToLive || MINUTE * 2
    var sockets = []
    var history = TimePurgedQueue(timeToLive)

    var requestHandler = RelayRequestHandler(routes, options, relayMessage)
    var httpServer = http.createServer(requestHandler)
    var tcpServer = net.createServer(socketListener)

    return {
        http: httpServer,
        tcp: tcpServer,
        close: close,
        _sockets: sockets,
        _history: history
    }

    function relayMessage(message) {
        var buffer = new Buffer(JSON.stringify(message) + "\n")
        history.add(message, buffer)

        for (var i = 0; i < sockets.length; i++) {
            var socketMessage = sockets[i]
            var regexp = socketMessage.regexp
            var socket = socketMessage.socket

            if (regexp.test(message.uri)) {
                socket.write(buffer)
            }
        }
    }

    function socketListener(socket) {
        var splitted = socket.pipe(split())

        // 0.8.x Need to add data listener or TCP wont flow
        splitted.once("data", function headerHandler(buffer) {
            var meta = JSON.parse(String(buffer))

            var metaUri = meta.uri || ""
            var metaRegexp = Router.pathToRegExp(metaUri)
            sockets.push(new SocketMessage(socket, metaUri, metaRegexp))

            var queue = history.queue

            for (var i = 0; i < queue.length; i++) {
                var tuple = queue[i]
                var value = tuple.value

                if (metaRegexp.test(value.uri)) {
                    socket.write(tuple.buffer)
                }
            }
        })

        socket.once("close", function closeHandler() {
            for (var i = 0; i < sockets.length; i++) {
                var tuple = sockets[i]
                if (tuple[0] === socket) {
                    sockets.splice(i, 1)
                    break
                }
            }
        })
    }

    function close(callback) {
        var forward = after(2, callback)

        history.destroy()
        httpServer.close(forward)
        tcpServer.close(forward)
    }
}

function SocketMessage(socket, uri, metaRegexp) {
    this.socket = socket
    this.uri = uri
    this.regexp = metaRegexp
}


function RelayRequestHandler(routes, options, relayMessage) {
    var notFound = options.notFound || fourofour
    var errorHandler = options.errorHandler || sendError

    var router = Router()

    Object.keys(routes).forEach(function (route) {
        var handler = routes[route]

        router.addRoute(route, handler)
    })

    return requestHandler

    function requestHandler(req, res) {
        var route = router.match(url.parse(req.url).pathname)

        if (!route) {
            return notFound(req, res)
        }

        var fn = route.fn
        fn(req, res, new RequestOptions(route.params, route.splats),
            function (err, message) {
                if (err) {
                    return errorHandler(req, res, err)
                }

                if (message) {
                    relayMessage(message)
                }
            })
    }
}

function RequestOptions(params, splats) {
    this.params = params || null
    this.splats = splats || null
}

function fourofour(req, res) {
    res.statusCode = 404
    res.end("404 Not Found")
}
