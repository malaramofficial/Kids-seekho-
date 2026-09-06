var exec = require('cordova/exec');

module.exports = {
  recognize: function(strokes, languageTag, width, height, success, failure) {
    exec(success, failure, 'KidsSeekhoAI', 'recognize', [{
      strokes: strokes || [],
      languageTag: languageTag || 'en-US',
      width: Number(width) || 1,
      height: Number(height) || 1
    }]);
  },
  isAvailable: function(success, failure) {
    exec(success, failure, 'KidsSeekhoAI', 'isAvailable', []);
  }
};
