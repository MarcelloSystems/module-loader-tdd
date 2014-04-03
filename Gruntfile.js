module.exports = function (grunt) {
    grunt.initConfig({
        // Read data like version info from file.
        pkg: grunt.file.readJSON('package.json'),

        // Test runner
        tdd: {
            browser: {
                files: {
                    sources: ['src/**/*.js'], // Where your application files are located
                    libs: [ // Libs loaded in order
                        'libs/acorn.js'
                    ],
                    tests: ['tests/**/*-test.js'] // Where your tests are located
                },
                options: {
                    runner: 'buster', // jasmine, mocha or buster
                    expect: true, // Use the expect.js library for assertions
                    sinon: true // For spies, stubs and fake XHR
                }
            }
        },

        // Minifies loader and parser separately with banners
        uglify: {
            loader: {
                options: {
                    banner: "/* module-loader-tdd v.{{ VERSION }} */"
                },
                files: {
                    'tmp/loader.js': ['src/**/*.js']
                }
            },
            parser: {
                options: {
                    banner: "/* minified acorn.js (http://marijnhaverbeke.nl/acorn/) */"
//                    mangle: false
                },
                files: {
                    'tmp/parser.js': ['libs/acorn.js']
                }
            }
        },

        // Merges loader and parser
        concat: {
            options: {
                separator: ';\n'
            },
            'dist-min': {
                src: [
                    'tmp/loader.js',
                    'tmp/parser.js'
                ],
                dest: 'tmp/module-loader-tdd.min.js'
            },
            'dist-dev': {
                src: [
                    'src/module-loader-tdd.js',
                    'libs/acorn.js'
                ],
                dest: 'tmp/module-loader-tdd.js'
            }
        },

        // Adds version info and moves files to dist folder
        'string-replace': {
            version: {
                files: {
                    'dist/module-loader-tdd.min.js': 'tmp/module-loader-tdd.min.js',
                    'dist/module-loader-tdd.js': 'tmp/module-loader-tdd.js'
                },
                options: {
                    replacements: [{
                        pattern: /{{ VERSION }}/g,
                        replacement: '<%= pkg.version %>'
                    }]
                }
            }
        },

        // Removes directories to keep things clean and start fresh
        clean: {
            tmp: ['tmp/'],
            dist: ['dist/'] // Only run this as first part of build-all. If not you loose last build...
        }
    });

    // LOAD
    grunt.loadNpmTasks('grunt-tdd');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-string-replace');


    // TASKS
    grunt.registerTask('build-min', ['uglify:loader', 'uglify:parser', 'concat:dist-min', 'string-replace:version', 'clean:tmp']);
    grunt.registerTask('build-dev', ['concat:dist-dev', 'string-replace:version', 'clean:tmp']);
    grunt.registerTask('build', ['clean:dist', 'build', 'build-dev']);

    grunt.registerTask('default', ['tdd:browser']);

};
