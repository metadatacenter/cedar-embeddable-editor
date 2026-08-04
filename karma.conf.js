// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage-istanbul-reporter'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      // Clear the test iframe before Karma shuts down Chrome. Keeping it alive
      // makes Chrome's normal teardown fire Karma's beforeunload guard after a
      // successful run, producing "Some of your tests did a full page reload!"
      // after completion while still returning exit code 0.
      clearContext: true
    },
    coverageIstanbulReporter: {
      dir: require('path').join(__dirname, './coverage/cedar-embeddable-editor'),
      reports: ['html', 'lcovonly', 'text-summary'],
      fixWebpackSourcePaths: true
    },
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false,
    restartOnFileChange: true
  });
};
