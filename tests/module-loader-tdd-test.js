/* global buster, modules, sinon, expect, console */
(function () {
    "use strict";

    var assert = buster.assert,
//        refute = buster.refute,
        p = modules._privates;

    buster.testCase('module-loader-tdd', {
//        setUp: function () {
//            var moduleId = 0;
//            this.createModule = function (name, func) {
//                return {name: name || 'module' + moduleId++, func: func || function () {
//                    return {};
//                }};
//            };
//        },
        'modules': {
            'is an object': function () {
                assert.isObject(modules);
            },
            'has method create()': function () {
                assert.isFunction(modules.create);
            },
            'has method initialize()': function () {
                assert.isFunction(modules.initialize);
            },
            'has method test()': function () {
                assert.isFunction(modules.test);
            },
            'has method reset()': function () {
                assert.isFunction(modules.reset);
            }
        },
        'create()': {
            'throws error when passing wrong name argument': function () {
                expect(modules.create).withArgs().to.throwError(/Invalid arguments for module creation/); // Passing no name
            },
            'throws when passing wrong module argument': function () {
                expect(modules.create).withArgs('foo').to.throwError(/Invalid arguments for module creation/); // Passing no name
                expect(modules.create).withArgs('foo', 'bar').to.throwError(/Invalid arguments for module creation/); // Passing no name
            }
        },
        'initialize()': {
            'takes on argument (callback)': function () {
                expect(modules.initialize).to.have.length(1);
            },
            '//calls loadForTest and the callback': function () { // Stub messes up test for p.sortedInLoadOrder below

                var spy = sinon.spy();
                modules.initialize(spy);
//                assert(p.sortedInLoadOrder.calledOnce);
//                assert(spy.calledOnce);
                expect(p.sortedInLoadOrder.calledOnce).to.be(true);
                expect(spy.calledOnce).to.be(true);
                p.sortedInLoadOrder.restore();
            }
        },
        'test()': {
            tearDown: function () {
                modules.reset();
            },
            'exists': function () {
                assert.isFunction(modules.test);
            },
            'takes two arguments (name, callback)': function () {
                assert.equals(modules.test.length, 2);
            },
            '//calls registerTestModule and callback': function () {
                var name = '1',
                    callback = sinon.spy();
                sinon.stub(p, 'registerTestModule').returns({
                    exports: {},
                    privates: {},
                    deps: {}
                });
                modules.test(name, callback);
                assert(p.registerTestModule.calledOnce);
                assert(callback.calledOnce);
                p.registerTestModule.restore();
            },
            'module to test is passed as argument to test callback': function () {
                var spy = sinon.spy();
                modules.create('1', function () {
                    return {
                        myMethod: function () {
                        }
                    };
                });
                modules.test('1', spy);
                assert.isFunction(spy.getCall(0).args[0].myMethod);
            },
            'returns test even if dependency is loaded after test module': function () {
                var spy = sinon.spy();
                modules.create('2', function () {
                    return {};
                });
                modules.create('1', function () {
                    this.require('2');
                    return {
                        myMethod: function () {
                        }
                    };
                });
                modules.test('1', spy);
                assert.isFunction(spy.getCall(0).args[0].myMethod);
            },
            'returned test has access to privates and deps': function () {
                modules.create('2', function () {
                    return {
                        depMethod: function () {
                        }
                    };
                });
                modules.create('1', function () {
                    var dep = this.require('2');
                    this.privates = {
                        myPrivate: function () {
                        }
                    };
                    return {};
                });
                modules.test('1', function (module, p, deps) {
                    assert.isFunction(p.myPrivate);
                    assert.isFunction(deps['2'].depMethod);
                });
            }
        },
        '//reset()': {
            'empties arrays with defined and initialized modules': function () {
                var initializedModules = ['a', 'b'],
                    definedModules = ['a', 'b'];
                modules.reset();
                // Won't work as targets are in another scope
                expect(initializedModules).to.eql([]);
                expect(definedModules).to.eql([]);
            }
        },
        'p.isArray(object)': {
            'is function': function () {
                expect(p.isArray).to.be.a('function');
            },
            'return true if passed object is an array': function () {
                expect(p.isArray([])).to.be(true);
            },
            'return false if passed object is not an array': function () {
                expect(p.isArray({})).to.be(false);
                expect(p.isArray('')).to.be(false);
                expect(p.isArray(42)).to.be(false);
                expect(p.isArray()).to.be(false);
            }
        },
        'p.throw()': {
            'exists': function () {
                assert.isFunction(p.throw);
            },
            'takes on argument (message)': function () {
                assert.equals(p.throw.length, 1);
            }
        },
        'p.addModule()': {
            'exists': function () {
                assert.isFunction(p.addModule);
            },
            'takes three arguments (array, name, func)': function () {
                assert.equals(p.addModule.length, 3);
            },
            'adds a module object to the array with name and func': function () {
                var array = [],
                    name = 'test',
                    func = function () {
                    };

                p.addModule(array, name, func);
                assert.equals(array[0], {name: name, func: func});

            }
        },


        'p.verifyThatAllDependenciesAreMet()': {
            'is a function': function () {
                expect(p.verifyThatAllDependenciesAreMet).to.be.a('function');
            },
            'takes one argument (definedModules)': function () {
                expect(p.verifyThatAllDependenciesAreMet).to.have.length(1);
            },
            'throws when dependency is not among registered modules. Includes names of modules in error message': function () {
                var definedModules = [
                    ['modA', ['modB']],
                    ['modB', ['modC']] // Should throw as modC is not defined as a module
                ];

                expect(p.verifyThatAllDependenciesAreMet).withArgs(definedModules).to.throwError(/mod[BC]/);
            },
            'does not throw when all dependencies can be met': function() {
                var definedModules = [
                    ['modA', ['modB']],
                    ['modB', ['modC']],
                    ['modC', []]
                ];
                expect(p.verifyThatAllDependenciesAreMet).withArgs(definedModules).not.to.throwError();
            }
        },


        'p.getSortedInLoadOrder()': {
            tearDown: function () {
                modules.reset();
            },
            'is a function': function () {
                expect(p.sortedInLoadOrder).to.be.a('function');
            },
            'takes one argument (defined)': function () {
                expect(p.sortedInLoadOrder).to.have.length(1);
            },
            //TODO: Move these to the method that loads modules
            '//adds initialized modules to the "initialized" array': function () {

                var dummyBody = function () {
                    return {};
                };

                var defined = [
                        this.createModule('1', dummyBody),
                        this.createModule('2', dummyBody),
                        this.createModule('3', dummyBody)
                    ],
                    initialized = [];
                p.sortedInLoadOrder(defined, initialized);
//                console.log("initialized:", initialized);
//                assert.equals(defined.length, 0);
                assert.equals(initialized.length, 3);

            },
            '//initializes modules with missing deps after deps have been initialized': function () {
                var defined = [
                        this.createModule('2', function () {
                            return {};
                        }),
                        this.createModule('1', function () {
                            this.require('2');
                            return {};
                        })
                    ],
                    initialized = [];
                p.sortedInLoadOrder(defined, initialized);
                assert.equals(defined.length, 0);
                assert.equals(initialized.length, 2);
                assert.equals(initialized[0].name, '2', 'dependency should be pushed first, even though it is initially processed last');
            },
            '//throws error when module returns undefined': function () {
                var defined = [
                        this.createModule('1', function () {
                            return undefined;
                        })
                    ],
                    initialized = [];
                expect(p.sortedInLoadOrder).withArgs(defined, initialized).to.throwError();
//            assert.exception(function () {
//                p.sortedInLoadOrder(defined, initialized);
//            });
            },
            '//throws error when dependency does not exists': function () {
                var defined = [
                        this.createModule('1', function () {
                            this.require('2');
                            return {};
                        })
                    ],
                    initialized = [];
                assert.exception(function () {
                    p.sortedInLoadOrder(defined, initialized);
                });
            }
        },
        'p.createContext()': {
            'is a function': function () {
                expect(p.createContext).to.be.a('function');
            },
            'takes one argument (modules)': function () {
                assert.equals(p.createContext.length, 1);
            },
            'returns object with a require method': function () {
                var returnedValue = p.createContext();
                assert.isObject(returnedValue);
                assert.isFunction(returnedValue.require);
                assert.isObject(returnedValue.privates);
            }
        },
//        'p.getLast()': {
//            'is a function': function () {
//                expect(p.getLast).to.be.a('function');
//            },
//            'take one argument (modules)': function () {
//                assert.equals(p.getLast.length, 1);
//            },
//            'returns the last item in the array': function () {
//                var array = ['1', '2'];
//                assert.equals(p.getLast(array), '2');
//                assert.equals(array, ['1', '2'], 'array has not changed');
//            }
//        },
//        'p.moveLastToFirst()': {
//            'exists': function () {
//                assert.isFunction(p.moveLastToFirst);
//            },
//            'takes one argument (modules)': function () {
//                assert.equals(p.moveLastToFirst.length, 1);
//            },
//            'moves last item in array to the top': function () {
//                var array = ['1', '2', '3'];
//                p.moveLastToFirst(array);
//                assert.equals(array, ['3', '1', '2']);
//            }
//        },
//        'p.moveLastToTarget': {
//            'exists': function () {
//                assert.isFunction(p.moveLastToTarget);
//            },
//            'takes two arguments (sourceArray, targetArray': function () {
//                assert.equals(p.moveLastToTarget.length, 2);
//            },
//            'moves last item in first array to second array': function () {
//                var sourceArray = ['1', '2', '3'],
//                    targetArray = ['4'];
//                p.moveLastToTarget(sourceArray, targetArray);
//                assert.equals(sourceArray, ['1', '2']);
//                assert.equals(targetArray, ['4', '3']);
//            }
//        },
        'p.getModule()': {
            'exists': function () {
                assert.isFunction(p.getModule);
            },
            'takes two arguments (name, modules)': function () {
                assert.equals(p.getModule.length, 2);
            },
            'throws exception when module does not exist': function () {
                assert.exception(function () {
                    p.getModule('test', []);
                });
            },
            'returns module if it exists': function () {
                var modules = [
                    {name: '1'},
                    {name: '2'},
                    {name: '3'}
                ];
                assert.equals(p.getModule('1', modules), {name: '1'});
                assert.equals(p.getModule('3', modules), {name: '3'});
            }
        },
        'p.loadForTest()': {
            'exists': function () {
                expect(p.loadForTest).to.be.a('function');
            },
            'takes three arguments (nameOfModuleToBeTested, orderedModules, initialized)': function () {
                expect(p.loadForTest).to.have.length(3)
            },
            '//throws error when dependency does not exists': function () {
                var defined = [
                    this.createModule('1', function () {
                        this.require('2');
                        return {};
                    })
                ];

//                expect(p.loadForTest).withArgs('1', defined).to.throwError();
                expect(p.loadForTest).withArgs(defined, []).to.throwError(/asdfa/);
            }
        },
        'p.createTestContext()': {
            'exists': function () {
                assert.isFunction(p.createTestContext);
            },
            'takes one argument (modules)': function () {
                assert.equals(p.createTestContext.length, 1);
            }
        },
        'p.createTestRequireMethod()': {
            'exists': function () {
                assert.isFunction(p.createTestRequireMethod);
            },
            'takes two arguments (context, modules)': function () {
                assert.equals(p.createTestRequireMethod.length, 2);
            },
            'returns a function': function () {
                assert.isFunction(p.createTestRequireMethod({}, []));
            }
        },
        'p.stubExports()': {
            'exists': function () {
                assert.isFunction(p.stubExports);
            },
            'takes one argument (exports)': function () {
                assert(p.stubExports.length, 1);
            },
            'creates sinon stubs of all methods on exports object': function () {
                var exports = {
                    func: function () {
                    },
                    func2: function () {
                    }
                };
                // Works but is it the way it should be used?
                var stubbed = p.stubExports(exports);
                expect(stubbed.func.calledWith).to.be.a('function');
                expect(stubbed.func2.calledWith).to.be.a('function');

                //ORIG TEST CODE
//                p.stubExports(exports);
//                assert.isFunction(exports.func.calledWith);
//                assert.isFunction(exports.func2.calledWith);
            }
        },
//        'p.timeout()': {
//            'exists': function () {
//                assert.isFunction(p.timeout);
//            },
//            'takes one argument (ms)': function () {
//                assert.equals(p.timeout.length, 1);
//            },
//            'returns true if time passed is 100ms or more': function () {
//                var exactLimit = new Date().getTime() - 100,
//                    passedLimit = new Date().getTime() - 200;
//                assert(p.timeout(exactLimit));
//                assert(p.timeout(passedLimit));
//            },
//            'returns false if time passed less than 100ms': function () {
//                var time = new Date().getTime() - 50;
//                buster.refute(p.timeout(time));
//            }
//        },
        '//p.addDepException()': {
            'exists': function () {
                assert(p.addDepException);
            },
            'takes two arguments (array, message)': function () {
                assert.equals(p.addDepException.length, 2);
            },
            'adds message to array if not exists': function () {
                var array = [],
                    message = 'test "name" test';
                p.addDepException(array, message);
                p.addDepException(array, message);
                assert.equals(array, ['name']);
            }
        },
        'p.getTemplate()': {
            'exists': function () {
                assert(p.getTemplate);
            }
        },
        // OBS: This disables auto refresh of tests in browser. //TODO: Find a way to co-exist
        '//p.getTemplateByXhr()': {
            setUp: function () {
                this.fakeServer = sinon.fakeServer.create();
                this.fakeServer.autoRespond = true;
                this.fakeServer.respondWith('GET', 'templates/test.hbs',
                    [200, { "Content-Type": "text/plain" },
                        '<div/>']);
            },
            'exists': function () {
                assert.isFunction(p.getTemplateByXhr);
            },
            'takes one argument (path)': function () {
                assert.equals(p.getTemplateByXhr.length, 1);
            },
            'returns a template function': function () {
                p.Handlebars = {
                    compile: function () {
                        return function () {
                        };
                    }
                };
                assert.isFunction(p.getTemplateByXhr('test'));
                delete p.Handlebars;
            }
        },
        'p.contextToArray()': {
            'is a function': function () {
                expect(p.contextToArray).to.be.a('function');

            },
            'takes on argument (context)': function () {
                assert.equals(p.contextToArray.length, 1);
            },
            'returns a context array in the correct order': function () {
                var require = function () {
                    },
                    privates = {},
                    requireTemplate = function () {
                    };
                assert.equals(p.contextToArray({
                    require: require,
                    privates: privates,
                    resource: requireTemplate
                }), [require, privates, requireTemplate]);
                assert.equals(p.contextToArray({
                    privates: privates,
                    resource: requireTemplate,
                    require: require
                }), [require, privates, requireTemplate]);
                assert.equals(p.contextToArray({
                    resource: requireTemplate,
                    privates: privates,
                    require: require
                }), [require, privates, requireTemplate]);
            }
        },
        'p.isModule()': {
            'is a function': function () {
                expect(p.isModule).to.be.a('function');
            },
            'takes one argument (module)': function () {
                assert.equals(p.isModule.length, 1);
            },
            'returns true if the module is a module-loader module': function () {
                var moduleLoaderModule = new p.Module('hey', function () {
                });
                var otherModule = {
                    aMethod: function () {
                    }
                };
                assert(p.isModule(moduleLoaderModule));
                refute(p.isModule(otherModule));
            }
        },
        'p.sanitizeTemplatesPath()': {
            'is a function': function () {
                expect(p.sanitizeTemplatesPath).to.be.a('function');
            },
            'takes one argument (path)': function () {
                assert.equals(p.sanitizeTemplatesPath.length, 1);
            },
            'removes leading slash': function () {
                expect(p.sanitizeTemplatesPath('/templates/')).to.be('templates/');
            },
            'adds missing trailing slash': function () {
                expect(p.sanitizeTemplatesPath('templates')).to.be('templates/');
            },
            'removes duplicate slashes': function () {
                expect(p.sanitizeTemplatesPath('//templates//')).to.be('templates/');
            },
            'keeps any existing slahes inside path': function () {
                expect(p.sanitizeTemplatesPath('path/to/templates/')).to.be('path/to/templates/');
            }
        },
        '//p.parseModulePath': {
            'exists': function () {
                assert.isFunction(p.parseModulePath);
            },
            'takes on argument (name)': function () {
                assert.equals(p.parseModuleName.length, 1);
            }
        },
        'p.removeFromDependencyLists()': {
            'is a function': function () {
                expect(p.removeFromDependencyLists).to.be.a('function');
            },
            'takes two arguments (resolvedDependency, dependencyGraph)': function () {
                expect(p.removeFromDependencyLists).to.have.length(2);
            },
            'removes a given dependency from dependency list of other modules': function () {
                var testData = [
                    ['a', ['b', 'c']],
                    ['b', ['c']],
                    ['d', []]
                ];
                p.removeFromDependencyLists('c', testData);
                expect(testData).to.eql([
                    ['a', ['b']],
                    ['b', []],
                    ['d', []]
                ]);
            }
        },
        'p.extractFirstLoadableModule()': {
            'is a function': function () {
                expect(p.extractFirstLoadableModule).to.be.a('function');
            },
            'takes one argument (dependencyGraph)': function () {
                expect(p.extractFirstLoadableModule).to.have.length(1);
            },
            'returns first module with no dependencies (looping in positive direction)': function () {
                var testData = [
                    ['a', ['b', 'c']],
                    ['b', ['c']],
                    ['c', []],
                    ['d', []]
                ];
                expect(p.extractFirstLoadableModule(testData)).to.be('c');
            },
            'removes the returned, loadable module from the graph (but not from other modules dependency list)': function () {
                var testData = [
                    ['b', ['c']],
                    ['c', []]
                ];
                p.extractFirstLoadableModule(testData);
                expect(testData).to.eql([
                    ['b', ['c']]
                ]);
            }
        },
        'p.getLoadOrder()': {
            'is a function': function () {
                expect(p.compileLoadOrderFromDependencyGraph).to.be.a('function');
            },
            'takes one argument (dependencyGraph)': function () {
                expect(p.compileLoadOrderFromDependencyGraph).to.have.length(1);
            },
            'returns expected load order': function () {
                var testData = [
                    ['a', ['b', 'c']],
                    ['b', ['c']],
                    ['c', []],
                    ['d', []]
                ];
                expect(p.compileLoadOrderFromDependencyGraph(testData)).to.eql(['c', 'b', 'a', 'd']);
            },
            "throws if load order can't be resolved": function () {
                var testDataWithLoop = [
                    ['a', ['b']],
                    ['b', ['a']]
                ];
                expect(p.compileLoadOrderFromDependencyGraph).withArgs(testDataWithLoop).to.throwError();
            },
            "Alters the argument passed in. Turning it into an empty array if load order is resolved": function () {
                var testData = [
                    ['a', ['b', 'c']],
                    ['b', ['c']],
                    ['c', []],
                    ['d', []]
                ];
                var originalLengthOfTestData = testData.length;
                p.compileLoadOrderFromDependencyGraph(testData);
                expect(p.compileLoadOrderFromDependencyGraph(testData)).to.eql([]);
            }
        }






    });

}());
