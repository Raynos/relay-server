var url = require("url")
var sendError = require("send-data/error")
var Router = require("routes")

var RelayMessage = require("../relay-message")

module.exports = RelayRequestHandler

function RelayRequestHandler(options, relayMessage) {
    var notFound = options.notFound || fourofour
    var errorHandler = options.errorHandler || sendError
    var writeRoutes = options.writeRoutes

    var router = Router()

    Object.keys(writeRoutes).forEach(function (route) {
        var handler = writeRoutes[route]

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

                if (!message) {
                    return
                }

                if (typeof message.uri === "string" &&
                    typeof message.verb === "string" &&
                    "body" in message
                ) {
                    relayMessage(new RelayMessage(message.uri,
                        message.verb, message.body))
                }
            })
    }
}

function fourofour(req, res) {
    res.statusCode = 404
    res.end("404 Not Found")
}

function RequestOptions(params, splats) {
    this.params = params || null
    this.splats = splats || null
}
