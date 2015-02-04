var statuses = {};
var stats = {};
var statusCnt = 0;

var socket = io();

var messageObservable = Rx.Observable.fromEvent(socket, 'sys').publish().refCount();

messageObservable.filter(function (msg) {
  return msg.imsi && statuses[msg.imsi] === undefined;
}).subscribe(Rx.Observer.create(
  function (msg) {
    var IMSI = msg.imsi;
    var HOST = msg.host;
    var PORT = msg.port;
    // Create row for showing results
    var row = $('<div class="row" id="' + msg.imsi + '">'+
    '<div class="col-md-2 host">' + msg.host + ':' + msg.port + '</div>'+
    '<div class="col-md-2 imsi"></div>'+
    '<div class="col-md-1 signal"></div>'+
    '<div class="col-md-1 queue"></div>'+
    '<div class="col-md-2 stattime"></div>'+
    '<div class="col-md-2 sent"></div>'+
    '<div class="col-md-2 rejected"></div>'+
    '</div>');
    $('#info').append(row);
    setRowValues(row, msg);
    // Subscribe for this messages only
    var subscr = messageObservable.
      filter(function (msg) { return msg.type === 'sys' && msg.host === HOST && msg.port === PORT; }).
      do(function (msg) {
        setRowValues(row, msg);
      }).subscribe();

    statuses[IMSI] = {
      subscription: subscr,
      row: row
    };
  }
));

function setRowValues (row, msg) {
  if (msg.error) {
    $('.signal', row).text(msg.error).css('color', 'red');
    $('.queue', row).text(msg.error).css('color', 'red');
    return;
  } else if (msg.type === 'sys') {
    $('.imsi', row).text(msg.imsi);
    $('.signal', row).text(msg.signal + ' db').css('color', msg.signal > -20 || msg.signal < -111 ? 'red' : 'green');
    $('.queue', row).text(msg.queue).css('color', msg.queue > 3 ? 'red' : 'green');
  } else if (msg.type === 'stat') {
    var t = new Date(msg.time * 1000);
    $('.stattime', row).text(formatTime(t));
    $('.sent', row).text(msg.sentTotal + ' (' + msg.sent + ')').css('color', msg.sent < 1 ? 'red' : 'green');
    $('.rejected', row).text(msg.rejectedTotal + '(' + msg.rejected + ')').css('color', msg.rejected > 0 ? 'red' : 'black');
  }
}
function formatTime (t) {
  return twoDigits(t.getHours()) + ':' + twoDigits(t.getMinutes()) + ':' + twoDigits(t.getSeconds());
}
function twoDigits (d) {
  return ('0' + d.toString()).slice(-2);
}


var statObservable = Rx.Observable.fromEvent(socket, 'stat').publish().refCount();
statObservable.filter(function (msg) {
  return msg.imsi && stats[msg.imsi] === undefined;
}).subscribe(Rx.Observer.create(
  function (msg) {
    var IMSI = msg.imsi;
    var row = $('#'+IMSI);
    setRowValues(row, msg);
  }
));
