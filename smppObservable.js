/* @flow */

var Rx = require('rx');
var smpp = require('smpp');

/**
* Parses SYS message
*/
function parseSYS(sysStr) {
  var match = sysStr.match(/Signal: ([\-+\d]+) Queue: (\d+)/),
      obj = {type: 'sys', signal: -1, queue: -1};
  if (match && match.length > 1) {
    obj.signal = parseInt(match[1], 10);
    obj.queue = parseInt(match[2], 10);
  }
  return obj;
}

/**
* Creates observable for messages from SMPP server
*/
function createMessageObservable (session) {
  // Observable for SYS messages
  var sysObservable = Rx.Observable.fromEvent(session, 'deliver_sm').
    filter(function (pdu) { //Filter only SYS messages
      return pdu.service_type === 'SYS';
    }).
    map(function (pdu) {
      var sys = parseSYS(pdu.short_message.message);
      sys.imsi = pdu.source_addr;
      return sys;
    }).
    startWith(parseSYS('')).
    timestamp().
    publish().
    refCount();

  // Observable for STAT messages
  var statObservable = Rx.Observable.fromEvent(session, 'deliver_sm').
    filter(function (pdu) {
      return pdu.service_type === 'STAT';
    }).
    map(function (pdu) {
      var msg = JSON.parse(pdu.short_message.message);
      msg.type = 'stat';
      msg.imsi = pdu.source_addr;
      return msg;
    }).
    publish().
    refCount();

  return sysObservable.combineLatest(
    Rx.Observable.interval(10000 /* ms */).startWith(-1).timestamp(),
    function (msg, interval) {
      if (msg.timestamp > interval.timestamp) {
        return msg.value;
      } else if (interval.timestamp - msg.timestamp > 10000) {
        return {type: 'sys', error: 'Timeout'};
      } else {
        return null;
      }
    }
  ).flatMap(function (arg0) {
    if (arg0 !== null) return Rx.Observable.just(arg0);
    else return Rx.Observable.never();
  }).merge(
    statObservable
  );
}
/**
 * Connects to SMPP server and creates observable to reconnect...
 */
function createSMPPObservable (host, port) {
  var smppSession = smpp.connect(host, port);

  var disconnectObservable = Rx.Observable.fromEvent(smppSession, 'close').publish().refCount().
    startWith('start');
  var errorObservable = Rx.Observable.fromEvent(smppSession, 'error').publish().refCount().
  filter(
    function (err) {
      return err.code === 'ECONNREFUSED';
    }
  );
  var connectObservable = Rx.Observable.fromEvent(smppSession, 'connect');
  var messageObservable = createMessageObservable (smppSession);

  var reconnectObservable = Rx.Observable.merge(
    disconnectObservable,
    errorObservable
  ).
  throttle(1000 /* ms */). // reconnect every ...
  // Connect to SMPP server
  flatMapLatest(function (reason) {
    var o = null;
    if (reason !== 'start') {
      smppSession.connect();
      return connectObservable;
    } else {
      return Rx.Observable.just(null);
    }
  }).flatMap(function () { // Authorize
    return Rx.Observable.fromCallback(smppSession.bind_transceiver.bind(smppSession))({
      system_id: 'test',
      password: 'test'
    }).
    // Filter only successful binding
    filter(function (pdu) {
      return pdu.command_status === 0;
    });
  });

  reconnectObservable.subscribe(Rx.Observer.create());

  return messageObservable;
}
/**
 * Creates SMPP observable
 */
module.exports.create = createSMPPObservable;
