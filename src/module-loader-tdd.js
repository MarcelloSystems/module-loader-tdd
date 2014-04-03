/* global global, module, Handlebars, require, console, sinon */
(function () {
    "use strict";

    /*!
     * module-loader-tdd  v.{{ VERSION }}
     */

    var definedModules = [];
    var initializedModules = [];
    var globalTemplates = 'Templates';
//    var tempDepExceptions = [];
    var resourceHandler = null;


    //TODO: Should it throw if dependency does not exist?

    //////////////////////////////////////////////////////////////////////
    // PRIVATES
    var p = {

        // TODO: Should this be moved to the other tests at the top (outside p)?
        Handlebars: typeof Handlebars !== 'undefined' ? Handlebars : null,

        Module: function Module(name, func) {
            this.name = name;
            this.func = func;
        },


        isModule: function (module) {
            return module instanceof p.Module;
        },

        // Throws error with a descriptive prefix
        'throw': function (message) {
            throw Error('MODULE-LOADER-TDD(): ' + message);
        },


        isArray: function (obj) {
            return Object.prototype.toString.call(obj) === '[object Array]';
        },

        createResourceHandler: function (ignoreRegister) {

            var resourceCallbacks = {};

            return {
                register: function (type, callback) {

                    // Do not register resource handling when testing
                    if (ignoreRegister) {
                        return;
                    }

                    resourceCallbacks[type] = function () {
                        return callback.apply(window, event.detail.value);
                    };
                },
                fetch: function (type) {

                    var resource = resourceCallbacks[type];

                    if (!resource) {
                        p.throw('Resource Error: "' + type + '" is not a valid resource');
                    }

                    return resource.apply(window, Array.prototype.slice.call(arguments, 0).splice(1, arguments.length));
                },

                remove: function (name) {// TODO: Unused?
                    if (resourceCallbacks[name]) {
                        delete resourceCallbacks[name];
                    } else {
                        p.throw('Resource Error: Can not remove ' + name + ', it does not exist');
                    }
                },
                teardown: function () {// TODO: Unused?
                    for (var callback in resourceCallbacks) { //TODO: JSHint would like a hasOwnProperty check here. Look into it when it is verified that code works
                        delete resourceCallbacks[callback];
                    }
                }
            };
        },


        /*
         * Retrieve module with the given name from the array of modules
         * */
        getModule: function (name, modules) {
            var module;
            for (var x = 0; x < modules.length; x++) {
                if (modules[x].name === name) {
                    module = modules[x];
                    break;
                }
            }
            if (!module) {
                p.throw('Could not require module: "' + name + '". It might be because the script is not loaded, the name does not exist or you have caused a loop.');
            }
            return module;
        },


        // Adds a module as a Module object to given array
        addModule: function (array, name, func) {
            array.push(new p.Module(name, func));
        },

        // Gives a module a "dependencies" property containing an array with the names of its dependencies.
        populateDependencyProperties: function (definedModules) {
            for (var i = 0, len = definedModules.length; i < len; i += 1) {
                var module = definedModules[i],
                    dependencies = p.extractDependencies(module.func);
                module.dependencies = dependencies;
            }
        },

        // Verifies that there is a corresponding module for all listed dependencies.
        verifyThatAllDependenciesAreMet: function (definedModules) {
            var namesOfRegisteredModules = [];

            // Find name of all modules
            for (var i = 0; i < definedModules.length; i += 1) {
                var moduleName = definedModules[i][0];
                namesOfRegisteredModules.push(moduleName);
            }

            // Look through dependencies for all modules. If a dependency is not in list of registered modules, throw.
            // Note: Stops on first module that has an unmet dependency
            for (var i = 0; i < definedModules.length; i += 1) {
                var dependencies = definedModules[i][1];

                for (var k = 0; k < dependencies.length; k++) {
                    var dependency = dependencies[k];

                    if (namesOfRegisteredModules.indexOf(dependency) === -1) {
                        p.throw('Oops, seems like you forgot to include module "' + dependency + '" that is a dependency of "'+definedModules[i][0]+'"! Include it or check spelling of module names.');
                    }
                }
            }
        },

        // Initializes registered modules.
        // Has a trial-and-error approach that will try another module if one fails, and get back to the first one later.
        sortedInLoadOrder: function (definedModules) {
            var module,
                dependencyGraph = [],
                loadOrder,
                moduleName,
                orderedModules = [], // Array with modules in load order
                modules = {}, // Lookup table for easy access
                i, // Loop index
                len; // Loop boundary


            p.populateDependencyProperties(definedModules);

            // TODO: ? Find and set dependencies on each module as a separate step
            // Populate dependency graph
            for (i = 0, len = definedModules.length; i < len; i += 1) {
                module = definedModules[i];
                dependencyGraph.push([module.name, module.dependencies]);
                modules[module.name] = module;
            }

            p.verifyThatAllDependenciesAreMet(dependencyGraph);

            // Decide load order (Array of module names)
            loadOrder = p.compileLoadOrderFromDependencyGraph(dependencyGraph);

            // Order modules by load order
            for (i = 0, len = loadOrder.length; i < len; i += 1) {
                moduleName = loadOrder[i];
                orderedModules.push(modules[moduleName]);
            }

            return orderedModules;
        },


        loadOrderedModules: function (orderedModules, initialized) {

            for (var i = 0, len = orderedModules.length; i < len; i += 1) {
                var module = orderedModules[i],
                    context = p.createContext(initialized);// Context for a single module

                // TODO: Run apply in try catch block?
                module.exports = context.exports = module.func.apply(context, p.contextToArray(context));

                p.verifyLoadedModule(module);

                initialized.push(module);
            }
        },

        // Verifies that the loaded module returned something to be exposed as "exports"
        verifyLoadedModule: function (module) {
            if (module.exports === undefined) {
                p.throw('Module ' + module.name + ' is returning undefined, it has to return something');
            }
        },


        /*
         * Create the context that will be passed as first argument to apply() when the module body is invoked.
         * */
        createContext: function (modules) {

            var context = {
                privates: {},
                require: function (name) {
                    var module = p.getModule(name, modules);
                    return p.isModule(module) ? module.exports : module; // Return exports only if it is a module-loader module
                },
                resource: resourceHandler
            };

            context.require.template = p.getTemplate;

            return context;
        },

        /*
         * Creates the array that will be passed as second argument to apply.
         * Simply an array version of the object passed as the first argument.
         * */
        contextToArray: function (context) {
            return [context.require, context.privates, context.resource];
        },

        /*
         * Retrieve template with the given path.
         * Either from the ones already compiled, or else by Ajax from server.
         * */
        getTemplate: function (path) {

            if (!p.Handlebars) {
                p.throw('Handlebars is not loaded, please load Handlebars before loading module-loader-tdd');
            }

            // Look for an existing template. One that has already been compiled.
            if (window[globalTemplates] && window[globalTemplates][path]) {
                return window[globalTemplates][path];
            } else {
                return p.getTemplateByXhr(path);
            }
        },

        /*
         * Retrieve template from server
         * */
        getTemplateByXhr: function (path) {
            var xhr = new XMLHttpRequest();
            path = (window.modules.templatesPath || 'templates/') + path + '.hbs';
            xhr.open('GET', path, false);
            xhr.send(null);

            if (xhr.status !== 200) {
                p.throw('Could not download requested template at: ' + path + ' , it probably does not exist, check the name');
            }

            return p.Handlebars.compile(xhr.responseText);
        },


        /*
         * Sanitize path
         * */
        sanitizeTemplatesPath: function (path) {
            path = path + '/'; // Ensure trailing slash (might add a duplicate, but that's removed next)
            path = path.replace(/\/+/g, '/'); // Remove any duplicate slashes
            return path.replace(/^\//, ''); // Remove any leading slash
        },


        //-----------------------TEST RELATED--------------------------


        // NEW
        loadForTest: function (nameOfModuleToBeTested, orderedModules, initialized) {
            var module,
                context;

            // Load modules one by one until the test subject (named "name") is encountered. Load it and return its context.
            for (var i = 0, len = orderedModules.length; i < len; i += 1) {
                module = orderedModules[i];
                context = p.createTestContext(initialized);

                // Load module and store what it returns (exports)
                module.exports = context.exports = module.func.apply(context, p.contextToArray(context));

                p.verifyLoadedModule(module);
                initialized.push(module); //TODO: Too early to do this here?

                // Store context for test subjects and stub for all other modules
                if (module.name === nameOfModuleToBeTested) {

                    p.addDepsProperty(context, module.dependencies, initialized);

                    return context; // End here as our test subject is now ready.
                }
            }
        },


        addDepsProperty: function (context, dependencies, initialized) {
            for (var i = 0, len = dependencies.length; i < len; i += 1) {
                var moduleName = dependencies[i];
                var dependency = p.getModule(moduleName, initialized);
                context.deps[moduleName] = dependency.exports;
            }
        },


        createTestContext: function (modules) {
            var context = {
                privates: {},
                deps: {},
                resource: resourceHandler
            };
            context.require = p.createTestRequireMethod(context, modules);

            // Template loading is unavavilable during testing
            context.require.template = function () {
                return function () {
                    return '';
                };
            };

            return context;
        },

        // Creates the require method used during testing where dependencies are treated with sinon and templates are unavailable.
        createTestRequireMethod: function (context, modules) {

            return function (name) {

                var depModule = p.getModule(name, modules), // The module we depend on
                    depContext = { // Contex of the module we depend on
                        privates: {},
                        require: function (name) { // TODO (CJ): Make this more general with registerModule

                            var module = p.getModule(name, modules);
                            module = module.func.apply(context, p.contextToArray(context));

                            return p.isModule(module) ? module.exports : module; // Return exports only if it is a module-loader module
                        }
                    };

                depContext.exports = p.isModule(depModule) ? depModule.func.apply(depContext, p.contextToArray(depContext)) : depModule;

                // Adds the dependency exports to the main context
                // which lets you edit the stubs in the test
                depModule.exports = p.stubExports(depContext.exports);
                context.deps[name] = depModule.exports;

                return depModule.exports;
            };
        },


        /*
         * Substitute dependencies with spy or stubs
         * */
        stubExports: function (exports) {
            var sinon = window.sinon,
                stubbedMethods = {};

            if (!sinon) {
                return exports; // Some users might wish to run without sinon.
            }

            // Return a spy as substitute for a function dependency
            if (typeof exports === 'function') {
                return sinon.spy();
            }

            // Return object with stubbed methods if dependency is an object
            for (var depMethod in exports) { // TODO: Consider adding hasOwnProperty() check
                if (typeof exports[depMethod] === 'function') {
                    stubbedMethods[depMethod] = exports[depMethod];
                    sinon.stub(stubbedMethods, depMethod);
                }
            }
            return stubbedMethods;
        },


        //-----------------------DECIDE MODULE DEPENDENCIES--------------------------

        /*
         * Extract names of dependencies defined in the module passed in.
         * Returns array of dependency names (module names)
         * */
        extractDependencies: function (module) {
            var moduleAsString = '(' + module.toString() + ')',// Wrap in parenthesis for the parser,
                parser = window.acorn, // Javascript parser used to generate an AST
                ast, // Abstract Syntax Tree representing the module
                nameOfRequireArg,// Name of the function used to import dependencies.
                dependencyData,
                initialMemo = {dependencies: [], currentBlock: 0, blacklist: []}; // Memo (/accumulator) used when traversing AST

            if (!parser) {
                throw "Parser not found! Please include acorn (http://marijnhaverbeke.nl/acorn/)";
            }

            ast = parser.parse(moduleAsString);

            // Look for require argument in the function wrapping the module
            if (ast.body[0].expression.type === "FunctionExpression" && ast.body[0].expression.params.length) {
                nameOfRequireArg = ast.body[0].expression.params[0].name; // First arg to function wrapping the module is the require function
            } else {
                // No require arg => No dependencies => Return early
                return [];
            }

            // Extract dependency data from AST using a node inspector created for our current require arg
            dependencyData = p.traverse(ast, p.nodeInspector(nameOfRequireArg), initialMemo);

            return p.compileDependencies(dependencyData);
        },


        /*
         * Traverse an Abstract Syntax Tree, calling inspector with each node and accumulation data in memo.
         * http://sevinf.github.io/blog/2012/09/29/esprima-tutorial/
         * */
        traverse: function traverse(node, inspector, memo) {
//        console.log(memo.currentBlock, "TYPE:", node.type, node.name || node.value || '');
            var currentBlock, // Store current block for current scope (as we dig deeper)
                result = inspector(memo, node);

            // inspector returns null to signal that we should ignore node properties (children).
            if (result === null) {
                return;
            }

            // Loop though all properties / child nodes..
            for (var key in node) {

                // ..but skip inherited ones
                if (node.hasOwnProperty(key)) {

                    var child = node[key];
                    if (typeof child === 'object' && child !== null) {

                        // Store the current block id before traversing children
                        currentBlock = memo.currentBlock;

                        // Traverse child based on whether it's an array of sub-nodes or a single one
                        if (Array.isArray(child)) {
//                        if (p.isArray(child)) {

                            child.forEach(function (node) {
                                traverse(node, inspector, memo);
                            });

                        } else {
                            traverse(child, inspector, memo);
                        }
                        // Restore current block back to where we left off before descending into children
                        memo.currentBlock = currentBlock;
                    }
                }
            }
            // Return what we have accumulated in memo as the final result
            return memo;
        },


        /*
         * Creates a function that will inspect a node looking for conflicts with the passed nameOfRequireArg
         * */
        nodeInspector: function (nameOfRequireArg) {
            return function (memo, node) {

                if (node.type === "BlockStatement") {
                    memo.currentBlock = node.start;
                }

                // Look for reasons to stop parsing child nodes

                if (node.type === "FunctionDeclaration") {

                    // Stop if name of function corresponds to name of our require arg.
                    if (node.id.name === nameOfRequireArg) {
                        memo.blacklist.push(memo.currentBlock); // Ignore the scope the both current scope and..
                        return null;
                    }

                    // Stop if any of the function's argument names corresponds to name of our require arg.
                    // But don't blacklist current scope as these arguments applies to the next block and
                    // that will be skipped by returning null here
                    for (var i = 0, len = node.params.length; i < len; i += 1) {
                        if (node.params[i].name === nameOfRequireArg) {
                            return null;
                        }
                    }
                }

                // Check variable declarations
                if (node.type === "VariableDeclarator" && node.id.name === nameOfRequireArg) {
                    memo.blacklist.push(memo.currentBlock);
                    return null;
                }


                // Now extract any dependencies
                if (node.type === "CallExpression") {
                    if (node.callee.name === nameOfRequireArg && node['arguments'][0].type === "Literal") {
                        var dep = node['arguments'][0].value;
                        memo.dependencies.push([dep, memo.currentBlock]);
                    }
                }
            };
        },

        /*
         * Compile an array of dependencies from the result of traversing the AST.
         * */
        compileDependencies: function (dependencyData) {
            var foundDependencies = dependencyData.dependencies,// Array of arrays where each entry has format [dependency, block id]
                blacklist = dependencyData.blacklist, // Array of black listed block ids
                dependencies = [];

            // Keep dependencies that were not extracted from a blacklisted block
            for (var i = 0, len = foundDependencies.length; i < len; i += 1) {
                if (blacklist.indexOf(foundDependencies[i][1]) === -1) {
                    dependencies.push(foundDependencies[i][0]);
                }
            }
//            console.log(dependencies);
            return dependencies;
        },


        //-----------------------MODULE LOAD ORDER--------------------------

        /*
         * Remove a given dependency (module name) from dependency lists of all remaining modules
         * */
        removeFromDependencyLists: function (resolvedDependency, dependencyGraph) {

            // Looping all modules
            for (var i = 0, len = dependencyGraph.length; i < len; i += 1) {

                // Loop all dependencies for a module. Backwards to not affect looping when removing elements
                for (var dep = dependencyGraph[i][1].length - 1; dep > -1; dep -= 1) {

                    // Remove dependency if it matches the resolved one
                    if (dependencyGraph[i][1][dep] === resolvedDependency) {
                        dependencyGraph[i][1].splice(dep, 1); // Remove the resolved dependency from this modules dependency list
                    }
                }
            }
        },


        //TODO: Probably need a deep-copy routine as compileLoadOrderFromDependencyGraph alters its input.
        /*
         * Get load order for provided dependency graph.
         * Input is a nested array: [[moduleName, [depA, depB]], [moduleName, [depA, depB]]]
         *
         * Note1: Throws if order can't be resolved!
         * Note2: Alters the provided graph!
         * */
        compileLoadOrderFromDependencyGraph: function (dependencyGraph) {
            var loadOrder = [];
//TODO: Improve error reporting when all scripts are not imported in index.html (or similar). The issue that arises is that extractFirstLoadableModule() fails as there is no obvious new to pick as some are missing and one of them would be the next to load.
            // Loop modules once. Using length of dependencyGraph as modules are being removed for each loadable module.
            while (dependencyGraph.length) {
                var loadable = p.extractFirstLoadableModule(dependencyGraph);

                if (!loadable) {
                    throw("Unable to resolve dependencies! Got this far in resolving load order: " + loadOrder);
                }

                loadOrder.push(loadable);
                p.removeFromDependencyLists(loadable, dependencyGraph);
            }
            return loadOrder;
        },

        /*
         * Return first module with no dependencies and deletes its entry in the graph.
         * Note: It is not deleted from the dependency list of other modules.
         * */
        extractFirstLoadableModule: function (dependencyGraph) {

            // Loop through all modules
            for (var i = 0, len = dependencyGraph.length; i < len; i += 1) {

                // Remove module and return its name if it has no dependencies
                if (dependencyGraph[i][1].length === 0) {
                    var moduleName = dependencyGraph[i][0];
                    dependencyGraph.splice(i, 1); // Removes this module
                    return moduleName;
                }
            }
        }

    };

    //////////////////////////////////////////////////////////////////////
    // PUBLIC

    var publicInterface = {
        _privates: p,

        /*
         * The public method used to create a new module
         * first argument is name as a string
         * Second argument is the function that will create the module
         * */
        create: function (name, func) {

            // Verify that user has provided module name and body as expected
            if (!name || typeof name !== 'string' || !func || typeof func !== 'function') {
                p.throw('Invalid arguments for module creation, you have to pass a string and a function');
            }

            // Add it to list of defined modules awaiting initialization.
            p.addModule(definedModules, name, func);
        },

        /*
         * The public method used to initialize all added modules. Typically called inside <script> in index.html or in main.js
         * "callback" is the code the user wants to run first when modules are ready.
         * */
        initialize: function (callback) {

            if (this.templatesPath) {
                this.templatesPath = p.sanitizeTemplatesPath(this.templatesPath);
            }
            if (this.templates) {
                globalTemplates = this.templates;
            }

            resourceHandler = p.createResourceHandler();

            // Arm events that signals ready-for-init
            document.addEventListener("DOMContentLoaded", init);
            document.addEventListener("deviceready", init);


            // Perform final init and execute users init code in the callback
            function init() {
                document.removeEventListener("DOMContentLoaded", init);
                document.removeEventListener("deviceready", init);

                var orderedModules = p.sortedInLoadOrder(definedModules);
                p.loadOrderedModules(orderedModules, initializedModules);

                var context = p.createContext(initializedModules);
                callback.apply(context, p.contextToArray(context));
            }
        },

        /*
         * Test a given module
         * */
        test: function (name, callback) {

            resourceHandler = p.createResourceHandler(true); // To prevent modules from registering resource //TODO MK: Why is this created here while also being called in apply below?

            var orderedModules = p.sortedInLoadOrder(definedModules);

            // Load modules, getting the context for the test subject in return to use for invoking the callback below
            var context = p.loadForTest(name, orderedModules, initializedModules);

            // Args to apply: context, [module under test, privates, dependencies, resource]
            callback.apply(context, [context.exports, context.privates, context.deps, p.createResourceHandler(false)]);
        },


        reset: function () {
            initializedModules = [];
            definedModules = [];
        }
    };


    // Expose module to environment
    window.modules = publicInterface;
}());