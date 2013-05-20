var url = require("url")
var net = require("net")
var request = require("request")
var test = require("tape")
var jsonBody = require("body/json")
var uuid = require("uuid")
var split = require("split")

var RelayServer = require("../index")

var HTTP_PORT = Math.round(Math.random() * 10000) + 2000
var TCP_PORT = Math.round(Math.random() * 10000) + 2000
var servers

test("RelayServer is a function", function (assert) {
    assert.equal(typeof RelayServer, "function")
    assert.end()
})

test("create server", function (assert) {
    servers = RelayServer({
        "/*": function (req, res, _, callback) {
            var pathname = url.parse(req.url).pathname
            jsonBody(req, res, function (err, body) {
                if (err) {
                    return callback(err)
                }

                callback(null, { uri: pathname, verb: req.method, body: body })

                res.end("\"OK\"")
            })
        }
    })

    assert.ok(servers)
    assert.equal(typeof servers.http.listen, "function")
    assert.equal(typeof servers.tcp.listen, "function")

    servers.http.listen(HTTP_PORT, function () {
        servers.tcp.listen(TCP_PORT, function () {
            assert.end()
        })
    })
})

test("POST with open socket", function (assert) {
    var id = uuid()
    // open a TCP socket
    var client = net.connect(TCP_PORT, function () {
        // Write the header saying what uri's your interested in
        client.write(JSON.stringify({ uri: "/*" }) + "\n")

        // make a RESTful request to add messages to the relay
        // server
        request({
            uri: "http://localhost:" + HTTP_PORT + "/foo",
            method: "POST",
            json: { id: id }
        }, function (err, res, body) {
            assert.ifError(err)
            assert.equal(res.statusCode, 200)
            assert.equal(body, "OK")
        })
    })

    var splitted = client.pipe(split())

    // split the messages on new lines and parse each message
    // as JSON
    splitted.on("data", function (chunk) {
        if (chunk === "") {
            return
        }

        var json = JSON.parse(String(chunk))

        assert.equal(json.uri, "/foo")
        assert.equal(json.verb, "POST")
        assert.equal(json.body.id, id)

        client.end()
        assert.end()
    })
})

test("close servers", function (assert) {
    servers.close(function (err) {
        assert.ifError(err)

        assert.end()
    })
})
