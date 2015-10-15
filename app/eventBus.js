import events from 'events';

const EventEmitter = events.EventEmitter;

// a global instance for EventEmitter
module.exports = new EventEmitter();
