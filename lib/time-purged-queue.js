var setInterval = require("timers").setInterval
var clearInterval = require("timers").clearInterval

module.exports = TimePurgedQueue

/*  TimePurgedQueue.

    Returns a queue construct that has a time to live for all
        the records in the queue. Records can be added to the
        back of the queue and will automatically be dequeued
        from the front once the items pass their time to live
        window.

    TimePurgedQueue := (timeToLive: Number) => {
        add: (value: Any, buffer: Buffer) => void,
        destroy: () => void,
        queue: Array<{ value: Any, buffer: Buffer }
    }

    The notion is that you add both the raw and buffer representation
        to the queue by calling add(value, buf).

    You can read the queue which will contain { value, buffer }
        tuples.
*/
function TimePurgedQueue(timeToLive) {
    var queue = []

    var interval = setInterval(purge, timeToLive / 2)

    return { queue: queue, add: add, destroy: destroy }

    function add(value, buffer) {
        var record = new ValueRecord(value, buffer)
        queue.push(record)
    }

    function destroy() {
        clearInterval(interval)
    }

    function purge() {
        var now = Date.now()

        // while the first item in the queue is too old
        // remove the head of the queue.
        // terminates when the tail of the queue is recent
        // this works because queue is sorted chronologically
        while (queue[0] && queue[0].timestamp < now - timeToLive) {
            queue.shift()
        }
    }
}

function ValueRecord(value, buffer) {
    this.timestamp = Date.now()
    this.value = value
    this.buffer = buffer
}
