/* @flow */

var Rx = require('rx');
var express = require('express');
var monitor = require('./monitor');

monitor.startMonitoring('localhost', 2780);

var app = express();
app.use(express.static(__dirname + '/static'));
var http = require('http').Server(app);

// let socket.IO listen on the server
io = require('socket.io')(http);
io.on('connection', function(socket) {
  var subscr = monitor.getObservable().subscribe(Rx.Observer.create(
    function (message) {
      socket.emit(message.type, message);
    }, function (err) {
      console.error(err);
    }, function () {
      console.log('completed');
    })
  );
  socket.on('disconnect', function () {
    subscr.dispose();
  });
});

// Start the server
http.listen(3000, function() {
  console.log('Server is listening at http://%s:%s', http.address().address, http.address().port);
});
